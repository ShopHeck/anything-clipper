// Active-speaker / subject reframing.
//
// True active-speaker tracking needs per-frame face detection on the decoded
// video, which belongs in the render worker (where frames are available).
// This module defines the data contract the renderer consumes
// (cropKeyframes: source-second → normalized horizontal center) and a
// detector interface so a real face/landmark model can be plugged in without
// touching the pipeline.
//
// Until a detector is wired up, `planReframeFromFaces` turns a set of
// detected face boxes (from sampled frames) into smooth crop keyframes, and
// `staticCenterReframe` is the safe fallback.
import { CropKeyframe } from '@/lib/render/types';

export interface FaceObservation {
  // Source-time second the frame was sampled at.
  t: number;
  // Face center as a fraction of frame width (0..1). Pick the dominant/most
  // confident face per sampled frame upstream.
  centerX: number;
  confidence: number;
}

export function staticCenterReframe(): CropKeyframe[] {
  return [{ t: 0, x: 0.5 }];
}

// Convert sparse face observations into crop keyframes:
//  - low-confidence frames fall back toward center
//  - the path is smoothed (EMA) so the crop glides instead of jittering
//  - near-duplicate consecutive keyframes are dropped to keep the expr small
export function planReframeFromFaces(
  observations: FaceObservation[],
  opts: { smoothing?: number; minDeltaX?: number; minConfidence?: number } = {}
): CropKeyframe[] {
  if (observations.length === 0) return staticCenterReframe();

  const smoothing = opts.smoothing ?? 0.4; // 0 = no movement, 1 = instant
  const minDelta = opts.minDeltaX ?? 0.04;
  const minConf = opts.minConfidence ?? 0.3;

  const sorted = [...observations].sort((a, b) => a.t - b.t);
  const keyframes: CropKeyframe[] = [];
  let current = 0.5;

  for (const obs of sorted) {
    const target = obs.confidence >= minConf ? clamp01(obs.centerX) : 0.5;
    current = current + (target - current) * smoothing;
    const last = keyframes[keyframes.length - 1];
    if (!last || Math.abs(current - last.x) >= minDelta || obs.t - last.t > 2) {
      keyframes.push({ t: obs.t, x: round3(current) });
    }
  }

  if (keyframes.length === 0) return staticCenterReframe();
  if (keyframes[0].t > 0) keyframes.unshift({ t: 0, x: keyframes[0].x });
  return keyframes;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// Zoom punch-ins on high-energy moments (e.g. AI-flagged hooks/stats). Each
// emphasis time produces a quick ramp in and out around it.
export function planZoomPunches(
  emphasisTimes: number[],
  opts: { scale?: number; rampSec?: number; holdSec?: number } = {}
): Array<{ t: number; scale: number }> {
  const scale = opts.scale ?? 1.12;
  const ramp = opts.rampSec ?? 0.25;
  const hold = opts.holdSec ?? 0.6;
  const kfs: Array<{ t: number; scale: number }> = [];
  for (const t of [...emphasisTimes].sort((a, b) => a - b)) {
    kfs.push({ t: Math.max(0, t - ramp), scale: 1 });
    kfs.push({ t, scale });
    kfs.push({ t: t + hold, scale });
    kfs.push({ t: t + hold + ramp, scale: 1 });
  }
  return kfs;
}
