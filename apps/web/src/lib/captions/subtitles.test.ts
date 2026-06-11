import { describe, expect, it } from 'vitest';
import { TimedWord } from './ass';
import { buildSubtitles, subtitleContentType } from './subtitles';
import { translatedLinesToWords } from './translate';

const words: TimedWord[] = [
  { text: 'Hello', start: 0, end: 0.4 },
  { text: 'world.', start: 0.4, end: 0.9 },
  { text: 'Next', start: 1.5, end: 1.8 },
  { text: 'line.', start: 1.8, end: 2.2 },
];

describe('buildSubtitles (SRT)', () => {
  it('emits numbered cues with comma millisecond separators', () => {
    const srt = buildSubtitles(words, 'srt');
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:00,900\nHello world.');
    expect(srt).toContain('2\n00:00:01,500 --> 00:00:02,200\nNext line.');
  });
});

describe('buildSubtitles (VTT)', () => {
  it('starts with the WEBVTT header and uses dot separators', () => {
    const vtt = buildSubtitles(words, 'vtt');
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:00.900');
  });
});

describe('subtitleContentType', () => {
  it('maps formats to MIME types', () => {
    expect(subtitleContentType('vtt')).toContain('text/vtt');
    expect(subtitleContentType('srt')).toContain('x-subrip');
  });
});

describe('translatedLinesToWords', () => {
  it('spreads a translated line evenly across its time window', () => {
    const out = translatedLinesToWords([{ start: 0, end: 2, text: 'hola mundo' }]);
    expect(out).toEqual([
      { text: 'hola', start: 0, end: 1 },
      { text: 'mundo', start: 1, end: 2 },
    ]);
  });

  it('skips empty translations', () => {
    expect(translatedLinesToWords([{ start: 0, end: 1, text: '   ' }])).toEqual([]);
  });
});
