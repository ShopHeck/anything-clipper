// Converts a UGC script + TTS section timing into word-level SpecWord[]
// for caption burning. Distributes timing proportionally across words
// within each section based on character count.

import type { SpecWord } from '@/lib/render/types';
import type { SectionTiming, UGCScript } from '@/lib/tts/types';

/** Ordered sections matching TTS concatenation order. */
const SCRIPT_SECTIONS: (keyof UGCScript)[] = [
  'hook',
  'problem',
  'solution',
  'demo',
  'cta',
];

/**
 * Split text into individual words, filtering out empty strings.
 */
function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Distribute timing across words proportionally based on character count.
 * Each word gets time proportional to its character length relative to
 * the total characters in the section. A small minimum gap (10ms) is
 * enforced between words to avoid zero-duration issues.
 */
function distributeTimingToWords(
  words: string[],
  startSec: number,
  endSec: number
): SpecWord[] {
  if (words.length === 0) return [];

  const totalDuration = endSec - startSec;
  if (totalDuration <= 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  if (totalChars === 0) return [];

  const result: SpecWord[] = [];
  let cursor = startSec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const proportion = word.length / totalChars;
    const wordDuration = totalDuration * proportion;
    const wordEnd = i === words.length - 1 ? endSec : cursor + wordDuration;

    result.push({
      text: word,
      start: Math.round(cursor * 1000) / 1000,
      end: Math.round(wordEnd * 1000) / 1000,
    });

    cursor = wordEnd;
  }

  return result;
}

/**
 * Convert a UGC script and its TTS section timings into word-level
 * SpecWord[] suitable for caption burning via the ASS pipeline.
 *
 * @param script - The UGC script with all sections
 * @param timings - Per-section timing markers from scriptToAudio
 * @returns Array of SpecWord with word-level start/end times
 */
export function captionsFromScript(
  script: UGCScript,
  timings: SectionTiming[]
): SpecWord[] {
  const result: SpecWord[] = [];

  for (const timing of timings) {
    const sectionKey = timing.section as keyof UGCScript;
    if (!SCRIPT_SECTIONS.includes(sectionKey)) continue;

    const text = script[sectionKey];
    if (!text || text.trim().length === 0) continue;

    const words = splitWords(text);
    const wordTimings = distributeTimingToWords(words, timing.startSec, timing.endSec);
    result.push(...wordTimings);
  }

  return result;
}
