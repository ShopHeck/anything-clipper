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

  let userId: string;

  if (!isWorker) {
    const user = await getApiUser(request);
    if (!user) {
      return Response.json({ error: 'Sign in to use this feature.' }, { status: 401 });
    }

    const [owned] = await sql`
      SELECT id, user_id, product_url, status FROM ugc_projects WHERE id = ${id} AND user_id = ${user.id}
    `;
    if (!owned) return Response.json({ error: 'UGC project not found' }, { status: 404 });

    userId = user.id;
  } else {
    // Worker mode: look up project without user auth
    const [project] = await sql`
      SELECT id, user_id, product_url, status FROM ugc_projects WHERE id = ${id}
    `;
    if (!project) return Response.json({ error: 'UGC project not found' }, { status: 404 });
    userId = project.user_id;
  }

  // Fetch project details for orchestration
  const [project] = await sql`
    SELECT id, user_id, product_url, status FROM ugc_projects WHERE id = ${id}
  `;

  if (!project) {
    return Response.json({ error: 'UGC project not found' }, { status: 404 });
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
    userId,
    url: project.product_url,
    voice,
    templateStyle,
    captionTemplate,
  });

  if (result.status === 'failed') {
    return Response.json({ error: result.error ?? 'Orchestration failed' }, { status: 500 });
  }

  return Response.json({ success: true, videoUrl: result.videoUrl });
}
