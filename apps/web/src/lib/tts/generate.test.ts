import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateTTS, TTSUnavailableError } from './generate';
import {
  buildFullText,
  calculateTimings,
  estimateDuration,
  estimateTotalDuration,
} from './script-to-audio';
import type { UGCScript } from './types';

// ---------- generateTTS tests ----------

describe('generateTTS', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('throws when no TTS provider is configured', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    delete process.env.OPENAI_API_KEY;

    await expect(generateTTS({ text: 'Hello world' })).rejects.toThrow(TTSUnavailableError);
    await expect(generateTTS({ text: 'Hello world' })).rejects.toThrow('not configured');
  });

  it('throws when text is empty', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    await expect(generateTTS({ text: '' })).rejects.toThrow('Text content is required');
    await expect(generateTTS({ text: '   ' })).rejects.toThrow('Text content is required');
  });

  it('calls proxy endpoint when configured', async () => {
    process.env.NEXT_PUBLIC_CREATE_BASE_URL = 'https://proxy.example.com';
    process.env.ANYTHING_PROJECT_TOKEN = 'tok-123';

    const mockBuffer = new ArrayBuffer(1024);
    const mockResponse = new Response(mockBuffer, { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await generateTTS({ text: 'Hello world', voice: 'alloy', speed: 1.2 });

    expect(fetch).toHaveBeenCalledWith(
      'https://proxy.example.com/integrations/text-to-speech',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-123',
        }),
      })
    );

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody).toEqual({
      model: 'tts-1',
      input: 'Hello world',
      voice: 'alloy',
      speed: 1.2,
      response_format: 'mp3',
    });
    expect(result).toBeInstanceOf(Buffer);
    expect(result.byteLength).toBe(1024);
  });

  it('falls back to OpenAI direct when proxy is not configured', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    process.env.OPENAI_API_KEY = 'sk-direct';

    const mockBuffer = new ArrayBuffer(512);
    const mockResponse = new Response(mockBuffer, { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await generateTTS({ text: 'Test direct' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/speech',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-direct',
        }),
      })
    );
  });

  it('throws TTSUnavailableError on upstream failure', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response('Rate limited', { status: 429 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await expect(generateTTS({ text: 'Hello' })).rejects.toThrow(TTSUnavailableError);
    await expect(generateTTS({ text: 'Hello' })).rejects.toThrow('upstream returned 429');
  });

  it('throws on empty audio response', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response(new ArrayBuffer(0), { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await expect(generateTTS({ text: 'Hello' })).rejects.toThrow('empty audio');
  });

  it('uses default voice nova and speed 1.0', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response(new ArrayBuffer(100), { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await generateTTS({ text: 'Default settings' });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.voice).toBe('nova');
    expect(callBody.speed).toBe(1.0);
  });
});

// ---------- Timing calculation tests ----------

describe('estimateDuration', () => {
  it('returns 0 for empty text', () => {
    expect(estimateDuration('')).toBe(0);
    expect(estimateDuration('  ')).toBe(0);
  });

  it('estimates duration based on character count', () => {
    // 14 chars at speed 1.0 = 1 second
    const result = estimateDuration('Hello, World!!'); // 14 chars
    expect(result).toBe(1);
  });

  it('adjusts duration by speed', () => {
    // 28 chars at speed 2.0 = 1 second
    const result = estimateDuration('A'.repeat(28), 2.0);
    expect(result).toBe(1);
  });

  it('halves duration at double speed', () => {
    const normal = estimateDuration('Some test text', 1.0);
    const fast = estimateDuration('Some test text', 2.0);
    expect(fast).toBeCloseTo(normal / 2, 5);
  });
});

