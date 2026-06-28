// Scene planner: maps UGC script sections + TTS timing to visual assets.
// Produces a complete scene plan covering the full TTS audio duration with
// zero gaps. Each scene has a type, timing, and optional asset/overlay.

import type { ProductAssets, ScenePlan } from './types';
import type { UGCScript } from '@/lib/tts/types';

/** Script section to visual asset type mapping (image-based fallback). */
const SECTION_ASSET_MAP: Record<string, ScenePlan['type']> = {
  hook: 'product-image',
  problem: 'lifestyle',
  solution: 'lifestyle',
  demo: 'product-image',
  cta: 'text-overlay',
  // Legacy support
  keyPoints: 'lifestyle',
};

export interface ScenePlannerInput {
  /** TTS timing markers per script section. */
  timings: Array<{
    section: string;
    startSec: number;
    endSec: number;
  }>;
  /** Available visual assets for the video. */
  assets: ProductAssets;
  /** Product data for overlay text. */
  productData: {
    name: string;
    price: string;
    originalPrice?: string;
    discount?: string;
    rating?: string;
    soldCount?: string;
  };
  /** The script text for text overlays. */
  script: UGCScript;
}

/**
 * Pick a product image from available assets using round-robin.
 */
function pickProductImage(assets: ProductAssets, index: number): string | undefined {
  if (assets.productImages.length === 0) return undefined;
  return assets.productImages[index % assets.productImages.length];
}

/**
 * Pick a lifestyle image from available assets using round-robin.
 * Falls back to product images if no lifestyle images are available.
 */
function pickLifestyleImage(assets: ProductAssets, index: number): string | undefined {
  if (assets.lifestyleImages.length > 0) {
    return assets.lifestyleImages[index % assets.lifestyleImages.length];
  }
  // Fallback to product images
  return pickProductImage(assets, index);
}

/**
 * Generate overlay text for a text-overlay scene based on section.
 */
function getOverlayText(
  section: string,
  _script: UGCScript,
  productData: ScenePlannerInput['productData']
): string {
  if (section === 'cta') {
    const parts: string[] = [productData.name];
    if (productData.price) parts.push(productData.price);
    if (productData.discount) parts.push(`(${productData.discount} off)`);
    return parts.join(' - ');
  }
  return '';
}

/**
 * Plan scenes for a UGC video based on script timing and available assets.
 *
 * When video clips are available (from Pexels), maps each section to its
 * corresponding video clip. Falls back to the image-based pipeline when
 * no video clips are provided.
 *
 * Rules for image-based fallback:
 * - hook section: product close-up (product-image)
 * - problem/solution sections: lifestyle shots
 * - demo section: product image
 * - cta section: product + price overlay (text-overlay)
 *
 * The resulting plan covers the entire TTS duration with no gaps.
 * Gaps between section timings (pauses) are filled by extending the
 * previous scene or inserting a bridge scene.
 */
export function planScenes(input: ScenePlannerInput): ScenePlan[] {
  const { timings, assets, productData, script } = input;

  if (timings.length === 0) return [];

  // If video clips are available, use the video-clip pipeline
  if (assets.videoClips && assets.videoClips.length > 0) {
    return planVideoClipScenes(timings, assets, productData, script);
  }

  // Fallback to image-based scene planning
  return planImageScenes(timings, assets, productData, script);
}

/**
 * Plan scenes using video clips from Pexels, mapped by section name.
 */
function planVideoClipScenes(
  timings: ScenePlannerInput['timings'],
  assets: ProductAssets,
  productData: ScenePlannerInput['productData'],
  script: UGCScript
): ScenePlan[] {
  const scenes: ScenePlan[] = [];
  const clipsBySection = new Map<string, string>();

  // Map clips to sections
  for (const clip of assets.videoClips!) {
    clipsBySection.set(clip.section, clip.url);
  }

  for (let i = 0; i < timings.length; i++) {
    const timing = timings[i];
    const prevScene = scenes[scenes.length - 1];

    // Fill gap between previous scene end and this section start
    if (prevScene && timing.startSec > prevScene.endSec) {
      prevScene.endSec = timing.startSec;
    }

    const videoUrl = clipsBySection.get(timing.section);
    if (videoUrl) {
      scenes.push({
        startSec: timing.startSec,
        endSec: timing.endSec,
        type: 'video-clip',
        videoUrl,
      });
    } else {
      // No clip for this section - fall back to image or text overlay
      const type = SECTION_ASSET_MAP[timing.section] || 'product-image';
      const overlayText = type === 'text-overlay'
        ? getOverlayText(timing.section, script, productData)
        : undefined;

      scenes.push({
        startSec: timing.startSec,
        endSec: timing.endSec,
        type,
        ...(overlayText ? { overlayText } : {}),
      });
    }
  }

  return scenes;
}

/**
 * Plan scenes using still images (legacy image-based pipeline).
 */
function planImageScenes(
  timings: ScenePlannerInput['timings'],
  assets: ProductAssets,
  productData: ScenePlannerInput['productData'],
  script: UGCScript
): ScenePlan[] {
  const scenes: ScenePlan[] = [];
  let productImageIdx = 0;
  let lifestyleImageIdx = 0;

  for (let i = 0; i < timings.length; i++) {
    const timing = timings[i];
    const prevScene = scenes[scenes.length - 1];

    // Fill gap between previous scene end and this section start
    if (prevScene && timing.startSec > prevScene.endSec) {
      prevScene.endSec = timing.startSec;
    }

    const type = SECTION_ASSET_MAP[timing.section] || 'product-image';
    let assetUrl: string | undefined;
    let overlayText: string | undefined;

    switch (type) {
      case 'product-image':
        assetUrl = pickProductImage(assets, productImageIdx++);
        break;
      case 'lifestyle':
        assetUrl = pickLifestyleImage(assets, lifestyleImageIdx++);
        break;
      case 'text-overlay':
        overlayText = getOverlayText(timing.section, script, productData);
        // Text overlays also get a background asset
        assetUrl = pickProductImage(assets, productImageIdx++);
        break;
    }

    scenes.push({
      startSec: timing.startSec,
      endSec: timing.endSec,
      type,
      ...(assetUrl ? { assetUrl } : {}),
      ...(overlayText ? { overlayText } : {}),
    });
  }

  return scenes;
}
