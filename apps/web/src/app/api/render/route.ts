import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import { checkPlanQuota, quotaExceeded } from '@/app/api/utils/quota';
import sql from '@/app/api/utils/sql';
import { parseRenderInput, validationResponse } from '@/lib/api/input-validation';
import { buildRenderSpec } from '@/lib/render/spec';

// POST /api/render
// Body: { projectId, mode: 'clip'|'timeline', clipId?, ratio?,
//         captionTemplateId?, captionPosition?, music?, ... }
// Creates a queued render job. The client (or render worker) then calls
// POST /api/render/[id]/process and polls GET /api/render/[id].
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const quota = await checkPlanQuota(user.id, 'render.create');
  if (quota && !quota.allowed) return quotaExceeded(quota);

  const limit = await consumeRateLimit(user.id, 'render.create', {
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const { projectId, ...opts } = parseRenderInput(await request.json());

    const built = await buildRenderSpec(user.id, projectId, opts);
    if ('error' in built) {
      return Response.json({ error: built.error }, { status: built.status });
    }

    const [job] = await sql`
      INSERT INTO render_jobs (user_id, project_id, clip_id, spec, status)
      VALUES (${user.id}, ${projectId}, ${built.clipId}, ${JSON.stringify(built.spec)}, 'queued')
      RETURNING id, status, progress, created_at
    `;

    return Response.json({ job });
  } catch (err) {
    const invalid = validationResponse(err);
    if (invalid) return invalid;
    console.error('Create render job error:', err);
    return Response.json({ error: 'Failed to create render job' }, { status: 500 });
  }
}
