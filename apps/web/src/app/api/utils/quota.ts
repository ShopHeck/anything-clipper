import sql from '@/app/api/utils/sql';
import {
  evaluateQuota,
  EVENT_TO_QUOTA,
  PlanQuotas,
  QuotaCheck,
  resolvePlan,
} from '@/lib/billing/plans';

export async function getUserPlan(userId: string) {
  const [row] = await sql`SELECT plan, status FROM user_plans WHERE user_id = ${userId}`;
  // Treat a past_due/canceled subscription as free.
  const planId = row && row.status === 'active' ? row.plan : 'free';
  return resolvePlan(planId);
}

// Calendar-month usage count for a given event (matches the quota window).
async function monthlyUsage(userId: string, event: string): Promise<number> {
  const [row] = await sql`
    SELECT COALESCE(SUM(units), 0) AS used
    FROM usage_events
    WHERE user_id = ${userId}
      AND event = ${event}
      AND created_at >= date_trunc('month', NOW())
  `;
  return Number(row?.used ?? 0);
}

// Check the monthly plan quota for an event without consuming it. Events not
// mapped to a quota are always allowed (they may still be rate-limited).
export async function checkPlanQuota(userId: string, event: string): Promise<QuotaCheck | null> {
  const quotaKey = EVENT_TO_QUOTA[event] as keyof PlanQuotas | undefined;
  if (!quotaKey) return null;
  const plan = await getUserPlan(userId);
  const used = await monthlyUsage(userId, event);
  return evaluateQuota(plan, quotaKey, used);
}

export function quotaExceeded(check: QuotaCheck): Response {
  return Response.json(
    {
      error: `You've reached your plan's monthly limit (${check.limit}). Upgrade for more.`,
      code: 'quota_exceeded',
      limit: check.limit,
      used: check.used,
    },
    { status: 402 }
  );
}
