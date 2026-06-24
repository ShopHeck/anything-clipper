// Scene planner: maps UGC script sections + TTS timing to visual assets.
// Produces a complete scene plan covering the full TTS audio duration with
// zero gaps. Each scene has a type, timing, and optional asset/overlay.

import type { ProductAssets, ScenePlan } from './types';

/** Script section to visual asset type mapping. */
const SECTION_ASSET_MAP: Record<string, ScenePlan['type']> = {
  hook: 'product-image',
  problem: 'lifestyle',
  solution: 'lifestyle',
  demo: 'product-image',
  socialProof: 'text-overlay',
  cta: 'text-overlay',
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
  script: {
    hook: string;
    problem: string;
    solution: string;
    demo: string;
    socialProof: string;
    cta: string;
  };
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
  script: ScenePlannerInput['script'],
  productData: ScenePlannerInput['productData']
): string {
  if (section === 'socialProof') {
    const parts: string[] = [];
    if (productData.rating) parts.push(`${productData.rating} stars`);
    if (productData.soldCount) parts.push(`${productData.soldCount} sold`);
    if (parts.length > 0) return parts.join(' | ');
    return script.socialProof.slice(0, 80);
  }
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
 * Rules:
 * - hook section: product close-up (product-image)
 * - problem/solution sections: lifestyle shots
 * - demo section: product images
 * - socialProof section: text overlay with rating/sales
 * - cta section: product + price overlay
 *
 * The resulting plan covers the entire TTS duration with no gaps.
 * Gaps between section timings (pauses) are filled by extending the
 * previous scene or inserting a bridge scene.
 */
export function planScenes(input: ScenePlannerInput): ScenePlan[] {
  const { timings, assets, productData, script } = input;

  if (timings.length === 0) return [];

  const scenes: ScenePlan[] = [];
  let productImageIdx = 0;
  let lifestyleImageIdx = 0;

  for (let i = 0; i < timings.length; i++) {
    const timing = timings[i];
    const prevScene = scenes[scenes.length - 1];

    // Fill gap between previous scene end and this section start
    if (prevScene && timing.startSec > prevScene.endSec) {
      // Extend the previous scene to fill the gap (covers the pause)
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
