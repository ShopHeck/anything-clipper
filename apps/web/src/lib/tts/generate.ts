// TTS voiceover generation service.
// Calls OpenAI's TTS API via the existing project proxy or directly.
import type { TTSVoice } from './types';

export class TTSUnavailableError extends Error {
  constructor(detail: string) {
    super(`TTS service unavailable: ${detail}`);
    this.name = 'TTSUnavailableError';
  }
}

export interface GenerateTTSOptions {
  text: string;
  voice?: TTSVoice;
  speed?: number;
}

/**
 * Generate speech audio from text using OpenAI's TTS API.
 * Returns the raw audio buffer (MP3 format).
 *
 * Routing priority:
 * 1. NEXT_PUBLIC_CREATE_BASE_URL proxy with ANYTHING_PROJECT_TOKEN
 * 2. Direct OpenAI API with OPENAI_API_KEY
 */
export async function generateTTS(opts: GenerateTTSOptions): Promise<Buffer> {
  const { text, voice = 'nova', speed = 1.0 } = opts;

  if (!text || text.trim().length === 0) {
    throw new TTSUnavailableError('Text content is required');
  }

  const proxyBase = process.env.NEXT_PUBLIC_CREATE_BASE_URL;
  const proxyToken = process.env.ANYTHING_PROJECT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  let url: string;
  let headers: Record<string, string>;

  if (proxyBase && proxyToken) {
    // Route through the project proxy
    url = `${proxyBase}/integrations/text-to-speech`;
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${proxyToken}`,
    };
  } else if (openaiKey) {
    // Direct OpenAI API fallback
    url = 'https://api.openai.com/v1/audio/speech';
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    };
  } else {
    throw new TTSUnavailableError('TTS integration is not configured on this deployment');
  }

  const body = JSON.stringify({
    model: 'tts-1',
    input: text,
    voice,
    speed,
    response_format: 'mp3',
  });

  const res = await fetch(url, { method: 'POST', headers, body });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new TTSUnavailableError(
      `upstream returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new TTSUnavailableError('upstream returned empty audio');
  }

  return Buffer.from(arrayBuffer);
}
