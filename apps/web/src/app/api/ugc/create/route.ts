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
    };

    const { url, voice, templateStyle, captionTemplate } = body;

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'url is required' }, { status: 400 });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Create ugc_projects row
    const meta = JSON.stringify({ voice, templateStyle, captionTemplate });
    const [project] = await sql`
      INSERT INTO ugc_projects (user_id, product_url, status)
      VALUES (${user.id}, ${url}, 'scraping')
      RETURNING id, status, created_at
    `;

    return Response.json({
      jobId: project.id,
      status: 'processing',
      meta: { voice, templateStyle, captionTemplate },
    });
  } catch (err) {
    console.error('Create UGC project error:', err);
    return Response.json({ error: 'Failed to create UGC project' }, { status: 500 });
  }
}
