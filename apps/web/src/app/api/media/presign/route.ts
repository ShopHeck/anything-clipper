import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import { checkPlanQuota, quotaExceeded } from '@/app/api/utils/quota';
import {
  buildObjectKey,
  presignDownload,
  presignUpload,
  storageConfigured,
} from '@/app/api/utils/storage';

// POST /api/media/presign { fileName, contentType }
// → { key, uploadUrl, readUrl }
// The client PUTs the file straight to object storage (no proxying through
// the app server), then uses readUrl for transcription/publishing.
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  if (!storageConfigured()) {
    return Response.json(
      { error: 'Object storage is not configured on this deployment.' },
      { status: 501 }
    );
  }

  const quota = await checkPlanQuota(user.id, 'media.presign');
  if (quota && !quota.allowed) return quotaExceeded(quota);

  const limit = await consumeRateLimit(user.id, 'media.presign', {
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const { fileName } = (await request.json()) as { fileName?: string };
    const key = buildObjectKey(user.id, fileName || 'video');
    return Response.json({
      key,
      uploadUrl: presignUpload(key, 3600),
      readUrl: presignDownload(key),
    });
  } catch (err) {
    console.error('Presign error:', err);
    return Response.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }
}
