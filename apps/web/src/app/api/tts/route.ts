import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import { presignDownload, presignUpload } from '@/app/api/utils/storage';
import { generateTTS, TTSUnavailableError } from '@/lib/tts/generate';
import type { TTSRequest, TTSVoice } from '@/lib/tts/types';

const VALID_VOICES: TTSVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'ai.tts', {
    limit: 20,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const body = (await request.json()) as TTSRequest;

    if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }

    if (body.text.length > 4096) {
      return Response.json({ error: 'text exceeds maximum length (4096 chars)' }, { status: 400 });
    }

    const voice: TTSVoice = body.voice && VALID_VOICES.includes(body.voice) ? body.voice : 'nova';
    const speed = typeof body.speed === 'number' ? Math.max(0.25, Math.min(4.0, body.speed)) : 1.0;

    // Generate TTS audio
    const audioBuffer = await generateTTS({ text: body.text, voice, speed });

    // Upload to object storage
    const jobId = crypto.randomUUID();
    const storageKey = `tts/${user.id}/${jobId}.mp3`;
    const uploadUrl = presignUpload(storageKey, 3600);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: new Uint8Array(audioBuffer),
    });
    if (!uploadRes.ok) {
      throw new Error(`Storage upload failed (${uploadRes.status})`);
    }

    const audioUrl = presignDownload(storageKey);

    // Estimate duration based on audio buffer size.
    // MP3 at 128kbps: byteLength / (128000 / 8) = seconds
    const durationSec = Math.round((audioBuffer.byteLength / 16000) * 100) / 100;

    return Response.json({ audioUrl, durationSec });
  } catch (error) {
    if (error instanceof TTSUnavailableError) {
      console.error('TTS route error:', error.message);
      return Response.json(
        { error: 'The TTS service is temporarily unavailable. Please try again in a moment.' },
        { status: 502 }
      );
    }
    console.error('TTS route error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
