import { describe, expect, it } from 'vitest';
import { planScenes, type ScenePlannerInput } from './scene-planner';
import type { ProductAssets, ScenePlan } from './types';

const mockAssets: ProductAssets = {
  productImages: [
    'https://storage.example.com/product-1.jpg',
    'https://storage.example.com/product-2.jpg',
    'https://storage.example.com/product-3.jpg',
  ],
  lifestyleImages: [
    'https://storage.example.com/lifestyle-1.jpg',
    'https://storage.example.com/lifestyle-2.jpg',
  ],
};

const mockScript = {
  hook: 'Stop scrolling! You need this.',
  problem: 'Tired of dry, flaky skin every winter?',
  solution: 'This serum hydrates instantly and fights aging.',
  demo: 'Just two drops morning and night for glowing skin.',
  cta: 'Get yours before the sale ends!',
};

const mockProductData = {
  name: 'Glow Serum',
  price: '$24.99',
  originalPrice: '$49.99',
  discount: '50%',
  rating: '4.8',
  soldCount: '12.4K+',
};

// Simulates TTS timings with pauses between sections (5-section format)
const mockTimings = [
  { section: 'hook', startSec: 0, endSec: 4.0 },
  { section: 'problem', startSec: 4.3, endSec: 8.0 },
  { section: 'solution', startSec: 8.3, endSec: 14.0 },
  { section: 'demo', startSec: 14.3, endSec: 20.0 },
  { section: 'cta', startSec: 20.3, endSec: 24.5 },
];

function buildInput(overrides?: Partial<ScenePlannerInput>): ScenePlannerInput {
  return {
    timings: mockTimings,
    assets: mockAssets,
    productData: mockProductData,
    script: mockScript,
    ...overrides,
  };
}

