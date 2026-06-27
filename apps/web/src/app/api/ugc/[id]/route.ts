import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';
import { presignDownload } from '@/app/api/utils/storage';

export const runtime = 'nodejs';

// GET /api/ugc/:id
// Returns current UGC job status with progress info. Only the owning user can access.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const [project] = await sql`
    SELECT id, user_id, product_url, product_data, script, tts_audio_url,
           tts_timing, video_assets, video_url, status, created_at, updated_at
    FROM ugc_projects
    WHERE id = ${id} AND user_id = ${user.id}
  `;

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Parse JSONB fields safely
  const productData =
    typeof project.product_data === 'string'
      ? JSON.parse(project.product_data)
      : project.product_data;
  const script =
    typeof project.script === 'string' ? JSON.parse(project.script) : project.script;
  const ttsTiming =
    typeof project.tts_timing === 'string'
      ? JSON.parse(project.tts_timing)
      : project.tts_timing;
  const videoAssets =
    typeof project.video_assets === 'string'
      ? JSON.parse(project.video_assets)
      : project.video_assets;

  // Presign the TTS audio URL on read if it looks like a storage key
  let ttsAudioUrl: string | null = project.tts_audio_url ?? null;
  if (ttsAudioUrl && ttsAudioUrl.startsWith('tts/')) {
    try {
      ttsAudioUrl = presignDownload(ttsAudioUrl);
    } catch {
      // Storage not configured, return key as-is
    }
  }

  // Extract error from video_assets if status is failed
  let errorMessage: string | null = null;
  if (project.status === 'failed' && videoAssets && typeof videoAssets === 'object' && 'error' in videoAssets) {
    errorMessage = videoAssets.error as string;
  }

  return Response.json({
    id: project.id,
    status: project.status,
    productUrl: project.product_url,
    productData: productData ?? null,
    script: script ?? null,
    ttsAudioUrl,
    ttsTiming: ttsTiming ?? null,
    videoAssets: project.status === 'failed' ? null : (videoAssets ?? null),
    videoUrl: project.video_url ?? null,
    ...(errorMessage ? { error: errorMessage } : {}),
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  });
}
