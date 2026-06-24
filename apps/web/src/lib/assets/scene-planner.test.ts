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
  hook: 'Stop scrolling! You need to see this.',
  problem: 'Tired of bad skin?',
  solution: 'This serum changed everything.',
  demo: 'Watch how easy it is to apply.',
  socialProof: '5000 five-star reviews.',
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

// Simulates TTS timings with pauses between sections
const mockTimings = [
  { section: 'hook', startSec: 0, endSec: 2.5 },
  { section: 'problem', startSec: 3.1, endSec: 4.5 },
  { section: 'solution', startSec: 5.1, endSec: 7.0 },
  { section: 'demo', startSec: 7.6, endSec: 9.5 },
  { section: 'socialProof', startSec: 10.1, endSec: 12.0 },
  { section: 'cta', startSec: 12.6, endSec: 14.5 },
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
    expect(result).toHaveLength(6);
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
    expect(lastScene.endSec).toBeGreaterThanOrEqual(14.5);
  });

  it('fills pauses between sections by extending previous scene', () => {
    const result = planScenes(buildInput());

    // The hook scene (0-2.5) should be extended to cover the pause until problem (3.1)
    expect(result[0].startSec).toBe(0);
    expect(result[0].endSec).toBe(3.1); // Extended to fill the gap

    // Problem scene starts at 3.1
    expect(result[1].startSec).toBe(3.1);
    expect(result[1].endSec).toBe(5.1); // Extended to fill gap before solution
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
    // socialProof -> text-overlay
    expect(result[4].type).toBe('text-overlay');
    // cta -> text-overlay
    expect(result[5].type).toBe('text-overlay');
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
    expect(textScenes.length).toBe(2);

    // socialProof overlay should have rating/sold info
    const socialScene = textScenes[0];
    expect(socialScene.overlayText).toContain('4.8');
    expect(socialScene.overlayText).toContain('12.4K+');

    // CTA overlay should have product name and price
    const ctaScene = textScenes[1];
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
      { section: 'cta', startSec: 4, endSec: 6 },
    ];
    const minScript = {
      hook: 'a',
      problem: '',
      solution: '',
      demo: 'b',
      socialProof: '',
      cta: 'c',
    };

    const result = planScenes(
      buildInput({ timings, script: minScript })
    );

    // hook uses product-1, demo uses product-2, cta uses product-3
    expect(result[0].assetUrl).toBe('https://storage.example.com/product-1.jpg');
    expect(result[1].assetUrl).toBe('https://storage.example.com/product-2.jpg');
    expect(result[2].assetUrl).toBe('https://storage.example.com/product-3.jpg');
  });

  it('produces valid timing for all scenes (startSec < endSec)', () => {
    const result = planScenes(buildInput());

    for (const scene of result) {
      expect(scene.startSec).toBeLessThan(scene.endSec);
    }
  });

  it('handles timings with no gaps (continuous sections)', () => {
    const continuousTimings = [
      { section: 'hook', startSec: 0, endSec: 2 },
      { section: 'problem', startSec: 2, endSec: 4 },
      { section: 'solution', startSec: 4, endSec: 6 },
      { section: 'demo', startSec: 6, endSec: 8 },
      { section: 'socialProof', startSec: 8, endSec: 10 },
      { section: 'cta', startSec: 10, endSec: 12 },
    ];

    const result = planScenes(buildInput({ timings: continuousTimings }));
    expect(result).toHaveLength(6);

    // No extension needed since no gaps
    expect(result[0].endSec).toBe(2);
    expect(result[1].startSec).toBe(2);
    expect(result[1].endSec).toBe(4);
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
    expect(result).toHaveLength(6);
    for (const scene of result) {
      expect(scene.assetUrl).toBeUndefined();
    }
  });
});
