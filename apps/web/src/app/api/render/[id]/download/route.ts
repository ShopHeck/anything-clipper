import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';
import { presignDownload, storageConfigured } from '@/app/api/utils/storage';

export const runtime = 'nodejs';

// GET /api/render/:id/download — redirect to a fresh presigned URL (storage
// deployments) or stream the local file (dev without storage).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const [job] = await sql`
    SELECT id, status, output_key, output_path FROM render_jobs
    WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!job) return Response.json({ error: 'Render job not found' }, { status: 404 });
  if (job.status !== 'completed') {
    return Response.json({ error: 'Render is not finished yet' }, { status: 409 });
  }

  if (job.output_key && storageConfigured()) {
    return Response.redirect(presignDownload(job.output_key, 3600), 302);
  }

  if (job.output_path && existsSync(job.output_path)) {
    const size = statSync(job.output_path).size;
    const stream = Readable.toWeb(createReadStream(job.output_path)) as ReadableStream;
    return new Response(stream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(size),
        'Content-Disposition': `attachment; filename="clip-${id}.mp4"`,
      },
    });
  }

  return Response.json({ error: 'Rendered file is no longer available' }, { status: 410 });
}
