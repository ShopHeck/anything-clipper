import { describe, expect, it } from 'vitest';
import { chunkTranscript, wordsFromSegments } from './transcript';

describe('chunkTranscript', () => {
  it('covers the whole transcript and preserves time ranges', () => {
    const words = Array.from({ length: 400 }, (_, i) => ({
      text: i % 12 === 11 ? 'end.' : `word${i}`,
      start: i,
      end: i + 1,
    }));
    const chunks = chunkTranscript(words, { targetChars: 200, maxChars: 300 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].startSec).toBe(0);
    expect(chunks[chunks.length - 1].endSec).toBe(400);
    // Chunks are contiguous and ascending.
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startSec).toBeGreaterThanOrEqual(chunks[i - 1].endSec - 1);
    }
  });

  it('returns nothing for empty input', () => {
    expect(chunkTranscript([])).toEqual([]);
  });
});

describe('wordsFromSegments', () => {
  it('spreads words evenly across each segment', () => {
    const words = wordsFromSegments([{ start: 0, end: 2, text: 'a b' }]);
    expect(words).toEqual([
      { text: 'a', start: 0, end: 1 },
      { text: 'b', start: 1, end: 2 },
    ]);
  });
});
