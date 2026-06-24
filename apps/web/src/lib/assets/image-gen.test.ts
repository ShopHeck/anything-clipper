import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImage } from './image-gen';

describe('generateImage', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  const baseReq = {
    productDescription: 'Test Serum - hydrating formula',
    sceneContext: 'Person using product in bathroom',
    size: '1024x1792' as const,
  };

  it('returns null when no provider is configured', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    delete process.env.OPENAI_API_KEY;

    const result = await generateImage(baseReq);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls proxy endpoint when configured', async () => {
    process.env.NEXT_PUBLIC_CREATE_BASE_URL = 'https://proxy.example.com';
    process.env.ANYTHING_PROJECT_TOKEN = 'tok-123';

    const mockResponse = new Response(
      JSON.stringify({ data: [{ url: 'https://img.example.com/generated.png' }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await generateImage(baseReq);

    expect(result).toBe('https://img.example.com/generated.png');
    expect(fetch).toHaveBeenCalledWith(
      'https://proxy.example.com/integrations/image-generation/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-123',
        }),
      })
    );

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.prompt).toContain('Test Serum');
    expect(callBody.size).toBe('1024x1792');
    expect(callBody.n).toBe(1);
    expect(callBody.model).toBeUndefined();
  });

  it('falls back to OpenAI DALL-E 3 when proxy is not configured', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    process.env.OPENAI_API_KEY = 'sk-direct';

    const mockResponse = new Response(
      JSON.stringify({ data: [{ url: 'https://oai-img.example.com/output.png' }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await generateImage(baseReq);

    expect(result).toBe('https://oai-img.example.com/output.png');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-direct',
        }),
      })
    );

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.model).toBe('dall-e-3');
    expect(callBody.prompt).toContain('Test Serum');
    expect(callBody.size).toBe('1024x1792');
    expect(callBody.n).toBe(1);
  });

  it('returns null on upstream error (graceful degradation)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response('Rate limited', { status: 429 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await generateImage(baseReq);
    expect(result).toBeNull();
  });

  it('returns null when response has empty data', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response(
      JSON.stringify({ data: [{ url: '' }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await generateImage(baseReq);
    expect(result).toBeNull();
  });

  it('returns null on network/fetch error', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const result = await generateImage(baseReq);
    expect(result).toBeNull();
  });

  it('uses default size 1024x1792 when not specified', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response(
      JSON.stringify({ data: [{ url: 'https://img.example.com/out.png' }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await generateImage({
      productDescription: 'Test',
      sceneContext: 'Scene',
    });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.size).toBe('1024x1792');
  });
});
