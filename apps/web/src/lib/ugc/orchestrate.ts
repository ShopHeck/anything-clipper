// End-to-end UGC video orchestration pipeline.
// Chains: scrape product -> generate script -> TTS -> assets -> scene plan -> compose.
// Updates the ugc_projects row at each step with progress status.

import { chatCompletionJson } from '@/app/api/utils/ai';
import sql from '@/app/api/utils/sql';
import { presignDownload } from '@/app/api/utils/storage';
import { generateImage } from '@/lib/assets/image-gen';
import { generatePlaceholderImage } from '@/lib/assets/placeholder-image';
import { processProductImages } from '@/lib/assets/product-images';
import { planScenes } from '@/lib/assets/scene-planner';
import type { ProductAssets, ScenePlan } from '@/lib/assets/types';
import { scriptToAudio } from '@/lib/tts/script-to-audio';
import type { ScriptToAudioResult, SectionTiming, TTSVoice, UGCScript } from '@/lib/tts/types';
import { captionsFromScript } from './captions-from-script';
import { composeUGCVideo } from './compose';
import type { UGCRenderSpec, UGCScene } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductData {
  name: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  rating?: string;
  soldCount?: string;
  shopName?: string;
  category?: string;
  features?: string[];
  imageUrls?: string[];
}

export type UGCProjectStatus =
  | 'scraping'
  | 'generating_script'
  | 'generating_tts'
  | 'generating_assets'
  | 'planning_scenes'
  | 'composing'
  | 'completed'
  | 'failed';

export interface OrchestrateOptions {
  projectId: string;
  userId: string;
  url: string;
  voice?: TTSVoice;
  templateStyle?: string;
  captionTemplate?: string;
}

export interface OrchestrateResult {
  status: 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateProjectStatus(
  projectId: string,
  status: UGCProjectStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const sets: string[] = [];
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      // Using parameterized values - we build a single update below
      sets.push(key);
    }
  }
  // Simple status update using tagged template
  if (extra && Object.keys(extra).length > 0) {
    // We need to do a manual update with all JSONB fields
    const productData = extra.product_data !== undefined ? JSON.stringify(extra.product_data) : undefined;
    const script = extra.script !== undefined ? JSON.stringify(extra.script) : undefined;
    const ttsAudioUrl = extra.tts_audio_url as string | undefined;
    const ttsTiming = extra.tts_timing !== undefined ? JSON.stringify(extra.tts_timing) : undefined;
    const videoAssets = extra.video_assets !== undefined ? JSON.stringify(extra.video_assets) : undefined;

    if (productData !== undefined) {
      await sql`UPDATE ugc_projects SET status = ${status}, product_data = ${productData}, updated_at = NOW() WHERE id = ${projectId}`;
    } else if (script !== undefined) {
      await sql`UPDATE ugc_projects SET status = ${status}, script = ${script}, updated_at = NOW() WHERE id = ${projectId}`;
    } else if (ttsAudioUrl !== undefined && ttsTiming !== undefined) {
      await sql`UPDATE ugc_projects SET status = ${status}, tts_audio_url = ${ttsAudioUrl}, tts_timing = ${ttsTiming}, updated_at = NOW() WHERE id = ${projectId}`;
    } else if (videoAssets !== undefined) {
      await sql`UPDATE ugc_projects SET status = ${status}, video_assets = ${videoAssets}, updated_at = NOW() WHERE id = ${projectId}`;
    } else {
      await sql`UPDATE ugc_projects SET status = ${status}, updated_at = NOW() WHERE id = ${projectId}`;
    }
  } else {
    await sql`UPDATE ugc_projects SET status = ${status}, updated_at = NOW() WHERE id = ${projectId}`;
  }
}

async function markFailed(projectId: string, error: string): Promise<void> {
  const errorPayload = JSON.stringify({ error });
  await sql`UPDATE ugc_projects SET status = 'failed', video_assets = ${errorPayload}, updated_at = NOW() WHERE id = ${projectId}`;
}

// ---------------------------------------------------------------------------
// Step 1: Scrape product data
// ---------------------------------------------------------------------------

