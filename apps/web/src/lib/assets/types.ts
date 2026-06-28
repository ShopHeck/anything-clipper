// Types for the asset management pipeline (image extraction, generation, scene planning).

/** A video clip asset fetched from Pexels or another stock video source. */
export interface VideoClipAsset {
  /** URL of the video clip (remote). */
  url: string;
  /** Local file path after download (populated during composition). */
  localPath?: string;
  /** Duration of the clip in seconds. */
  durationSec: number;
  /** The search query that found this clip. */
  searchQuery: string;
  /** The script section this clip is associated with. */
  section: string;
}

/** Collection of visual assets available for video composition. */
export interface ProductAssets {
  /** Product image URLs stored in object storage. */
  productImages: string[];
  /** AI-generated lifestyle images or extracted lifestyle shots. */
  lifestyleImages: string[];
  /** Optional background music URL. */
  backgroundMusic?: string;
  /** Video clips fetched from stock video sources (e.g., Pexels). */
  videoClips?: VideoClipAsset[];
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
    problem: string;
    solution: string;
    demo: string;
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
  type: 'product-image' | 'lifestyle' | 'text-overlay' | 'video-clip';
  assetUrl?: string;
  /** URL of the video clip (for type='video-clip'). */
  videoUrl?: string;
  overlayText?: string;
}
