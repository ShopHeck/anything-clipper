import { describe, expect, it } from 'vitest';
import { detectFillerCuts, detectSilences, snapClipBoundaries, TimedWord } from './boundaries';

// "Hello world. [0.5s gap] This is a test! [1s gap] Final words."
const words: TimedWord[] = [
  { text: 'Hello', start: 0.0, end: 0.4 },
  { text: 'world.', start: 0.4, end: 0.9 },
  { text: 'This', start: 1.4, end: 1.7 },
  { text: 'is', start: 1.7, end: 1.9 },
  { text: 'a', start: 1.9, end: 2.0 },
  { text: 'test!', start: 2.0, end: 2.6 },
  { text: 'Final', start: 3.6, end: 4.0 },
  { text: 'words.', start: 4.0, end: 4.6 },
];

describe('snapClipBoundaries', () => {
  it('snaps start forward to a phrase start and end to a sentence end', () => {
    // Raw window starts mid-first-phrase and ends mid-second.
    const { start, end } = snapClipBoundaries(words, 1.3, 2.7);
    expect(start).toBe(1.4); // start of "This"
    expect(end).toBe(2.6); // end of "test!"
  });

  it('leaves the window untouched when no boundary is within tolerance', () => {
    const res = snapClipBoundaries(words, 1.45, 2.55, { toleranceSec: 0.01 });
    expect(res.start).toBe(1.45);
    expect(res.end).toBe(2.55);
  });

  it('never returns an inverted window', () => {
    const res = snapClipBoundaries(words, 4.0, 3.9);
    expect(res.end).toBeGreaterThan(res.start);
  });
});

describe('detectSilences', () => {
  it('finds gaps longer than the threshold', () => {
    const silences = detectSilences(words, { minSilenceSec: 0.8, padSec: 0 });
    // Gaps: 0.9→1.4 (0.5, below) ; 2.6→3.6 (1.0, above)
    expect(silences).toEqual([{ start: 2.6, end: 3.6 }]);
  });
});

describe('detectFillerCuts', () => {
  it('cuts hard fillers by default', () => {
    const w: TimedWord[] = [
      { text: 'So', start: 0, end: 0.2 },
      { text: 'um', start: 0.2, end: 0.5 },
      { text: 'yeah', start: 0.5, end: 0.8 },
    ];
    const cuts = detectFillerCuts(w);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].text).toBe('um');
  });

  it('includes soft fillers only when asked', () => {
    const w: TimedWord[] = [{ text: 'basically', start: 0, end: 0.5 }];
    expect(detectFillerCuts(w)).toHaveLength(0);
    expect(detectFillerCuts(w, { includeSoft: true })).toHaveLength(1);
  });
});
