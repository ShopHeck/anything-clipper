import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/app/api/utils/storage', () => ({
  presignUpload: vi.fn(() => 'https://storage.example.com/upload?sig=abc'),
  presignDownload: vi.fn((key: string) => `https://storage.example.com/${key}?sig=xyz`),
}));

import { generatePlaceholderImage, createSolidPNG } from './placeholder-image';
import { presignUpload, presignDownload } from '@/app/api/utils/storage';

describe('placeholder-image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSolidPNG', () => {
    it('generates a buffer starting with PNG magic bytes', () => {
      const buf = createSolidPNG(10, 10, [0x1a, 0x1a, 0x2e]);
      // PNG signature: 137 80 78 71 13 10 26 10
      expect(buf[0]).toBe(137);
      expect(buf[1]).toBe(80);
      expect(buf[2]).toBe(78);
      expect(buf[3]).toBe(71);
      expect(buf[4]).toBe(13);
      expect(buf[5]).toBe(10);
      expect(buf[6]).toBe(26);
      expect(buf[7]).toBe(10);
    });

    it('contains IHDR chunk with correct dimensions', () => {
      const width = 100;
      const height = 200;
      const buf = createSolidPNG(width, height, [0xff, 0x00, 0x00]);

      // After 8-byte signature, IHDR chunk starts: length(4) + "IHDR"(4) + data(13) + crc(4)
      // IHDR data starts at offset 16
      const ihdrWidth = buf.readUInt32BE(16);
      const ihdrHeight = buf.readUInt32BE(20);
      expect(ihdrWidth).toBe(width);
      expect(ihdrHeight).toBe(height);
    });

    it('produces a valid buffer with expected minimum size', () => {
      const buf = createSolidPNG(1, 1, [0x00, 0x00, 0x00]);
      // A 1x1 PNG should have at least: sig(8) + IHDR(25) + IDAT(min ~20) + IEND(12)
      expect(buf.length).toBeGreaterThan(50);
    });

    it('handles larger dimensions', () => {
      const buf = createSolidPNG(1080, 1920, [0x1a, 0x1a, 0x2e]);
      expect(buf.length).toBeGreaterThan(100);
      // Should still start with PNG signature
      expect(buf.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );
    });
  });

  describe('generatePlaceholderImage', () => {
    it('returns a presigned URL string', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });

      const result = await generatePlaceholderImage({
        productName: 'Test Product',
        userId: 'user-123',
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('https://storage.example.com/');
      expect(result).toContain('placeholder-images/user-123/');
    });

    it('calls presignUpload and fetch PUT', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });

      await generatePlaceholderImage({
        productName: 'Test Product',
        userId: 'user-456',
      });

      expect(presignUpload).toHaveBeenCalledWith(
        expect.stringContaining('placeholder-images/user-456/'),
        3600
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://storage.example.com/upload?sig=abc',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
        })
      );
    });

    it('calls presignDownload after successful upload', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });

      await generatePlaceholderImage({
        productName: 'Test Product',
        userId: 'user-789',
      });

      expect(presignDownload).toHaveBeenCalledWith(
        expect.stringContaining('placeholder-images/user-789/')
      );
    });

    it('throws if upload fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        generatePlaceholderImage({
          productName: 'Test Product',
          userId: 'user-err',
        })
      ).rejects.toThrow('Failed to upload placeholder image (500)');
    });

    it('uses custom dimensions when provided', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });

      const result = await generatePlaceholderImage({
        productName: 'Test',
        userId: 'u1',
        width: 500,
        height: 800,
      });

      // Should still succeed with custom dimensions
      expect(typeof result).toBe('string');
      // Verify the body sent to fetch is a Uint8Array (our PNG buffer)
      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = fetchCall[1]?.body as Uint8Array;
      expect(body).toBeInstanceOf(Uint8Array);
      // Verify PNG signature in the uploaded data
      expect(body[0]).toBe(137);
      expect(body[1]).toBe(80);
      expect(body[2]).toBe(78);
      expect(body[3]).toBe(71);
    });
  });
});
