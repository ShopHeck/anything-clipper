import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import { checkPlanQuota, quotaExceeded } from '@/app/api/utils/quota';
import sql from '@/app/api/utils/sql';
import type { TTSVoice } from '@/lib/tts/types';

export const runtime = 'nodejs';

// POST /api/ugc/create
// Body: { url: string, voice?: TTSVoice, templateStyle?: string, captionTemplate?: string }
// Creates a ugc_projects row and returns a job ID for polling.
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const quota = await checkPlanQuota(user.id, 'ai.ugc-create');
  if (quota && !quota.allowed) return quotaExceeded(quota);

  const limit = await consumeRateLimit(user.id, 'ai.ugc-create', {
    limit: 5,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const body = (await request.json()) as {
      url?: string;
      voice?: TTSVoice;
      templateStyle?: string;
      captionTemplate?: string;
      avatarId?: string;
      useAvatar?: boolean;
      useBroll?: boolean;
    };

    const { url, voice, templateStyle, captionTemplate, avatarId, useAvatar, useBroll } = body;

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'url is required' }, { status: 400 });
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // SSRF protection: only allow http/https and reject private/reserved addresses
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return Response.json({ error: 'Only http and https URLs are allowed' }, { status: 400 });
    }

    const hostname = parsedUrl.hostname;
    const isPrivate =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0' ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname);

    if (isPrivate) {
      return Response.json({ error: 'URLs pointing to private or reserved addresses are not allowed' }, { status: 400 });
    }

    // Create ugc_projects row
    const options = { voice, templateStyle, captionTemplate, avatarId, useAvatar, useBroll };
    const optionsJson = JSON.stringify(options);
    const [project] = await sql`
      INSERT INTO ugc_projects (user_id, product_url, status, options)
      VALUES (${user.id}, ${url}, 'scraping', ${optionsJson})
      RETURNING id, status, created_at
    `;

    return Response.json({
      jobId: project.id,
      status: 'processing',
      meta: options,
    });
  } catch (err) {
    console.error('Create UGC project error:', err);
    return Response.json({ error: 'Failed to create UGC project' }, { status: 500 });
  }
}
