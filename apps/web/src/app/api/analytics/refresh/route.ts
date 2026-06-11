import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import sql from '@/app/api/utils/sql';
import { getFreshTikTokToken } from '@/app/api/utils/tiktok';
import { fetchTikTokVideos, JobToMatch, matchVideosToJobs } from '@/lib/analytics/tiktok';

// POST /api/analytics/refresh — pull fresh TikTok stats for the user's
// published posts and store them on publish_jobs. Best-effort: posts are
// matched to videos by publish-time proximity (the Content Posting API
// doesn't expose the public video id).
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'analytics.refresh', {
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  const token = await getFreshTikTokToken(user.id);
  if (!token) {
    return Response.json({ error: 'Connect TikTok to sync analytics.' }, { status: 403 });
  }

  const published = await sql`
    SELECT id, published_at FROM publish_jobs
    WHERE user_id = ${user.id} AND platform = 'TikTok' AND status = 'published'
      AND published_at IS NOT NULL
    ORDER BY published_at DESC
    LIMIT 50
  `;
  if (published.length === 0) {
    return Response.json({ updated: 0 });
  }

  let videos;
  try {
    videos = await fetchTikTokVideos(token);
  } catch (err) {
    console.error('TikTok analytics fetch failed:', err);
    return Response.json(
      {
        error:
          'Could not fetch TikTok stats. Reconnect TikTok with analytics permission and try again.',
      },
      { status: 502 }
    );
  }

  const jobs: JobToMatch[] = published.map((p) => ({
    jobId: p.id as string,
    publishedAtSec: Math.floor(new Date(p.published_at as string).getTime() / 1000),
  }));

  const matched = matchVideosToJobs(jobs, videos);
  let updated = 0;
  for (const [jobId, stats] of matched) {
    await sql`
      UPDATE publish_jobs SET
        views = ${stats.views}, likes = ${stats.likes},
        comments = ${stats.comments}, shares = ${stats.shares},
        analytics_updated_at = NOW()
      WHERE id = ${jobId} AND user_id = ${user.id}
    `;
    updated++;
  }

  return Response.json({ updated });
}
