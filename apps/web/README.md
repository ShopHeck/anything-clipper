# Anything Clipper — Web

Next.js app: AI clipping, a server-side FFmpeg render pipeline, captions/subtitles,
multi-tenant auth, plan quotas, and scheduled publishing.

## Scripts

```bash
yarn dev          # next dev on :4000
yarn build        # production build
yarn typecheck    # tsc --noEmit
yarn test         # vitest (ffmpeg smoke test auto-skips if ffmpeg is absent)
yarn migrate      # apply migrations/*.sql in order (needs DATABASE_URL)
```

## Database

SQL migrations live in `migrations/` and are applied in filename order by
`scripts/migrate.mjs`, tracked in a `_migrations` table. Run after deploy:

```bash
DATABASE_URL=postgres://... yarn migrate
```

## Background workers

The render pipeline and scheduled publishing can run inline (the app processes
jobs on request) or via standalone pollers for scale:

```bash
# Render worker — claims queued render_jobs and asks the app to process them
DATABASE_URL=... APP_URL=https://your-app RENDER_WORKER_SECRET=... \
  node scripts/render-worker.mjs

# Publish scheduler — posts due scheduled publish_jobs
APP_URL=https://your-app RENDER_WORKER_SECRET=... \
  node scripts/publish-scheduler.mjs
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon/Postgres connection string |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_CREATE_*` | auth origins / app URLs |
| `ANYTHING_PROJECT_TOKEN` | token for the LLM gateway |
| `ASSEMBLYAI_API_KEY` | transcription |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_REGION` | S3-compatible media storage (R2/S3/MinIO). Without these the app falls back to legacy upload + local render output (no publishing). |
| `FFMPEG_PATH` | ffmpeg binary path (default `ffmpeg`) |
| `RENDER_WORKER_SECRET` | shared secret for the render worker + publish scheduler endpoints |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | TikTok publishing |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | billing (checkout + webhook → `user_plans`). Without these, billing routes return 501 and everyone stays on the free plan. |

## Architecture notes

- **Render pipeline** (`src/lib/render/`): a `RenderSpec` → ffmpeg args (trim, cut removal,
  aspect crop with animated reframe/zoom keyframes, burned ASS karaoke captions, music mix,
  loudness). Source↔output time mapping keeps captions in sync across cuts.
- **Clip intelligence** (`src/lib/clip/`): full-transcript map-reduce analysis, word-accurate
  boundary snapping, silence/filler detection, reframe/zoom planning.
- **Captions** (`src/lib/captions/`): ASS karaoke builder, SRT/VTT export, translation.
- **Billing** (`src/lib/billing/`): plans + monthly quotas enforced against `usage_events`.
- **Publishing** (`src/lib/publish/`): platform-agnostic dispatch; TikTok implemented.
