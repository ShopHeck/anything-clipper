import { describe, expect, it } from 'vitest';
import { mapWordsToOutput, normalizeCuts, outputDuration, sourceToOutputTime } from './time';

describe('normalizeCuts', () => {
  it('clamps cuts to the render window and drops empty ones', () => {
    const cuts = normalizeCuts(
      [
        { start: 0, end: 5 }, // partially before window
        { start: 50, end: 70 }, // partially after window
        { start: 20, end: 20.005 }, // effectively empty
      ],
      2,
      60
    );
    expect(cuts).toEqual([
      { start: 2, end: 5 },
      { start: 50, end: 60 },
    ]);
  });

  it('merges overlapping cuts', () => {
    const cuts = normalizeCuts(
      [
        { start: 10, end: 20 },
        { start: 15, end: 25 },
        { start: 30, end: 35 },
      ],
      0,
      100
    );
    expect(cuts).toEqual([
      { start: 10, end: 25 },
      { start: 30, end: 35 },
    ]);
  });
});

describe('sourceToOutputTime', () => {
  const cuts = [{ start: 10, end: 20 }];

  it('shifts by the trim start', () => {
    expect(sourceToOutputTime(7, 5, [])).toBe(2);
  });

  it('subtracts removed cut time after the cut', () => {
    expect(sourceToOutputTime(25, 0, cuts)).toBe(15);
  });

  it('returns null inside a cut', () => {
    expect(sourceToOutputTime(15, 0, cuts)).toBeNull();
  });

  it('returns null before the trim start', () => {
    expect(sourceToOutputTime(3, 5, [])).toBeNull();
  });
});

describe('outputDuration', () => {
  it('subtracts trims and cuts', () => {
    expect(outputDuration(10, 70, [{ start: 20, end: 30 }])).toBe(50);
  });
});

describe('mapWordsToOutput', () => {
  it('drops words inside cuts and shifts the rest', () => {
    const words = [
      { text: 'keep1', start: 1, end: 2 },
      { text: 'cut', start: 11, end: 12 },
      { text: 'keep2', start: 21, end: 22 },
    ];
    const mapped = mapWordsToOutput(words, 0, 30, [{ start: 10, end: 20 }]);
    expect(mapped).toEqual([
      { text: 'keep1', start: 1, end: 2 },
      { text: 'keep2', start: 11, end: 12 },
    ]);
  });

  it('drops words outside the render window', () => {
    const words = [
      { text: 'before', start: 0, end: 1 },
      { text: 'inside', start: 6, end: 7 },
      { text: 'after', start: 30, end: 31 },
    ];
    const mapped = mapWordsToOutput(words, 5, 20, []);
    expect(mapped).toEqual([{ text: 'inside', start: 1, end: 2 }]);
  });
});
