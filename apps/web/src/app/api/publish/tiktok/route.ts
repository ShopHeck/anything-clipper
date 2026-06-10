import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';
import { getFreshTikTokToken, getTikTokConnection } from '@/app/api/utils/tiktok';

/**
 * POST /api/publish/tiktok
 * Body: { jobId: string }
 *
 * Full flow:
 *  1. Load the caller's publish job + clip + project
 *  2. Load the caller's TikTok connection — auto-refresh token if near expiry
 *  3. Initiate TikTok PULL_FROM_URL post with the RENDERED clip (never the
 *     raw source video)
 *  4. Poll publish status until complete or failed (max 90 s)
 *  5. Save result back to publish_jobs
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  let jobId: string;
  try {
    const body = await request.json();
    jobId = body.jobId;
    if (!jobId) throw new Error('jobId required');
  } catch {
    return Response.json({ error: 'jobId is required' }, { status: 400 });
  }

  // ── 1. Load job, clip, and project (caller's only) ───────
  const [row] = await sql`
    SELECT
      pj.id            AS job_id,
      pj.clip_id,
      pj.project_id,
      pj.caption,
      pj.hashtags,
      pj.platform,
      pj.status        AS job_status,
      c.title          AS clip_title,
      c.start_time,
      c.end_time,
      c.rendered_url
    FROM publish_jobs pj
    JOIN clips    c ON c.id = pj.clip_id AND c.project_id = pj.project_id
    JOIN projects p ON p.id = pj.project_id
    WHERE pj.id = ${jobId} AND pj.user_id = ${user.id} AND p.user_id = ${user.id}
    LIMIT 1
  `;

  if (!row) {
    return Response.json({ error: 'Publish job not found' }, { status: 404 });
  }

  if (row.platform !== 'TikTok') {
    return Response.json({ error: 'This endpoint only handles TikTok jobs' }, { status: 400 });
  }

  if (row.job_status === 'published') {
    return Response.json({ error: 'Already published' }, { status: 409 });
  }

  // Guard: only the rendered, trimmed MP4 may be posted. Publishing the raw
  // source would upload the entire original video instead of the clip.
  if (!row.rendered_url) {
    return Response.json(
      {
        error:
          'This clip has not been rendered yet. Export the clip first so the trimmed video — not the full source — gets posted.',
      },
      { status: 422 }
    );
  }

  // Mark as processing
  await sql`UPDATE publish_jobs SET status = 'processing', error_msg = NULL WHERE id = ${jobId}`;

  // ── 2. Load & maybe refresh the caller's TikTok token ────
  const accessToken = await getFreshTikTokToken(user.id);
  if (!accessToken) {
    await sql`UPDATE publish_jobs SET status = 'failed', error_msg = 'No TikTok connection found' WHERE id = ${jobId}`;
    return Response.json({ error: 'TikTok not connected' }, { status: 403 });
  }

  // ── 3. Build caption + hashtags ──────────────────────────
  const hashtags: string[] = Array.isArray(row.hashtags) ? row.hashtags : [];
  const hashtagStr = hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const fullCaption = [row.caption || row.clip_title || 'Check this out!', hashtagStr]
    .filter(Boolean)
    .join(' ')
    .slice(0, 2200); // TikTok caption limit

  // ── 4. Initiate TikTok video post ────────────────────────
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
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: row.rendered_url,
        },
      }),
    });

    const initData = await initRes.json();

    if (!initRes.ok || initData.error?.code !== 'ok') {
      const errMsg = initData.error?.message ?? initData.error?.code ?? `HTTP ${initRes.status}`;
      console.error('TikTok init failed:', initData);
      await sql`
        UPDATE publish_jobs SET status = 'failed', error_msg = ${errMsg} WHERE id = ${jobId}
      `;
      return Response.json({ error: errMsg }, { status: 502 });
    }

    publishId = initData.data?.publish_id;
    if (!publishId) {
      await sql`UPDATE publish_jobs SET status = 'failed', error_msg = 'No publish_id returned' WHERE id = ${jobId}`;
      return Response.json({ error: 'TikTok did not return a publish_id' }, { status: 502 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error calling TikTok';
    console.error('TikTok init error:', err);
    await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${msg} WHERE id = ${jobId}`;
    return Response.json({ error: msg }, { status: 502 });
  }

  // ── 5. Poll for completion (max 90 s, 6 s intervals) ─────
  const MAX_POLLS = 15;
  let postUrl: string | null = null;
  let finalStatus: 'published' | 'failed' = 'failed';
  let errorMsg: string | null = null;

  for (let i = 0; i < MAX_POLLS; i++) {
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
        finalStatus = 'published';
        // TikTok doesn't return the post URL directly — construct profile link
        const conn = await getTikTokConnection(user.id);
        postUrl = conn?.username
          ? `https://www.tiktok.com/@${conn.username}`
          : 'https://www.tiktok.com';
        break;
      }

      if (status === 'FAILED') {
        errorMsg = statusData.data?.fail_reason ?? 'TikTok processing failed';
        break;
      }

      // statuses like PROCESSING_UPLOAD, PROCESSING_DOWNLOAD etc — keep polling
    } catch (pollErr) {
      console.error(`Poll attempt ${i + 1} error:`, pollErr);
    }
  }

  // ── 6. Save final result ──────────────────────────────────
  if (finalStatus === 'published') {
    await sql`
      UPDATE publish_jobs SET
        status       = 'published',
        platform_url = ${postUrl},
        published_at = NOW(),
        error_msg    = NULL
      WHERE id = ${jobId}
    `;
    return Response.json({ success: true, platform_url: postUrl });
  } else {
    const msg = errorMsg ?? 'TikTok did not finish processing within timeout';
    await sql`
      UPDATE publish_jobs SET status = 'failed', error_msg = ${msg} WHERE id = ${jobId}
    `;
    return Response.json({ error: msg }, { status: 502 });
  }
}
