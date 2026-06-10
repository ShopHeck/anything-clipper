// Poll AssemblyAI for transcript status, then build segments and viral-score them.
// GET /api/transcribe/:id

export const runtime = 'nodejs';
export const maxDuration = 60;

interface AssemblyWord {
  text: string;
  start: number; // milliseconds
  end: number; // milliseconds
  confidence: number;
}

interface AssemblyHighlight {
  count: number;
  rank: number;
  text: string;
  timestamps: Array<{ start: number; end: number }>;
}

interface Segment {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
  highlight: boolean;
  deleted: boolean;
  viralScore: number;
}

interface ScoredResult {
  segments: Segment[];
  overallScore: number;
}

// Group flat word tokens into ~TARGET_SECS chunks, splitting on natural gaps
function buildSegments(
  words: AssemblyWord[],
  audioDurationMs: number
): Array<Omit<Segment, 'highlight' | 'deleted' | 'viralScore'>> {
  if (!words || words.length === 0) return [];

  const TARGET_SECS = 12; // aim for 12-second segments
  const MAX_SECS = 25; // never let one segment exceed 25s
  const segments: Array<Omit<Segment, 'highlight' | 'deleted' | 'viralScore'>> = [];
  let bucket: AssemblyWord[] = [];
  let segIdx = 0;

  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    bucket.push(word);
    const bucketDurSec = (word.end - bucket[0].start) / 1000;
    const nextWord = words[wi + 1];
    const gapSec = nextWord ? (nextWord.start - word.end) / 1000 : 99;
    const isLast = wi === words.length - 1;

    const shouldSplit =
      isLast ||
      bucketDurSec >= MAX_SECS ||
      (bucketDurSec >= TARGET_SECS && gapSec > 0.5) ||
      (bucketDurSec >= 6 && gapSec > 2.5);

    if (shouldSplit) {
      const segEnd = isLast ? Math.max(word.end, audioDurationMs) / 1000 : word.end / 1000;

      segments.push({
        id: `t${segIdx + 1}`,
        start: Math.round((bucket[0].start / 1000) * 10) / 10,
        end: Math.round(segEnd * 10) / 10,
        text: bucket.map((w) => w.text).join(' '),
      });
      segIdx++;
      bucket = [];
    }
  }

  return segments;
}

// Build a set of high-value phrase timestamps from AssemblyAI's auto_highlights
function buildHighlightRanges(
  highlights: AssemblyHighlight[]
): Array<{ start: number; end: number; rank: number }> {
  const ranges: Array<{ start: number; end: number; rank: number }> = [];
  for (const h of highlights ?? []) {
    for (const ts of h.timestamps ?? []) {
      ranges.push({ start: ts.start, end: ts.end, rank: h.rank });
    }
  }
  return ranges;
}

// Check if a segment overlaps with any auto-highlighted phrase
function getHighlightBoost(
  segStartMs: number,
  segEndMs: number,
  ranges: Array<{ start: number; end: number; rank: number }>
): number {
  let boost = 0;
  for (const r of ranges) {
    const overlap = Math.min(segEndMs, r.end) - Math.max(segStartMs, r.start);
    if (overlap > 200) {
      // Weight by rank (rank 1.0 = most highlighted)
      boost += Math.round(r.rank * 12);
    }
  }
  return Math.min(boost, 22); // cap boost at 22 points
}

