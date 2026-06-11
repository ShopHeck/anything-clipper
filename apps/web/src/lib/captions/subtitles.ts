// SRT / WebVTT export from word-level timestamps. Reuses the same line
// grouping as the burned ASS captions so the downloadable subtitle file
// matches what's on screen.
import { CaptionLine, groupWordsIntoLines, TimedWord } from './ass';

function pad(n: number, width = 2): string {
  return String(Math.floor(n)).padStart(width, '0');
}

function timestamp(seconds: number, msSep: ',' | '.'): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sec)}${msSep}${pad(ms, 3)}`;
}

function lineText(line: CaptionLine): string {
  return line.words
    .map((w) => w.text)
    .join(' ')
    .trim();
}

export function linesToSrt(lines: CaptionLine[]): string {
  return lines
    .map((line, i) => {
      const start = timestamp(line.start, ',');
      const end = timestamp(line.end, ',');
      return `${i + 1}\n${start} --> ${end}\n${lineText(line)}`;
    })
    .join('\n\n')
    .concat('\n');
}

export function linesToVtt(lines: CaptionLine[]): string {
  const cues = lines
    .map((line) => {
      const start = timestamp(line.start, '.');
      const end = timestamp(line.end, '.');
      return `${start} --> ${end}\n${lineText(line)}`;
    })
    .join('\n\n');
  return `WEBVTT\n\n${cues}\n`;
}

export type SubtitleFormat = 'srt' | 'vtt';

export function buildSubtitles(words: TimedWord[], format: SubtitleFormat): string {
  const lines = groupWordsIntoLines(words);
  return format === 'vtt' ? linesToVtt(lines) : linesToSrt(lines);
}

export function subtitleContentType(format: SubtitleFormat): string {
  return format === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8';
}
