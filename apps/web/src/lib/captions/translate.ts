// Caption translation. Translates grouped caption LINES (not raw words) so
// timing is preserved: each source line keeps its [start, end] and gets
// translated text. The translated line is re-distributed into pseudo-words
// for karaoke rendering.
import { chatCompletionJson } from '@/app/api/utils/ai';
import { CaptionLine, TimedWord } from './ass';

export interface TranslatedLine {
  start: number;
  end: number;
  text: string;
}

const TRANSLATION_SCHEMA = {
  name: 'translated_lines',
  schema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number' },
            text: { type: 'string' },
          },
          required: ['index', 'text'],
          additionalProperties: false,
        },
      },
    },
    required: ['lines'],
    additionalProperties: false,
  },
} as const;

// Translate caption lines in batches to bound prompt size.
export async function translateLines(
  lines: CaptionLine[],
  targetLanguage: string,
  opts: { batchSize?: number } = {}
): Promise<TranslatedLine[]> {
  const batchSize = opts.batchSize ?? 40;
  const out: TranslatedLine[] = [];

  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);
    const numbered = batch
      .map((l, j) => `[${j}] ${l.words.map((w) => w.text).join(' ')}`)
      .join('\n');

    const parsed = await chatCompletionJson<{ lines: Array<{ index: number; text: string }> }>(
      [
        {
          role: 'system',
          content: `You translate short-form video captions into ${targetLanguage}. Keep each line punchy and roughly the same length. Preserve meaning and tone. Return one translation per input line, by index. Do not merge or split lines.`,
        },
        {
          role: 'user',
          content: `Translate these caption lines into ${targetLanguage}:\n${numbered}`,
        },
      ],
      TRANSLATION_SCHEMA
    );

    const byIndex = new Map(parsed.lines.map((l) => [l.index, l.text]));
    batch.forEach((line, j) => {
      out.push({
        start: line.start,
        end: line.end,
        text: byIndex.get(j) ?? line.words.map((w) => w.text).join(' '),
      });
    });
  }

  return out;
}

// Spread a translated line's words evenly across its [start, end] so the
// karaoke renderer (which works on TimedWord[]) can animate it.
export function translatedLinesToWords(lines: TranslatedLine[]): TimedWord[] {
  const words: TimedWord[] = [];
  for (const line of lines) {
    const tokens = line.text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const per = (line.end - line.start) / tokens.length;
    tokens.forEach((text, i) => {
      words.push({ text, start: line.start + i * per, end: line.start + (i + 1) * per });
    });
  }
  return words;
}
