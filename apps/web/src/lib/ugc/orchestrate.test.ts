import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrchestrateOptions, ProductData, UGCProjectStatus } from './orchestrate';
import type { UGCScript, UGCScriptWithQueries } from '@/lib/tts/types';

// Mock all external dependencies
const mockSql = vi.hoisted(() => {
  const fn = vi.fn(async () => [{ id: 'proj-1', user_id: 'u1', product_url: 'https://example.com', status: 'scraping' }]);
  return fn as any;
});

const mockPuppeteerPage = vi.hoisted(() => ({
  setUserAgent: vi.fn(async () => {}),
  goto: vi.fn(async () => {}),
  waitForSelector: vi.fn(async () => {}),
  evaluate: vi.fn(async () => ({
    text: 'Test Product - Great item for only $24.99',
    imgSrcs: ['https://cdn.example.com/product1.jpg', 'https://cdn.example.com/product2.jpg'],
  })),
  close: vi.fn(async () => {}),
}));

const mockPuppeteerBrowser = vi.hoisted(() => ({
  newPage: vi.fn(async () => mockPuppeteerPage),
  close: vi.fn(async () => {}),
}));

vi.mock('@/app/api/utils/sql', () => ({
  default: mockSql,
}));

vi.mock('@/app/api/utils/ai', () => ({
  chatCompletionJson: vi.fn(),
}));

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(async () => mockPuppeteerBrowser),
  },
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

