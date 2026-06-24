import { getApiUser } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';
import { orchestrateUGCVideo } from '@/lib/ugc/orchestrate';
import type { TTSVoice } from '@/lib/tts/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

// POST /api/ugc/:id/process
// Executes the full UGC orchestration pipeline. Can be called by the job's
// owner (browser-driven processing) or by a worker with x-render-worker-secret.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const workerSecret = process.env.RENDER_WORKER_SECRET;
  const isWorker =
    Boolean(workerSecret) && request.headers.get('x-render-worker-secret') === workerSecret;

  let project: Record<string, unknown>;

  if (!isWorker) {
    const user = await getApiUser(request);
    if (!user) {
      return Response.json({ error: 'Sign in to use this feature.' }, { status: 401 });
    }

    const [owned] = await sql`
      SELECT id, user_id, product_url, status FROM ugc_projects WHERE id = ${id} AND user_id = ${user.id}
    `;
    if (!owned) return Response.json({ error: 'UGC project not found' }, { status: 404 });

    project = owned;
  } else {
    // Worker mode: look up project without user auth
    const [found] = await sql`
      SELECT id, user_id, product_url, status FROM ugc_projects WHERE id = ${id}
    `;
    if (!found) return Response.json({ error: 'UGC project not found' }, { status: 404 });
    project = found;
  }

  // Re-entrance guard: reject if the project is already completed or composing
  if (project.status === 'completed' || project.status === 'composing') {
    return Response.json(
      { error: `Project is already ${project.status}` },
      { status: 409 }
    );
  }

  // Parse optional params from request body
  let voice: TTSVoice | undefined;
  let templateStyle: string | undefined;
  let captionTemplate: string | undefined;

  try {
    const body = await request.json();
    voice = body?.voice;
    templateStyle = body?.templateStyle;
    captionTemplate = body?.captionTemplate;
  } catch {
    // Empty body is fine
  }

  const result = await orchestrateUGCVideo({
    projectId: id,
    userId: project.user_id as string,
    url: project.product_url as string,
    voice,
    templateStyle,
    captionTemplate,
  });

  if (result.status === 'failed') {
    return Response.json({ error: result.error ?? 'Orchestration failed' }, { status: 500 });
  }

  return Response.json({ success: true, videoUrl: result.videoUrl });
}
