import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { PlanId, PLANS } from '@/lib/billing/plans';
import { createCheckoutSession, stripeConfigured } from '@/lib/billing/stripe';

// POST /api/billing/checkout { plan: 'pro' | 'business' }
// Returns { url } for the Stripe-hosted checkout page.
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  if (!stripeConfigured()) {
    return Response.json({ error: 'Billing is not configured on this deployment.' }, { status: 501 });
  }

  try {
    const { plan } = (await request.json()) as { plan?: PlanId };
    if (!plan || !PLANS[plan] || plan === 'free') {
      return Response.json({ error: 'Choose a paid plan to upgrade.' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? new URL(request.url).origin;
    const url = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      plan,
      successUrl: `${appUrl}/dashboard?upgraded=1`,
      cancelUrl: `${appUrl}/dashboard?canceled=1`,
    });

    return Response.json({ url });
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
  }
}
