// Downloads product images from external URLs, validates them,
// and re-uploads to object storage for durable access by ffmpeg.
import { presignDownload, presignUpload } from '@/app/api/utils/storage';

/** Maximum image file size in bytes (10 MB). */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Allowed image content types. */
const VALID_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

export interface ProcessedImage {
  storageUrl: string;
  originalUrl: string;
}

/**
 * Validate that a URL points to an actual image.
 * Checks Content-Type and file size.
 */
async function validateAndDownload(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnythingClipper/1.0)',
      },
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!contentType || !VALID_IMAGE_TYPES.includes(contentType)) {
      return null;
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_SIZE) {
      return null;
    }

    return buffer;
  } catch {
    return null;
  }
}

/**
 * Determine the file extension from an image URL or content type.
 */
function getExtension(url: string): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith('.png')) return 'png';
  if (path.endsWith('.webp')) return 'webp';
  if (path.endsWith('.gif')) return 'gif';
  if (path.endsWith('.avif')) return 'avif';
  return 'jpg';
}

/**
 * Process product image URLs: download, validate, and re-upload to storage.
 * Handles common TikTok image CDN patterns (e.g. p16-oec-va.ibyteimg.com).
 * Returns storage URLs for valid images.
 */
export async function processProductImages(
  imageUrls: string[],
  userId: string
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];
  const seen = new Set<string>();

  for (const url of imageUrls) {
    // Skip duplicates
    if (seen.has(url)) continue;
    seen.add(url);

    // Limit to 6 product images max
    if (results.length >= 6) break;

    const buffer = await validateAndDownload(url);
    if (!buffer) continue;

    const ext = getExtension(url);
    const key = `product-images/${userId}/${Date.now()}-${results.length}.${ext}`;

    try {
      const uploadUrl = presignUpload(key, 3600);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}` },
        body: new Uint8Array(buffer),
      });

      if (uploadRes.ok) {
        const storageUrl = presignDownload(key);
        results.push({ storageUrl, originalUrl: url });
      }
    } catch {
      // Skip this image, continue with others
      continue;
    }
  }

  return results;
}
