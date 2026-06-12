import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import { buildObjectKey, presignDownload, presignUpload, storageConfigured } from '@/app/api/utils/storage';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

// POST /api/brand-kits/logo-presign { fileName, contentType }
// Presigns a brand logo upload (image only) under a brand/ prefix. Separate
// from /api/media/presign so it doesn't consume the video upload quota.
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  if (!storageConfigured()) {
    return Response.json(
      { error: 'Object storage is not configured on this deployment.' },
      { status: 501 }
    );
  }

  const limit = await consumeRateLimit(user.id, 'brandkit.logo', { limit: 40, windowSec: 3600 });
  if (!limit.ok) return rateLimited(limit);

  try {
    const { fileName, contentType } = (await request.json()) as {
      fileName?: string;
      contentType?: string;
    };
    if (contentType && !ALLOWED.has(contentType)) {
      return Response.json({ error: 'Logo must be a PNG, JPEG, or WebP image.' }, { status: 400 });
    }
    const key = buildObjectKey(user.id, fileName || 'logo.png', 'brand');
    return Response.json({
      key,
      uploadUrl: presignUpload(key, 3600),
      readUrl: presignDownload(key),
    });
  } catch (err) {
    console.error('Logo presign error:', err);
    return Response.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }
}