// Heuristic viral scorer — no GPT needed
function scoreSegmentsLocally(
  segments: Array<Omit<Segment, 'highlight' | 'deleted' | 'viralScore'>>,
  highlightRanges: Array<{ start: number; end: number; rank: number }>
): ScoredResult {
  const scored: Segment[] = segments.map((seg, i) => {
    const t = seg.text.toLowerCase();
    let score = 58;

    // Hook phrases
    if (/\bwhat if\b|\bimagine\b|\bhere'?s?\b|\bthe (secret|truth|key|problem)\b/.test(t))
      score += 16;
    if (/\bnobody\b|\bno one\b|\beveryone\b|\bmost people\b/.test(t)) score += 14;
    if (/\bmistake\b|\bwrong\b|\bstop\b|\bwait\b|\bactually\b/.test(t)) score += 12;

    // Stats and proof
    if (/\d+%|\$\d+|\d+x\b|\d+ million|\d+ billion/.test(t)) score += 14;
    if (/\bstudy\b|\bresearch\b|\bproven\b|\bscientific\b/.test(t)) score += 8;

    // Emotional triggers
    if (/\bincredible\b|\bamazing\b|\bunbelievable\b|\bshock\b|\bcrazy\b/.test(t)) score += 10;
    if (/\bi (was|did|found|realized|discovered)\b/.test(t)) score += 8;

    // Question hook
    if (/\?/.test(seg.text)) score += 8;

    // Length — meaty content
    if (seg.text.length > 200) score += 6;
    if (seg.text.length > 400) score += 4;
    if (seg.text.length < 30) score -= 14; // too short, probably filler

    // Position — first segment often intro/filler
    if (i === 0) score -= 10;
    // Segments near the start of content often perform well
    if (i > 0 && i <= 3) score += 4;

    // AssemblyAI auto_highlights boost
    const segStartMs = seg.start * 1000;
    const segEndMs = seg.end * 1000;
    score += getHighlightBoost(segStartMs, segEndMs, highlightRanges);

    score = Math.min(98, Math.max(50, score));
    return {
      ...seg,
      viralScore: score,
      highlight: score >= 82,
      deleted: false,
    };
  });

  const sorted = [...scored].sort((a, b) => b.viralScore - a.viralScore);
  const topN = sorted.slice(0, Math.ceil(scored.length * 0.3));
  const avg = topN.length
    ? Math.round(topN.reduce((a, s) => a + s.viralScore, 0) / topN.length)
    : 75;
  const overallScore = Math.min(98, Math.max(55, avg));

  return { segments: scored, overallScore };
}

// Optional GPT enhancement for longer content (when segment count > 6)
async function enrichWithGPT(
  segments: Array<Omit<Segment, 'highlight' | 'deleted' | 'viralScore'>>,
  fullText: string
): Promise<ScoredResult | null> {
  const apiKey = process.env.ANYTHING_PROJECT_TOKEN;
  const base = process.env.NEXT_PUBLIC_CREATE_BASE_URL;
  if (!apiKey || !base || segments.length <= 4) return null;

  const prompt = `You are a viral short-form content expert for TikTok, Reels, and YouTube Shorts.

Score each segment 50–99 for short-form viral potential:
- 90–99: Perfect hook, shocking insight, quotable, high-energy, emotional
- 75–89: Good content, interesting, shareable
- 60–74: Decent filler, context-setting
- 50–59: Low-energy intro/outro, transitions, weak content

Full transcript (context): "${fullText.slice(0, 800)}"

Segments to score:
${segments
  .slice(0, 25)
  .map((s, i) => `[${i}] (${s.start}s–${s.end}s) "${s.text.slice(0, 200)}"`)
  .join('\n')}

Score all ${Math.min(segments.length, 25)} segments.`;

  try {
    const res = await fetch(`${base}/integrations/chat-gpt/conversationgpt4`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        json_schema: {
          name: 'segment_scores',
          schema: {
            type: 'object',
            properties: {
              scores: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'number' },
                    viralScore: { type: 'number' },
                  },
                  required: ['index', 'viralScore'],
                  additionalProperties: false,
                },
              },
              overallScore: { type: 'number' },
            },
            required: ['scores', 'overallScore'],
            additionalProperties: false,
          },
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content) as {
      scores: Array<{ index: number; viralScore: number }>;
      overallScore: number;
    };

    const scored: Segment[] = segments.map((seg, i) => {
      const entry = parsed.scores.find((x) => x.index === i);
      const score = Math.min(99, Math.max(50, Math.round(entry?.viralScore ?? 65)));
      return { ...seg, viralScore: score, highlight: score >= 82, deleted: false };
    });

    return {
      segments: scored,
      overallScore: Math.min(99, Math.max(55, Math.round(parsed.overallScore ?? 80))),
    };
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          status: 'error',
          error:
            'ASSEMBLYAI_API_KEY is not configured. Add it in your project environment variables.',
        },
        { status: 500 }
      );
    }

    const res = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      return Response.json(
        { status: 'error', error: `AssemblyAI returned ${res.status}. Check your API key.` },
        { status: 500 }
      );
    }

    const data = await res.json();

    // Still running
    if (data.status === 'queued' || data.status === 'processing') {
      return Response.json({ status: data.status });
    }

    // Failed
    if (data.status === 'error') {
      const msg = data.error ?? 'AssemblyAI could not transcribe this file';
      console.error('AssemblyAI transcript error:', msg);
      return Response.json({
        status: 'error',
        error: `Transcription error: ${msg}. Make sure your video has clear audio.`,
      });
    }

    // Completed — parse words
    const words: AssemblyWord[] = data.words ?? [];
    const audioDurationMs: number = (data.audio_duration ?? 0) * 1000;

    if (words.length === 0) {
      return Response.json({
        status: 'error',
        error:
          'No speech detected in your video. Make sure the video has audible speech (not music-only). If your video is silent, try a different file.',
      });
    }

    // Build segments
    const rawSegments = buildSegments(words, audioDurationMs);

    // Extract AssemblyAI auto_highlights for smart scoring
    const highlights: AssemblyHighlight[] = data.auto_highlights_result?.results ?? [];
    const highlightRanges = buildHighlightRanges(highlights);

    // Start with fast heuristic scoring
    const heuristicResult = scoreSegmentsLocally(rawSegments, highlightRanges);

    // Optionally enhance with GPT for longer videos
    const gptResult = await enrichWithGPT(rawSegments, data.text ?? '');
    const final = gptResult ?? heuristicResult;

    return Response.json({
      status: 'completed',
      segments: final.segments,
      overallScore: final.overallScore,
      totalDuration: audioDurationMs / 1000,
      wordCount: words.length,
      text: data.text ?? '',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Transcribe poll error:', msg);
    return Response.json({ status: 'error', error: `Server error: ${msg}` }, { status: 500 });
  }
}
