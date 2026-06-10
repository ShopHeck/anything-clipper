import { aiErrorResponse, chatCompletionJson } from '@/app/api/utils/ai';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'ai.analyze-virality', {
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const body = await request.json();
    const { transcript, fileName } = body as { transcript: string; fileName?: string };

    if (!transcript) {
      return Response.json({ error: 'transcript is required' }, { status: 400 });
    }

    const parsed = await chatCompletionJson(
      [
        {
          role: 'system',
          content: `You are a world-class viral content strategist who understands human psychology deeply. You analyze video content through the lens of neuroscience, behavioral psychology, and social media algorithms. You score content on proven dopamine-triggering factors: curiosity gaps, pattern interrupts, social proof, emotional resonance, novelty, loss aversion, and variable reward mechanics. You give precise, actionable data.`,
        },
        {
          role: 'user',
          content: `Analyze this video transcript for viral potential using proven human psychology principles.

Video: "${fileName || 'Unknown'}"
Transcript: "${transcript.slice(0, 2000)}"

Provide a deep psychological analysis including:
1. Hook strength score (first 3 seconds effectiveness)
2. Curiosity gap score (how much viewers need to watch til end)
3. Emotional triggers present (list which ones)
4. Pattern interrupt moments (timestamp-style descriptions)
5. Predicted retention curve shape
6. Dopamine trigger score
7. Best hook rewrite using psychology
8. Top 3 reasons this will/won't go viral
9. Recommended effects (zoom punch timing, caption style, etc.)
10. Optimal clip start time for maximum hook impact`,
        },
      ],
      {
        name: 'virality_analysis',
        schema: {
          type: 'object',
          properties: {
            hookScore: { type: 'number' },
            curiosityGapScore: { type: 'number' },
            emotionalTriggers: { type: 'array', items: { type: 'string' } },
            patternInterrupts: { type: 'array', items: { type: 'string' } },
            dopamineScore: { type: 'number' },
            bestHookRewrite: { type: 'string' },
            viralReasons: { type: 'array', items: { type: 'string' } },
            recommendedEffects: { type: 'array', items: { type: 'string' } },
            optimalStartSeconds: { type: 'number' },
            retentionPrediction: { type: 'string' },
            overallViralScore: { type: 'number' },
            psychologyInsight: { type: 'string' },
          },
          required: [
            'hookScore',
            'curiosityGapScore',
            'emotionalTriggers',
            'patternInterrupts',
            'dopamineScore',
            'bestHookRewrite',
            'viralReasons',
            'recommendedEffects',
            'optimalStartSeconds',
            'retentionPrediction',
            'overallViralScore',
            'psychologyInsight',
          ],
          additionalProperties: false,
        },
      }
    );

    return Response.json(parsed);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
