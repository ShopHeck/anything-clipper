// Standalone render worker: claims queued render jobs from the DB and asks
// the app to process them (all render logic lives in the app, so this stays
// a dumb pump that can run on any box with network access).
//
// Usage:
//   DATABASE_URL=... APP_URL=https://your-app RENDER_WORKER_SECRET=... \
//     node scripts/render-worker.mjs
import { neon } from '@neondatabase/serverless';

const { DATABASE_URL, APP_URL, RENDER_WORKER_SECRET } = process.env;
if (!DATABASE_URL || !APP_URL || !RENDER_WORKER_SECRET) {
  console.error('DATABASE_URL, APP_URL, and RENDER_WORKER_SECRET are required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const POLL_MS = 3000;

async function claimJob() {
  const rows = await sql`
    SELECT id FROM render_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

console.log('Render worker started, polling for jobs…');
for (;;) {
  try {
    const jobId = await claimJob();
    if (jobId) {
      console.log(`Processing render job ${jobId}…`);
      const res = await fetch(`${APP_URL}/api/render/${jobId}/process`, {
        method: 'POST',
        headers: { 'x-render-worker-secret': RENDER_WORKER_SECRET },
      });
      const body = await res.json().catch(() => ({}));
      console.log(`Job ${jobId}: ${res.ok ? 'completed' : `failed — ${body.error ?? res.status}`}`);
    }
  } catch (err) {
    console.error('Worker loop error:', err);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
