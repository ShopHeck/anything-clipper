// Full-transcript clip discovery (Phase 2). Map-reduce over the whole
// video instead of the first ~5 minutes: score every chunk, ask the LLM for
// candidate clips per high-value region, then snap each candidate to
// word-accurate boundaries and rank.
import { chatCompletionJson } from '@/app/api/utils/ai';
import { snapClipBoundaries, TimedWord } from './boundaries';
import { chunkTranscript, TranscriptChunk } from './transcript';

export interface CandidateClip {
  title: string;
  hook: string;
  score: number;
  platforms: string[];
  reason: string;
  start: number;
  end: number;
  keywords: string[];
}

const CLIP_SCHEMA = {
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
            startSec: { type: 'number' },
            endSec: { type: 'number' },
            keywords: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'hook', 'score', 'platforms', 'reason', 'startSec', 'endSec', 'keywords'],
          additionalProperties: false,
        },
      },
    },
    required: ['clips'],
    additionalProperties: false,
  },
} as const;

interface RawClip {
  title: string;
  hook: string;
  score: number;
  platforms: string[];
  reason: string;
  startSec: number;
  endSec: number;
  keywords: string[];
}

async function findClipsInChunk(
  chunk: TranscriptChunk,
  perChunk: number
): Promise<CandidateClip[]> {
  const parsed = await chatCompletionJson<{ clips: RawClip[] }>(
    [
      {
        role: 'system',
        content:
          'You are a viral short-form editor. You find the most shareable 20–90s moments in a transcript for TikTok, Reels, and YouTube Shorts: strong hooks, curiosity gaps, surprising claims, emotional peaks, and quotable lines. Timestamps you return MUST fall within the provided time range.',
      },
      {
        role: 'user',
        content: `This is one section of a longer video, covering ${chunk.startSec.toFixed(
          1
        )}s to ${chunk.endSec.toFixed(1)}s.

Find up to ${perChunk} candidate clips in THIS section. For each: title, hook (<12 words), viral score 60–99, best platforms, why it works, the keywords/phrases to emphasize as on-screen captions, and startSec/endSec (absolute seconds within ${chunk.startSec.toFixed(
          1
        )}–${chunk.endSec.toFixed(1)}).

Transcript section:
"${chunk.text}"`,
      },
    ],
    CLIP_SCHEMA
  );

  return parsed.clips.map((c) => ({
    title: c.title,
    hook: c.hook,
    score: clampScore(c.score),
    platforms: c.platforms?.length ? c.platforms : ['TikTok', 'Reels'],
    reason: c.reason,
    // Clamp to the chunk's range so a hallucinated timestamp can't escape it.
    start: clamp(c.startSec, chunk.startSec, chunk.endSec),
    end: clamp(c.endSec, chunk.startSec, chunk.endSec),
    keywords: c.keywords ?? [],
  }));
}

export interface AnalyzeOptions {
  count: number;
  words: TimedWord[];
}

export async function analyzeTranscript(
  opts: AnalyzeOptions
): Promise<CandidateClip[]> {
  const { words, count } = opts;
  const chunks = chunkTranscript(words);
  if (chunks.length === 0) return [];

  // Ask each chunk for a few candidates; gather more than we need so ranking
  // has something to choose from across the whole video.
  const perChunk = Math.max(2, Math.ceil((count * 1.5) / chunks.length));
  const results = await Promise.all(
    chunks.map((chunk) =>
      findClipsInChunk(chunk, perChunk).catch((err) => {
        console.error(`Chunk ${chunk.index} analysis failed:`, err);
        return [] as CandidateClip[];
      })
    )
  );

  const all = results.flat();
  if (all.length === 0) {
    throw new Error('No clips could be generated from this transcript');
  }

  // Snap to word boundaries, drop degenerate/duplicate windows, rank by score.
  const snapped = all
    .map((c) => {
      const { start, end } = snapClipBoundaries(words, c.start, c.end);
      return { ...c, start, end };
    })
    .filter((c) => c.end - c.start >= 8 && c.end - c.start <= 120);

  const deduped = dedupeByOverlap(snapped);
  deduped.sort((a, b) => b.score - a.score);
  return deduped.slice(0, count);
}

// Drop clips that overlap an already-kept (higher-scoring) clip by >50%.
function dedupeByOverlap(clips: CandidateClip[]): CandidateClip[] {
  const sorted = [...clips].sort((a, b) => b.score - a.score);
  const kept: CandidateClip[] = [];
  for (const c of sorted) {
    const dup = kept.some((k) => {
      const overlap = Math.min(c.end, k.end) - Math.max(c.start, k.start);
      const shorter = Math.min(c.end - c.start, k.end - k.start);
      return overlap > 0 && overlap / shorter > 0.5;
    });
    if (!dup) kept.push(c);
  }
  return kept;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
function clampScore(v: number): number {
  return Math.min(99, Math.max(50, Math.round(v)));
}
