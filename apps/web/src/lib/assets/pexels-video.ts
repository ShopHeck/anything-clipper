// Pexels Video API client for fetching stock video clips.
// Used by the UGC pipeline to source real video content instead of still images.

import { writeFile } from 'node:fs/promises';

const PEXELS_API_BASE = 'https://api.pexels.com/videos/search';

/** A single video file variant from Pexels (different quality/resolution). */
export interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

/** A video result from the Pexels API. */
export interface PexelsVideo {
  id: number;
  url: string;
  duration: number;
  image: string;
  video_files: PexelsVideoFile[];
}

export interface SearchVideosOptions {
  perPage?: number;
  minDuration?: number;
  maxDuration?: number;
}

/**
 * Pick the best video file from a list of variants.
 * Prefers HD quality (1920x1080 or 1080x1920), falls back to largest available.
 */
export function pickBestFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  if (files.length === 0) return undefined;

  // Filter to mp4 files only
  const mp4Files = files.filter((f) => f.file_type === 'video/mp4');
  const candidates = mp4Files.length > 0 ? mp4Files : files;

  // Prefer HD resolution (1080p in either orientation)
  const hdFile = candidates.find(
    (f) =>
      (f.width === 1920 && f.height === 1080) ||
      (f.width === 1080 && f.height === 1920)
  );
  if (hdFile) return hdFile;

  // Fall back to largest by total pixel count
  return candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

/**
 * Search for videos on Pexels matching the given query.
 * Requires PEXELS_API_KEY environment variable.
 */
export async function searchVideos(
  query: string,
  opts?: SearchVideosOptions
): Promise<PexelsVideo[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY environment variable is not set');
  }

  const perPage = opts?.perPage ?? 10;
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    orientation: 'portrait',
  });

  if (opts?.minDuration) {
    params.set('min_duration', String(opts.minDuration));
  }
  if (opts?.maxDuration) {
    params.set('max_duration', String(opts.maxDuration));
  }

  const res = await fetch(`${PEXELS_API_BASE}?${params.toString()}`, {
    headers: {
      Authorization: apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Pexels API error (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { videos: PexelsVideo[] };
  return data.videos ?? [];
}

/**
 * Download a video file from a URL to a local path.
 */
export async function downloadVideo(videoUrl: string, destPath: string): Promise<void> {
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Failed to download video from ${videoUrl} (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  await writeFile(destPath, Buffer.from(buffer));
}