export async function scrapeProduct(url: string): Promise<ProductData> {
  const base = process.env.NEXT_PUBLIC_CREATE_BASE_URL;
  const token = process.env.ANYTHING_PROJECT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  let pageText = '';

  if (base && token) {
    // Use proxy scraping service
    const scrapeRes = await fetch(`${base}/integrations/web-scraping/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, getText: true }),
    });

    if (scrapeRes.ok) {
      pageText = await scrapeRes.text();
      pageText = pageText.slice(0, 4000);
    }
  } else if (openaiKey) {
    // Direct fetch fallback when proxy is not configured
    // SSRF protection: validate the URL before fetching
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Only http and https URLs are allowed');
    }

    const hostname = parsedUrl.hostname;
    const isPrivate =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0' ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname);

    if (isPrivate) {
      throw new Error('URLs pointing to private or reserved addresses are not allowed');
    }

    const scrapeRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (scrapeRes.ok) {
      const html = await scrapeRes.text();
      // Strip HTML tags to extract text content
      pageText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      pageText = pageText.slice(0, 4000);
    }
  } else {
    throw new Error('Scraping service is not configured and no AI API key is available');
  }

  if (!pageText) {
    throw new Error('Could not read the product page. Check the URL is public and try again.');
  }

  const product = await chatCompletionJson<ProductData>(
    [
      {
        role: 'system',
        content:
          'You are an e-commerce data extractor. Extract product details from webpage text. Only report details actually present in the page content. Also extract any image URLs you find.',
      },
      {
        role: 'user',
        content: `Extract product details from this TikTok Shop product page.\n\nURL: ${url}\n\nPage content (may be partial):\n${pageText}\n\nFor features, return 4-6 bullet point benefits. For imageUrls, extract product image URLs found in the content.`,
      },
    ],
    {
      name: 'product_details',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'string' },
          originalPrice: { type: 'string' },
          discount: { type: 'string' },
          rating: { type: 'string' },
          soldCount: { type: 'string' },
          shopName: { type: 'string' },
          category: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          imageUrls: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'price', 'features', 'imageUrls'],
        additionalProperties: false,
      },
    }
  );

  return product;
}

// ---------------------------------------------------------------------------
// Step 2: Generate UGC script
// ---------------------------------------------------------------------------

export async function generateUGCScript(
  product: ProductData,
  templateStyle?: string
): Promise<UGCScript> {
  const stylePrompt =
    templateStyle === 'pov'
      ? 'Use POV: format hooks. Short, punchy, relatable.'
      : templateStyle === 'storytime'
        ? 'Use storytime hooks. Personal, emotional, narrative-driven.'
        : templateStyle === 'bold-hook'
          ? 'Use bold, direct claims. Numbers and stats when possible.'
          : 'Use authentic UGC creator style. Conversational, genuine, excited.';

  const script = await chatCompletionJson<UGCScript>(
    [
      {
        role: 'system',
        content: `You are an elite UGC video script writer specializing in TikTok Shop affiliate content. ${stylePrompt}`,
      },
      {
        role: 'user',
        content: `Write a complete UGC product video script for TikTok/Reels.\n\nProduct: ${product.name}\nPrice: ${product.price}${product.originalPrice ? ` (was ${product.originalPrice})` : ''}\nRating: ${product.rating ?? 'N/A'} stars, ${product.soldCount ?? 'N/A'} sold\nShop: ${product.shopName ?? 'Unknown'}\nCategory: ${product.category ?? 'General'}\nKey features:\n${(product.features ?? []).map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nCreate a script that sounds authentic, NOT like an ad. Each section should be 1-3 sentences max.`,
      },
    ],
    {
      name: 'ugc_script',
      schema: {
        type: 'object',
        properties: {
          hook: { type: 'string' },
          problem: { type: 'string' },
          solution: { type: 'string' },
          demo: { type: 'string' },
          socialProof: { type: 'string' },
          cta: { type: 'string' },
        },
        required: ['hook', 'problem', 'solution', 'demo', 'socialProof', 'cta'],
        additionalProperties: false,
      },
    }
  );

  return script;
}

// ---------------------------------------------------------------------------
// Step 3: Generate TTS voiceover
// ---------------------------------------------------------------------------

export async function generateTTSAudio(
  script: UGCScript,
  userId: string,
  projectId: string,
  voice?: TTSVoice
): Promise<ScriptToAudioResult> {
  const storageKey = `tts/${userId}/${projectId}.mp3`;
  return scriptToAudio({
    script,
    voice: voice ?? 'nova',
    speed: 1.0,
    storageKey,
  });
}

// ---------------------------------------------------------------------------
// Step 4: Extract/generate visual assets
// ---------------------------------------------------------------------------

export async function gatherAssets(
  product: ProductData,
  userId: string
): Promise<ProductAssets> {
  const assets: ProductAssets = {
    productImages: [],
    lifestyleImages: [],
  };

  // Download and store product images from scraped URLs
  if (product.imageUrls && product.imageUrls.length > 0) {
    const processed = await processProductImages(product.imageUrls, userId);
    assets.productImages = processed.map((p) => p.storageUrl);
  }

  // Generate a lifestyle image if possible
  const lifestyleImg = await generateImage({
    productDescription: `${product.name} - ${(product.features ?? []).slice(0, 2).join(', ')}`,
    sceneContext: `Person happily using ${product.name} in a natural setting, authentic UGC style`,
    size: '1024x1792',
    userId,
  });
  if (lifestyleImg) {
    assets.lifestyleImages.push(lifestyleImg);
  }

  // Fallback: if no images at all, generate a placeholder so the pipeline never aborts
  if (assets.productImages.length === 0 && assets.lifestyleImages.length === 0) {
    try {
      const placeholderUrl = await generatePlaceholderImage({
        productName: product.name,
        userId,
      });
      assets.productImages.push(placeholderUrl);
    } catch (err) {
      console.warn(
        'Placeholder image upload failed; compose will generate a local fallback:',
        err instanceof Error ? err.message : err
      );
    }
  }

  return assets;
}

// ---------------------------------------------------------------------------
// Step 5: Plan scenes
// ---------------------------------------------------------------------------

export function buildScenePlan(
  script: UGCScript,
  timings: SectionTiming[],
  assets: ProductAssets,
  product: ProductData
): ScenePlan[] {
  return planScenes({
    timings,
    assets,
    productData: {
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      discount: product.discount,
      rating: product.rating,
      soldCount: product.soldCount,
    },
    script,
  });
}

// ---------------------------------------------------------------------------
// Step 6: Build render spec and compose video
// ---------------------------------------------------------------------------

export function buildRenderSpec(
  script: UGCScript,
  timings: SectionTiming[],
  scenePlan: ScenePlan[],
  ttsAudioUrl: string,
  captionTemplate?: string
): UGCRenderSpec {
  // Convert scene plan into UGCScene array
  const scenes: UGCScene[] = scenePlan.map((scene, i) => ({
    startSec: scene.startSec,
    endSec: scene.endSec,
    imageUrl: scene.assetUrl || '',
    zoomDirection: i % 2 === 0 ? 'in' : 'out',
    overlayText: scene.overlayText,
    overlayPosition: scene.type === 'text-overlay' ? 'center' : undefined,
  }));

  // Generate word-level captions
  const captions = captionsFromScript(script, timings);

  return {
    ttsAudioUrl,
    scenes,
    captions,
    aspect: '9:16',
    captionTemplateId: captionTemplate || 'default',
    captionPosition: 'bottom',
    fps: 30,
  };
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

export async function orchestrateUGCVideo(opts: OrchestrateOptions): Promise<OrchestrateResult> {
  const { projectId, userId, url, voice, templateStyle, captionTemplate } = opts;

  try {
    // Step 1: Scrape product
    await updateProjectStatus(projectId, 'scraping');
    const product = await scrapeProduct(url);
    await updateProjectStatus(projectId, 'generating_script', { product_data: product });

    // Step 2: Generate script
    const script = await generateUGCScript(product, templateStyle);
    await updateProjectStatus(projectId, 'generating_tts', { script });

    // Step 3: Generate TTS
    const ttsResult = await generateTTSAudio(script, userId, projectId, voice);
    // Store the storage key (not a presigned URL) so the link doesn't expire in the DB
    const ttsStorageKey = `tts/${userId}/${projectId}.mp3`;
    await updateProjectStatus(projectId, 'generating_assets', {
      tts_audio_url: ttsStorageKey,
      tts_timing: ttsResult,
    });

    // Step 4: Gather visual assets
    const assets = await gatherAssets(product, userId);

    await updateProjectStatus(projectId, 'planning_scenes', {
      video_assets: assets,
    });

    // Step 5: Plan scenes
    const scenePlan = buildScenePlan(script, ttsResult.timings, assets, product);
    await updateProjectStatus(projectId, 'composing');

    // Step 6: Build spec and compose video
    const renderSpec = buildRenderSpec(
      script,
      ttsResult.timings,
      scenePlan,
      ttsResult.audioUrl,
      captionTemplate
    );

    const outputKey = `ugc/${userId}/${projectId}/output.mp4`;
    const composeResult = await composeUGCVideo({
      spec: renderSpec,
      outputKey,
      onProgress: () => {
        // Could update progress in DB here if needed
      },
    });

    if (composeResult.status === 'failed') {
      await markFailed(projectId, composeResult.error ?? 'Composition failed');
      return { status: 'failed', error: composeResult.error };
    }

    // Mark completed
    const videoUrl = composeResult.outputUrl ?? composeResult.outputPath ?? '';
    await sql`UPDATE ugc_projects SET status = 'completed', updated_at = NOW() WHERE id = ${projectId}`;

    return { status: 'completed', videoUrl };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await markFailed(projectId, errorMsg).catch(() => {});
    return { status: 'failed', error: errorMsg };
  }
}
