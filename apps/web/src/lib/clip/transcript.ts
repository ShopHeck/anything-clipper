// Chunk long transcripts so the WHOLE video is analyzed (the old code only
// looked at the first ~2000 chars ≈ 5 min). Each chunk carries its source
// time range so clip timestamps map back to the original video.
export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptChunk {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

// Split words into chunks of roughly `targetChars`, breaking on sentence
// boundaries when possible so chunks read coherently for the LLM.
export function chunkTranscript(
  words: TimedWord[],
  opts: { targetChars?: number; maxChars?: number } = {}
): TranscriptChunk[] {
  const target = opts.targetChars ?? 4000;
  const max = opts.maxChars ?? 6000;
  const chunks: TranscriptChunk[] = [];
  if (words.length === 0) return chunks;

  let bucket: TimedWord[] = [];
  let chars = 0;

  const flush = () => {
    if (bucket.length === 0) return;
    chunks.push({
      index: chunks.length,
      startSec: bucket[0].start,
      endSec: bucket[bucket.length - 1].end,
      text: bucket.map((w) => w.text).join(' '),
    });
    bucket = [];
    chars = 0;
  };

  for (const w of words) {
    bucket.push(w);
    chars += w.text.length + 1;
    const endsSentence = /[.!?]$/.test(w.text);
    if ((chars >= target && endsSentence) || chars >= max) {
      flush();
    }
  }
  flush();
  return chunks;
}

// Build the words array from segment text when word-level timestamps aren't
// available, spreading evenly across each segment (parity with the renderer's
// synthesizeWordsFromSegments).
export function wordsFromSegments(
  segments: Array<{ start: number; end: number; text: string }>
): TimedWord[] {
  const words: TimedWord[] = [];
  for (const seg of segments) {
    const tokens = seg.text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const per = (seg.end - seg.start) / tokens.length;
    tokens.forEach((text, i) => {
      words.push({ text, start: seg.start + i * per, end: seg.start + (i + 1) * per });
    });
  }
  return words;
}
