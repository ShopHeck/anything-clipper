// Builds an ASS (Advanced SubStation Alpha) subtitle file with per-word
// karaoke timing from word-level timestamps. Burned into the video by
// ffmpeg's `ass` filter, and the same data drives SRT/VTT export.
import { CaptionTemplate } from './templates';

export interface TimedWord {
  text: string;
  // Seconds, in OUTPUT time (already shifted/cut-compensated by the caller).
  start: number;
  end: number;
}

export interface CaptionLine {
  start: number;
  end: number;
  words: TimedWord[];
}

// Group words into short caption lines the way short-form captions read
// best: a handful of words at a time, broken early at speech gaps.
export function groupWordsIntoLines(
  words: TimedWord[],
  opts: { maxWords?: number; maxDurationSec?: number; gapBreakSec?: number } = {}
): CaptionLine[] {
  const maxWords = opts.maxWords ?? 4;
  const maxDuration = opts.maxDurationSec ?? 3.5;
  const gapBreak = opts.gapBreakSec ?? 0.6;

  const lines: CaptionLine[] = [];
  let current: TimedWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    current.push(word);

    const lineDuration = word.end - current[0].start;
    const next = words[i + 1];
    const gap = next ? next.start - word.end : Infinity;
    const endsSentence = /[.!?]$/.test(word.text);

    if (
      current.length >= maxWords ||
      lineDuration >= maxDuration ||
      gap >= gapBreak ||
      endsSentence
    ) {
      flush();
    }
  }
  flush();
  return lines;
}

function toAssTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// ASS colors are &HAABBGGRR (alpha first, then BGR).
function toAssColor(hex: string, alpha = 0): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  const [r, g, b] = m ? [m[1], m[2], m[3]] : ['ff', 'ff', 'ff'];
  return `&H${alpha.toString(16).padStart(2, '0').toUpperCase()}${b}${g}${r}`.toUpperCase();
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')');
}

export interface BuildAssOptions {
  template: CaptionTemplate;
  playResX: number;
  playResY: number;
  position?: 'bottom' | 'center' | 'top';
}

export function buildAss(lines: CaptionLine[], opts: BuildAssOptions): string {
  const { template, playResX, playResY } = opts;
  const fontSize = Math.round(playResY * template.fontScale);
  const outline = template.outlineScale > 0 ? Math.max(1, Math.round(fontSize * template.outlineScale)) : 0;
  // Alignment uses numpad layout: 2 = bottom-center, 5 = middle-center, 8 = top-center.
  const alignment = opts.position === 'top' ? 8 : opts.position === 'center' ? 5 : 2;
  const marginV = Math.round(playResY * 0.18);

  // BorderStyle 3 draws an opaque box using BackColour (MrBeast/TikTok look).
  const borderStyle = template.boxColor ? 3 : 1;
  const backColor = template.boxColor ? toAssColor(template.boxColor) : toAssColor('#000000', 0x80);
  const shadowDepth = template.shadow ? Math.max(1, Math.round(fontSize * 0.06)) : 0;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${template.fontName},${fontSize},${toAssColor(template.highlightColor)},${toAssColor(template.baseColor)},${toAssColor(template.outlineColor)},${backColor},${template.bold ? -1 : 0},0,0,0,100,100,0,0,${borderStyle},${outline},${shadowDepth},${alignment},40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = lines
    .map((line) => {
      // \k karaoke tags: each word fills with PrimaryColour as it's spoken
      // (SecondaryColour before). Durations are in centiseconds.
      const text = line.words
        .map((w, i) => {
          const next = line.words[i + 1];
          const wordEnd = next ? next.start : w.end;
          const durCs = Math.max(1, Math.round((wordEnd - w.start) * 100));
          const raw = template.uppercase ? w.text.toUpperCase() : w.text;
          return `{\\k${durCs}}${escapeAssText(raw)}`;
        })
        .join(' ');
      return `Dialogue: 0,${toAssTime(line.start)},${toAssTime(line.end)},Caption,,0,0,0,,${text}`;
    })
    .join('\n');

  return `${header}${events}\n`;
}
