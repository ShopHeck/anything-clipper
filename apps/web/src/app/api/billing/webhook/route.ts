import sql from '@/app/api/utils/sql';
import { resolvePlan } from '@/lib/billing/plans';
import { planForPriceId, verifyWebhookSignature } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

// POST /api/billing/webhook — Stripe subscription lifecycle. Signature is
// verified against the raw body; we then upsert user_plans so the quota
// gates (utils/quota.ts) reflect the active subscription.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: 'Billing webhook is not configured.' }, { status: 501 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!verifyWebhookSignature(rawBody, sig, secret)) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const obj = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const userId =
          (obj.client_reference_id as string) ??
          (obj.metadata as Record<string, string> | undefined)?.userId;
        const plan = (obj.metadata as Record<string, string> | undefined)?.plan ?? 'pro';
        if (userId) {
          await upsertPlan(userId, resolvePlan(plan).id, 'active', {
            customer: obj.customer as string | null,
            subscription: obj.subscription as string | null,
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const meta = obj.metadata as Record<string, string> | undefined;
        const userId = meta?.userId;
        const priceId = (obj.items as { data?: Array<{ price?: { id?: string } }> } | undefined)
          ?.data?.[0]?.price?.id;
        const plan = planForPriceId(priceId) ?? resolvePlan(meta?.plan).id;
        const status = obj.status === 'active' || obj.status === 'trialing' ? 'active' : 'past_due';
        if (userId) {
          await upsertPlan(userId, plan, status, {
            customer: obj.customer as string | null,
            subscription: obj.id as string | null,
            periodEnd: obj.current_period_end as number | undefined,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const userId = (obj.metadata as Record<string, string> | undefined)?.userId;
        if (userId) {
          await sql`
            UPDATE user_plans SET plan = 'free', status = 'canceled', updated_at = NOW()
            WHERE user_id = ${userId}
          `;
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handling error:', err);
    return Response.json({ error: 'Webhook handling failed' }, { status: 500 });
  }

  return Response.json({ received: true });
}

async function upsertPlan(
  userId: string,
  plan: string,
  status: string,
  refs: { customer?: string | null; subscription?: string | null; periodEnd?: number }
) {
  const periodEnd = refs.periodEnd ? new Date(refs.periodEnd * 1000).toISOString() : null;
  await sql`
    INSERT INTO user_plans (user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at)
    VALUES (${userId}, ${plan}, ${status}, ${refs.customer ?? null}, ${refs.subscription ?? null}, ${periodEnd}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_plans.stripe_customer_id),
      stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, user_plans.stripe_subscription_id),
      current_period_end = COALESCE(EXCLUDED.current_period_end, user_plans.current_period_end),
      updated_at = NOW()
  `;
}
