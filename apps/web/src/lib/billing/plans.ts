// Plan definitions and monthly quotas. Quotas are enforced against the
// usage_events ledger (the same table the sliding-window rate limiter uses),
// so metering and billing share one source of truth.

export type PlanId = 'free' | 'pro' | 'business';

export interface PlanQuotas {
  // Calendar-month caps. -1 means unlimited.
  uploadsPerMonth: number;
  clipGenerationsPerMonth: number;
  rendersPerMonth: number;
  translationsPerMonth: number;
  ugcVideosPerMonth: number;
}

export interface Plan {
  id: PlanId;
  label: string;
  priceUsdMonthly: number;
  quotas: PlanQuotas;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    label: 'Free',
    priceUsdMonthly: 0,
    quotas: {
      uploadsPerMonth: 5,
      clipGenerationsPerMonth: 10,
      rendersPerMonth: 15,
      translationsPerMonth: 5,
      ugcVideosPerMonth: 3,
    },
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    priceUsdMonthly: 19,
    quotas: {
      uploadsPerMonth: 100,
      clipGenerationsPerMonth: 300,
      rendersPerMonth: 500,
      translationsPerMonth: 200,
      ugcVideosPerMonth: 50,
    },
  },
  business: {
    id: 'business',
    label: 'Business',
    priceUsdMonthly: 49,
    quotas: {
      uploadsPerMonth: -1,
      clipGenerationsPerMonth: -1,
      rendersPerMonth: -1,
      translationsPerMonth: -1,
      ugcVideosPerMonth: -1,
    },
  },
};

export function resolvePlan(planId: string | null | undefined): Plan {
  return PLANS[(planId as PlanId)] ?? PLANS.free;
}

// Maps a metered usage event to the quota it counts against. Events not
// listed here are rate-limited but not plan-capped.
export const EVENT_TO_QUOTA: Record<string, keyof PlanQuotas> = {
  'upload.video': 'uploadsPerMonth',
  'media.presign': 'uploadsPerMonth',
  'ai.generate-clips': 'clipGenerationsPerMonth',
  'render.create': 'rendersPerMonth',
  'captions.translate': 'translationsPerMonth',
  'ai.ugc-create': 'ugcVideosPerMonth',
};

export interface QuotaCheck {
  allowed: boolean;
  limit: number; // -1 = unlimited
  used: number;
  remaining: number; // Infinity when unlimited
}

export function evaluateQuota(plan: Plan, quotaKey: keyof PlanQuotas, used: number): QuotaCheck {
  const limit = plan.quotas[quotaKey];
  if (limit < 0) {
    return { allowed: true, limit: -1, used, remaining: Infinity };
  }
  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}
