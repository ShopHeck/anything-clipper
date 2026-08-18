import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import { checkPlanQuota, quotaExceeded } from '@/app/api/utils/quota';
import {
  buildObjectKey,
  presignDownload,
  presignUpload,
  storageConfigured,
} from '@/app/api/utils/storage';

const SPONSOR_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

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
    const body = (await request.json()) as {
      fileName?: string;
      contentType?: string;
      purpose?: string;
    };
    const purpose = body.purpose === 'sponsor-logo' ? 'sponsor-logo' : 'upload';
    if (purpose === 'sponsor-logo') {
      const contentType = (body.contentType ?? '').split(';', 1)[0].trim().toLowerCase();
      if (!SPONSOR_LOGO_TYPES.has(contentType)) {
        return Response.json(
          { error: 'Sponsor logos must be PNG, JPEG, WebP, or GIF files.' },
          { status: 400 }
        );
      }
    }
    const key = buildObjectKey(
      user.id,
      body.fileName || (purpose === 'sponsor-logo' ? 'logo.png' : 'video'),
      purpose === 'sponsor-logo' ? 'sponsor-logos' : 'uploads'
    );
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
