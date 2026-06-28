// Converts a full UGC script into a single timed voiceover audio file.
// Each script section is concatenated with natural pauses between them.
// Returns per-section timing markers for video composition sync.
import { presignDownload, presignUpload } from '@/app/api/utils/storage';
import { generateTTS } from './generate';
import type { ScriptToAudioResult, SectionTiming, TTSVoice, UGCScript } from './types';

/** Average speaking rate in characters per second at speed 1.2 (OpenAI TTS). */
const CHARS_PER_SECOND = 17;

/** Pause duration in seconds between script sections. */
const SECTION_PAUSE_SEC = 0.3;

/** Ordered sections from a UGC script for voiceover. */
const SCRIPT_SECTIONS: (keyof UGCScript)[] = [
  'hook',
  'problem',
  'solution',
  'demo',
  'cta',
];

/**
 * Estimate the spoken duration of a text segment based on character count and speed.
 * This is used for timing marker calculations before we have actual audio duration.
 */
export function estimateDuration(text: string, speed = 1.0): number {
  if (!text || text.trim().length === 0) return 0;
  const charCount = text.trim().length;
  return charCount / (CHARS_PER_SECOND * speed);
}

/**
 * Calculate per-section timing markers for a UGC script.
 * Returns the timing of each section within the concatenated audio,
 * including pauses between sections.
 * Duration is uncapped - the script determines the natural length (typically 20-35 sec).
 */
export function calculateTimings(script: UGCScript, speed = 1.0): SectionTiming[] {
  const timings: SectionTiming[] = [];
  let cursor = 0;

  for (let i = 0; i < SCRIPT_SECTIONS.length; i++) {
    const section = SCRIPT_SECTIONS[i];
    const text = script[section];
    if (!text || text.trim().length === 0) continue;

    const duration = estimateDuration(text, speed);
    timings.push({
      section,
      startSec: Math.round(cursor * 100) / 100,
      endSec: Math.round((cursor + duration) * 100) / 100,
    });

    cursor += duration;

    // Add pause after each section except the last
    if (i < SCRIPT_SECTIONS.length - 1) {
      cursor += SECTION_PAUSE_SEC;
    }
  }

  return timings;
}

/**
 * Calculate total estimated duration including pauses.
 */
export function estimateTotalDuration(script: UGCScript, speed = 1.0): number {
  const timings = calculateTimings(script, speed);
  if (timings.length === 0) return 0;
  return timings[timings.length - 1].endSec;
}

/**
 * Concatenate all script sections into a single text block with pause markers.
 * Uses triple newlines as pause separators (OpenAI TTS treats them as pauses).
 */
export function buildFullText(script: UGCScript): string {
  const sections = SCRIPT_SECTIONS.map((key) => script[key])
    .filter((text) => text && text.trim().length > 0);

  // Join with ellipsis + newlines to create natural pauses in TTS output
  return sections.join('\n\n...\n\n');
}

export interface ScriptToAudioOptions {
  script: UGCScript;
  voice?: TTSVoice;
  speed?: number;
  /** Storage key for the output audio file. */
  storageKey: string;
}

/**
 * Process a full UGC script into a single voiceover audio file.
 * Generates TTS audio, uploads to object storage, and returns timing markers.
 */
export async function scriptToAudio(opts: ScriptToAudioOptions): Promise<ScriptToAudioResult> {
  const { script, voice = 'nova', speed = 1.0, storageKey } = opts;

  // Build concatenated text from all script sections
  const fullText = buildFullText(script);
  if (fullText.trim().length === 0) {
    throw new Error('Script has no content to convert to audio');
  }

  // Generate TTS audio
  const audioBuffer = await generateTTS({ text: fullText, voice, speed });

  // Upload to object storage
  const uploadUrl = presignUpload(storageKey, 3600);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/mpeg' },
    body: new Uint8Array(audioBuffer),
  });
  if (!uploadRes.ok) {
    throw new Error(`Failed to upload TTS audio (${uploadRes.status})`);
  }

  // Build the download URL
  const audioUrl = presignDownload(storageKey);

  // Calculate timing markers based on estimated durations
  const timings = calculateTimings(script, speed);
  const durationSec = timings.length > 0 ? timings[timings.length - 1].endSec : 0;

  return { audioUrl, durationSec, timings };
}
