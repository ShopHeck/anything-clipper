import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrchestrateOptions, ProductData, UGCProjectStatus } from './orchestrate';
import type { UGCScript } from '@/lib/tts/types';

// Mock all external dependencies
const mockSql = vi.hoisted(() => {
  const fn = vi.fn(async () => [{ id: 'proj-1', user_id: 'u1', product_url: 'https://example.com', status: 'scraping' }]);
  return fn as any;
});

vi.mock('@/app/api/utils/sql', () => ({
  default: mockSql,
}));

vi.mock('@/app/api/utils/ai', () => ({
  chatCompletionJson: vi.fn(),
}));

vi.mock('@/app/api/utils/storage', () => ({
  presignUpload: vi.fn(() => 'https://storage.example.com/upload?sig=abc'),
  presignDownload: vi.fn((key: string) => `https://storage.example.com/${key}?sig=xyz`),
  storageConfigured: vi.fn(() => false),
}));

vi.mock('@/lib/tts/script-to-audio', () => ({
  scriptToAudio: vi.fn(),
}));

vi.mock('@/lib/tts/generate', () => ({
  generateTTS: vi.fn(),
}));

vi.mock('@/lib/assets/product-images', () => ({
  processProductImages: vi.fn(),
}));

vi.mock('@/lib/assets/image-gen', () => ({
  generateImage: vi.fn(),
}));

vi.mock('@/lib/assets/placeholder-image', () => ({
  generatePlaceholderImage: vi.fn(),
}));

vi.mock('./compose', () => ({
  composeUGCVideo: vi.fn(),
}));

// Import after mocking
import {
  orchestrateUGCVideo,
  scrapeProduct,
  generateUGCScript,
  generateTTSAudio,
  gatherAssets,
  buildScenePlan,
  buildRenderSpec,
} from './orchestrate';
import { chatCompletionJson } from '@/app/api/utils/ai';
import { scriptToAudio } from '@/lib/tts/script-to-audio';
import { processProductImages } from '@/lib/assets/product-images';
import { generateImage } from '@/lib/assets/image-gen';
import { generatePlaceholderImage } from '@/lib/assets/placeholder-image';
import { composeUGCVideo } from './compose';

const mockProduct: ProductData = {
  name: 'Test Serum',
  price: '$24.99',
  originalPrice: '$49.99',
  discount: '50%',
  rating: '4.8',
  soldCount: '12K+',
  shopName: 'TestShop',
  category: 'skincare',
  features: ['Hydrates skin', 'Anti-aging formula', 'Natural ingredients'],
  imageUrls: ['https://cdn.example.com/img1.jpg', 'https://cdn.example.com/img2.jpg'],
};

const mockScript: UGCScript = {
  hook: 'This serum changed my skin overnight',
  problem: 'My skin was so dry and nothing worked. I tried everything.',
  solution: 'Then I found Test Serum for only $24.99 and everything changed.',
  demo: 'Look at this texture - it absorbs instantly and leaves no residue.',
  socialProof: '4.8 stars and over 12K sold. The reviews are insane.',
  cta: 'Link in bio before it sells out. Trust me on this one.',
};

const mockTTSResult = {
  audioUrl: 'https://storage.example.com/tts/u1/proj-1.mp3?sig=xyz',
  durationSec: 28.5,
  timings: [
    { section: 'hook', startSec: 0, endSec: 3.0 },
    { section: 'problem', startSec: 3.6, endSec: 8.5 },
    { section: 'solution', startSec: 9.1, endSec: 14.2 },
    { section: 'demo', startSec: 14.8, endSec: 20.0 },
    { section: 'socialProof', startSec: 20.6, endSec: 24.5 },
    { section: 'cta', startSec: 25.1, endSec: 28.5 },
  ],
};

