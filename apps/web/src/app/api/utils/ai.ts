// Single gateway for LLM calls. Centralizes the upstream endpoint, auth,
// JSON-schema responses, and honest error handling (no fabricated results).

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

export class AiUnavailableError extends Error {
  constructor(detail: string) {
    super(`AI service unavailable: ${detail}`);
    this.name = 'AiUnavailableError';
  }
}

/**
 * Send a chat completion request.
 *
 * Routing priority:
 * 1. NEXT_PUBLIC_CREATE_BASE_URL proxy with ANYTHING_PROJECT_TOKEN
 * 2. Direct OpenAI API with OPENAI_API_KEY
 */
export async function chatCompletion(
  messages: ChatMessage[],
  jsonSchema?: JsonSchemaSpec
): Promise<string> {
  const proxyBase = process.env.NEXT_PUBLIC_CREATE_BASE_URL;
  const proxyToken = process.env.ANYTHING_PROJECT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  let url: string;
  let headers: Record<string, string>;
  let body: string;

  if (proxyBase && proxyToken) {
    // Route through the project proxy
    url = `${proxyBase}/integrations/chat-gpt/conversationgpt4`;
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${proxyToken}`,
    };
    body = JSON.stringify({
      messages,
      ...(jsonSchema ? { json_schema: jsonSchema } : {}),
    });
  } else if (openaiKey) {
    // Direct OpenAI API fallback
    url = 'https://api.openai.com/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    };
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    body = JSON.stringify({
      model,
      messages,
      ...(jsonSchema
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: jsonSchema.name,
                strict: false,
                schema: jsonSchema.schema,
              },
            },
          }
        : {}),
    });
  } else {
    throw new AiUnavailableError('AI integration is not configured on this deployment');
  }

  const res = await fetch(url, { method: 'POST', headers, body });

  if (!res.ok) {
    throw new AiUnavailableError(`upstream returned ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new AiUnavailableError('upstream returned an empty response');
  }
  return content;
}

export async function chatCompletionJson<T>(
  messages: ChatMessage[],
  jsonSchema: JsonSchemaSpec
): Promise<T> {
  const content = await chatCompletion(messages, jsonSchema);
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AiUnavailableError('upstream returned malformed JSON');
  }
}

// Honest failure response. The previous implementation silently returned
// hardcoded fake results on error — never do that.
export function aiErrorResponse(err: unknown): Response {
  const detail = err instanceof Error ? err.message : String(err);
  console.error('AI route error:', detail);
  return Response.json(
    { error: 'The AI service is temporarily unavailable. Please try again in a moment.' },
    { status: 502 }
  );
}
