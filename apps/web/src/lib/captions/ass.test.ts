import { describe, expect, it } from 'vitest';
import { buildAss, groupWordsIntoLines } from './ass';
import { getCaptionTemplate } from './templates';

const words = (texts: string[], startAt = 0, per = 0.4) =>
  texts.map((text, i) => ({
    text,
    start: startAt + i * per,
    end: startAt + (i + 1) * per,
  }));

describe('groupWordsIntoLines', () => {
  it('caps lines at maxWords', () => {
    const lines = groupWordsIntoLines(words(['a', 'b', 'c', 'd', 'e', 'f']), { maxWords: 4 });
    expect(lines.map((l) => l.words.length)).toEqual([4, 2]);
  });

  it('breaks on speech gaps', () => {
    const input = [
      { text: 'hello', start: 0, end: 0.4 },
      { text: 'world', start: 0.45, end: 0.8 },
      { text: 'pause', start: 2.5, end: 2.9 }, // 1.7s gap before this
    ];
    const lines = groupWordsIntoLines(input);
    expect(lines.length).toBe(2);
    expect(lines[0].words.map((w) => w.text)).toEqual(['hello', 'world']);
  });

  it('breaks at sentence-ending punctuation', () => {
    const lines = groupWordsIntoLines(words(['That', 'works.', 'Next', 'line']));
    expect(lines[0].words.map((w) => w.text)).toEqual(['That', 'works.']);
  });
});

describe('buildAss', () => {
  it('produces karaoke timing tags and valid timestamps', () => {
    const lines = groupWordsIntoLines(words(['viral', 'clip'], 1));
    const ass = buildAss(lines, {
      template: getCaptionTemplate('hormozi'),
      playResX: 1080,
      playResY: 1920,
    });

    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('PlayResY: 1920');
    // Two karaoke words, 40cs each
    expect(ass).toContain('{\\k40}VIRAL {\\k40}CLIP');
    expect(ass).toContain('Dialogue: 0,0:00:01.00,0:00:01.80,Caption');
  });

  it('uppercases only when the template says so', () => {
    const lines = groupWordsIntoLines(words(['Hello'], 0));
    const ass = buildAss(lines, {
      template: getCaptionTemplate('tiktok'),
      playResX: 1080,
      playResY: 1920,
    });
    expect(ass).toContain('Hello');
    expect(ass).not.toContain('HELLO');
  });

  it('escapes braces that would break ASS override blocks', () => {
    const lines = groupWordsIntoLines([{ text: '{evil}', start: 0, end: 0.5 }]);
    const ass = buildAss(lines, {
      template: getCaptionTemplate('hormozi'),
      playResX: 1080,
      playResY: 1920,
    });
    expect(ass).toContain('(EVIL)');
  });
});
