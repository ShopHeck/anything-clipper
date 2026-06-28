import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  heygenConfigured,
  buildVoiceInput,
  buildGenerateBody,
  generateAvatarVideo,
  listAvatars,
  HeyGenError,
} from './heygen';

const noSleep = async () => {};

afterEach(() => {
  delete process.env.HEYGEN_API_KEY;
  delete process.env.HEYGEN_DEFAULT_AVATAR_ID;
  vi.restoreAllMocks();
});

describe('heygenConfigured', () => {
  it('is false without a key and true with one', () => {
    delete process.env.HEYGEN_API_KEY;
    expect(heygenConfigured()).toBe(false);
    process.env.HEYGEN_API_KEY = 'k';
    expect(heygenConfigured()).toBe(true);
  });
});

describe('buildVoiceInput', () => {
  it('prefers audio mode when audioUrl is provided', () => {
    expect(buildVoiceInput({ audioUrl: 'https://x/a.mp3' })).toEqual({
      type: 'audio',
      audio_url: 'https://x/a.mp3',
    });
  });

  it('uses text mode when text + voiceId provided', () => {
    expect(buildVoiceInput({ text: 'hi', voiceId: 'v1' })).toEqual({
      type: 'text',
      input_text: 'hi',
      voice_id: 'v1',
    });
  });

  it('throws when neither audio nor text+voice is available', () => {
    expect(() => buildVoiceInput({ text: 'hi' })).toThrow(HeyGenError);
  });
});

describe('buildGenerateBody', () => {
  it('builds a 9:16 avatar request with audio voice', () => {
    const body = buildGenerateBody({ audioUrl: 'https://x/a.mp3', avatarId: 'av1' }) as any;
    expect(body.video_inputs[0].character).toEqual({
      type: 'avatar',
      avatar_id: 'av1',
      avatar_style: 'normal',
    });
    expect(body.video_inputs[0].voice).toEqual({ type: 'audio', audio_url: 'https://x/a.mp3' });
    expect(body.dimension).toEqual({ width: 720, height: 1280 });
  });

  it('falls back to HEYGEN_DEFAULT_AVATAR_ID', () => {
    process.env.HEYGEN_DEFAULT_AVATAR_ID = 'env-avatar';
    const body = buildGenerateBody({ audioUrl: 'https://x/a.mp3' }) as any;
    expect(body.video_inputs[0].character.avatar_id).toBe('env-avatar');
  });

  it('throws when no avatar id is available', () => {
    expect(() => buildGenerateBody({ audioUrl: 'https://x/a.mp3' })).toThrow(HeyGenError);
  });
});

describe('generateAvatarVideo', () => {
  it('submits then polls until completed and returns the video url', async () => {
    process.env.HEYGEN_API_KEY = 'k';
    const fetchImpl = vi
      .fn()
      // submit
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: null, data: { video_id: 'vid-1' } }) })
      // first poll - still processing
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { status: 'processing' } }) })
      // second poll - completed
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', video_url: 'https://cdn/v.mp4', duration: 28 } }),
      });

    const result = await generateAvatarVideo({
      audioUrl: 'https://x/a.mp3',
      avatarId: 'av1',
      pollIntervalMs: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: noSleep,
    });

    expect(result).toEqual({ videoId: 'vid-1', videoUrl: 'https://cdn/v.mp4', durationSec: 28 });

    // First call is the submit POST with X-Api-Key
    const [submitUrl, submitInit] = fetchImpl.mock.calls[0];
    expect(submitUrl).toBe('https://api.heygen.com/v2/video/generate');
    expect(submitInit.method).toBe('POST');
    expect(submitInit.headers['X-Api-Key']).toBe('k');

    // Subsequent calls hit the status endpoint with the video id
    expect(fetchImpl.mock.calls[1][0]).toContain('/v1/video_status.get?video_id=vid-1');
  });

  it('throws when submit returns a non-2xx', async () => {
    process.env.HEYGEN_API_KEY = 'k';
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'bad key' });
    await expect(
      generateAvatarVideo({ audioUrl: 'https://x/a.mp3', avatarId: 'av1', fetchImpl: fetchImpl as any, sleepImpl: noSleep })
    ).rejects.toThrow(HeyGenError);
  });

  it('throws when HeyGen reports an error field on a 200 submit', async () => {
    process.env.HEYGEN_API_KEY = 'k';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: { message: 'quota exceeded' } }) });
    await expect(
      generateAvatarVideo({ audioUrl: 'https://x/a.mp3', avatarId: 'av1', fetchImpl: fetchImpl as any, sleepImpl: noSleep })
    ).rejects.toThrow(/quota exceeded/);
  });

  it('throws when the render status is failed', async () => {
    process.env.HEYGEN_API_KEY = 'k';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { video_id: 'vid-2' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'failed', error: { message: 'render error' } } }),
      });
    await expect(
      generateAvatarVideo({
        audioUrl: 'https://x/a.mp3',
        avatarId: 'av1',
        pollIntervalMs: 1,
        fetchImpl: fetchImpl as any,
        sleepImpl: noSleep,
      })
    ).rejects.toThrow(/render failed/);
  });

  it('times out when the render never completes', async () => {
    process.env.HEYGEN_API_KEY = 'k';
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/v2/video/generate')) {
        return { ok: true, json: async () => ({ data: { video_id: 'vid-3' } }) };
      }
      return { ok: true, json: async () => ({ data: { status: 'processing' } }) };
    });
    await expect(
      generateAvatarVideo({
        audioUrl: 'https://x/a.mp3',
        avatarId: 'av1',
        pollIntervalMs: 1,
        timeoutMs: 5,
        fetchImpl: fetchImpl as any,
        sleepImpl: noSleep,
      })
    ).rejects.toThrow(/did not complete/);
  });
});

describe('listAvatars', () => {
  it('returns [] when not configured', async () => {
    delete process.env.HEYGEN_API_KEY;
    expect(await listAvatars()).toEqual([]);
  });

  it('maps the avatar list response', async () => {
    process.env.HEYGEN_API_KEY = 'k';
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          avatars: [
            { avatar_id: 'a1', avatar_name: 'Mia', gender: 'female', preview_image_url: 'https://img/a1.png' },
            { avatar_name: 'no id - skipped' },
          ],
        },
      }),
    });
    const result = await listAvatars(fetchImpl as unknown as typeof fetch);
    expect(result).toEqual([
      { avatarId: 'a1', name: 'Mia', gender: 'female', previewImageUrl: 'https://img/a1.png', previewVideoUrl: undefined },
    ]);
  });

  it('returns [] on a failed request', async () => {
    process.env.HEYGEN_API_KEY = 'k';
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    expect(await listAvatars(fetchImpl as unknown as typeof fetch)).toEqual([]);
  });
});
