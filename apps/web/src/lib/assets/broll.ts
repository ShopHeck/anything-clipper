// AI product b-roll provider (image-to-video).
//
// Turns the REAL scraped product photos into short, photoreal motion clips so
// the UGC video showcases the actual product and its details/use case — not
// generic stock footage. This mirrors the moras.ai approach of generating
// product-forward shots, using the strongest image-to-video models available.
//
// Routing: fal.ai unified queue API (one key, many models) with FAL_KEY.
// The model is configurable via FAL_VIDEO_MODEL and defaults to a current
// best-in-class image-to-video model. When FAL_KEY is absent the pipeline
// falls back to the stock-footage / still-image path.
//
// fal queue protocol:
//   1. POST https://queue.fal.run/{model}            -> { request_id, status_url, response_url }
//   2. poll GET {status_url}                         -> { status: IN_QUEUE|IN_PROGRESS|COMPLETED }
//   3. GET {response_url}                            -> { video: { url } }
//
// Docs: https://docs.fal.ai/model-endpoints/queue

const FAL_QUEUE_BASE = 'https://queue.fal.run';

/** Default to a current top-tier image-to-video model for realistic product shots. */
export const DEFAULT_FAL_VIDEO_MODEL = 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video';

export class BrollError extends Error {
  constructor(detail: string) {
    super(`Product b-roll generation failed: ${detail}`);
    this.name = 'BrollError';
  }
}

export interface GenerateBrollOptions {
  /** Public URL of the source product image to animate. */
  imageUrl: string;
  /** Motion/scene prompt describing how the product should be shown in use. */
  prompt: string;
  /** Target clip duration in seconds. Snapped to the model's allowed values. */
  durationSec?: number;
  /** Override the fal model id. Defaults to FAL_VIDEO_MODEL or DEFAULT_FAL_VIDEO_MODEL. */
  model?: string;
  /** Poll interval in ms. Defaults to 5000. */
  pollIntervalMs?: number;
  /** Max time to wait for the render in ms. Defaults to 240000 (4 min). */
  timeoutMs?: number;
  /** Injectable fetch for testing. */
  fetchImpl?: typeof fetch;
  /** Injectable sleep for testing. */
  sleepImpl?: (ms: number) => Promise<void>;
}

export interface BrollResult {
  videoUrl: string;
}

/** True when a fal.ai API key is configured on this deployment. */
export function brollConfigured(): boolean {
  return Boolean(process.env.FAL_KEY);
}

function getApiKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new BrollError('FAL_KEY is not configured');
  return key;
}

function getModel(override?: string): string {
  return override || process.env.FAL_VIDEO_MODEL || DEFAULT_FAL_VIDEO_MODEL;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Snap a desired duration to the values image-to-video models accept.
 * Most (Kling, Seedance) support 5s or 10s clips; we never request shorter
 * than the scene needs so the clip can always cover its slot.
 */
export function snapDuration(durationSec?: number): string {
  if (typeof durationSec === 'number' && durationSec > 5) return '10';
  return '5';
}

/**
 * Generate a single product b-roll clip from a product image and wait for it
 * to finish. Throws BrollError on failure so the caller can fall back.
 */
export async function generateProductBroll(opts: GenerateBrollOptions): Promise<BrollResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleepImpl ?? defaultSleep;
  const apiKey = getApiKey();
  const model = getModel(opts.model);

  const body = {
    prompt: opts.prompt,
    image_url: opts.imageUrl,
    duration: snapDuration(opts.durationSec),
  };

  // 1. Submit to the queue
  const submitRes = await fetchImpl(`${FAL_QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const detail = await submitRes.text().catch(() => '');
    throw new BrollError(`submit returned ${submitRes.status}: ${detail.slice(0, 200)}`);
  }

  const submitData = await submitRes.json();
  const requestId: string | undefined = submitData?.request_id;
  if (!requestId) {
    throw new BrollError('submit response did not include a request_id');
  }

  // fal returns fully-qualified URLs; fall back to constructing them if absent.
  const statusUrl: string =
    submitData?.status_url ?? `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`;
  const responseUrl: string =
    submitData?.response_url ?? `${FAL_QUEUE_BASE}/${model}/requests/${requestId}`;

  // 2. Poll for completion
  const pollIntervalMs = opts.pollIntervalMs ?? 5000;
  const timeoutMs = opts.timeoutMs ?? 240000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const statusRes = await fetchImpl(statusUrl, {
      method: 'GET',
      headers: { Authorization: `Key ${apiKey}`, Accept: 'application/json' },
    });
    if (!statusRes.ok) {
      console.warn(`[b-roll] status poll returned ${statusRes.status}`);
      continue;
    }

    const statusData = await statusRes.json();
    const status: string | undefined = statusData?.status;

    if (status === 'COMPLETED') {
      return fetchResult(responseUrl, apiKey, fetchImpl);
    }
    // IN_QUEUE / IN_PROGRESS -> keep polling. fal does not return a terminal
    // FAILED status here; failures surface as a non-2xx on the result fetch.
  }

  throw new BrollError(`render did not complete within ${Math.round(timeoutMs / 1000)}s`);
}

async function fetchResult(
  responseUrl: string,
  apiKey: string,
  fetchImpl: typeof fetch
): Promise<BrollResult> {
  const res = await fetchImpl(responseUrl, {
    method: 'GET',
    headers: { Authorization: `Key ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new BrollError(`result fetch returned ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  // Most fal video models return { video: { url } }; some return { video_url } or
  // a videos array. Probe the common shapes.
  const videoUrl: string | undefined =
    data?.video?.url ??
    data?.video_url ??
    (Array.isArray(data?.videos) ? data.videos[0]?.url : undefined);
  if (!videoUrl) {
    throw new BrollError('result did not include a video url');
  }
  return { videoUrl };
}
