import { describe, expect, it } from 'vitest';
import { captionsFromScript } from './captions-from-script';
import type { SectionTiming, UGCScript } from '@/lib/tts/types';

const sampleScript: UGCScript = {
  hook: 'This product is amazing',
  problem: 'My skin was always dry and flaky',
  solution: 'Until I found this moisturizer',
  demo: 'Apply twice daily for best results',
  socialProof: 'Five stars from thousands of users',
  cta: 'Buy now and save fifty percent',
};

const sampleTimings: SectionTiming[] = [
  { section: 'hook', startSec: 0, endSec: 2 },
  { section: 'problem', startSec: 2.6, endSec: 5 },
  { section: 'solution', startSec: 5.6, endSec: 8 },
  { section: 'demo', startSec: 8.6, endSec: 11 },
  { section: 'socialProof', startSec: 11.6, endSec: 14 },
  { section: 'cta', startSec: 14.6, endSec: 17 },
];

describe('captionsFromScript', () => {
  it('produces words for all script sections', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);
    expect(words.length).toBeGreaterThan(0);

    // Should have a word for every word in the script
    const totalScriptWords =
      sampleScript.hook.split(/\s+/).length +
      sampleScript.problem.split(/\s+/).length +
      sampleScript.solution.split(/\s+/).length +
      sampleScript.demo.split(/\s+/).length +
      sampleScript.socialProof.split(/\s+/).length +
      sampleScript.cta.split(/\s+/).length;
    expect(words.length).toBe(totalScriptWords);
  });

  it('distributes timing proportionally by character count', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);

    // First section "This product is amazing" (0 to 2 seconds)
    const hookWords = words.filter((w) => w.start >= 0 && w.end <= 2);
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
    expect(lastHookWord.end).toBe(2);
  });

  it('handles empty sections gracefully', () => {
    const partialScript: UGCScript = {
      hook: 'Hello world',
      problem: '',
      solution: 'The fix',
      demo: '',
      socialProof: '',
      cta: 'Buy now',
    };
    const timings: SectionTiming[] = [
      { section: 'hook', startSec: 0, endSec: 2 },
      { section: 'solution', startSec: 2.6, endSec: 4 },
      { section: 'cta', startSec: 4.6, endSec: 6 },
    ];
    const words = captionsFromScript(partialScript, timings);
    expect(words.length).toBe(6); // "Hello", "world", "The", "fix", "Buy", "now"
    expect(words[0].text).toBe('Hello');
    expect(words[1].text).toBe('world');
    expect(words[2].text).toBe('The');
    expect(words[3].text).toBe('fix');
    expect(words[4].text).toBe('Buy');
    expect(words[5].text).toBe('now');
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
      problem: '',
      solution: '',
      demo: '',
      socialProof: '',
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

    // Problem section words should be within [2.6, 5]
    const hookWordCount = sampleScript.hook.split(/\s+/).length;
    const problemWordCount = sampleScript.problem.split(/\s+/).length;

    const problemWords = words.slice(hookWordCount, hookWordCount + problemWordCount);
    for (const w of problemWords) {
      expect(w.start).toBeGreaterThanOrEqual(2.6);
      expect(w.end).toBeLessThanOrEqual(5);
    }
  });
});
