// Types for the asset management pipeline (image extraction, generation, scene planning).

/** Collection of visual assets available for video composition. */
export interface ProductAssets {
  /** Product image URLs stored in object storage. */
  productImages: string[];
  /** AI-generated lifestyle images or extracted lifestyle shots. */
  lifestyleImages: string[];
  /** Optional background music URL. */
  backgroundMusic?: string;
}

/** Request to generate/gather assets for a UGC video. */
export interface AssetGenerationRequest {
  /** Structured product data from /api/product-details. */
  productData: {
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
  };
  /** The UGC script to plan scenes for. */
  script: {
    hook: string;
    keyPoints: string;
    cta: string;
  };
  /** TTS timing markers from scriptToAudio. */
  ttsTiming: {
    audioUrl: string;
    durationSec: number;
    timings: Array<{
      section: string;
      startSec: number;
      endSec: number;
    }>;
  };
}

/** Result of the full asset generation pipeline. */
export interface AssetGenerationResult {
  assets: ProductAssets;
  scenePlan: ScenePlan[];
}

/** A single scene in the video composition timeline. */
export interface ScenePlan {
  startSec: number;
  endSec: number;
  type: 'product-image' | 'lifestyle' | 'text-overlay';
  assetUrl?: string;
  overlayText?: string;
}
