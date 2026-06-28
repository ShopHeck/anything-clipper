// HeyGen talking-avatar provider.
//
// Produces a realistic, smiling talking-head "creator" video that is
// lip-synced to our own TTS voiceover. The avatar carries the hook and the
// CTA ("Purchase from my TikTok Shop") so the finished UGC video looks like a
// real person filmed it — the core of the moras.ai-style experience.
//
// Routing: direct HeyGen REST API with HEYGEN_API_KEY. When the key is not
// configured, the pipeline gracefully falls back to the stock-footage path.
//
// Flow:
//   1. POST /v2/video/generate  -> { data: { video_id } }
//   2. poll GET /v1/video_status.get?video_id=...  until completed/failed
//   3. return the rendered video_url
//
// Docs: https://docs.heygen.com/reference/generate-video

const HEYGEN_API_BASE = 'https://api.heygen.com';

export class HeyGenError extends Error {
  constructor(detail: string) {
    super(`HeyGen avatar generation failed: ${detail}`);
    this.name = 'HeyGenError';
  }
}

/** A HeyGen avatar option surfaced to the UI picker. */
export interface HeyGenAvatar {
  avatarId: string;
  name: string;
  gender?: string;
  previewImageUrl?: string;
  previewVideoUrl?: string;
}

export interface GenerateAvatarVideoOptions {
  /**
   * Public URL of the voiceover audio to lip-sync against. When provided, the
   * avatar speaks exactly our TTS track ("audio" voice mode), guaranteeing the
   * avatar's lips match the voiceover the rest of the pipeline is timed to.
   */
  audioUrl?: string;
  /** Script text — used only when audioUrl is omitted (HeyGen TTS "text" mode). */
  text?: string;
  /** HeyGen voice id for "text" mode. Ignored when audioUrl is provided. */
  voiceId?: string;
  /** Avatar id to drive. Falls back to HEYGEN_DEFAULT_AVATAR_ID. */
  avatarId?: string;
  /** Output width (px). Defaults to 720 (9:16). */
  width?: number;
  /** Output height (px). Defaults to 1280 (9:16). */
  height?: number;
  /** Poll interval in ms. Defaults to 5000. */
  pollIntervalMs?: number;
  /** Max time to wait for the render in ms. Defaults to 240000 (4 min). */
  timeoutMs?: number;
  /** Injectable fetch for testing. */
  fetchImpl?: typeof fetch;
  /** Injectable sleep for testing. */
  sleepImpl?: (ms: number) => Promise<void>;
}

export interface AvatarVideoResult {
  videoId: string;
  videoUrl: string;
  /** Duration in seconds when HeyGen reports it. */
  durationSec?: number;
}

/** True when a HeyGen API key is configured on this deployment. */
export function heygenConfigured(): boolean {
  return Boolean(process.env.HEYGEN_API_KEY);
}

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new HeyGenError('HEYGEN_API_KEY is not configured');
  return key;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * List available avatars for the picker UI. Returns an empty array when the
 * provider is not configured or the request fails, so the UI degrades cleanly.
 */
