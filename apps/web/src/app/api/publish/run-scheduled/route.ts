import sql from '@/app/api/utils/sql';
import { publishTikTokJob } from '@/lib/publish/tiktok';

export const runtime = 'nodejs';
export const maxDuration = 300;

// POST /api/publish/run-scheduled
// Processes publish jobs whose scheduled_at is due. Protected by the worker
// secret — invoked by scripts/publish-scheduler.mjs or a cron trigger, not
// by end users. Each job carries its own user_id, so publishing stays scoped.
export async function POST(request: Request) {
  const secret = process.env.RENDER_WORKER_SECRET;
  if (!secret || request.headers.get('x-render-worker-secret') !== secret) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Claim a small batch of due jobs atomically so concurrent runners don't
  // double-post the same job.
  const due = await sql`
    UPDATE publish_jobs
    SET status = 'processing'
    WHERE id IN (
      SELECT id FROM publish_jobs
      WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 5
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, user_id, platform
  `;

  const results: Array<{ jobId: string; ok: boolean; error?: string }> = [];
  for (const job of due) {
    if (job.platform !== 'TikTok') {
      await sql`UPDATE publish_jobs SET status = 'failed', error_msg = ${'Scheduled publishing for ' + job.platform + ' is not available yet'} WHERE id = ${job.id}`;
      results.push({ jobId: job.id, ok: false, error: 'unsupported platform' });
      continue;
    }
    const result = await publishTikTokJob(job.id, job.user_id);
    results.push({ jobId: job.id, ok: result.ok, error: result.error });
  }

  return Response.json({ processed: results.length, results });
}
