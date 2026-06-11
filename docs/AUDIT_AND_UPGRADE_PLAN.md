# Anything Clipper — Audit & Upgrade Plan

**Goal:** turn the current prototype into an AI video editor + clipping product that
beats CapCut (editing depth) and Opus Clip (long‑form → viral clips) on the dimensions
that matter to creators.

This document has three parts:

1. **Audit** — what exists today and where it breaks.
2. **Competitive bar** — what "better than CapCut/Opus Clip" actually requires.
3. **Upgrade phases** — a sequenced roadmap, starting with the things that are
   currently unsafe or broken.

---

## 1. Audit

### 1.1 Architecture (as built)

| Layer | Implementation |
|---|---|
| Monorepo | Yarn 4 workspaces — `apps/web`, `apps/mobile` |
| Web | Next.js 16, React 19, Tailwind 4, TanStack Query |
| Mobile | Expo 54 / React Native 0.81, expo-router, Skia, expo-video |
| Auth | `better-auth` + Neon Postgres (`apps/web/src/lib/auth.ts`) |
| DB access | Raw SQL via `@neondatabase/serverless` (`app/api/utils/sql.ts`) |
| Transcription | AssemblyAI (`/api/transcribe`, `/api/transcribe/[id]`) |
| LLM | GPT via the "Anything" proxy (`/integrations/chat-gpt/conversationgpt4`) |
| Publishing | TikTok PULL_FROM_URL (`/api/publish/tiktok`) |
| "Editor export" | Client-side `canvas.captureStream()` + `MediaRecorder` |

The data model (inferred from SQL, **no migrations in repo**): `projects`,
`transcript_segments`, `clips`, `publish_jobs`, `platform_connections`.

### 1.2 Critical issues (fix before anything else)

**C1 — Multi-tenant data leak (security, severe).**
No data API route verifies the session or scopes by user.
- `GET /api/projects` returns *every* project in the database (`app/api/projects/route.ts`).
- `projects/[id]`, `clips`, `transcript_segments` have no `user_id` filter — any user can
  read or mutate any project by ID.
- `platform_connections` is read as `WHERE platform = 'TikTok' LIMIT 1`
  (`app/api/publish/tiktok/route.ts`) — a **single global TikTok account** is shared by
  all users. Any user can publish through whoever connected first.

**C2 — No real video pipeline.** `handleExport` in `app/editor/[id]/page.tsx`:
- Records in **real time** via `MediaRecorder` — a 10‑minute source takes 10 minutes to
  export, and the loop runs for `totalDuration` (the **whole video**), not the selected
  clip's start/end.
- Outputs **WebM** on most browsers (TikTok/IG want MP4/H.264) → needs a re-encode that
  doesn't exist.
- Frame draw is `requestAnimationFrame`, which throttles when the tab loses focus →
  dropped frames / corrupt timing.
- `createMediaElementSource` can only be called once per element → re‑export in the same
  session throws. Fails on Safari/iOS.
- Cannot run on mobile, cannot batch, cannot scale.

**C3 — Publishing posts the wrong asset.** `/api/publish/tiktok` pulls `projects.file_url`
(the **full original** upload) and never trims to `clips.start_time/end_time`. Every "clip"
publish posts the entire source video.

**C4 — No durable media storage.** The source video is only an in-memory
`URL.createObjectURL` blob held in a module singleton (`utils/videoStore.ts`); a reload
loses it. `file_url` points at the AssemblyAI **upload** endpoint — intended as
transcription input, not a public CDN, and not a reliable origin for TikTok's pull servers.

**C5 — Open, unmetered AI endpoints.** `generate-clips`, `analyze-virality`, `ai-suggest`,
`generate-hook` are unauthenticated POSTs that call a **paid** GPT integration. No auth,
no rate limit, no usage metering → direct cost-abuse vector.

**C6 — Fake fallback clips erode trust.** On any error, `/api/generate-clips` and
`/api/analyze-virality` return **hardcoded** clips/scores with invented timestamps that
don't match the user's video. Users see confident "94 viral score" results for content
that was never analyzed.

### 1.3 Product gaps vs. competitors

