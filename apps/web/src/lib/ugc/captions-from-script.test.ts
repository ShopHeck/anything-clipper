import { describe, expect, it } from 'vitest';
import { captionsFromScript } from './captions-from-script';
import type { SectionTiming, UGCScript } from '@/lib/tts/types';

const sampleScript: UGCScript = {
  hook: 'This product is amazing',
  keyPoints: 'Hydrates instantly and fights aging like nothing else',
  cta: 'Buy now and save fifty percent',
};

const sampleTimings: SectionTiming[] = [
  { section: 'hook', startSec: 0, endSec: 4 },
  { section: 'keyPoints', startSec: 4.3, endSec: 10 },
  { section: 'cta', startSec: 10.3, endSec: 14 },
];

describe('captionsFromScript', () => {
  it('produces words for all script sections', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);
    expect(words.length).toBeGreaterThan(0);

    // Should have a word for every word in the script
    const totalScriptWords =
      sampleScript.hook.split(/\s+/).length +
      sampleScript.keyPoints.split(/\s+/).length +
      sampleScript.cta.split(/\s+/).length;
    expect(words.length).toBe(totalScriptWords);
  });

  it('distributes timing proportionally by character count', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);

    // First section "This product is amazing" (0 to 4 seconds)
    const hookWords = words.filter((w) => w.start >= 0 && w.end <= 4);
    expect(hookWords.length).toBe(4); // "This", "product", "is", "amazing"

    // Longer words should get more time
    const productWord = hookWords.find((w) => w.text === 'product')!;
    const isWord = hookWords.find((w) => w.text === 'is')!;
    const productDuration = productWord.end - productWord.start;
    const isDuration = isWord.end - isWord.start;
    expect(productDuration).toBeGreaterThan(isDuration);
  });

  it('covers the full timing range for each section with no gaps', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);

    // Check first section coverage
    const firstWord = words[0];
    expect(firstWord.start).toBe(0);

    // Check last word of first section ends at section end
    const hookWordCount = sampleScript.hook.split(/\s+/).length;
    const lastHookWord = words[hookWordCount - 1];
    expect(lastHookWord.end).toBe(4);
  });

  it('handles empty sections gracefully', () => {
    const partialScript: UGCScript = {
      hook: 'Hello world',
      keyPoints: '',
      cta: 'Buy now',
    };
    const timings: SectionTiming[] = [
      { section: 'hook', startSec: 0, endSec: 2 },
      { section: 'cta', startSec: 2.3, endSec: 4 },
    ];
    const words = captionsFromScript(partialScript, timings);
    expect(words.length).toBe(4); // "Hello", "world", "Buy", "now"
    expect(words[0].text).toBe('Hello');
    expect(words[1].text).toBe('world');
    expect(words[2].text).toBe('Buy');
    expect(words[3].text).toBe('now');
  });

  it('handles unknown section names in timings', () => {
    const timings: SectionTiming[] = [
      { section: 'hook', startSec: 0, endSec: 2 },
      { section: 'unknownSection', startSec: 2, endSec: 4 },
    ];
    const words = captionsFromScript(sampleScript, timings);
    // Should only produce words for the known section
    const hookWordCount = sampleScript.hook.split(/\s+/).length;
    expect(words.length).toBe(hookWordCount);
  });

  it('preserves word ordering across sections', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);

    // Verify monotonically increasing timestamps
    for (let i = 1; i < words.length; i++) {
      expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].start);
    }
  });

  it('returns empty array for empty script/timings', () => {
    const emptyScript: UGCScript = {
      hook: '',
      keyPoints: '',
      cta: '',
    };
    const words = captionsFromScript(emptyScript, []);
    expect(words).toEqual([]);
  });

  it('rounds timestamps to millisecond precision', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);
    for (const word of words) {
      // Check that we have at most 3 decimal places
      const startDecimals = word.start.toString().split('.')[1]?.length ?? 0;
      const endDecimals = word.end.toString().split('.')[1]?.length ?? 0;
      expect(startDecimals).toBeLessThanOrEqual(3);
      expect(endDecimals).toBeLessThanOrEqual(3);
    }
  });

  it('correctly positions words within their section timing window', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);

    // keyPoints section words should be within [4.3, 10]
    const hookWordCount = sampleScript.hook.split(/\s+/).length;
    const keyPointsWordCount = sampleScript.keyPoints.split(/\s+/).length;

    const keyPointsWords = words.slice(hookWordCount, hookWordCount + keyPointsWordCount);
    for (const w of keyPointsWords) {
      expect(w.start).toBeGreaterThanOrEqual(4.3);
      expect(w.end).toBeLessThanOrEqual(10);
    }
  });
});
