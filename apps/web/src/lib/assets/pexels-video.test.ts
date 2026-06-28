import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { pickBestFile, searchVideos, downloadVideo } from './pexels-video';
import type { PexelsVideoFile } from './pexels-video';

describe('pickBestFile', () => {
  it('returns undefined for empty array', () => {
    expect(pickBestFile([])).toBeUndefined();
  });

  it('picks 1080x1920 vertical HD file', () => {
    const files: PexelsVideoFile[] = [
      { id: 1, quality: 'sd', file_type: 'video/mp4', width: 540, height: 960, link: 'https://example.com/sd.mp4' },
      { id: 2, quality: 'hd', file_type: 'video/mp4', width: 1080, height: 1920, link: 'https://example.com/hd.mp4' },
      { id: 3, quality: 'sd', file_type: 'video/mp4', width: 720, height: 1280, link: 'https://example.com/720.mp4' },
    ];
    const result = pickBestFile(files);
    expect(result?.id).toBe(2);
    expect(result?.link).toBe('https://example.com/hd.mp4');
  });

  it('picks 1920x1080 horizontal HD file', () => {
    const files: PexelsVideoFile[] = [
      { id: 1, quality: 'sd', file_type: 'video/mp4', width: 640, height: 480, link: 'https://example.com/sd.mp4' },
      { id: 2, quality: 'hd', file_type: 'video/mp4', width: 1920, height: 1080, link: 'https://example.com/hd.mp4' },
    ];
    const result = pickBestFile(files);
    expect(result?.id).toBe(2);
  });

  it('falls back to largest resolution when no HD available', () => {
    const files: PexelsVideoFile[] = [
      { id: 1, quality: 'sd', file_type: 'video/mp4', width: 640, height: 480, link: 'https://example.com/small.mp4' },
      { id: 2, quality: 'sd', file_type: 'video/mp4', width: 1280, height: 720, link: 'https://example.com/medium.mp4' },
      { id: 3, quality: 'sd', file_type: 'video/mp4', width: 960, height: 540, link: 'https://example.com/mid.mp4' },
    ];
    const result = pickBestFile(files);
    expect(result?.id).toBe(2);
  });

  it('prefers mp4 over other formats', () => {
    const files: PexelsVideoFile[] = [
      { id: 1, quality: 'hd', file_type: 'video/webm', width: 1920, height: 1080, link: 'https://example.com/hd.webm' },
      { id: 2, quality: 'sd', file_type: 'video/mp4', width: 1280, height: 720, link: 'https://example.com/720.mp4' },
    ];
    const result = pickBestFile(files);
    // Should pick mp4 even though webm is bigger
    expect(result?.id).toBe(2);
  });
});

describe('searchVideos', () => {
  beforeEach(() => {
    process.env.PEXELS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.PEXELS_API_KEY;
    vi.unstubAllGlobals();
  });

  it('throws if PEXELS_API_KEY is not set', async () => {
    delete process.env.PEXELS_API_KEY;
    await expect(searchVideos('skincare')).rejects.toThrow('PEXELS_API_KEY environment variable is not set');
  });

  it('calls Pexels API with correct URL and headers', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ videos: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await searchVideos('woman applying skincare');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('https://api.pexels.com/videos/search');
    expect(url).toContain('query=woman+applying+skincare');
    expect(url).toContain('orientation=portrait');
    expect(opts.headers.Authorization).toBe('test-api-key');
  });

  it('passes perPage, minDuration, maxDuration params', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ videos: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await searchVideos('test', { perPage: 5, minDuration: 3, maxDuration: 10 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('per_page=5');
    expect(url).toContain('min_duration=3');
    expect(url).toContain('max_duration=10');
  });

  it('returns parsed video results', async () => {
    const mockVideos = [
      { id: 1, url: 'https://pexels.com/v/1', duration: 8, image: 'https://img.com/1.jpg', video_files: [] },
      { id: 2, url: 'https://pexels.com/v/2', duration: 5, image: 'https://img.com/2.jpg', video_files: [] },
    ];
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ videos: mockVideos }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await searchVideos('skincare routine');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].duration).toBe(5);
  });

  it('throws on API error response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(searchVideos('test')).rejects.toThrow('Pexels API error (429)');
  });
});

describe('downloadVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads video and writes to disk', async () => {
    const mockBuffer = new ArrayBuffer(1024);
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => mockBuffer,
    });
    vi.stubGlobal('fetch', mockFetch);

    // downloadVideo calls fetch then writes to disk; verify fetch was called correctly
    // Writing to /tmp is safe in test environments
    const { mkdtemp, rm } = await import('node:fs/promises');
    const path = await import('node:path');
    const os = await import('node:os');
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'pexels-test-'));
    const destPath = path.join(tmpDir, 'video.mp4');

    await downloadVideo('https://example.com/video.mp4', destPath);

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/video.mp4');

    // Verify the file was actually written
    const { readFile } = await import('node:fs/promises');
    const written = await readFile(destPath);
    expect(written.byteLength).toBe(1024);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws on failed download', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(downloadVideo('https://example.com/missing.mp4', '/tmp/out.mp4')).rejects.toThrow(
      'Failed to download video'
    );
  });
});
