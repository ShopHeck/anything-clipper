import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImage } from './image-gen';

vi.mock('@/app/api/utils/storage', () => ({
  presignUpload: vi.fn(
    (key: string) => `https://storage.example.com/upload/${key}?sig=abc`
  ),
  presignDownload: vi.fn(
    (key: string) => `https://storage.example.com/download/${key}?sig=xyz`
  ),
}));

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

  it('uses OPENAI_IMAGE_MODEL env var when set', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    process.env.OPENAI_API_KEY = 'sk-direct';
    process.env.OPENAI_IMAGE_MODEL = 'gpt-image-1';

    const mockResponse = new Response(
      JSON.stringify({ data: [{ url: 'https://oai-img.example.com/output.png' }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await generateImage(baseReq);

    expect(result).toBe('https://oai-img.example.com/output.png');
    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.model).toBe('gpt-image-1');
  });

  describe('b64_json handling (gpt-image-2)', () => {
    const b64PngData = Buffer.from('fake-png-image-data').toString('base64');

    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
      delete process.env.ANYTHING_PROJECT_TOKEN;
      process.env.OPENAI_API_KEY = 'sk-direct';
      process.env.OPENAI_IMAGE_MODEL = 'gpt-image-2';
      // Set storage env vars needed by presign functions
      process.env.STORAGE_ENDPOINT = 'https://r2.example.com';
      process.env.STORAGE_BUCKET = 'test-bucket';
      process.env.STORAGE_ACCESS_KEY_ID = 'test-key';
      process.env.STORAGE_SECRET_ACCESS_KEY = 'test-secret';
    });

    it('decodes b64_json and uploads to storage, returns download URL', async () => {
      // First call: OpenAI API returns b64_json
      const apiResponse = new Response(
        JSON.stringify({ data: [{ b64_json: b64PngData }] }),
        { status: 200 }
      );
      // Second call: storage upload succeeds
      const uploadResponse = new Response('', { status: 200 });

      vi.mocked(fetch)
        .mockResolvedValueOnce(apiResponse)
        .mockResolvedValueOnce(uploadResponse);

      const result = await generateImage({ ...baseReq, userId: 'user-123' });

      // Should return a presigned download URL
      expect(result).toContain('https://storage.example.com/download/generated-images/user-123/');
      expect(result).toContain('.png');

      // Verify the upload call was made with correct content type
      expect(fetch).toHaveBeenCalledTimes(2);
      const uploadCall = vi.mocked(fetch).mock.calls[1];
      expect(uploadCall[0]).toContain('https://storage.example.com/upload/generated-images/user-123/');
      expect(uploadCall[1]).toEqual(
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
        })
      );
    });

    it('sends output_format png for gpt-image-2 models', async () => {
      const apiResponse = new Response(
        JSON.stringify({ data: [{ b64_json: b64PngData }] }),
        { status: 200 }
      );
      const uploadResponse = new Response('', { status: 200 });

      vi.mocked(fetch)
        .mockResolvedValueOnce(apiResponse)
        .mockResolvedValueOnce(uploadResponse);

      await generateImage({ ...baseReq, userId: 'user-123' });

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(callBody.model).toBe('gpt-image-2');
      expect(callBody.output_format).toBe('png');
    });

    it('prefers url over b64_json when both are present (backward compat)', async () => {
      const apiResponse = new Response(
        JSON.stringify({
          data: [{ url: 'https://direct-url.example.com/img.png', b64_json: b64PngData }],
        }),
        { status: 200 }
      );

      vi.mocked(fetch).mockResolvedValueOnce(apiResponse);

      const result = await generateImage({ ...baseReq, userId: 'user-123' });

      // URL takes priority - no upload should happen
      expect(result).toBe('https://direct-url.example.com/img.png');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('returns null when upload to storage fails', async () => {
      const apiResponse = new Response(
        JSON.stringify({ data: [{ b64_json: b64PngData }] }),
        { status: 200 }
      );
      const uploadResponse = new Response('Forbidden', { status: 403 });

      vi.mocked(fetch)
        .mockResolvedValueOnce(apiResponse)
        .mockResolvedValueOnce(uploadResponse);

      const result = await generateImage({ ...baseReq, userId: 'user-123' });
      expect(result).toBeNull();
    });

    it('uses anonymous prefix when userId is not provided', async () => {
      const apiResponse = new Response(
        JSON.stringify({ data: [{ b64_json: b64PngData }] }),
        { status: 200 }
      );
      const uploadResponse = new Response('', { status: 200 });

      vi.mocked(fetch)
        .mockResolvedValueOnce(apiResponse)
        .mockResolvedValueOnce(uploadResponse);

      const result = await generateImage(baseReq);

      expect(result).toContain('generated-images/anonymous/');
    });
  });
});
