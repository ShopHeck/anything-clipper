// Active-speaker / subject auto-reframe analysis for the render worker.
//
// True per-frame face detection needs an ML model + runtime; to stay
// dependency-free (ffmpeg is already required) we estimate the subject's
// horizontal position from temporal motion energy: sample low-res grayscale
// frames, measure per-column frame-to-frame change, and take the motion
// centroid as the subject center. Talking/gesturing subjects light up the
// columns around them; static/low-motion frames yield low confidence and the
// planner holds center — so this never makes a clip worse than center-crop.
//
// Output feeds the existing planReframeFromFaces smoother, producing the same
// CropKeyframe[] the render spec already consumes.
import { spawn } from 'node:child_process';
import { CropKeyframe } from '@/lib/render/types';
import { FaceObservation, planReframeFromFaces, staticCenterReframe } from './reframe';

export interface MotionGridFrame {
  // Row-major grayscale pixels, length === cols * rows.
  data: Uint8Array;
}

// Pure core: per-column motion centroid between consecutive frames.
// Returns one observation per frame transition, timestamped in SOURCE time.
export function computeMotionObservations(
  frames: MotionGridFrame[],
  cols: number,
  rows: number,
  opts: { fps: number; startSec: number; activityThreshold?: number }
): FaceObservation[] {
  const observations: FaceObservation[] = [];
  if (frames.length < 2 || cols <= 0 || rows <= 0) return observations;
  const threshold = opts.activityThreshold ?? 8; // per-pixel delta to count

  // Track a running max column energy for confidence normalization.
  let maxColEnergy = 1;

  for (let f = 1; f < frames.length; f++) {
    const prev = frames[f - 1].data;
    const cur = frames[f].data;
    const colEnergy = new Float64Array(cols);
    let total = 0;

    for (let y = 0; y < rows; y++) {
      const rowOff = y * cols;
      for (let x = 0; x < cols; x++) {
        const d = Math.abs(cur[rowOff + x] - prev[rowOff + x]);
        if (d >= threshold) {
          colEnergy[x] += d;
          total += d;
        }
      }
    }

    // Motion centroid across columns → normalized horizontal center [0,1].
    let weighted = 0;
    let peak = 0;
    for (let x = 0; x < cols; x++) {
      weighted += colEnergy[x] * (x + 0.5);
      if (colEnergy[x] > peak) peak = colEnergy[x];
    }
    if (peak > maxColEnergy) maxColEnergy = peak;

    const centerX = total > 0 ? weighted / (total * cols) : 0.5;
    // Confidence scales with how much motion there is relative to the busiest
    // frame seen — quiet frames stay near center.
    const confidence = Math.min(1, peak / maxColEnergy);

    observations.push({
      t: opts.startSec + f / opts.fps,
      centerX: clamp01(centerX),
      confidence,
    });
  }

  return observations;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Decode a window of the source into low-res grayscale frames via ffmpeg and
// return them as fixed-size motion grids.
export function extractGrayFrames(
  ffmpegPath: string,
  sourceUrl: string,
  startSec: number,
  endSec: number,
  cols: number,
  rows: number,
  fps: number
): Promise<MotionGridFrame[]> {
  return new Promise((resolve) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      String(startSec),
      '-t',
      String(Math.max(0, endSec - startSec)),
      '-i',
      sourceUrl,
      '-vf',
      `fps=${fps},scale=${cols}:${rows},format=gray`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      'pipe:1',
    ];
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.on('error', () => resolve([]));
    proc.on('close', () => {
      const buf = Buffer.concat(chunks);
      const frameSize = cols * rows;
      const frames: MotionGridFrame[] = [];
      for (let off = 0; off + frameSize <= buf.length; off += frameSize) {
        frames.push({ data: new Uint8Array(buf.subarray(off, off + frameSize)) });
      }
      resolve(frames);
    });
  });
}

export interface AnalyzeReframeOptions {
  ffmpegPath: string;
  sourceUrl: string;
  startSec: number;
  endSec: number;
  cols?: number;
  rows?: number;
  fps?: number;
}

// End-to-end: sample frames → motion observations → smoothed crop keyframes
// (in SOURCE time, matching how the render spec treats cropKeyframes).
export async function analyzeReframe(opts: AnalyzeReframeOptions): Promise<CropKeyframe[]> {
  const cols = opts.cols ?? 128;
  const rows = opts.rows ?? 72;
  const fps = opts.fps ?? 3;
  const frames = await extractGrayFrames(
    opts.ffmpegPath,
    opts.sourceUrl,
    opts.startSec,
    opts.endSec,
    cols,
    rows,
    fps
  );
  if (frames.length < 2) return staticCenterReframe();

  const observations = computeMotionObservations(frames, cols, rows, {
    fps,
    startSec: opts.startSec,
  });
  return planReframeFromFaces(observations, { smoothing: 0.35, minDeltaX: 0.05 });
}
