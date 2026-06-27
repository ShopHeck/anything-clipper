import EventEmitter from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { UGCRenderSpec } from './types';

const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/utils/storage', () => ({
  presignDownload: vi.fn((key: string) => `https://storage.example.com/${key}`),
  presignUpload: vi.fn((key: string) => `https://storage.example.com/upload/${key}`),
  storageConfigured: vi.fn(() => false),
}));

vi.mock('@/lib/captions/ass', () => ({
  buildAss: vi.fn(() => ''),
  groupWordsIntoLines: vi.fn(() => []),
}));

vi.mock('@/lib/captions/templates', () => ({
  getCaptionTemplate: vi.fn(() => ({})),
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: mockSpawn,
  };
});

import { composeUGCVideo } from './compose';

function createMockProcess(behavior: 'success' | 'enoent') {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = null;

  setTimeout(() => {
    if (behavior === 'enoent') {
      const err = new Error('spawn ffmpeg ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      proc.emit('error', err);
    } else {
      proc.emit('close', 0);
    }
  }, 10);

  return proc;
}

describe('composeUGCVideo', () => {
  it('handles scenes with empty imageUrl by generating placeholder PNG', async () => {
    mockSpawn.mockImplementation(() => createMockProcess('success'));

    // Mock fetch for TTS download only
    const mockFetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('voiceover')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        });
      }
      // If fetch is called with empty string or unexpected URL, fail
      return Promise.resolve({
        ok: false,
        status: 404,
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const spec: UGCRenderSpec = {
      ttsAudioUrl: 'https://example.com/voiceover.mp3',
      scenes: [
        { startSec: 0, endSec: 5, imageUrl: '' },
        { startSec: 5, endSec: 10, imageUrl: '' },
      ],
      captions: [],
      aspect: '9:16',
      captionTemplateId: 'mrBeast',
    };

    const result = await composeUGCVideo({
      spec,
      outputKey: 'test/output.mp4',
    });

    // Should not crash - either completes or fails gracefully
    expect(result.status).toBeDefined();
    // fetch should only be called for voiceover, not for empty imageUrl scenes
    const fetchCalls = mockFetch.mock.calls.map((c: any[]) => c[0]);
    expect(fetchCalls).not.toContain('');

    vi.unstubAllGlobals();
  });

  it('returns failed status with helpful message when ffmpeg is not found', async () => {
    mockSpawn.mockImplementation(() => createMockProcess('enoent'));

    // Mock fetch for all downloads
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const spec: UGCRenderSpec = {
      ttsAudioUrl: 'https://example.com/voiceover.mp3',
      scenes: [{ startSec: 0, endSec: 5, imageUrl: 'https://example.com/img.jpg' }],
      captions: [],
      aspect: '9:16',
      captionTemplateId: 'mrBeast',
    };

    const result = await composeUGCVideo({
      spec,
      outputKey: 'test/output.mp4',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('ffmpeg failed');
    expect(result.error).toContain('ENOENT');
    expect(warnSpy).toHaveBeenCalledWith(
      'FFmpeg not found. Install FFmpeg or set FFMPEG_PATH environment variable.'
    );

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
