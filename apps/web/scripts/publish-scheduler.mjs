// Polls the app to publish due scheduled jobs. Run as a long-lived process
// or invoke once per minute from cron.
//
// Usage:
//   APP_URL=https://your-app RENDER_WORKER_SECRET=... node scripts/publish-scheduler.mjs
const { APP_URL, RENDER_WORKER_SECRET } = process.env;
if (!APP_URL || !RENDER_WORKER_SECRET) {
  console.error('APP_URL and RENDER_WORKER_SECRET are required');
  process.exit(1);
}

const POLL_MS = 30_000;

async function tick() {
  try {
    const res = await fetch(`${APP_URL}/api/publish/run-scheduled`, {
      method: 'POST',
      headers: { 'x-render-worker-secret': RENDER_WORKER_SECRET },
    });
    const body = await res.json().catch(() => ({}));
    if (body.processed) console.log(`Published ${body.processed} scheduled job(s).`);
  } catch (err) {
    console.error('Scheduler tick error:', err);
  }
}

console.log('Publish scheduler started.');
for (;;) {
  await tick();
  await new Promise((r) => setTimeout(r, POLL_MS));
}
