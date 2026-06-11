import { aiErrorResponse, chatCompletion } from '@/app/api/utils/ai';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'ai.generate-hook', {
    limit: 60,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const body = await request.json();
    const { title } = body;

    if (!title) {
      return Response.json({ error: 'title is required' }, { status: 400 });
    }

    const hook = await chatCompletion([
      {
        role: 'system',
        content: `You are a viral social media copywriter specializing in hooks for short-form video content (TikTok, Reels, Shorts). Write hooks that create massive curiosity gaps, use pattern interrupts, and make people HAVE to watch. Keep it under 15 words. Make it punchy, bold, and impossible to ignore. Start with action or emotion — never with "I" or "You".`,
      },
      {
        role: 'user',
        content: `Write one viral hook sentence for a short-form video clip titled: "${title}". Return ONLY the hook text, nothing else.`,
      },
    ]);

    return Response.json({ hook: hook.replace(/^["']|["']$/g, '') });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
