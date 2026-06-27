// Generates a minimal solid-color PNG image in memory (no canvas/sharp deps)
// and uploads it to R2 storage. Used as a fallback when no product images
// can be scraped and AI image generation fails, ensuring the video pipeline
// always has at least one visual asset for FFmpeg composition.

import crypto from 'node:crypto';
import zlib from 'node:zlib';

import { presignDownload, presignUpload } from '@/app/api/utils/storage';

export interface PlaceholderImageOptions {
  productName: string;
  userId: string;
  width?: number;
  height?: number;
}

/**
 * Generate a minimal valid PNG image (solid dark color) in memory,
 * upload it to R2, and return a presigned download URL.
 *
 * The PNG is constructed from raw bytes:
 * - 8-byte PNG signature
 * - IHDR chunk (image header)
 * - IDAT chunk (zlib-compressed scanline data)
 * - IEND chunk (end marker)
 *
 * This produces a valid PNG that FFmpeg can decode without needing
 * canvas, sharp, or any native dependencies.
 */
export async function generatePlaceholderImage(
  opts: PlaceholderImageOptions
): Promise<string> {
  const { userId, width = 1080, height = 1920 } = opts;

  const pngBuffer = createSolidPNG(width, height, [0x1a, 0x1a, 0x2e]);

  const suffix = crypto.randomUUID().slice(0, 8);
  const storageKey = `placeholder-images/${userId}/${Date.now()}-${suffix}.png`;
  const uploadUrl = presignUpload(storageKey, 3600);

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: new Uint8Array(pngBuffer),
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload placeholder image (${uploadRes.status})`);
  }

  return presignDownload(storageKey);
}

/**
 * Create a valid PNG file buffer for a solid-color image.
 * Uses RGB color type (2) with 8-bit depth.
 */
export function createSolidPNG(
  width: number,
  height: number,
  rgb: [number, number, number]
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width(4) + height(4) + bitDepth(1) + colorType(1) + compression(1) + filter(1) + interlace(1) = 13 bytes
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdrChunk = buildChunk('IHDR', ihdrData);

  // Raw scanline data: for each row, a filter byte (0 = None) followed by RGB pixels
  const rowBytes = 1 + width * 3; // filter byte + pixel data
  const rawData = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = rgb[0];
      rawData[pixelOffset + 1] = rgb[1];
      rawData[pixelOffset + 2] = rgb[2];
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = buildChunk('IDAT', compressedData);

  // IEND: empty data
  const iendChunk = buildChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Build a PNG chunk: length(4) + type(4) + data + CRC(4)
 */
function buildChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  // CRC is calculated over type + data
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcInput);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

/**
 * CRC-32 implementation for PNG chunk validation.
 * Uses the standard polynomial 0xEDB88320.
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
