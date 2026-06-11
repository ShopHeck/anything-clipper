import { describe, expect, it } from 'vitest';
import { planReframeFromFaces, planZoomPunches, staticCenterReframe } from './reframe';

describe('planReframeFromFaces', () => {
  it('falls back to center with no observations', () => {
    expect(planReframeFromFaces([])).toEqual(staticCenterReframe());
  });

  it('eases toward the detected face and starts at t=0', () => {
    const kfs = planReframeFromFaces(
      [
        { t: 1, centerX: 0.8, confidence: 0.9 },
        { t: 2, centerX: 0.8, confidence: 0.9 },
        { t: 3, centerX: 0.8, confidence: 0.9 },
      ],
      { smoothing: 0.5 }
    );
    expect(kfs[0].t).toBe(0);
    // Crop center moves right (toward 0.8) but never overshoots.
    const last = kfs[kfs.length - 1];
    expect(last.x).toBeGreaterThan(0.5);
    expect(last.x).toBeLessThanOrEqual(0.8);
  });

  it('pulls toward center on low-confidence frames', () => {
    const kfs = planReframeFromFaces(
      [
        { t: 1, centerX: 0.9, confidence: 0.1 },
        { t: 2, centerX: 0.9, confidence: 0.1 },
      ],
      { smoothing: 1, minConfidence: 0.3 }
    );
    expect(kfs.every((k) => Math.abs(k.x - 0.5) < 1e-9)).toBe(true);
  });
});

describe('planZoomPunches', () => {
  it('ramps in and out around each emphasis time', () => {
    const kfs = planZoomPunches([5], { scale: 1.2, rampSec: 0.2, holdSec: 0.5 });
    expect(kfs).toEqual([
      { t: 4.8, scale: 1 },
      { t: 5, scale: 1.2 },
      { t: 5.5, scale: 1.2 },
      { t: 5.7, scale: 1 },
    ]);
  });
});
