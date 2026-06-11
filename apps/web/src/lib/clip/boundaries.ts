// Boundary snapping: AI/heuristics pick approximate clip start/end seconds,
// but cuts should land on natural speech boundaries — the start of a word
// after a pause, the end of a sentence — never mid-word. Uses word-level
// timestamps to snap.
export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface SnapResult {
  start: number;
  end: number;
}

// Find the gap-based boundaries near a target time. A "boundary" is the
// instant between two words separated by more than `minGapSec` of silence,
// or a sentence end.
function wordBoundaries(words: TimedWord[], minGapSec: number): number[] {
  const starts: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const prev = words[i - 1];
    const gap = prev ? words[i].start - prev.end : Infinity;
    const prevEndsSentence = prev ? /[.!?]$/.test(prev.text) : true;
    if (gap >= minGapSec || prevEndsSentence) {
      starts.push(words[i].start);
    }
  }
  return starts;
}

// Snap a [start, end] window to the nearest natural boundaries within
// `toleranceSec`. Start snaps to the beginning of a phrase; end snaps to the
// end of the word/sentence just before the next phrase.
export function snapClipBoundaries(
  words: TimedWord[],
  rawStart: number,
  rawEnd: number,
  opts: { toleranceSec?: number; minGapSec?: number } = {}
): SnapResult {
  if (words.length === 0) return { start: rawStart, end: rawEnd };
  const tolerance = opts.toleranceSec ?? 1.5;
  const minGap = opts.minGapSec ?? 0.35;

  const starts = wordBoundaries(words, minGap);

  // Snap start: nearest phrase start at or before rawStart (so we don't clip
  // into the first word), within tolerance; else nearest overall.
  let start = rawStart;
  let bestStartDist = Infinity;
  for (const s of starts) {
    const dist = Math.abs(s - rawStart);
    if (dist < bestStartDist && dist <= tolerance) {
      bestStartDist = dist;
      start = s;
    }
  }

  // Snap end: the end of the last word that finishes at/just before a phrase
  // boundary near rawEnd. We look at word ends followed by a real gap.
  let end = rawEnd;
  let bestEndDist = Infinity;
  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1];
    const gap = next ? next.start - words[i].end : Infinity;
    const endsSentence = /[.!?]$/.test(words[i].text);
    if (gap >= minGap || endsSentence) {
      const candidate = words[i].end;
      const dist = Math.abs(candidate - rawEnd);
      if (dist < bestEndDist && dist <= tolerance) {
        bestEndDist = dist;
        end = candidate;
      }
    }
  }

  // Guard against inversion / degenerate windows — fall back to the raw
  // window, normalized so start < end even if the caller passed them swapped.
  if (end - start < 1) {
    const lo = Math.max(0, Math.min(rawStart, rawEnd));
    const hi = Math.max(lo + 0.5, Math.max(rawStart, rawEnd));
    return { start: lo, end: hi };
  }
  return { start: Math.max(0, start), end };
}

// Detect dead-air ranges from word gaps — used for one-tap silence removal
// and to tighten clips. Only gaps longer than `minSilenceSec` are returned,
// trimmed by `padSec` so speech isn't clipped.
export function detectSilences(
  words: TimedWord[],
  opts: { minSilenceSec?: number; padSec?: number } = {}
): Array<{ start: number; end: number }> {
  const minSilence = opts.minSilenceSec ?? 0.8;
  const pad = opts.padSec ?? 0.1;
  const silences: Array<{ start: number; end: number }> = [];
  for (let i = 1; i < words.length; i++) {
    const gapStart = words[i - 1].end + pad;
    const gapEnd = words[i].start - pad;
    if (gapEnd - gapStart >= minSilence) {
      silences.push({ start: gapStart, end: gapEnd });
    }
  }
  return silences;
}

// Common spoken filler words. Returns the word-index ranges to cut.
const FILLER_PATTERNS = [
  /^(um+|uh+|er+|ah+|hmm+)$/i,
  /^(like|literally|basically|honestly|actually)$/i, // soft fillers (opt-in)
];

export function detectFillerCuts(
  words: TimedWord[],
  opts: { includeSoft?: boolean } = {}
): Array<{ start: number; end: number; text: string }> {
  const patterns = opts.includeSoft ? FILLER_PATTERNS : FILLER_PATTERNS.slice(0, 1);
  const cuts: Array<{ start: number; end: number; text: string }> = [];
  for (const w of words) {
    const clean = w.text.replace(/[.,!?]/g, '');
    if (patterns.some((p) => p.test(clean))) {
      cuts.push({ start: w.start, end: w.end, text: w.text });
    }
  }
  return cuts;
}