vi.mock('@/lib/assets/pexels-video', () => ({
  searchVideos: vi.fn(),
  pickBestFile: vi.fn(),
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
  ensureCtaEnding,
} from './orchestrate';
import { chatCompletionJson } from '@/app/api/utils/ai';
import { scriptToAudio } from '@/lib/tts/script-to-audio';
import { processProductImages } from '@/lib/assets/product-images';
import { generateImage } from '@/lib/assets/image-gen';
import { generatePlaceholderImage } from '@/lib/assets/placeholder-image';
import { searchVideos, pickBestFile } from '@/lib/assets/pexels-video';
import { composeUGCVideo } from './compose';
import puppeteer from 'puppeteer';

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
  hook: 'This serum changed my skin completely',
  problem: 'I was so tired of dry flaky skin every single morning',
  solution: 'This serum hydrates instantly and fights aging with natural ingredients',
  demo: 'Just two drops morning and night and my skin is literally glowing',
  cta: 'Link in bio before it sells out, fifty percent off today only',
};

const mockScriptWithQueries: UGCScriptWithQueries = {
  ...mockScript,
  searchQueries: {
    hook: 'woman excited about skincare product',
    problem: 'woman looking in mirror dry skin',
    solution: 'applying serum to face close up',
    demo: 'skincare routine morning bathroom',
    cta: 'happy woman glowing skin smiling',
  },
};

const mockTTSResult = {
  audioUrl: 'https://storage.example.com/tts/u1/proj-1.mp3?sig=xyz',
  durationSec: 28.5,
  timings: [
    { section: 'hook', startSec: 0, endSec: 4.5 },
    { section: 'problem', startSec: 4.8, endSec: 10.0 },
    { section: 'solution', startSec: 10.3, endSec: 17.5 },
    { section: 'demo', startSec: 17.8, endSec: 24.0 },
    { section: 'cta', startSec: 24.3, endSec: 28.5 },
  ],
};

describe('orchestrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureCtaEnding', () => {
    it('appends the required TikTok Shop line when missing', () => {
      expect(ensureCtaEnding('Grab yours now, 50% off today')).toBe(
        'Grab yours now, 50% off today. Purchase from my TikTok Shop.'
      );
    });

    it('leaves an already-correct CTA unchanged', () => {
      const cta = 'Hurry, this sells out fast. Purchase from my TikTok Shop.';
      expect(ensureCtaEnding(cta)).toBe(cta);
    });

    it('is case-insensitive and adds the trailing period if absent', () => {
      expect(ensureCtaEnding('Get it. purchase from my tiktok shop')).toBe(
        'Get it. purchase from my tiktok shop.'
      );
    });

    it('handles an empty CTA', () => {
      expect(ensureCtaEnding('')).toBe('Purchase from my TikTok Shop.');
    });
  });

  describe('scrapeProduct', () => {
    it('calls the scraping service and returns product data', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => 'Page content with product info' })
        .mockResolvedValueOnce(undefined);

      global.fetch = mockFetch;

      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockProduct);

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

    it('uses Puppeteer scraping when proxy not configured but OPENAI_API_KEY is set', async () => {
      delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
      delete process.env.ANYTHING_PROJECT_TOKEN;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockProduct);

      const result = await scrapeProduct('https://tiktok.com/product/456');
      expect(result).toEqual(mockProduct);
      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({ headless: true })
      );
      expect(mockPuppeteerBrowser.newPage).toHaveBeenCalled();
      expect(mockPuppeteerPage.goto).toHaveBeenCalledWith(
        'https://tiktok.com/product/456',
        expect.objectContaining({ waitUntil: 'networkidle2' })
      );
      expect(mockPuppeteerPage.evaluate).toHaveBeenCalled();
      expect(mockPuppeteerBrowser.close).toHaveBeenCalled();
    });

    it('passes extracted image URLs to chatCompletionJson prompt', async () => {
      delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
      delete process.env.ANYTHING_PROJECT_TOKEN;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockProduct);

      await scrapeProduct('https://tiktok.com/product/789');

      const chatCall = vi.mocked(chatCompletionJson).mock.calls[0];
      const userMessage = chatCall[0][1];
      expect(userMessage.content).toContain('https://cdn.example.com/product1.jpg');
      expect(userMessage.content).toContain('https://cdn.example.com/product2.jpg');
      expect(userMessage.content).toContain('Image URLs found on page');
    });

    it('closes browser even when navigation fails', async () => {
      delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
      delete process.env.ANYTHING_PROJECT_TOKEN;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      mockPuppeteerPage.goto.mockRejectedValueOnce(new Error('Navigation timeout'));

      await expect(scrapeProduct('https://tiktok.com/product/timeout')).rejects.toThrow('Navigation timeout');
      expect(mockPuppeteerBrowser.close).toHaveBeenCalled();
    });

    it('rejects private/reserved hostnames (SSRF protection)', async () => {
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

    it('rejects non-http/https protocols', async () => {
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
    it('returns a UGC script with 5 sections and search queries', async () => {
      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockScriptWithQueries);

      const result = await generateUGCScript(mockProduct, 'pov');
      expect(result).toEqual(mockScriptWithQueries);
      expect(result.hook).toBeDefined();
      expect(result.problem).toBeDefined();
      expect(result.solution).toBeDefined();
      expect(result.demo).toBeDefined();
      expect(result.cta).toBeDefined();
      expect(result.searchQueries).toBeDefined();
      expect(chatCompletionJson).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({ name: 'ugc_script' })
      );
    });

    it('uses different style prompts based on templateStyle', async () => {
      vi.mocked(chatCompletionJson).mockResolvedValueOnce(mockScriptWithQueries);

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
        speed: 1.2,
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
    it('fetches Pexels video clips when API key is set', async () => {
      process.env.PEXELS_API_KEY = 'test-pexels-key';

      vi.mocked(searchVideos).mockResolvedValue([
        { id: 1, url: 'https://pexels.com/v/1', duration: 8, image: 'thumb.jpg', video_files: [{ id: 1, quality: 'hd', file_type: 'video/mp4', width: 1080, height: 1920, link: 'https://videos.pexels.com/1.mp4' }] },
      ]);
      vi.mocked(pickBestFile).mockReturnValue({ id: 1, quality: 'hd', file_type: 'video/mp4', width: 1080, height: 1920, link: 'https://videos.pexels.com/1.mp4' });

      const result = await gatherAssets(mockProduct, 'u1', mockScriptWithQueries);

      expect(result.videoClips).toBeDefined();
      expect(result.videoClips!.length).toBeGreaterThan(0);
      expect(searchVideos).toHaveBeenCalled();

      delete process.env.PEXELS_API_KEY;
    });

    it('falls back to images when PEXELS_API_KEY is not set', async () => {
      delete process.env.PEXELS_API_KEY;

      vi.mocked(processProductImages).mockResolvedValueOnce([
        { storageUrl: 'https://storage.example.com/img1.jpg', originalUrl: 'https://cdn.example.com/img1.jpg' },
      ]);
      vi.mocked(generateImage).mockResolvedValueOnce('https://storage.example.com/lifestyle1.jpg');

      const result = await gatherAssets(mockProduct, 'u1', mockScriptWithQueries);

      expect(result.productImages).toHaveLength(1);
      expect(result.lifestyleImages).toHaveLength(1);
      expect(searchVideos).not.toHaveBeenCalled();
    });

    it('handles case with no image URLs by generating a placeholder', async () => {
      delete process.env.PEXELS_API_KEY;

      vi.mocked(processProductImages).mockResolvedValueOnce([]);
      vi.mocked(generateImage).mockResolvedValueOnce(null);
      vi.mocked(generatePlaceholderImage).mockResolvedValueOnce(
        'https://storage.example.com/placeholder-images/u1/12345.png?sig=xyz'
      );

      const productNoImages = { ...mockProduct, imageUrls: [] };
      const result = await gatherAssets(productNoImages, 'u1');

      expect(result.productImages).toHaveLength(1);
      expect(result.productImages[0]).toContain('placeholder-images');
      expect(result.lifestyleImages).toHaveLength(0);
      expect(generatePlaceholderImage).toHaveBeenCalledWith({
        productName: mockProduct.name,
        userId: 'u1',
      });
    });

    it('continues gracefully when placeholder image upload fails', async () => {
      delete process.env.PEXELS_API_KEY;

      vi.mocked(processProductImages).mockResolvedValueOnce([]);
      vi.mocked(generateImage).mockResolvedValueOnce(null);
      vi.mocked(generatePlaceholderImage).mockRejectedValueOnce(
        new Error('Failed to upload placeholder image (503)')
      );

      const productNoImages = { ...mockProduct, imageUrls: [] };
      const result = await gatherAssets(productNoImages, 'u1');

      expect(result.productImages).toHaveLength(0);
      expect(result.lifestyleImages).toHaveLength(0);
      expect(generatePlaceholderImage).toHaveBeenCalled();
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
      expect(plan[0].startSec).toBeLessThanOrEqual(mockTTSResult.timings[0].startSec);
      expect(plan[plan.length - 1].endSec).toBeGreaterThanOrEqual(
        mockTTSResult.timings[mockTTSResult.timings.length - 1].endSec
      );
    });
  });

  describe('buildRenderSpec', () => {
    it('converts scene plan to a UGCRenderSpec with captions', () => {
      const scenePlan = [
        { startSec: 0, endSec: 4.5, type: 'product-image' as const, assetUrl: 'https://img1.jpg' },
        { startSec: 4.8, endSec: 10.0, type: 'lifestyle' as const, assetUrl: 'https://img2.jpg' },
        { startSec: 10.3, endSec: 17.5, type: 'lifestyle' as const, assetUrl: 'https://img3.jpg' },
        { startSec: 17.8, endSec: 24.0, type: 'product-image' as const, assetUrl: 'https://img4.jpg' },
        { startSec: 24.3, endSec: 28.5, type: 'text-overlay' as const, assetUrl: 'https://img5.jpg', overlayText: 'Test Serum - $24.99' },
      ];

      const spec = buildRenderSpec(
        mockScript,
        mockTTSResult.timings,
        scenePlan,
        mockTTSResult.audioUrl,
        'karaoke-pop'
      );

      expect(spec.ttsAudioUrl).toBe(mockTTSResult.audioUrl);
      expect(spec.scenes).toHaveLength(5);
      expect(spec.aspect).toBe('9:16');
      expect(spec.captionTemplateId).toBe('karaoke-pop');
      expect(spec.captions.length).toBeGreaterThan(0);
      spec.scenes.forEach((s) => {
        expect(s.imageUrl).toBeTruthy();
        expect(s.startSec).toBeLessThan(s.endSec);
      });
    });

    it('handles video-clip scenes in render spec', () => {
      const scenePlan = [
        { startSec: 0, endSec: 5, type: 'video-clip' as const, videoUrl: 'https://example.com/clip.mp4' },
      ];

      const spec = buildRenderSpec(
        mockScript,
        mockTTSResult.timings,
        scenePlan,
        mockTTSResult.audioUrl
      );

      expect(spec.scenes[0].isVideoClip).toBe(true);
      expect(spec.scenes[0].videoUrl).toBe('https://example.com/clip.mp4');
      expect(spec.scenes[0].imageUrl).toBe('');
    });

    it('uses default caption template when none specified', () => {
      const scenePlan = [
        { startSec: 0, endSec: 4.5, type: 'product-image' as const, assetUrl: 'https://img1.jpg' },
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
      delete process.env.PEXELS_API_KEY;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Product page content',
        json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(0),
      });
    });

    it('executes all steps in the correct order on success', async () => {
      mockSql.mockImplementation(async (..._args: unknown[]) => {
        return [{ id: 'proj-1', user_id: 'u1' }];
      });

      vi.mocked(chatCompletionJson)
        .mockResolvedValueOnce(mockProduct) // scrapeProduct
        .mockResolvedValueOnce(mockScriptWithQueries); // generateUGCScript

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

      expect(chatCompletionJson).toHaveBeenCalledTimes(2);
      expect(scriptToAudio).toHaveBeenCalledTimes(1);
      expect(composeUGCVideo).toHaveBeenCalledTimes(1);
    });

    it('marks project as failed when scraping fails', async () => {
      mockSql.mockImplementation(async () => [{ id: 'proj-1' }]);

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
        .mockResolvedValueOnce(mockProduct)
        .mockRejectedValueOnce(new Error('AI service unavailable'));

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
        .mockResolvedValueOnce(mockScriptWithQueries);

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
        .mockResolvedValueOnce(mockScriptWithQueries);

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
  });
});
