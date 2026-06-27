// High-level UGC video composition: takes a UGCRenderSpec, downloads
// all assets to a temp dir, generates ASS captions, builds the ffmpeg
// filtergraph, runs ffmpeg, uploads the result, and cleans up.
//
// Follows the same spawn/temp-dir/upload pattern as lib/render/process.ts.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { presignDownload, presignUpload, storageConfigured } from '@/app/api/utils/storage';
import { buildAss, groupWordsIntoLines } from '@/lib/captions/ass';
import type { TimedWord } from '@/lib/captions/ass';
import { getCaptionTemplate } from '@/lib/captions/templates';
import { ASPECT_DIMENSIONS } from '@/lib/render/types';
import { createSolidPNG } from '@/lib/assets/placeholder-image';
import { buildUGCFfmpegArgs } from './ffmpeg-compose';
import type { UGCRenderSpec } from './types';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

export interface UGCComposeResult {
  status: 'completed' | 'failed';
  outputUrl?: string;
  outputPath?: string;
  error?: string;
}

/**
 * Download a remote file to a local path.
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url} (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  await writeFile(destPath, Buffer.from(buffer));
}

/**
 * Upload a local file to object storage and return the presigned download URL.
 */
async function uploadToStorage(localPath: string, key: string): Promise<string> {
  const body = await readFile(localPath);
  const res = await fetch(presignUpload(key, 3600), {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Storage upload failed (${res.status})`);
  }
  return presignDownload(key);
}

/**
 * Run ffmpeg with the given args, reporting progress via callback.
 */
function runFfmpeg(
  args: string[],
  totalDurationSec: number,
  onProgress?: (pct: number) => void
): Promise<{ ok: boolean; stderrTail: string }> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrTail = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      const m = /out_time_us=(\d+)/.exec(chunk.toString());
      if (m && totalDurationSec > 0 && onProgress) {
        const pct = Math.min(99, Math.round((Number(m[1]) / 1e6 / totalDurationSec) * 100));
        onProgress(pct);
      }
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2000);
    });
    proc.on('error', (err) => {
      if ('code' in err && err.code === 'ENOENT') {
        console.warn('FFmpeg not found. Install FFmpeg or set FFMPEG_PATH environment variable.');
      }
      resolve({ ok: false, stderrTail: `${err.message}\n${stderrTail}` });
    });
    proc.on('close', (code) => {
      resolve({ ok: code === 0, stderrTail });
    });
  });
}

export interface ComposeOptions {
  spec: UGCRenderSpec;
  /** Storage key prefix for the output file. */
  outputKey: string;
  /** Progress callback (percentage 0-99). */
  onProgress?: (pct: number) => void;
}

/**
 * Compose a UGC video from the given render spec.
 *
 * Steps:
 * 1. Create temp working directory
 * 2. Download TTS audio and scene images
 * 3. Download background music (if any)
 * 4. Generate ASS subtitle file from captions
 * 5. Build ffmpeg args and run the composition
 * 6. Upload the output MP4 to object storage
 * 7. Clean up temp files
 */
export async function composeUGCVideo(opts: ComposeOptions): Promise<UGCComposeResult> {
  const { spec, outputKey, onProgress } = opts;
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ugc-compose-'));

  try {
    // Download TTS audio
    const ttsAudioPath = path.join(workDir, 'voiceover.mp3');
    await downloadFile(spec.ttsAudioUrl, ttsAudioPath);

    // Download scene images
    const sceneImagePaths: string[] = [];
    for (let i = 0; i < spec.scenes.length; i++) {
      const imageUrl = spec.scenes[i].imageUrl;
      if (!imageUrl) {
        // No image URL available - generate a solid-color placeholder PNG
        const imgPath = path.join(workDir, `scene_${i}.png`);
        const pngBuffer = createSolidPNG(1080, 1920, [0x1a, 0x1a, 0x2e]);
        await writeFile(imgPath, pngBuffer);
        sceneImagePaths.push(imgPath);
      } else {
        const ext = imageUrl.match(/\.(png|jpg|jpeg|webp)/i)?.[1] ?? 'jpg';
        const imgPath = path.join(workDir, `scene_${i}.${ext}`);
        await downloadFile(imageUrl, imgPath);
        sceneImagePaths.push(imgPath);
      }
    }

    // Download background music (if provided)
    let musicPath: string | undefined;
    if (spec.backgroundMusicUrl) {
      musicPath = path.join(workDir, 'music.mp3');
      await downloadFile(spec.backgroundMusicUrl, musicPath);
    }

    // Calculate total duration from TTS audio (sum of scenes as fallback)
    const totalDurationSec =
      spec.scenes.length > 0
        ? spec.scenes[spec.scenes.length - 1].endSec
        : 0;

    if (totalDurationSec < 0.5) {
      throw new Error('Video duration too short - check TTS audio and scene timing.');
    }

    // Generate ASS captions from word-level timing
    let assPath: string | undefined;
    if (spec.captions.length > 0) {
      const [width, height] = ASPECT_DIMENSIONS[spec.aspect];
      const timedWords: TimedWord[] = spec.captions.map((w) => ({
        text: w.text,
        start: w.start,
        end: w.end,
      }));
      const lines = groupWordsIntoLines(timedWords);
      const ass = buildAss(lines, {
        template: getCaptionTemplate(spec.captionTemplateId),
        playResX: width,
        playResY: height,
        position: spec.captionPosition,
      });
      assPath = path.join(workDir, 'captions.ass');
      await writeFile(assPath, ass, 'utf8');
    }

    // Build ffmpeg args
    const outPath = path.join(workDir, 'output.mp4');
    const args = buildUGCFfmpegArgs({
      spec,
      ttsAudioPath,
      sceneImagePaths,
      musicPath,
      assPath,
      outPath,
      totalDurationSec,
    });

    // Run ffmpeg
    const result = await runFfmpeg(args, totalDurationSec, onProgress);
    if (!result.ok) {
      throw new Error(`ffmpeg failed: ${result.stderrTail.slice(-500) || 'unknown error'}`);
    }

    // Upload to storage
    if (storageConfigured()) {
      const outputUrl = await uploadToStorage(outPath, outputKey);
      await rm(workDir, { recursive: true, force: true });
      return { status: 'completed', outputUrl };
    }

    // No storage configured (dev mode): keep file locally
    const keepPath = path.join(os.tmpdir(), `ugc-output-${Date.now()}.mp4`);
    const { copyFile } = await import('node:fs/promises');
    await copyFile(outPath, keepPath);
    await rm(workDir, { recursive: true, force: true });
    return { status: 'completed', outputPath: keepPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    return { status: 'failed', error: msg };
  }
}
