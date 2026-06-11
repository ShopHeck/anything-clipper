import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planForPriceId, priceIdForPlan, verifyWebhookSignature } from './stripe';

function signedHeader(body: string, secret: string, t: number): string {
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const body = '{"id":"evt_123","type":"checkout.session.completed"}';
  const now = 1_700_000_000;

  it('accepts a correctly signed, fresh payload', () => {
    const header = signedHeader(body, secret, now);
    expect(verifyWebhookSignature(body, header, secret, 300, now)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const header = signedHeader(body, secret, now);
    expect(verifyWebhookSignature(body + 'x', header, secret, 300, now)).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const header = signedHeader(body, secret, now);
    expect(verifyWebhookSignature(body, header, 'whsec_other', 300, now)).toBe(false);
  });

  it('rejects a stale timestamp beyond tolerance', () => {
    const header = signedHeader(body, secret, now - 10_000);
    expect(verifyWebhookSignature(body, header, secret, 300, now)).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(verifyWebhookSignature(body, null, secret, 300, now)).toBe(false);
    expect(verifyWebhookSignature(body, 'garbage', secret, 300, now)).toBe(false);
  });
});

describe('plan ⟷ price mapping', () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO = 'price_pro_123';
    process.env.STRIPE_PRICE_BUSINESS = 'price_biz_456';
  });
  afterEach(() => {
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_BUSINESS;
  });

  it('maps plans to configured price ids', () => {
    expect(priceIdForPlan('pro')).toBe('price_pro_123');
    expect(priceIdForPlan('business')).toBe('price_biz_456');
    expect(priceIdForPlan('free')).toBeNull();
  });

  it('maps price ids back to plans', () => {
    expect(planForPriceId('price_pro_123')).toBe('pro');
    expect(planForPriceId('price_biz_456')).toBe('business');
    expect(planForPriceId('price_unknown')).toBeNull();
    expect(planForPriceId(null)).toBeNull();
  });
});
