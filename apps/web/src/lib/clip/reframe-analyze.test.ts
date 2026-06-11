import { describe, expect, it } from 'vitest';
import { computeMotionObservations, MotionGridFrame } from './reframe-analyze';

const COLS = 10;
const ROWS = 4;

// Build a frame with a bright vertical bar at column `barCol`.
function frameWithBar(barCol: number, brightness = 255): MotionGridFrame {
  const data = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) {
    data[y * COLS + barCol] = brightness;
  }
  return { data };
}

describe('computeMotionObservations', () => {
  it('returns nothing for fewer than two frames', () => {
    expect(computeMotionObservations([frameWithBar(5)], COLS, ROWS, { fps: 2, startSec: 0 })).toEqual(
      []
    );
  });

  it('locates a subject localized on the left', () => {
    // A subject on the left jitters between adjacent columns; motion stays
    // localized there, so the centroid lands left of center.
    const frames = [frameWithBar(1), frameWithBar(2)];
    const obs = computeMotionObservations(frames, COLS, ROWS, { fps: 2, startSec: 0 });
    expect(obs).toHaveLength(1);
    expect(obs[0].centerX).toBeLessThan(0.4);
    expect(obs[0].confidence).toBeGreaterThan(0);
  });

  it('locates a subject localized on the right', () => {
    const frames = [frameWithBar(7), frameWithBar(8)];
    const obs = computeMotionObservations(frames, COLS, ROWS, { fps: 2, startSec: 0 });
    expect(obs[0].centerX).toBeGreaterThan(0.6);
  });

  it('reports near-zero confidence for static frames', () => {
    const frames = [frameWithBar(5), frameWithBar(5)];
    const obs = computeMotionObservations(frames, COLS, ROWS, { fps: 2, startSec: 0 });
    expect(obs[0].confidence).toBeLessThan(0.001);
  });

  it('timestamps observations in source time from startSec and fps', () => {
    const frames = [frameWithBar(1), frameWithBar(5), frameWithBar(9)];
    const obs = computeMotionObservations(frames, COLS, ROWS, { fps: 2, startSec: 10 });
    expect(obs.map((o) => o.t)).toEqual([10.5, 11]);
  });
});
