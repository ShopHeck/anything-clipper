import { aiErrorResponse, chatCompletion } from '@/app/api/utils/ai';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'ai.suggest', {
    limit: 60,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const body = await request.json();
    const { transcript } = body;

    if (!transcript) {
      return Response.json({ error: 'transcript is required' }, { status: 400 });
    }

    const suggestion = await chatCompletion([
      {
        role: 'system',
        content:
          'You are an expert video editor and content strategist specializing in short-form viral content. Give concise, actionable editing suggestions to improve video retention and virality. Keep suggestions to 2-3 sentences max.',
      },
      {
        role: 'user',
        content: `Analyze this video transcript and give one specific, actionable editing suggestion to improve its viral potential and viewer retention:\n\n"${transcript}"`,
      },
    ]);

    return Response.json({ suggestion });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
