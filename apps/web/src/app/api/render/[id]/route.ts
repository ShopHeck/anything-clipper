import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

// GET /api/render/:id — poll job status/progress.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const [job] = await sql`
      SELECT id, project_id, clip_id, status, progress, error_msg, output_key, output_path,
             created_at, started_at, completed_at
      FROM render_jobs WHERE id = ${id} AND user_id = ${user.id}
    `;
    if (!job) return Response.json({ error: 'Render job not found' }, { status: 404 });

    return Response.json({
      job: {
        id: job.id,
        projectId: job.project_id,
        clipId: job.clip_id,
        status: job.status,
        progress: job.progress,
        error: job.error_msg,
        downloadUrl: job.status === 'completed' ? `/api/render/${job.id}/download` : null,
      },
    });
  } catch (err) {
    console.error('Get render job error:', err);
    return Response.json({ error: 'Failed to load render job' }, { status: 500 });
  }
}
