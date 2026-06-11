import { aiErrorResponse, chatCompletionJson } from '@/app/api/utils/ai';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import { analyzeTranscript } from '@/lib/clip/analyze';
import { TimedWord } from '@/lib/clip/boundaries';
import { wordsFromSegments } from '@/lib/clip/transcript';

interface InputSegment {
  id: string;
  start: number;
  end: number;
  text?: string;
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

function durationLabel(start: number, end: number): string {
  const durationSec = Math.max(8, end - start);
  const m = Math.floor(durationSec / 60);
  const s = Math.round(durationSec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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
      words = [],
    } = body as {
      transcript: string;
      count?: number;
      segments?: InputSegment[];
      words?: TimedWord[];
    };

    // Preferred path: full-transcript, word-accurate analysis over the WHOLE
    // video. Use provided word timestamps, else synthesize from segments.
    const timedWords: TimedWord[] =
      words.length > 0
        ? words
        : segments.some((s) => s.text)
          ? wordsFromSegments(
              segments
                .filter((s) => s.text)
                .map((s) => ({ start: s.start, end: s.end, text: s.text as string }))
            )
          : [];

    if (timedWords.length > 0) {
      const candidates = await analyzeTranscript({ count, words: timedWords });
      const clips = candidates.map((c, i) => ({
        id: `clip-${i}`,
        title: c.title,
        hook: c.hook,
        score: c.score,
        platforms: c.platforms,
        reason: c.reason,
        keywords: c.keywords,
        start: c.start,
        end: c.end,
        duration: durationLabel(c.start, c.end),
        thumbnail: THUMBNAILS[i % THUMBNAILS.length],
      }));
      return Response.json({ clips });
    }

    // Fallback path: only plain transcript text available (e.g. "generate
    // more" from the clips page) — single-shot analysis without timestamps.
    if (!transcript || transcript.trim().length === 0) {
      return Response.json({ error: 'transcript or words is required' }, { status: 400 });
    }

    const parsed = await chatCompletionJson<{ clips: RawClip[] }>(
      [
        {
          role: 'system',
          content: `You are a viral content expert and video editor. You analyze video transcripts and identify the most shareable, engaging moments that would perform well on TikTok, Instagram Reels, and YouTube Shorts. You understand hooks, curiosity gaps, pattern interrupts, and what drives shares.`,
        },
        {
          role: 'user',
          content: `Analyze this transcript and generate ${count} viral short-form clips (30–90 seconds each). For each clip: compelling title, punchy hook under 12 words, viral score 70–99, best platforms, reason why it works, and start/end seconds from the transcript.\n\nTranscript: "${transcript.slice(0, 4000)}"\n\nReturn exactly ${count} clips.`,
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
      const start = c.segmentStart || 0;
      const end = c.segmentEnd || 60;
      return {
        id: `clip-${i}`,
        title: c.title,
        hook: c.hook,
        score: c.score,
        platforms: c.platforms,
        reason: c.reason,
        start,
        end,
        duration: durationLabel(start, end),
        thumbnail: THUMBNAILS[i % THUMBNAILS.length],
      };
    });

    return Response.json({ clips });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
