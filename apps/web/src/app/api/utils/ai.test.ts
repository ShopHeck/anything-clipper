import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiUnavailableError, chatCompletion, chatCompletionJson } from './ai';

describe('chatCompletion', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('throws when no provider is configured', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    delete process.env.OPENAI_API_KEY;

    await expect(
      chatCompletion([{ role: 'user', content: 'hi' }])
    ).rejects.toThrow(AiUnavailableError);
    await expect(
      chatCompletion([{ role: 'user', content: 'hi' }])
    ).rejects.toThrow('not configured');
  });

  it('calls proxy endpoint when configured', async () => {
    process.env.NEXT_PUBLIC_CREATE_BASE_URL = 'https://proxy.example.com';
    process.env.ANYTHING_PROJECT_TOKEN = 'tok-abc';

    const mockResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: 'hello' } }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await chatCompletion([{ role: 'user', content: 'hi' }]);

    expect(result).toBe('hello');
    expect(fetch).toHaveBeenCalledWith(
      'https://proxy.example.com/integrations/chat-gpt/conversationgpt4',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-abc',
        }),
      })
    );
  });

  it('falls back to OpenAI direct when proxy is not configured', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    process.env.OPENAI_API_KEY = 'sk-direct';

    const mockResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: 'direct response' } }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await chatCompletion([{ role: 'user', content: 'test' }]);

    expect(result).toBe('direct response');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-direct',
        }),
      })
    );

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.model).toBe('gpt-4o');
    expect(callBody.messages).toEqual([{ role: 'user', content: 'test' }]);
  });

  it('uses OPENAI_MODEL env var when set', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';

    const mockResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await chatCompletion([{ role: 'user', content: 'hi' }]);

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.model).toBe('gpt-4o-mini');
  });

  it('sends json_schema response_format for direct OpenAI calls', async () => {
    delete process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    delete process.env.ANYTHING_PROJECT_TOKEN;
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: '{"name":"test"}' } }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const schema = {
      name: 'test_schema',
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
      },
    };

    await chatCompletion([{ role: 'user', content: 'extract' }], schema);

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'test_schema',
        strict: true,
        schema: schema.schema,
      },
    });
  });

  it('sends json_schema in proxy format for proxy calls', async () => {
    process.env.NEXT_PUBLIC_CREATE_BASE_URL = 'https://proxy.example.com';
    process.env.ANYTHING_PROJECT_TOKEN = 'tok-abc';

    const mockResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: '{"name":"test"}' } }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const schema = {
      name: 'test_schema',
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
      },
    };

    await chatCompletion([{ role: 'user', content: 'extract' }], schema);

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.json_schema).toEqual(schema);
    expect(callBody.response_format).toBeUndefined();
  });

  it('throws AiUnavailableError on upstream failure', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response('Server Error', { status: 500 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await expect(
      chatCompletion([{ role: 'user', content: 'test' }])
    ).rejects.toThrow(AiUnavailableError);
    await expect(
      chatCompletion([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('upstream returned 500');
  });

  it('throws AiUnavailableError on empty response', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: '' } }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await expect(
      chatCompletion([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('empty response');
  });
});

describe('chatCompletionJson', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('parses JSON from completion response', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: '{"name":"Product","price":"$10"}' } }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await chatCompletionJson<{ name: string; price: string }>(
      [{ role: 'user', content: 'extract' }],
      { name: 'test', schema: { type: 'object', properties: {} } }
    );

    expect(result).toEqual({ name: 'Product', price: '$10' });
  });

  it('throws on malformed JSON', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const mockResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: 'not valid json' } }] }),
      { status: 200 }
    );
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await expect(
      chatCompletionJson(
        [{ role: 'user', content: 'extract' }],
        { name: 'test', schema: { type: 'object', properties: {} } }
      )
    ).rejects.toThrow('malformed JSON');
  });
});
