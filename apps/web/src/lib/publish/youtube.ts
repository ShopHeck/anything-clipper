// YouTube Shorts publish adapter. OAuth tokens live in platform_connections
// (platform='YouTube'); publishing uploads the rendered clip via the Data API
// resumable protocol. Network paths are gated on GOOGLE_CLIENT_ID/SECRET so
// the feature is inert without configuration.
import { getConnection, saveTokens, tokenExpiringSoon } from '@/app/api/utils/connections';
import sql from '@/app/api/utils/sql';
import { buildYouTubeMetadata } from './dispatch';
import { PublishResult } from './tiktok';

export function youTubeConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Refresh the user's YouTube access token if it's near expiry. Returns a valid
// token or null.
export async function getFreshYouTubeToken(userId: string): Promise<string | null> {
  const conn = await getConnection(userId, 'YouTube');
  if (!conn) return null;
  if (!tokenExpiringSoon(conn) || !conn.refresh_token) return conn.access_token;
  if (!youTubeConfigured()) return conn.access_token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  });
  if (!res.ok) {
    console.error('YouTube token refresh failed:', res.status);
    return conn.access_token;
  }
  const data = await res.json();
  if (!data.access_token) return conn.access_token;
  await saveTokens(userId, 'YouTube', {
    accessToken: data.access_token,
    expiresInSec: data.expires_in,
  });
  return data.access_token as string;
}

export async function publishYouTubeJob(jobId: string, userId: string): Promise<PublishResult> {
  if (!youTubeConfigured()) {
    return { ok: false, status: 501, error: 'YouTube publishing is not configured.' };
  }

  const [row] = await sql`
    SELECT pj.id, pj.caption, pj.hashtags, pj.platform, pj.status AS job_status,
           c.title AS clip_title, c.rendered_url
    FROM publish_jobs pj
    JOIN clips    c ON c.id = pj.clip_id AND c.project_id = pj.project_id
    JOIN projects p ON p.id = pj.project_id
    WHERE pj.id = ${jobId} AND pj.user_id = ${userId} AND p.user_id = ${userId}
    LIMIT 1
  `;
  if (!row) return { ok: false, status: 404, error: 'Publish job not found' };
  if (row.platform !== 'YouTube') {
    return { ok: false, status: 400, error: 'This job is not a YouTube job' };
  }
  if (row.job_status === 'published') return { ok: false, status: 409, error: 'Already published' };
  if (!row.rendered_url) {
    return {
      ok: false,
      status: 422,
      error: 'This clip has not been rendered yet. Export the clip first.',
    };
  }

  await sql`UPDATE publish_jobs SET status = 'processing', error_msg = NULL WHERE id = ${jobId}`;

  const token = await getFreshYouTubeToken(userId);
  if (!token) {
    await sql`UPDATE publish_jobs SET status = 'failed', error_msg = 'No YouTube connection' WHERE id = ${jobId}`;
    return { ok: false, status: 403, error: 'YouTube not connected' };
  }

  const meta = buildYouTubeMetadata(row.clip_title, row.caption, row.hashtags);

  try {
    // Fetch the rendered clip bytes (clips are short, so buffering is fine).
    const videoRes = await fetch(row.rendered_url as string);
    if (!videoRes.ok) throw new Error(`Could not fetch rendered clip (${videoRes.status})`);
    const videoBytes = Buffer.from(await videoRes.arrayBuffer());

    // 1) Start a resumable upload session with the snippet/status metadata.
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(videoBytes.length),
        },
        body: JSON.stringify({
          snippet: { title: meta.title, description: meta.description },
          status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
        }),
      }
    );
    if (!initRes.ok) {
      throw new Error(`YouTube upload init failed (${initRes.status})`);
    }
    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) throw new Error('YouTube did not return an upload URL');

    // 2) Upload the bytes.
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(videoBytes.length) },
      body: videoBytes,
    });
    if (!uploadRes.ok) {
      throw new Error(`YouTube upload failed (${uploadRes.status})`);
    }
    const uploaded = await uploadRes.json();
    const videoId = uploaded.id as string | undefined;
    if (!videoId) throw new Error('YouTube did not return a video id');

    const postUrl = `https://www.youtube.com/shorts/${videoId}`;
    await sql`
      UPDATE publish_jobs SET status = 'published', platform_url = ${postUrl},
        published_at = NOW(), error_msg = NULL
      WHERE id = ${jobId}
    `;
    return { ok: true, status: 200, platformUrl: postUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'YouTube upload error';
    await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${msg} WHERE id = ${jobId}`;
    return { ok: false, status: 502, error: msg };
  }
}
