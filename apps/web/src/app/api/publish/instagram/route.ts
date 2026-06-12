import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { publishInstagramJob } from '@/lib/publish/instagram';

export const runtime = 'nodejs';
export const maxDuration = 300;

// POST /api/publish/instagram  Body: { jobId: string }
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

  const result = await publishInstagramJob(jobId, user.id);
  if (result.ok) return Response.json({ success: true, platform_url: result.platformUrl });
  return Response.json({ error: result.error }, { status: result.status });
}
