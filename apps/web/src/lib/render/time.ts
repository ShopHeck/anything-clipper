// Time-domain mapping between SOURCE time and OUTPUT time. The output
// starts at spec.startSec and has every cut range removed, so caption
// timestamps (and anything else expressed in source time) must be shifted
// before they line up with the rendered video.
import { CutRange, SpecWord } from './types';

// Normalize cuts: clamp to [startSec, endSec], drop empty, sort, merge overlaps.
export function normalizeCuts(cuts: CutRange[], startSec: number, endSec: number): CutRange[] {
  const clamped = cuts
    .map((c) => ({ start: Math.max(c.start, startSec), end: Math.min(c.end, endSec) }))
    .filter((c) => c.end - c.start > 0.01)
    .sort((a, b) => a.start - b.start);

  const merged: CutRange[] = [];
  for (const c of clamped) {
    const last = merged[merged.length - 1];
    if (last && c.start <= last.end) {
      last.end = Math.max(last.end, c.end);
    } else {
      merged.push({ ...c });
    }
  }
  return merged;
}

// Source time → output time. Returns null when the moment is inside a cut
// (it doesn't exist in the output). `cuts` must be normalized.
export function sourceToOutputTime(
  t: number,
  startSec: number,
  cuts: CutRange[]
): number | null {
  if (t < startSec) return null;
  let removed = 0;
  for (const c of cuts) {
    if (t >= c.start && t < c.end) return null;
    if (c.end <= t) removed += c.end - c.start;
  }
  return t - startSec - removed;
}

// Output duration after trimming and cuts.
export function outputDuration(startSec: number, endSec: number, cuts: CutRange[]): number {
  const removed = cuts.reduce((acc, c) => acc + (c.end - c.start), 0);
  return Math.max(0, endSec - startSec - removed);
}

// Map caption words (source time) into output time, dropping words that
// fall entirely inside cuts and clamping ones that straddle a boundary.
export function mapWordsToOutput(
  words: SpecWord[],
  startSec: number,
  endSec: number,
  cuts: CutRange[]
): SpecWord[] {
  const mapped: SpecWord[] = [];
  for (const w of words) {
    if (w.end <= startSec || w.start >= endSec) continue;
    const midpoint = (w.start + w.end) / 2;
    if (sourceToOutputTime(midpoint, startSec, cuts) === null) continue;

    const start = sourceToOutputTime(Math.max(w.start, startSec), startSec, cuts);
    const end = sourceToOutputTime(Math.min(w.end, endSec), startSec, cuts);
    const safeStart = start ?? sourceToOutputTime(midpoint, startSec, cuts);
    if (safeStart === null) continue;
    const safeEnd = end ?? safeStart + 0.2;
    if (safeEnd - safeStart < 0.02) continue;
    mapped.push({ text: w.text, start: safeStart, end: safeEnd });
  }
  return mapped;
}
