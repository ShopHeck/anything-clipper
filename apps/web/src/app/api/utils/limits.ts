import sql from '@/app/api/utils/sql';

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

// Sliding-window rate limit backed by the usage_events table so it works
// across serverless instances. Every successful consume also records a
// metering row, which is what billing reads later.
export async function consumeRateLimit(
  userId: string,
  event: string,
  opts: { limit: number; windowSec: number; units?: number; meta?: Record<string, unknown> }
): Promise<LimitResult> {
  const units = opts.units ?? 1;
  const [row] = await sql`
    SELECT COALESCE(SUM(units), 0) AS used, MIN(created_at) AS oldest
    FROM usage_events
    WHERE user_id = ${userId}
      AND event = ${event}
      AND created_at > NOW() - make_interval(secs => ${opts.windowSec})
  `;
  const used = Number(row?.used ?? 0);

  if (used + units > opts.limit) {
    const oldest = row?.oldest ? new Date(row.oldest).getTime() : Date.now();
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + opts.windowSec * 1000 - Date.now()) / 1000)
    );
    return { ok: false, remaining: Math.max(0, opts.limit - used), retryAfterSec };
  }

  await sql`
    INSERT INTO usage_events (user_id, event, units, meta)
    VALUES (${userId}, ${event}, ${units}, ${opts.meta ? JSON.stringify(opts.meta) : null})
  `;
  return { ok: true, remaining: opts.limit - used - units, retryAfterSec: 0 };
}

export function rateLimited(result: LimitResult): Response {
  const mins = Math.max(1, Math.ceil(result.retryAfterSec / 60));
  return Response.json(
    { error: `You've hit the usage limit for this feature. Try again in about ${mins} min.` },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } }
  );
}
