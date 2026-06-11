// TikTok publish core, shared by the interactive route and the scheduler.
// Always posts the RENDERED (trimmed) clip — never the raw source.
import sql from '@/app/api/utils/sql';
import { getFreshTikTokToken, getTikTokConnection } from '@/app/api/utils/tiktok';

export interface PublishResult {
  ok: boolean;
  status: number;
  platformUrl?: string;
  error?: string;
}

// Publish a single job belonging to `userId`. Updates publish_jobs throughout.
export async function publishTikTokJob(jobId: string, userId: string): Promise<PublishResult> {
  const [row] = await sql`
    SELECT
      pj.id            AS job_id,
      pj.caption,
      pj.hashtags,
      pj.platform,
      pj.status        AS job_status,
      c.title          AS clip_title,
      c.rendered_url
    FROM publish_jobs pj
    JOIN clips    c ON c.id = pj.clip_id AND c.project_id = pj.project_id
    JOIN projects p ON p.id = pj.project_id
    WHERE pj.id = ${jobId} AND pj.user_id = ${userId} AND p.user_id = ${userId}
    LIMIT 1
  `;

  if (!row) return { ok: false, status: 404, error: 'Publish job not found' };
  if (row.platform !== 'TikTok') {
    return { ok: false, status: 400, error: 'This job is not a TikTok job' };
  }
  if (row.job_status === 'published') {
    return { ok: false, status: 409, error: 'Already published' };
  }
  if (!row.rendered_url) {
    return {
      ok: false,
      status: 422,
      error:
        'This clip has not been rendered yet. Export the clip first so the trimmed video — not the full source — gets posted.',
    };
  }

  await sql`UPDATE publish_jobs SET status = 'processing', error_msg = NULL WHERE id = ${jobId}`;

  const accessToken = await getFreshTikTokToken(userId);
  if (!accessToken) {
    await sql`UPDATE publish_jobs SET status = 'failed', error_msg = 'No TikTok connection found' WHERE id = ${jobId}`;
    return { ok: false, status: 403, error: 'TikTok not connected' };
  }

  const hashtags: string[] = Array.isArray(row.hashtags) ? row.hashtags : [];
  const hashtagStr = hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const fullCaption = [row.caption || row.clip_title || 'Check this out!', hashtagStr]
    .filter(Boolean)
    .join(' ')
    .slice(0, 2200);

  // Initiate the PULL_FROM_URL post.
  let publishId: string;
  try {
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: fullCaption,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: row.rendered_url },
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok || initData.error?.code !== 'ok') {
      const errMsg = initData.error?.message ?? initData.error?.code ?? `HTTP ${initRes.status}`;
      await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${errMsg} WHERE id = ${jobId}`;
      return { ok: false, status: 502, error: errMsg };
    }
    publishId = initData.data?.publish_id;
    if (!publishId) {
      await sql`UPDATE publish_jobs SET status = 'failed', error_msg = 'No publish_id returned' WHERE id = ${jobId}`;
      return { ok: false, status: 502, error: 'TikTok did not return a publish_id' };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error calling TikTok';
    await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${msg} WHERE id = ${jobId}`;
    return { ok: false, status: 502, error: msg };
  }

  // Poll for completion (max 90s).
  let postUrl: string | null = null;
  let errorMsg: string | null = null;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    try {
      const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
      });
      const statusData = await statusRes.json();
      const status = statusData.data?.status as string | undefined;

      if (status === 'PUBLISH_COMPLETE') {
        const conn = await getTikTokConnection(userId);
        postUrl = conn?.username
          ? `https://www.tiktok.com/@${conn.username}`
          : 'https://www.tiktok.com';
        await sql`
          UPDATE publish_jobs SET status = 'published', platform_url = ${postUrl},
            published_at = NOW(), error_msg = NULL
          WHERE id = ${jobId}
        `;
        return { ok: true, status: 200, platformUrl: postUrl };
      }
      if (status === 'FAILED') {
        errorMsg = statusData.data?.fail_reason ?? 'TikTok processing failed';
        break;
      }
    } catch (pollErr) {
      console.error(`Poll attempt ${i + 1} error:`, pollErr);
    }
  }

  const msg = errorMsg ?? 'TikTok did not finish processing within timeout';
  await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${msg} WHERE id = ${jobId}`;
  return { ok: false, status: 502, error: msg };
}
