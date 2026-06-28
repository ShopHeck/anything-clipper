import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  brollConfigured,
  snapDuration,
  generateProductBroll,
  DEFAULT_FAL_VIDEO_MODEL,
  BrollError,
} from './broll';

const noSleep = async () => {};

afterEach(() => {
  delete process.env.FAL_KEY;
  delete process.env.FAL_VIDEO_MODEL;
  vi.restoreAllMocks();
});

describe('brollConfigured', () => {
  it('reflects presence of FAL_KEY', () => {
    delete process.env.FAL_KEY;
    expect(brollConfigured()).toBe(false);
    process.env.FAL_KEY = 'k';
    expect(brollConfigured()).toBe(true);
  });
});

describe('snapDuration', () => {
  it('snaps to "5" for short/undefined durations', () => {
    expect(snapDuration(undefined)).toBe('5');
    expect(snapDuration(4)).toBe('5');
    expect(snapDuration(5)).toBe('5');
  });

  it('snaps to "10" for durations longer than 5s', () => {
    expect(snapDuration(6)).toBe('10');
    expect(snapDuration(9.9)).toBe('10');
  });
});

describe('generateProductBroll', () => {
  it('submits to the default model, polls, and returns the video url', async () => {
    process.env.FAL_KEY = 'falkey';
    const fetchImpl = vi
      .fn()
      // submit
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          request_id: 'req-1',
          status_url: 'https://queue.fal.run/status/req-1',
          response_url: 'https://queue.fal.run/result/req-1',
        }),
      })
      // poll - in progress
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'IN_PROGRESS' }) })
      // poll - completed
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'COMPLETED' }) })
      // result fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ video: { url: 'https://cdn/broll.mp4' } }) });

    const result = await generateProductBroll({
      imageUrl: 'https://img/p.jpg',
      prompt: 'product in use',
      durationSec: 6,
      pollIntervalMs: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: noSleep,
    });

    expect(result).toEqual({ videoUrl: 'https://cdn/broll.mp4' });

    // submit goes to the default model with a Key auth header and a "10" duration
    const [submitUrl, submitInit] = fetchImpl.mock.calls[0];
    expect(submitUrl).toBe(`https://queue.fal.run/${DEFAULT_FAL_VIDEO_MODEL}`);
    expect(submitInit.headers.Authorization).toBe('Key falkey');
    expect(JSON.parse(submitInit.body)).toEqual({
      prompt: 'product in use',
      image_url: 'https://img/p.jpg',
      duration: '10',
    });

    // poll uses the returned status_url
    expect(fetchImpl.mock.calls[1][0]).toBe('https://queue.fal.run/status/req-1');
    // result uses the returned response_url
    expect(fetchImpl.mock.calls[3][0]).toBe('https://queue.fal.run/result/req-1');
  });

  it('honors FAL_VIDEO_MODEL and an explicit model override', async () => {
    process.env.FAL_KEY = 'falkey';
    process.env.FAL_VIDEO_MODEL = 'fal-ai/some-model';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'r', status_url: 's', response_url: 'r2' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ video_url: 'https://cdn/x.mp4' }) });

    const result = await generateProductBroll({
      imageUrl: 'https://img/p.jpg',
      prompt: 'p',
      model: 'bytedance/seedance-2.0/image-to-video',
      pollIntervalMs: 1,
      fetchImpl: fetchImpl as any,
      sleepImpl: noSleep,
    });

    expect(result.videoUrl).toBe('https://cdn/x.mp4');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://queue.fal.run/bytedance/seedance-2.0/image-to-video');
  });

  it('throws when submit fails', async () => {
    process.env.FAL_KEY = 'falkey';
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'bad input' });
    await expect(
      generateProductBroll({ imageUrl: 'https://img/p.jpg', prompt: 'p', fetchImpl: fetchImpl as any, sleepImpl: noSleep })
    ).rejects.toThrow(BrollError);
  });

  it('throws when no FAL_KEY is configured', async () => {
    delete process.env.FAL_KEY;
    await expect(
      generateProductBroll({ imageUrl: 'https://img/p.jpg', prompt: 'p', sleepImpl: noSleep })
    ).rejects.toThrow(/FAL_KEY is not configured/);
  });

  it('throws when the result has no video url', async () => {
    process.env.FAL_KEY = 'falkey';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ request_id: 'r', status_url: 's', response_url: 'r2' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nope: true }) });
    await expect(
      generateProductBroll({ imageUrl: 'https://img/p.jpg', prompt: 'p', pollIntervalMs: 1, fetchImpl: fetchImpl as any, sleepImpl: noSleep })
    ).rejects.toThrow(/did not include a video url/);
  });
});
