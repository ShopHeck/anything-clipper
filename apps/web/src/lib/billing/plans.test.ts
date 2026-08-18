import { describe, expect, it } from 'vitest';
import { evaluateQuota, EVENT_TO_QUOTA, PLANS, resolvePlan } from './plans';

describe('resolvePlan', () => {
  it('falls back to free for unknown/empty plan ids', () => {
    expect(resolvePlan(null).id).toBe('free');
    expect(resolvePlan('nonsense').id).toBe('free');
    expect(resolvePlan('pro').id).toBe('pro');
  });
});

describe('evaluateQuota', () => {
  it('treats the current unlimited free plan as uncapped', () => {
    const check = evaluateQuota(PLANS.free, 'rendersPerMonth', 10);
    expect(check.allowed).toBe(true);
    expect(check.limit).toBe(-1);
    expect(check.remaining).toBe(Infinity);
  });

  it('does not block unlimited free usage at a former paid cap', () => {
    const check = evaluateQuota(PLANS.free, 'rendersPerMonth', 15);
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(Infinity);
  });

  it('treats negative limits as unlimited', () => {
    const check = evaluateQuota(PLANS.business, 'rendersPerMonth', 99999);
    expect(check.allowed).toBe(true);
    expect(check.limit).toBe(-1);
    expect(check.remaining).toBe(Infinity);
  });
});

describe('EVENT_TO_QUOTA', () => {
  it('maps metered events onto real quota keys', () => {
    for (const quotaKey of Object.values(EVENT_TO_QUOTA)) {
      expect(PLANS.free.quotas).toHaveProperty(quotaKey);
    }
  });

  it('counts both upload entry points against the upload quota', () => {
    expect(EVENT_TO_QUOTA['upload.video']).toBe('uploadsPerMonth');
    expect(EVENT_TO_QUOTA['media.presign']).toBe('uploadsPerMonth');
  });
});
