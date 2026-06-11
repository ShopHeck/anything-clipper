import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

// GET /api/analytics — aggregate posted-clip performance for the signed-in
// user, plus per-post rows. Numbers come straight from publish_jobs (populated
// by /api/analytics/refresh); never fabricated.
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const [totals] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'published')      AS published_count,
        COALESCE(SUM(views), 0)                           AS views,
        COALESCE(SUM(likes), 0)                           AS likes,
        COALESCE(SUM(comments), 0)                        AS comments,
        COALESCE(SUM(shares), 0)                          AS shares
      FROM publish_jobs
      WHERE user_id = ${user.id}
    `;

    const posts = await sql`
      SELECT pj.id, pj.platform, pj.platform_url, pj.published_at,
             pj.views, pj.likes, pj.comments, pj.shares, pj.analytics_updated_at,
             c.title AS clip_title
      FROM publish_jobs pj
      LEFT JOIN clips c ON c.id = pj.clip_id AND c.project_id = pj.project_id
      WHERE pj.user_id = ${user.id} AND pj.status = 'published'
      ORDER BY pj.published_at DESC NULLS LAST
      LIMIT 100
    `;

    return Response.json({
      totals: {
        publishedCount: Number(totals?.published_count ?? 0),
        views: Number(totals?.views ?? 0),
        likes: Number(totals?.likes ?? 0),
        comments: Number(totals?.comments ?? 0),
        shares: Number(totals?.shares ?? 0),
      },
      posts,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return Response.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
