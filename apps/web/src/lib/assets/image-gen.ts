// AI image generation service for producing lifestyle/context images.
// Uses the existing Create proxy (NEXT_PUBLIC_CREATE_BASE_URL) to call
// a DALL-E/image generation endpoint.

export class ImageGenUnavailableError extends Error {
  constructor(detail: string) {
    super(`Image generation unavailable: ${detail}`);
    this.name = 'ImageGenUnavailableError';
  }
}

export interface ImageGenRequest {
  /** Product description for context. */
  productDescription: string;
  /** Scene description, e.g. "person using product in bathroom mirror". */
  sceneContext: string;
  /** Image dimensions. */
  size?: '1024x1024' | '1024x1792' | '1792x1024';
}

/**
 * Generate a lifestyle image using AI image generation.
 * Returns a generated image URL, or null if the service is not available
 * (allowing the pipeline to proceed with extracted product images only).
 *
 * Routing priority:
 * 1. NEXT_PUBLIC_CREATE_BASE_URL proxy with ANYTHING_PROJECT_TOKEN
 * 2. Direct OpenAI DALL-E 3 API with OPENAI_API_KEY
 */
export async function generateImage(req: ImageGenRequest): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_CREATE_BASE_URL;
  const token = process.env.ANYTHING_PROJECT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = `Professional product photography style: ${req.sceneContext}. Product: ${req.productDescription}. Natural lighting, high quality, realistic, clean background.`;

  let url: string;
  let headers: Record<string, string>;
  let body: string;

  if (base && token) {
    // Route through the project proxy
    url = `${base}/integrations/image-generation/generate`;
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    body = JSON.stringify({
      prompt,
      size: req.size || '1024x1792',
      n: 1,
    });
  } else if (openaiKey) {
    // Direct OpenAI DALL-E 3 fallback
    url = 'https://api.openai.com/v1/images/generations';
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    };
    body = JSON.stringify({
      model: 'dall-e-3',
      prompt,
      size: req.size || '1024x1792',
      n: 1,
    });
  } else {
    // Image generation not configured - return null so pipeline continues
    return null;
  }

  try {
    const res = await fetch(url, { method: 'POST', headers, body });

    if (!res.ok) {
      console.error(`Image generation upstream returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const imageUrl = data?.data?.[0]?.url;

    if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
      console.error('Image generation returned empty result');
      return null;
    }

    return imageUrl;
  } catch (err) {
    console.error('Image generation failed:', err);
    return null;
  }
}