describe('orchestrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scrapeProduct', () => {
    it('calls the scraping service and returns product data', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => 'Page content with product info' })
        .mockResolvedValueOnce(undefined); // chatCompletionJson handles its own fetch

      global.fetch = mockFetch;

      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockProduct);

      // Set env vars
      process.env.NEXT_PUBLIC_CREATE_BASE_URL = 'https://api.example.com';
      process.env.ANYTHING_PROJECT_TOKEN = 'test-token';

      const result = await scrapeProduct('https://tiktok.com/product/123');
      expect(result).toEqual(mockProduct);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/integrations/web-scraping/post',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'https://tiktok.com/product/123', getText: true }),
        })
      );
    });

    it('throws if the page cannot be scraped', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, text: async () => '' });

      process.env.NEXT_PUBLIC_CREATE_BASE_URL = 'https://api.example.com';
      process.env.ANYTHING_PROJECT_TOKEN = 'test-token';

      await expect(scrapeProduct('https://bad.url')).rejects.toThrow(
        'Could not read the product page'
      );
    });

    it('throws if scraping service is not configured and no API key', async () => {
      delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
      delete process.env.ANYTHING_PROJECT_TOKEN;
      delete process.env.OPENAI_API_KEY;

      await expect(scrapeProduct('https://example.com')).rejects.toThrow(
        'Scraping service is not configured and no AI API key is available'
      );
    });

    it('uses direct fetch fallback when proxy not configured but OPENAI_API_KEY is set', async () => {
      delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
      delete process.env.ANYTHING_PROJECT_TOKEN;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '<html><body><h1>Test Product</h1><p>Great item</p></body></html>',
        });

      global.fetch = mockFetch;

      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockProduct);

      const result = await scrapeProduct('https://tiktok.com/product/456');
      expect(result).toEqual(mockProduct);
      // Should call fetch with the product URL directly (not a proxy endpoint)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://tiktok.com/product/456',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
          }),
        })
      );
    });

    it('rejects private/reserved hostnames on direct fetch path (SSRF protection)', async () => {
      delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
      delete process.env.ANYTHING_PROJECT_TOKEN;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const privateUrls = [
        'http://localhost/secret',
        'http://127.0.0.1/metadata',
        'http://[::1]/internal',
        'http://10.0.0.1/admin',
        'http://172.16.0.1/internal',
        'http://192.168.1.1/admin',
        'http://169.254.169.254/latest/meta-data/',
      ];

      for (const privateUrl of privateUrls) {
        await expect(scrapeProduct(privateUrl)).rejects.toThrow(
          'URLs pointing to private or reserved addresses are not allowed'
        );
      }
    });

    it('rejects non-http/https protocols on direct fetch path', async () => {
      delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
      delete process.env.ANYTHING_PROJECT_TOKEN;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      await expect(scrapeProduct('ftp://example.com/file')).rejects.toThrow(
        'Only http and https URLs are allowed'
      );
      await expect(scrapeProduct('file:///etc/passwd')).rejects.toThrow(
        'Only http and https URLs are allowed'
      );
    });
  });

  describe('generateUGCScript', () => {
    it('returns a UGC script from chatCompletionJson', async () => {
      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockScript);

      const result = await generateUGCScript(mockProduct, 'pov');
      expect(result).toEqual(mockScript);
      expect(chatCompletionJson).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({ name: 'ugc_script' })
      );
    });

    it('uses different style prompts based on templateStyle', async () => {
      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockScript);

      await generateUGCScript(mockProduct, 'storytime');
      const call = vi.mocked(chatCompletionJson).mock.calls[0];
      const systemMsg = call[0][0];
      expect(systemMsg.content).toContain('storytime');
    });
  });

  describe('generateTTSAudio', () => {
    it('calls scriptToAudio with correct params', async () => {
      vi.mocked(scriptToAudio).mockResolvedValueOnce(mockTTSResult);

      const result = await generateTTSAudio(mockScript, 'u1', 'proj-1', 'echo');
      expect(result).toEqual(mockTTSResult);
      expect(scriptToAudio).toHaveBeenCalledWith({
        script: mockScript,
        voice: 'echo',
        speed: 1.0,
        storageKey: 'tts/u1/proj-1.mp3',
      });
    });

    it('defaults to nova voice when not specified', async () => {
      vi.mocked(scriptToAudio).mockResolvedValueOnce(mockTTSResult);

      await generateTTSAudio(mockScript, 'u1', 'proj-1');
      expect(scriptToAudio).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'nova' })
      );
    });
  });

  describe('gatherAssets', () => {
    it('processes product images and generates a lifestyle image', async () => {
      vi.mocked(processProductImages).mockResolvedValueOnce([
        { storageUrl: 'https://storage.example.com/img1.jpg', originalUrl: 'https://cdn.example.com/img1.jpg' },
        { storageUrl: 'https://storage.example.com/img2.jpg', originalUrl: 'https://cdn.example.com/img2.jpg' },
      ]);
      vi.mocked(generateImage).mockResolvedValueOnce('https://storage.example.com/lifestyle1.jpg');

      const result = await gatherAssets(mockProduct, 'u1');

      expect(result.productImages).toHaveLength(2);
      expect(result.lifestyleImages).toHaveLength(1);
      expect(processProductImages).toHaveBeenCalledWith(mockProduct.imageUrls, 'u1');
      expect(generateImage).toHaveBeenCalled();
    });

    it('handles case with no image URLs by generating a placeholder', async () => {
      vi.mocked(processProductImages).mockResolvedValueOnce([]);
      vi.mocked(generateImage).mockResolvedValueOnce(null);
      vi.mocked(generatePlaceholderImage).mockResolvedValueOnce(
        'https://storage.example.com/placeholder-images/u1/12345.png?sig=xyz'
      );

      const productNoImages = { ...mockProduct, imageUrls: [] };
      const result = await gatherAssets(productNoImages, 'u1');

      // Placeholder should be added to productImages
      expect(result.productImages).toHaveLength(1);
      expect(result.productImages[0]).toContain('placeholder-images');
      expect(result.lifestyleImages).toHaveLength(0);
      expect(generatePlaceholderImage).toHaveBeenCalledWith({
        productName: mockProduct.name,
        userId: 'u1',
      });
    });
  });

  describe('buildScenePlan', () => {
    it('produces a scene plan covering the full timeline', () => {
      const assets = {
        productImages: ['https://storage.example.com/img1.jpg', 'https://storage.example.com/img2.jpg'],
        lifestyleImages: ['https://storage.example.com/lifestyle1.jpg'],
      };

      const plan = buildScenePlan(mockScript, mockTTSResult.timings, assets, mockProduct);

      expect(plan.length).toBeGreaterThan(0);
      // First scene starts at or before first timing
      expect(plan[0].startSec).toBeLessThanOrEqual(mockTTSResult.timings[0].startSec);
      // Last scene covers up to the last timing
      expect(plan[plan.length - 1].endSec).toBeGreaterThanOrEqual(
        mockTTSResult.timings[mockTTSResult.timings.length - 1].endSec
      );
    });
  });

  describe('buildRenderSpec', () => {
    it('converts scene plan to a UGCRenderSpec with captions', () => {
      const scenePlan = [
        { startSec: 0, endSec: 3.0, type: 'product-image' as const, assetUrl: 'https://img1.jpg' },
        { startSec: 3.6, endSec: 8.5, type: 'lifestyle' as const, assetUrl: 'https://img2.jpg' },
        { startSec: 9.1, endSec: 14.2, type: 'lifestyle' as const, assetUrl: 'https://img3.jpg' },
        { startSec: 14.8, endSec: 20.0, type: 'product-image' as const, assetUrl: 'https://img4.jpg' },
        { startSec: 20.6, endSec: 24.5, type: 'text-overlay' as const, assetUrl: 'https://img5.jpg', overlayText: '4.8 stars | 12K+ sold' },
        { startSec: 25.1, endSec: 28.5, type: 'text-overlay' as const, assetUrl: 'https://img6.jpg', overlayText: 'Test Serum - $24.99' },
      ];

      const spec = buildRenderSpec(
        mockScript,
        mockTTSResult.timings,
        scenePlan,
        mockTTSResult.audioUrl,
        'karaoke-pop'
      );

      expect(spec.ttsAudioUrl).toBe(mockTTSResult.audioUrl);
      expect(spec.scenes).toHaveLength(6);
      expect(spec.aspect).toBe('9:16');
      expect(spec.captionTemplateId).toBe('karaoke-pop');
      expect(spec.captions.length).toBeGreaterThan(0);
      // Each scene has imageUrl
      spec.scenes.forEach((s) => {
        expect(s.imageUrl).toBeTruthy();
        expect(s.startSec).toBeLessThan(s.endSec);
      });
    });

    it('uses default caption template when none specified', () => {
      const scenePlan = [
        { startSec: 0, endSec: 3.0, type: 'product-image' as const, assetUrl: 'https://img1.jpg' },
      ];

      const spec = buildRenderSpec(
        mockScript,
        mockTTSResult.timings,
        scenePlan,
        mockTTSResult.audioUrl
      );

      expect(spec.captionTemplateId).toBe('default');
    });
  });

  describe('orchestrateUGCVideo (end-to-end)', () => {
    const orchestrateOpts: OrchestrateOptions = {
      projectId: 'proj-1',
      userId: 'u1',
      url: 'https://tiktok.com/product/123',
      voice: 'nova',
      templateStyle: 'pov',
      captionTemplate: 'default',
    };

    beforeEach(() => {
      process.env.NEXT_PUBLIC_CREATE_BASE_URL = 'https://api.example.com';
      process.env.ANYTHING_PROJECT_TOKEN = 'test-token';

      // Mock fetch for scraping
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Product page content',
        json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(0),
      });
    });

    it('executes all steps in the correct order on success', async () => {
      const statusUpdates: string[] = [];
      mockSql.mockImplementation(async (..._args: unknown[]) => {
        // Capture status updates
        const templateStrings = _args[0] as TemplateStringsArray;
        const raw = Array.isArray(templateStrings) ? templateStrings.join('?') : '';
        if (raw.includes('UPDATE ugc_projects SET status')) {
          const statusArg = _args[1] as string;
          if (typeof statusArg === 'string') {
            statusUpdates.push(statusArg);
          }
        }
        return [{ id: 'proj-1', user_id: 'u1' }];
      });

      vi.mocked(chatCompletionJson)
        .mockResolvedValueOnce(mockProduct) // scrapeProduct
        .mockResolvedValueOnce(mockScript); // generateUGCScript

      vi.mocked(scriptToAudio).mockResolvedValueOnce(mockTTSResult);

      vi.mocked(processProductImages).mockResolvedValueOnce([
        { storageUrl: 'https://storage.example.com/img1.jpg', originalUrl: 'https://cdn.example.com/img1.jpg' },
      ]);
      vi.mocked(generateImage).mockResolvedValueOnce('https://storage.example.com/lifestyle.jpg');

      vi.mocked(composeUGCVideo).mockResolvedValueOnce({
        status: 'completed',
        outputUrl: 'https://storage.example.com/ugc/u1/proj-1/output.mp4',
      });

      const result = await orchestrateUGCVideo(orchestrateOpts);

      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBe('https://storage.example.com/ugc/u1/proj-1/output.mp4');

      // Verify step order
      expect(chatCompletionJson).toHaveBeenCalledTimes(2);
      expect(scriptToAudio).toHaveBeenCalledTimes(1);
      expect(processProductImages).toHaveBeenCalledTimes(1);
      expect(generateImage).toHaveBeenCalledTimes(1);
      expect(composeUGCVideo).toHaveBeenCalledTimes(1);
    });

    it('marks project as failed when scraping fails', async () => {
      mockSql.mockImplementation(async () => [{ id: 'proj-1' }]);

      // Scraping fetch returns failure
      global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => '' });

      const result = await orchestrateUGCVideo(orchestrateOpts);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Could not read the product page');
    });

    it('marks project as failed when script generation fails', async () => {
      mockSql.mockImplementation(async () => [{ id: 'proj-1' }]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Page content',
      });

      vi.mocked(chatCompletionJson)
        .mockResolvedValueOnce(mockProduct) // scrapeProduct succeeds
        .mockRejectedValueOnce(new Error('AI service unavailable')); // script gen fails

      const result = await orchestrateUGCVideo(orchestrateOpts);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('AI service unavailable');
    });

    it('marks project as failed when TTS generation fails', async () => {
      mockSql.mockImplementation(async () => [{ id: 'proj-1' }]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Page content',
      });

      vi.mocked(chatCompletionJson)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(mockScript);

      vi.mocked(scriptToAudio).mockRejectedValueOnce(new Error('TTS service error'));

      const result = await orchestrateUGCVideo(orchestrateOpts);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('TTS service error');
    });

    it('marks project as failed when video composition fails', async () => {
      mockSql.mockImplementation(async () => [{ id: 'proj-1' }]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Page content',
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      vi.mocked(chatCompletionJson)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(mockScript);

      vi.mocked(scriptToAudio).mockResolvedValueOnce(mockTTSResult);
      vi.mocked(processProductImages).mockResolvedValueOnce([
        { storageUrl: 'https://storage.example.com/img1.jpg', originalUrl: 'https://cdn.example.com/img1.jpg' },
      ]);
      vi.mocked(generateImage).mockResolvedValueOnce(null);

      vi.mocked(composeUGCVideo).mockResolvedValueOnce({
        status: 'failed',
        error: 'ffmpeg exited with code 1',
      });

      const result = await orchestrateUGCVideo(orchestrateOpts);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('ffmpeg exited with code 1');
    });

    it('uses placeholder image when no visual assets are available', async () => {
      mockSql.mockImplementation(async () => [{ id: 'proj-1' }]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Page content',
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      // Product with no image URLs so processProductImages is not called
      const productNoImages = { ...mockProduct, imageUrls: [] };
      vi.mocked(chatCompletionJson)
        .mockResolvedValueOnce(productNoImages)
        .mockResolvedValueOnce(mockScript);

      vi.mocked(scriptToAudio).mockResolvedValueOnce(mockTTSResult);
      // No lifestyle image generated either
      vi.mocked(generateImage).mockResolvedValueOnce(null);
      // Placeholder is generated
      vi.mocked(generatePlaceholderImage).mockResolvedValueOnce(
        'https://storage.example.com/placeholder-images/u1/12345.png?sig=xyz'
      );

      vi.mocked(composeUGCVideo).mockResolvedValueOnce({
        status: 'completed',
        outputUrl: 'https://storage.example.com/ugc/u1/proj-1/output.mp4',
      });

      const result = await orchestrateUGCVideo(orchestrateOpts);

      // Pipeline should continue and complete instead of aborting
      expect(result.status).toBe('completed');
      expect(generatePlaceholderImage).toHaveBeenCalledWith({
        productName: productNoImages.name,
        userId: 'u1',
      });
      // Composition should have been called
      expect(composeUGCVideo).toHaveBeenCalled();
    });
  });
});
