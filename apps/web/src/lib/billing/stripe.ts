// Stripe billing via the REST API (no SDK dependency) + webhook signature
// verification with Node crypto. Everything degrades gracefully: with no
// STRIPE_SECRET_KEY the checkout/webhook routes return 501 and the rest of
// the app is unaffected.
import crypto from 'node:crypto';
import { PlanId } from './plans';

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Map a plan id to its configured Stripe price id, and back.
export function priceIdForPlan(plan: PlanId): string | null {
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO ?? null;
  if (plan === 'business') return process.env.STRIPE_PRICE_BUSINESS ?? null;
  return null;
}

export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'business';
  return null;
}

async function stripeForm(
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (data.error as { message?: string } | undefined)?.message ?? `Stripe error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export interface CheckoutInput {
  userId: string;
  email: string;
  plan: PlanId;
  successUrl: string;
  cancelUrl: string;
}

// Create a subscription Checkout session; returns the hosted URL.
export async function createCheckoutSession(input: CheckoutInput): Promise<string> {
  const price = priceIdForPlan(input.plan);
  if (!price) throw new Error(`No Stripe price configured for the ${input.plan} plan`);

  const session = await stripeForm('checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    customer_email: input.email,
    'metadata[userId]': input.userId,
    'metadata[plan]': input.plan,
    'subscription_data[metadata][userId]': input.userId,
    'subscription_data[metadata][plan]': input.plan,
  });

  const url = session.url;
  if (typeof url !== 'string') throw new Error('Stripe did not return a checkout URL');
  return url;
}

// Verify a Stripe webhook signature header against the raw request body.
// Mirrors Stripe's scheme: signedPayload = `${t}.${body}`, HMAC-SHA256 with
// the webhook secret, compared (constant-time) to the v1 signature, with a
// freshness tolerance on the timestamp.
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSec = 300,
  nowSec: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i), kv.slice(i + 1)];
    })
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;

  const timestamp = Number(t);
  if (!Number.isFinite(timestamp) || Math.abs(nowSec - timestamp) > toleranceSec) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
