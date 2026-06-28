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

/**
 * Section -> role mapping for the avatar pipeline. The smiling talking
 * "creator" carries the hook, the relatable problem, and the CTA; the real
 * product is showcased via AI b-roll during the solution and demo.
 */
const AVATAR_SECTION_ROLE: Record<string, 'avatar' | 'broll'> = {
  hook: 'avatar',
  problem: 'avatar',
  solution: 'broll',
  demo: 'broll',
  cta: 'avatar',
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

  // Avatar pipeline: a talking-avatar clip is available -> intercut the
  // smiling creator (hook/problem/cta) with product b-roll (solution/demo).
  if (assets.avatarVideo) {
    return planAvatarScenes(timings, assets);
  }

  // If video clips are available, use the video-clip pipeline
  if (assets.videoClips && assets.videoClips.length > 0) {
    return planVideoClipScenes(timings, assets, productData, script);
  }

  // Fallback to image-based scene planning
  return planImageScenes(timings, assets, productData, script);
}

/**
 * Plan scenes for the avatar pipeline.
 *
 * The avatar clip is rendered full-length and lip-synced to the entire
 * voiceover, so an avatar scene simply plays the matching time window of that
 * clip (source time === timeline time, captured via clipStartSec). Product
 * b-roll clips are mapped to their section and start at 0 (they loop to fill).
 * Sections that lack a b-roll clip gracefully fall back to the avatar so the
 * timeline always has the creator on screen rather than a gap.
 */
function planAvatarScenes(
  timings: ScenePlannerInput['timings'],
  assets: ProductAssets
): ScenePlan[] {
  const scenes: ScenePlan[] = [];
  const avatarUrl = assets.avatarVideo!.url;
  const avatarDuration = assets.avatarVideo!.durationSec;

  const brollBySection = new Map<string, string>();
  for (const clip of assets.brollClips ?? []) {
    if (!brollBySection.has(clip.section)) brollBySection.set(clip.section, clip.url);
  }

  for (let i = 0; i < timings.length; i++) {
    const timing = timings[i];
    const prevScene = scenes[scenes.length - 1];

    // Fill gap between previous scene end and this section start.
    if (prevScene && timing.startSec > prevScene.endSec) {
      prevScene.endSec = timing.startSec;
    }

    const role = AVATAR_SECTION_ROLE[timing.section] ?? 'avatar';
    const brollUrl = role === 'broll' ? brollBySection.get(timing.section) : undefined;

    if (role === 'broll' && brollUrl) {
      scenes.push({
        startSec: timing.startSec,
        endSec: timing.endSec,
        type: 'broll',
        videoUrl: brollUrl,
        clipStartSec: 0,
      });
    } else {
      // Avatar window. Clamp the source offset so we never seek past the end
      // of the rendered avatar clip when its duration is known.
      const sceneDur = timing.endSec - timing.startSec;
      let clipStartSec = timing.startSec;
      if (typeof avatarDuration === 'number' && clipStartSec + sceneDur > avatarDuration) {
        clipStartSec = Math.max(0, avatarDuration - sceneDur);
      }
      scenes.push({
        startSec: timing.startSec,
        endSec: timing.endSec,
        type: 'avatar',
        videoUrl: avatarUrl,
        clipStartSec,
      });
    }
  }

  return scenes;
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
