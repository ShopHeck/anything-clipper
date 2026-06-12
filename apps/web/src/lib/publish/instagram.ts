// Instagram Reels publish adapter via the Instagram Graph API. Requires a
// Facebook app + an Instagram Business/Creator account linked to a Page.
// The connection stores the long-lived token (access_token) and the IG
// business account id (open_id). Gated on FACEBOOK_APP_ID/SECRET so it's
// inert without configuration.
import { getConnection } from '@/app/api/utils/connections';
import sql from '@/app/api/utils/sql';
import { buildCaption } from './dispatch';
import { PublishResult } from './tiktok';

const GRAPH = 'https://graph.facebook.com/v21.0';

export function instagramConfigured(): boolean {
  return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

export async function publishInstagramJob(jobId: string, userId: string): Promise<PublishResult> {
  if (!instagramConfigured()) {
    return { ok: false, status: 501, error: 'Instagram publishing is not configured.' };
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
  if (row.platform !== 'Instagram') {
    return { ok: false, status: 400, error: 'This job is not an Instagram job' };
  }
  if (row.job_status === 'published') return { ok: false, status: 409, error: 'Already published' };
  if (!row.rendered_url) {
    return {
      ok: false,
      status: 422,
      error: 'This clip has not been rendered yet. Export the clip first.',
    };
  }

  const conn = await getConnection(userId, 'Instagram');
  // open_id holds the IG business account id (set during OAuth).
  const igUserId = (conn as unknown as { open_id?: string })?.open_id;
  if (!conn || !igUserId) {
    return { ok: false, status: 403, error: 'Instagram not connected' };
  }

  await sql`UPDATE publish_jobs SET status = 'processing', error_msg = NULL WHERE id = ${jobId}`;
  const token = conn.access_token;
  const caption = buildCaption(row.clip_title, row.caption, row.hashtags, 2200);

  try {
    // 1) Create a REELS media container pointing at the rendered clip.
    const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: row.rendered_url,
        caption,
        access_token: token,
      }),
    });
    const createData = await createRes.json();
    const creationId = createData.id as string | undefined;
    if (!createRes.ok || !creationId) {
      const msg = createData.error?.message ?? `Container create failed (${createRes.status})`;
      await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${msg} WHERE id = ${jobId}`;
      return { ok: false, status: 502, error: msg };
    }

    // 2) Poll the container until the upload finishes processing (max ~90s).
    let ready = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 6000));
      const statusRes = await fetch(
        `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`
      );
      const statusData = await statusRes.json();
      const code = statusData.status_code as string | undefined;
      if (code === 'FINISHED') {
        ready = true;
        break;
      }
      if (code === 'ERROR') {
        await sql`UPDATE publish_jobs SET status = 'failed', error_msg = 'Instagram could not process the video' WHERE id = ${jobId}`;
        return { ok: false, status: 502, error: 'Instagram could not process the video' };
      }
    }
    if (!ready) {
      await sql`UPDATE publish_jobs SET status = 'failed', error_msg = 'Instagram processing timed out' WHERE id = ${jobId}`;
      return { ok: false, status: 502, error: 'Instagram processing timed out' };
    }

    // 3) Publish the container.
    const pubRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    });
    const pubData = await pubRes.json();
    const mediaId = pubData.id as string | undefined;
    if (!pubRes.ok || !mediaId) {
      const msg = pubData.error?.message ?? `Publish failed (${pubRes.status})`;
      await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${msg} WHERE id = ${jobId}`;
      return { ok: false, status: 502, error: msg };
    }

    // 4) Fetch the permalink for the post URL.
    let postUrl = 'https://www.instagram.com';
    try {
      const permaRes = await fetch(
        `${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`
      );
      if (permaRes.ok) {
        const permaData = await permaRes.json();
        if (permaData.permalink) postUrl = permaData.permalink;
      }
    } catch {
      /* non-fatal */
    }

    await sql`
      UPDATE publish_jobs SET status = 'published', platform_url = ${postUrl},
        published_at = NOW(), error_msg = NULL
      WHERE id = ${jobId}
    `;
    return { ok: true, status: 200, platformUrl: postUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Instagram publish error';
    await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${msg} WHERE id = ${jobId}`;
    return { ok: false, status: 502, error: msg };
  }
}
