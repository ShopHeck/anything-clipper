import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { analyzeReframe } from './reframe-analyze';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const hasFfmpeg = spawnSync(FFMPEG, ['-version'], { stdio: 'ignore' }).status === 0;

describe.skipIf(!hasFfmpeg)('analyzeReframe (ffmpeg smoke)', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'reframe-smoke-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('tracks a subject moving left→right across the frame', () => {
    const src = path.join(dir, 'moving.mp4');
    // A white box sweeps from the left edge to the right edge over 6s on a
    // black background — a clean active-subject signal.
    execFileSync(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=30:d=6',
      '-f', 'lavfi', '-i', 'color=c=white:s=120x120:d=6',
      '-f', 'lavfi', '-i', 'sine=frequency=300:d=6',
      '-filter_complex',
      "[0:v][1:v]overlay=x='(main_w-overlay_w)*t/6':y=120[v]",
      '-map', '[v]', '-map', '2:a',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
      src,
    ]);

    return analyzeReframe({
      ffmpegPath: FFMPEG,
      sourceUrl: src,
      startSec: 0,
      endSec: 6,
      fps: 4,
    }).then((keyframes) => {
      expect(keyframes.length).toBeGreaterThan(1);
      // The crop center should drift rightward over time as the box moves.
      const first = keyframes[0].x;
      const last = keyframes[keyframes.length - 1].x;
      expect(last).toBeGreaterThan(first);
    });
  }, 120_000);
});
