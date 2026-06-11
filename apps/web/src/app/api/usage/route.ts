import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { getUserPlan } from '@/app/api/utils/quota';
import sql from '@/app/api/utils/sql';
import { evaluateQuota, EVENT_TO_QUOTA, PlanQuotas } from '@/lib/billing/plans';

// GET /api/usage — current plan + this-month usage against each quota.
// Drives the account/billing screen and in-app upgrade prompts.
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const plan = await getUserPlan(user.id);

    const rows = await sql`
      SELECT event, COALESCE(SUM(units), 0) AS used
      FROM usage_events
      WHERE user_id = ${user.id} AND created_at >= date_trunc('month', NOW())
      GROUP BY event
    `;
    const usedByEvent = new Map(rows.map((r) => [r.event as string, Number(r.used)]));

    // Aggregate event usage up to each quota bucket.
    const usedByQuota: Partial<Record<keyof PlanQuotas, number>> = {};
    for (const [event, quotaKey] of Object.entries(EVENT_TO_QUOTA)) {
      usedByQuota[quotaKey] = (usedByQuota[quotaKey] ?? 0) + (usedByEvent.get(event) ?? 0);
    }

    const quotas = (Object.keys(plan.quotas) as Array<keyof PlanQuotas>).map((key) => {
      const used = usedByQuota[key] ?? 0;
      const check = evaluateQuota(plan, key, used);
      return {
        key,
        used,
        limit: check.limit,
        remaining: check.remaining === Infinity ? null : check.remaining,
        unlimited: check.limit < 0,
      };
    });

    return Response.json({
      plan: { id: plan.id, label: plan.label, priceUsdMonthly: plan.priceUsdMonthly },
      quotas,
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    });
  } catch (err) {
    console.error('Usage summary error:', err);
    return Response.json({ error: 'Failed to load usage' }, { status: 500 });
  }
}
