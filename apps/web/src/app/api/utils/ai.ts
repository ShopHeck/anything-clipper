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

export async function chatCompletion(
  messages: ChatMessage[],
  jsonSchema?: JsonSchemaSpec
): Promise<string> {
  const base = process.env.NEXT_PUBLIC_CREATE_BASE_URL;
  const token = process.env.ANYTHING_PROJECT_TOKEN;
  if (!base || !token) {
    throw new AiUnavailableError('AI integration is not configured on this deployment');
  }

  const res = await fetch(`${base}/integrations/chat-gpt/conversationgpt4`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages,
      ...(jsonSchema ? { json_schema: jsonSchema } : {}),
    }),
  });

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
