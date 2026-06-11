import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { publishTikTokJob } from '@/lib/publish/tiktok';

/**
 * POST /api/publish/tiktok  Body: { jobId: string }
 *
 * Publishes the caller's rendered clip to TikTok (PULL_FROM_URL). The full
 * flow — auth-scoped job load, token refresh, init, status polling — lives in
 * lib/publish/tiktok so the scheduler can reuse it.
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

  const result = await publishTikTokJob(jobId, user.id);
  if (result.ok) {
    return Response.json({ success: true, platform_url: result.platformUrl });
  }
  return Response.json({ error: result.error }, { status: result.status });
}