describe('planScenes', () => {
  it('returns empty array for empty timings', () => {
    const result = planScenes(buildInput({ timings: [] }));
    expect(result).toEqual([]);
  });

  it('produces a scene for every timing section', () => {
    const result = planScenes(buildInput());
    expect(result).toHaveLength(5);
  });

  it('covers the full TTS duration with no gaps', () => {
    const result = planScenes(buildInput());

    // First scene starts at or before the first timing
    expect(result[0].startSec).toBe(0);

    // Check no gaps between consecutive scenes
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startSec).toBeLessThanOrEqual(result[i - 1].endSec);
    }

    // Last scene extends to at least the last timing end
    const lastScene = result[result.length - 1];
    expect(lastScene.endSec).toBeGreaterThanOrEqual(24.5);
  });

  it('fills pauses between sections by extending previous scene', () => {
    const result = planScenes(buildInput());

    // The hook scene (0-4.0) should be extended to cover the pause until problem (4.3)
    expect(result[0].startSec).toBe(0);
    expect(result[0].endSec).toBe(4.3); // Extended to fill the gap

    // problem scene starts at 4.3
    expect(result[1].startSec).toBe(4.3);
    expect(result[1].endSec).toBe(8.3); // Extended to fill gap before solution
  });

  it('assigns correct asset types per script section', () => {
    const result = planScenes(buildInput());

    // hook -> product-image
    expect(result[0].type).toBe('product-image');
    // problem -> lifestyle
    expect(result[1].type).toBe('lifestyle');
    // solution -> lifestyle
    expect(result[2].type).toBe('lifestyle');
    // demo -> product-image
    expect(result[3].type).toBe('product-image');
    // cta -> text-overlay
    expect(result[4].type).toBe('text-overlay');
  });

  it('assigns product image URLs to product-image scenes', () => {
    const result = planScenes(buildInput());

    const productScenes = result.filter((s) => s.type === 'product-image');
    expect(productScenes.length).toBeGreaterThan(0);
    for (const scene of productScenes) {
      expect(scene.assetUrl).toBeDefined();
      expect(scene.assetUrl).toContain('product-');
    }
  });

  it('assigns lifestyle image URLs to lifestyle scenes', () => {
    const result = planScenes(buildInput());

    const lifestyleScenes = result.filter((s) => s.type === 'lifestyle');
    expect(lifestyleScenes.length).toBe(2);
    for (const scene of lifestyleScenes) {
      expect(scene.assetUrl).toBeDefined();
      expect(scene.assetUrl).toContain('lifestyle-');
    }
  });

  it('includes overlay text for text-overlay scenes', () => {
    const result = planScenes(buildInput());

    const textScenes = result.filter((s) => s.type === 'text-overlay');
    expect(textScenes.length).toBe(1);

    // CTA overlay should have product name and price
    const ctaScene = textScenes[0];
    expect(ctaScene.overlayText).toContain('Glow Serum');
    expect(ctaScene.overlayText).toContain('$24.99');
    expect(ctaScene.overlayText).toContain('50%');
  });

  it('falls back to product images when no lifestyle images available', () => {
    const assetsNoLifestyle: ProductAssets = {
      productImages: ['https://storage.example.com/product-1.jpg'],
      lifestyleImages: [],
    };

    const result = planScenes(buildInput({ assets: assetsNoLifestyle }));

    const lifestyleScenes = result.filter((s) => s.type === 'lifestyle');
    for (const scene of lifestyleScenes) {
      expect(scene.assetUrl).toBe('https://storage.example.com/product-1.jpg');
    }
  });

  it('handles single-section timing', () => {
    const singleTiming = [{ section: 'hook', startSec: 0, endSec: 3.0 }];

    const result = planScenes(buildInput({ timings: singleTiming }));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      startSec: 0,
      endSec: 3.0,
      type: 'product-image',
      assetUrl: 'https://storage.example.com/product-1.jpg',
    });
  });

  it('round-robins through available images', () => {
    // With 3 product images and multiple product-image scenes
    const timings = [
      { section: 'hook', startSec: 0, endSec: 2 },
      { section: 'demo', startSec: 2, endSec: 4 },
    ];

    const result = planScenes(buildInput({ timings }));

    // hook uses product-1, demo uses product-2
    expect(result[0].assetUrl).toBe('https://storage.example.com/product-1.jpg');
    expect(result[1].assetUrl).toBe('https://storage.example.com/product-2.jpg');
  });

  it('produces valid timing for all scenes (startSec < endSec)', () => {
    const result = planScenes(buildInput());

    for (const scene of result) {
      expect(scene.startSec).toBeLessThan(scene.endSec);
    }
  });

  it('handles timings with no gaps (continuous sections)', () => {
    const continuousTimings = [
      { section: 'hook', startSec: 0, endSec: 5 },
      { section: 'problem', startSec: 5, endSec: 10 },
      { section: 'solution', startSec: 10, endSec: 15 },
      { section: 'demo', startSec: 15, endSec: 20 },
      { section: 'cta', startSec: 20, endSec: 25 },
    ];

    const result = planScenes(buildInput({ timings: continuousTimings }));
    expect(result).toHaveLength(5);

    // No extension needed since no gaps
    expect(result[0].endSec).toBe(5);
    expect(result[1].startSec).toBe(5);
    expect(result[1].endSec).toBe(10);
  });

  it('handles missing product data gracefully for overlays', () => {
    const minimalProduct = { name: 'Test Product', price: '$10' };

    const result = planScenes(
      buildInput({ productData: minimalProduct })
    );

    const ctaScene = result.find(
      (s) => s.type === 'text-overlay' && s.overlayText?.includes('Test Product')
    );
    expect(ctaScene).toBeDefined();
    expect(ctaScene!.overlayText).toContain('$10');
  });

  it('handles empty assets gracefully', () => {
    const emptyAssets: ProductAssets = {
      productImages: [],
      lifestyleImages: [],
    };

    const result = planScenes(buildInput({ assets: emptyAssets }));

    // Still produces scenes with correct types/timing
    expect(result).toHaveLength(5);
    for (const scene of result) {
      expect(scene.assetUrl).toBeUndefined();
    }
  });

  describe('video clip pipeline', () => {
    it('uses video-clip type when videoClips are available', () => {
      const assetsWithClips: ProductAssets = {
        productImages: [],
        lifestyleImages: [],
        videoClips: [
          { url: 'https://example.com/hook.mp4', durationSec: 5, searchQuery: 'product reveal', section: 'hook' },
          { url: 'https://example.com/problem.mp4', durationSec: 5, searchQuery: 'dry skin', section: 'problem' },
          { url: 'https://example.com/solution.mp4', durationSec: 7, searchQuery: 'serum application', section: 'solution' },
          { url: 'https://example.com/demo.mp4', durationSec: 6, searchQuery: 'skincare routine', section: 'demo' },
          { url: 'https://example.com/cta.mp4', durationSec: 4, searchQuery: 'happy woman', section: 'cta' },
        ],
      };

      const result = planScenes(buildInput({ assets: assetsWithClips }));

      expect(result).toHaveLength(5);
      for (const scene of result) {
        expect(scene.type).toBe('video-clip');
        expect(scene.videoUrl).toBeDefined();
      }
    });

    it('maps video clips to correct sections by name', () => {
      const assetsWithClips: ProductAssets = {
        productImages: [],
        lifestyleImages: [],
        videoClips: [
          { url: 'https://example.com/hook.mp4', durationSec: 5, searchQuery: 'product reveal', section: 'hook' },
          { url: 'https://example.com/demo.mp4', durationSec: 6, searchQuery: 'using product', section: 'demo' },
        ],
      };

      const result = planScenes(buildInput({ assets: assetsWithClips }));

      const hookScene = result[0];
      expect(hookScene.type).toBe('video-clip');
      expect(hookScene.videoUrl).toBe('https://example.com/hook.mp4');

      // demo is the 4th section (index 3)
      const demoScene = result[3];
      expect(demoScene.type).toBe('video-clip');
      expect(demoScene.videoUrl).toBe('https://example.com/demo.mp4');

      // Sections without clips fall back to image types
      const problemScene = result[1];
      expect(problemScene.type).toBe('lifestyle');
    });

    it('fills timing gaps for video clip scenes', () => {
      const assetsWithClips: ProductAssets = {
        productImages: [],
        lifestyleImages: [],
        videoClips: [
          { url: 'https://example.com/hook.mp4', durationSec: 5, searchQuery: 'test', section: 'hook' },
          { url: 'https://example.com/problem.mp4', durationSec: 5, searchQuery: 'test', section: 'problem' },
          { url: 'https://example.com/solution.mp4', durationSec: 7, searchQuery: 'test', section: 'solution' },
          { url: 'https://example.com/demo.mp4', durationSec: 6, searchQuery: 'test', section: 'demo' },
          { url: 'https://example.com/cta.mp4', durationSec: 4, searchQuery: 'test', section: 'cta' },
        ],
      };

      const result = planScenes(buildInput({ assets: assetsWithClips }));

      // Hook is extended to fill the gap before problem
      expect(result[0].endSec).toBe(4.3);
      expect(result[1].startSec).toBe(4.3);
    });
  });
});
