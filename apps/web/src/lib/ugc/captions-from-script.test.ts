import { describe, expect, it } from 'vitest';
import { captionsFromScript } from './captions-from-script';
import type { SectionTiming, UGCScript } from '@/lib/tts/types';

const sampleScript: UGCScript = {
  hook: 'This product is amazing',
  problem: 'Dry skin is the worst especially in winter',
  solution: 'This serum hydrates instantly and fights aging like nothing else',
  demo: 'Just apply two drops morning and night and watch the glow',
  cta: 'Buy now and save fifty percent',
};

const sampleTimings: SectionTiming[] = [
  { section: 'hook', startSec: 0, endSec: 4 },
  { section: 'problem', startSec: 4.3, endSec: 8 },
  { section: 'solution', startSec: 8.3, endSec: 14 },
  { section: 'demo', startSec: 14.3, endSec: 20 },
  { section: 'cta', startSec: 20.3, endSec: 24 },
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
      problem: '',
      solution: '',
      demo: '',
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
      problem: '',
      solution: '',
      demo: '',
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

    // problem section words should be within [4.3, 8]
    const hookWordCount = sampleScript.hook.split(/\s+/).length;
    const problemWordCount = sampleScript.problem.split(/\s+/).length;

    const problemWords = words.slice(hookWordCount, hookWordCount + problemWordCount);
    for (const w of problemWords) {
      expect(w.start).toBeGreaterThanOrEqual(4.3);
      expect(w.end).toBeLessThanOrEqual(8);
    }
  });

  it('handles all 5 sections correctly', () => {
    const words = captionsFromScript(sampleScript, sampleTimings);

    // Verify words from the demo section exist
    const demoText = sampleScript.demo;
    const demoFirstWord = demoText.split(/\s+/)[0];
    const foundDemoWord = words.find((w) => w.text === demoFirstWord && w.start >= 14.3);
    expect(foundDemoWord).toBeDefined();
  });
});
