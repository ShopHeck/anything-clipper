import { getApiUser } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';
import { processRenderJob } from '@/lib/render/process';

export const runtime = 'nodejs';
export const maxDuration = 300;

// POST /api/render/:id/process — execute the render. Callable by the job's
// owner (browser-driven processing) or by the render worker via the
// x-render-worker-secret header.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const workerSecret = process.env.RENDER_WORKER_SECRET;
  const isWorker =
    Boolean(workerSecret) && request.headers.get('x-render-worker-secret') === workerSecret;

  if (!isWorker) {
    const user = await getApiUser(request);
    if (!user) {
      return Response.json({ error: 'Sign in to use this feature.' }, { status: 401 });
    }
    const [owned] = await sql`
      SELECT id FROM render_jobs WHERE id = ${id} AND user_id = ${user.id}
    `;
    if (!owned) return Response.json({ error: 'Render job not found' }, { status: 404 });
  }

  const result = await processRenderJob(id);
  if (result.status === 'failed') {
    return Response.json({ error: result.error ?? 'Render failed' }, { status: 500 });
  }
  return Response.json({ success: true });
}