export async function listAvatars(fetchImpl: typeof fetch = fetch): Promise<HeyGenAvatar[]> {
  if (!heygenConfigured()) return [];

  try {
    const res = await fetchImpl(`${HEYGEN_API_BASE}/v2/avatars`, {
      method: 'GET',
      headers: { 'X-Api-Key': getApiKey(), Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[HeyGen] listAvatars returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    const avatars = data?.data?.avatars;
    if (!Array.isArray(avatars)) return [];
    return avatars
      .filter((a: Record<string, unknown>) => typeof a?.avatar_id === 'string')
      .map((a: Record<string, unknown>) => ({
        avatarId: a.avatar_id as string,
        name: (a.avatar_name as string) || (a.avatar_id as string),
        gender: a.gender as string | undefined,
        previewImageUrl: a.preview_image_url as string | undefined,
        previewVideoUrl: a.preview_video_url as string | undefined,
      }));
  } catch (err) {
    console.warn('[HeyGen] listAvatars failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Build the HeyGen `voice` input from our options. */
export function buildVoiceInput(
  opts: Pick<GenerateAvatarVideoOptions, 'audioUrl' | 'text' | 'voiceId'>
): Record<string, unknown> {
  if (opts.audioUrl) {
    return { type: 'audio', audio_url: opts.audioUrl };
  }
  if (opts.text && opts.voiceId) {
    return { type: 'text', input_text: opts.text, voice_id: opts.voiceId };
  }
  throw new HeyGenError('either audioUrl, or both text and voiceId, must be provided');
}

/** Build the v2/video/generate request body. */
export function buildGenerateBody(opts: GenerateAvatarVideoOptions): Record<string, unknown> {
  const avatarId = opts.avatarId || process.env.HEYGEN_DEFAULT_AVATAR_ID;
  if (!avatarId) {
    throw new HeyGenError('no avatarId provided and HEYGEN_DEFAULT_AVATAR_ID is not set');
  }
  return {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: 'normal',
        },
        voice: buildVoiceInput(opts),
      },
    ],
    dimension: {
      width: opts.width ?? 720,
      height: opts.height ?? 1280,
    },
  };
}

/**
 * Generate a talking-avatar video and wait for the render to complete.
 * Throws HeyGenError on any failure so the caller can fall back.
 */
export async function generateAvatarVideo(
  opts: GenerateAvatarVideoOptions
): Promise<AvatarVideoResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleepImpl ?? defaultSleep;
  const apiKey = getApiKey();

  // 1. Submit the generation request
  const submitRes = await fetchImpl(`${HEYGEN_API_BASE}/v2/video/generate`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(buildGenerateBody(opts)),
  });

  if (!submitRes.ok) {
    const detail = await submitRes.text().catch(() => '');
    throw new HeyGenError(`submit returned ${submitRes.status}: ${detail.slice(0, 200)}`);
  }

  const submitData = await submitRes.json();
  // HeyGen surfaces request errors in the `error` field even on HTTP 200.
  if (submitData?.error) {
    const msg =
      typeof submitData.error === 'string'
        ? submitData.error
        : submitData.error?.message || JSON.stringify(submitData.error);
    throw new HeyGenError(`submit error: ${String(msg).slice(0, 200)}`);
  }
  const videoId: string | undefined = submitData?.data?.video_id;
  if (!videoId) {
    throw new HeyGenError('submit response did not include a video_id');
  }

  // 2. Poll for completion
  const pollIntervalMs = opts.pollIntervalMs ?? 5000;
  const timeoutMs = opts.timeoutMs ?? 240000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const statusRes = await fetchImpl(
      `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      { method: 'GET', headers: { 'X-Api-Key': apiKey, Accept: 'application/json' } }
    );
    if (!statusRes.ok) {
      // Transient status errors shouldn't abort the whole render; keep polling.
      console.warn(`[HeyGen] status poll returned ${statusRes.status}`);
      continue;
    }

    const statusData = await statusRes.json();
    const status: string | undefined = statusData?.data?.status;

    if (status === 'completed') {
      const videoUrl: string | undefined = statusData?.data?.video_url;
      if (!videoUrl) {
        throw new HeyGenError('render completed but no video_url was returned');
      }
      const durationSec =
        typeof statusData?.data?.duration === 'number' ? statusData.data.duration : undefined;
      return { videoId, videoUrl, durationSec };
    }

    if (status === 'failed') {
      const reason =
        statusData?.data?.error?.message ||
        statusData?.data?.error ||
        'unknown error';
      throw new HeyGenError(`render failed: ${String(reason).slice(0, 200)}`);
    }
    // status is 'pending' or 'processing' -> keep polling
  }

  throw new HeyGenError(`render did not complete within ${Math.round(timeoutMs / 1000)}s`);
}
