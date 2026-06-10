import { aiErrorResponse, chatCompletionJson } from '@/app/api/utils/ai';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';

interface InputSegment {
  id: string;
  start: number;
  end: number;
  viralScore?: number;
}
interface RawClip {
  title: string;
  hook: string;
  score: number;
  platforms: string[];
  reason: string;
  segmentStart: number;
  segmentEnd: number;
}

const THUMBNAILS = [
  'from-violet-800 to-purple-900',
  'from-pink-800 to-rose-900',
  'from-blue-800 to-cyan-900',
  'from-amber-800 to-orange-900',
  'from-emerald-800 to-green-900',
  'from-indigo-800 to-violet-900',
];

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'ai.generate-clips', {
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const body = await request.json();
    const {
      transcript,
      count = 5,
      segments = [],
    } = body as { transcript: string; count?: number; segments?: InputSegment[] };

    if (!transcript || transcript.trim().length === 0) {
      return Response.json({ error: 'transcript is required' }, { status: 400 });
    }

    const parsed = await chatCompletionJson<{ clips: RawClip[] }>(
      [
        {
          role: 'system',
          content: `You are a viral content expert and video editor. You analyze video transcripts and identify the most shareable, engaging moments that would perform well on TikTok, Instagram Reels, and YouTube Shorts. You understand hooks, curiosity gaps, pattern interrupts, and what drives shares.`,
        },
        {
          role: 'user',
          content: `Analyze this transcript and generate ${count} viral short-form clips (30–90 seconds each). For each clip: compelling title, punchy hook under 12 words, viral score 70–99, best platforms, reason why it works, and start/end seconds from the transcript.\n\nTranscript: "${transcript.slice(0, 2000)}"\n\n${segments.length > 0 ? `Segment timestamps: ${JSON.stringify(segments.map((s) => ({ id: s.id, start: s.start, end: s.end, viralScore: s.viralScore })))}` : ''}\n\nReturn exactly ${count} clips.`,
        },
      ],
      {
        name: 'viral_clips',
        schema: {
          type: 'object',
          properties: {
            clips: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  hook: { type: 'string' },
                  score: { type: 'number' },
                  platforms: { type: 'array', items: { type: 'string' } },
                  reason: { type: 'string' },
                  segmentStart: { type: 'number' },
                  segmentEnd: { type: 'number' },
                },
                required: [
                  'title',
                  'hook',
                  'score',
                  'platforms',
                  'reason',
                  'segmentStart',
                  'segmentEnd',
                ],
                additionalProperties: false,
              },
            },
          },
          required: ['clips'],
          additionalProperties: false,
        },
      }
    );

    const clips = parsed.clips.map((c: RawClip, i: number) => {
      const durationSec = Math.max(15, (c.segmentEnd || 60) - (c.segmentStart || 0));
      const m = Math.floor(durationSec / 60);
      const s = Math.round(durationSec % 60);
      return {
        id: `clip-${i}`,
        title: c.title,
        hook: c.hook,
        score: c.score,
        platforms: c.platforms,
        reason: c.reason,
        start: c.segmentStart || 0,
        end: c.segmentEnd || 60,
        duration: `${m}:${s.toString().padStart(2, '0')}`,
        thumbnail: THUMBNAILS[i % THUMBNAILS.length],
      };
    });

    return Response.json({ clips });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