describe('calculateTimings', () => {
  const mockScript: UGCScript = {
    hook: 'A'.repeat(14), // 1 second
    problem: 'B'.repeat(28), // 2 seconds
    solution: 'C'.repeat(42), // 3 seconds
    demo: 'D'.repeat(14), // 1 second
    socialProof: 'E'.repeat(28), // 2 seconds
    cta: 'F'.repeat(14), // 1 second
  };

  it('calculates correct start/end times for each section', () => {
    const timings = calculateTimings(mockScript, 1.0);

    expect(timings).toHaveLength(6);

    // hook: 0 -> 1
    expect(timings[0]).toEqual({ section: 'hook', startSec: 0, endSec: 1 });

    // problem: 1 + 0.6 pause = 1.6 -> 3.6
    expect(timings[1]).toEqual({ section: 'problem', startSec: 1.6, endSec: 3.6 });

    // solution: 3.6 + 0.6 = 4.2 -> 7.2
    expect(timings[2]).toEqual({ section: 'solution', startSec: 4.2, endSec: 7.2 });

    // demo: 7.2 + 0.6 = 7.8 -> 8.8
    expect(timings[3]).toEqual({ section: 'demo', startSec: 7.8, endSec: 8.8 });

    // socialProof: 8.8 + 0.6 = 9.4 -> 11.4
    expect(timings[4]).toEqual({ section: 'socialProof', startSec: 9.4, endSec: 11.4 });

    // cta: 11.4 + 0.6 = 12.0 -> 13.0
    expect(timings[5]).toEqual({ section: 'cta', startSec: 12, endSec: 13 });
  });

  it('skips empty sections', () => {
    const partial: UGCScript = {
      hook: 'A'.repeat(14),
      problem: '',
      solution: 'C'.repeat(14),
      demo: '',
      socialProof: '',
      cta: 'F'.repeat(14),
    };

    const timings = calculateTimings(partial, 1.0);
    expect(timings).toHaveLength(3);
    expect(timings[0].section).toBe('hook');
    expect(timings[1].section).toBe('solution');
    expect(timings[2].section).toBe('cta');
  });

  it('adjusts timing based on speed', () => {
    const normalTimings = calculateTimings(mockScript, 1.0);
    const fastTimings = calculateTimings(mockScript, 2.0);

    // At 2x speed, durations are halved
    expect(fastTimings[0].endSec).toBeCloseTo(normalTimings[0].endSec / 2, 1);
  });

  it('returns empty array for all-empty script', () => {
    const empty: UGCScript = {
      hook: '',
      problem: '',
      solution: '',
      demo: '',
      socialProof: '',
      cta: '',
    };
    expect(calculateTimings(empty)).toEqual([]);
  });
});

describe('estimateTotalDuration', () => {
  it('returns 0 for empty script', () => {
    const empty: UGCScript = {
      hook: '',
      problem: '',
      solution: '',
      demo: '',
      socialProof: '',
      cta: '',
    };
    expect(estimateTotalDuration(empty)).toBe(0);
  });

  it('returns correct total with pauses', () => {
    const script: UGCScript = {
      hook: 'A'.repeat(14), // 1s
      problem: 'B'.repeat(14), // 1s
      solution: '',
      demo: '',
      socialProof: '',
      cta: '',
    };
    // 1s + 0.6s pause + 1s = 2.6s
    expect(estimateTotalDuration(script)).toBeCloseTo(2.6, 1);
  });
});

describe('buildFullText', () => {
  it('concatenates non-empty sections with pause markers', () => {
    const script: UGCScript = {
      hook: 'Stop scrolling!',
      problem: 'You have a problem.',
      solution: 'Here is the fix.',
      demo: 'Watch this.',
      socialProof: '5 stars.',
      cta: 'Buy now!',
    };

    const result = buildFullText(script);
    expect(result).toContain('Stop scrolling!');
    expect(result).toContain('Buy now!');
    expect(result).toContain('\n\n...\n\n');
    // 6 sections = 5 separators
    expect(result.split('\n\n...\n\n')).toHaveLength(6);
  });

  it('skips empty sections', () => {
    const script: UGCScript = {
      hook: 'Hello',
      problem: '',
      solution: 'World',
      demo: '',
      socialProof: '',
      cta: '',
    };

    const result = buildFullText(script);
    expect(result).toBe('Hello\n\n...\n\nWorld');
  });

  it('returns empty string for all-empty script', () => {
    const script: UGCScript = {
      hook: '',
      problem: '',
      solution: '',
      demo: '',
      socialProof: '',
      cta: '',
    };
    expect(buildFullText(script)).toBe('');
  });
});