- **Shallow analysis window.** Transcript is truncated to 2000 chars for clip generation
  and 800 for scoring — only the first ~5 minutes of a video is ever considered. Long
  podcasts/webinars (Opus Clip's core use case) are mostly ignored.
- **Unaligned clip boundaries.** GPT returns `segmentStart/segmentEnd` that aren't
  reconciled with AssemblyAI word timestamps, so cuts land mid-word/mid-sentence.
- **Heuristic virality.** Scoring is English-only regex keyword matching (`scoreSegmentsLocally`)
  — gameable and not calibrated to real engagement.
- **No active-speaker reframing.** Export does a static center-crop; competitors track the
  speaker's face and keyframe the crop.
- **Crude captions.** One word at fixed 80% height, two hardcoded styles, drawn live during
  recording. No karaoke word-highlight timing, emoji, positioning, editable text, animation
  presets, translation, or SRT/VTT export.
- **No silence/filler removal, no scene detection, no B-roll, no real zoom/speed effects** —
  even though the AI "recommends" them.
- **Speaker diarization disabled** (`speaker_labels: false`).
- **Half-wired upload** (`utils/useUpload.ts` — Uploadcare client commented out, throws).
- **No tests for web/AI logic, no CI, no DB migrations.**

---

## 2. Competitive bar

| Capability | Opus Clip | CapCut | Anything (today) |
|---|---|---|---|
| Long-form → auto clips | ✅ | ➖ | ⚠️ first ~5 min only |
| Calibrated virality score | ✅ | ❌ | ⚠️ regex heuristic |
| Active-speaker auto-reframe | ✅ | ✅ | ❌ static crop |
| Animated/karaoke captions | ✅ | ✅ (70+ langs) | ⚠️ one word, 2 styles |
| Server render → MP4 | ✅ | ✅ (cloud) | ❌ client WebM, real-time |
| Trim to clip on export/publish | ✅ | ✅ | ❌ exports whole video |
| Multi-track timeline editor | ➖ | ✅ | ❌ |
| B-roll / stock / effects | ✅ | ✅ | ❌ |
| Multi-platform publish + schedule | ✅ | ➖ | ⚠️ TikTok only, untrimmed |
| Translation / dubbing | ✅ | ✅ | ❌ |
| Per-user data isolation & billing | ✅ | ✅ | ❌ |

**Where we can win:** a single product that does Opus-grade auto-clipping **and**
CapCut-grade manual editing on the same timeline, with a server render farm so it works
identically on web and mobile.

---

## 3. Upgrade phases

Estimates assume a small team. Each phase ends in a shippable state.

### Phase 0 — Stop the bleeding (security & correctness) · ~1–2 weeks
Non-negotiable; everything else builds on this.

- **Enforce auth + user scoping on every data route.** Resolve the session
  (`auth.api.getSession`), add `user_id` to `projects` / `clips` / `transcript_segments` /
  `publish_jobs` / `platform_connections`, and filter every query by it. (Fixes **C1**.)
- **Scope `platform_connections` per user**; never share one TikTok token globally. (**C1**)
- **Authenticate + rate-limit + meter** all AI endpoints; reject anonymous calls. (**C5**)
- **Replace fake fallback clips** with an honest error state (or a clearly-labeled demo). (**C6**)
- **Block publishing untrimmed clips** until the render pipeline lands (interim guard). (**C3**)
- **Add a real media bucket** (Cloudflare R2 / S3 / Mux). Upload the source there on import;
  store the durable URL as `file_url`; keep AssemblyAI strictly as a transcription input. (**C4**)
- **Land the DB schema as migrations** (Drizzle/Prisma or SQL files) and a CI typecheck/test job.

### Phase 1 — Real video engine · ~3–6 weeks · ✅ SHIPPED
The single highest-leverage change. (Fixes **C2/C3**.)

- ✅ **Server-side render service.** `render_jobs` queue (migration 0003) + an FFmpeg
  processor (`lib/render/process.ts`). Runs inline via `POST /api/render/:id/process` or
  through the standalone `scripts/render-worker.mjs` poller (secured by
  `RENDER_WORKER_SECRET`), so it scales from a single box to a worker fleet without code
  changes.
- ✅ **Render spec per clip** (`lib/render/`): trim to `start/end`, cut out deleted/silent
  segments, H.264 MP4, target ratio (9:16 / 1:1 / 16:9), **burned karaoke captions** (ASS
  with per-word `\k` timing), animated reframe + zoom keyframes, music bed mix, and
  `loudnorm` loudness normalization. Output uploaded to object storage; `clips.rendered_url`
  is stamped so publishing posts the trimmed clip.
- ✅ **Editor + clips flow** now "submit render job → poll progress → download MP4." The
  real-time `MediaRecorder`/canvas capture path is gone.
- ✅ **Time-domain correctness:** caption words and crop/zoom keyframes are mapped from
  source time into output time after trims and cuts (`lib/render/time.ts`), so captions stay
  in sync across removed regions. Covered by unit tests + an end-to-end ffmpeg smoke test.
- ⏳ **Deferred:** WebCodecs instant client preview (the server render is fast enough to ship
  without it for now).

### Phase 2 — AI clipping that beats Opus Clip · ~3–6 weeks · ✅ SHIPPED
- ✅ **Full-transcript analysis** via map-reduce chunking (`lib/clip/transcript.ts` +
  `analyze.ts`): every chunk of the whole video is scored, candidates are gathered across
  the entire runtime, then ranked and de-duplicated by overlap. The 2000/800-char truncation
  is gone; `generate-clips` accepts word timestamps and analyzes the full video.
- ✅ **Word-timestamp-aligned boundaries** (`lib/clip/boundaries.ts`): clip start/end snap to
  phrase starts and sentence ends from word timing, so cuts never land mid-word. Word
  timestamps are captured from AssemblyAI and persisted on the project.
- ✅ **Silence + filler detection** (`detectSilences`, `detectFillerCuts`) feeding the
  render pipeline's cut list for one-tap "remove dead air / filler words."
- ✅ **Diarization enabled** (`speaker_labels: true`) for multi-speaker reframing.
- ✅ **Reframe + zoom planning** (`lib/clip/reframe.ts`): a detector-agnostic contract that
  turns face observations into smoothed crop keyframes and emphasis times into zoom punch-ins
  — consumed directly by the Phase 1 render spec.
- ⏳ **Deferred:** wiring a real per-frame face-detection model in the render worker (the
  contract + smoothing/fallback are in place; today it defaults to center-crop until a
  detector is plugged in).

### Phase 3 — Caption & effects parity with CapCut · ~3–5 weeks · ✅ SHIPPED (core)
- ✅ **Karaoke word-highlight captions** from word timestamps with a template library and
  positioning (Phase 1 ASS builder: `\k` per-word timing, 5 styles, bottom/center/top).
- ✅ **Translation + subtitle export**: `GET /api/projects/:id/subtitles?format=srt|vtt&lang=…`
  builds SRT/VTT from word timestamps, optionally translated and clip-scoped
  (`lib/captions/subtitles.ts`, `translate.ts`). The editor caption panel exports .SRT/.VTT
  and picks a burn-in language; the renderer burns translated captions into the MP4.
- ✅ **Effects that render:** zoom punch-ins and animated reframe crop (Phases 1–2) are live
  in the ffmpeg pipeline.
- ⏳ **Deferred (next iteration):** TTS dubbing, per-range speed ramps (kept out to avoid
  caption-sync regressions), transitions, auto B-roll/stock, background removal, and the full
  multi-track timeline editor UI. The render spec already has typed fields for speed ranges so
  they can be added without an API change.

### Phase 4 — Growth & monetization · ongoing
- **Multi-platform publish** (Instagram Reels, YouTube Shorts, X) + **scheduling** + posted-clip
  **analytics**.
- **Brand kits / templates**, teams & collaboration.
- **Usage metering + billing** (Stripe credits) wired to the Phase 0 metering.
- **Observability:** render-job dashboard, error tracking, cost monitoring.

---

## Suggested first PRs (Phase 0)

1. `auth-scoping`: session check + `user_id` filter on all data routes; migration adding
   `user_id` columns and indexes.
2. `media-storage`: R2/S3 upload on import; durable `file_url`; signed playback URLs.
3. `ai-guardrails`: auth + rate limit + usage metering on AI routes; remove fake fallbacks.
4. `schema-and-ci`: migrations + a CI job running typecheck and tests.

> Recommendation: start with PRs #1 and #3 — they close the security holes — then #2, which
> unblocks the Phase 1 render engine.
