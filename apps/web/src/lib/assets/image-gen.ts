// AI image generation service for producing lifestyle/context images.
// Uses the existing Create proxy (NEXT_PUBLIC_CREATE_BASE_URL) to call
// a DALL-E/image generation endpoint.
// Supports both URL responses (dall-e-3) and b64_json responses (gpt-image-2).

import { presignDownload, presignUpload } from '@/app/api/utils/storage';

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
  /** User ID for building storage keys when uploading base64 results. */
  userId?: string;
}

/** Models that return base64 encoded images instead of URLs. */
const B64_MODELS = new Set(['gpt-image-1', 'gpt-image-2']);

/**
 * Generate a lifestyle image using AI image generation.
 * Returns a generated image URL, or null if the service is not available
 * (allowing the pipeline to proceed with extracted product images only).
 *
 * Routing priority:
 * 1. NEXT_PUBLIC_CREATE_BASE_URL proxy with ANYTHING_PROJECT_TOKEN
 * 2. Direct OpenAI API with OPENAI_API_KEY (supports dall-e-3 and gpt-image-2)
 */
export async function generateImage(req: ImageGenRequest): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_CREATE_BASE_URL;
  const token = process.env.ANYTHING_PROJECT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = `Professional product photography style: ${req.sceneContext}. Product: ${req.productDescription}. Natural lighting, high quality, realistic, clean background.`;

  let url: string;
  let headers: Record<string, string>;
  let body: string;
  let expectsB64 = false;

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
    // Direct OpenAI fallback
    const imageModel = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
    expectsB64 = B64_MODELS.has(imageModel);
    url = 'https://api.openai.com/v1/images/generations';
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    };

    const requestBody: Record<string, unknown> = {
      model: imageModel,
      prompt,
      size: req.size || '1024x1792',
      n: 1,
    };

    // gpt-image-2 returns b64_json by default; be explicit for clarity
    if (expectsB64) {
      requestBody.output_format = 'png';
    }

    body = JSON.stringify(requestBody);
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
    const firstResult = data?.data?.[0];

    // Prefer a URL if present (dall-e-3 path, backward compatible)
    if (typeof firstResult?.url === 'string' && firstResult.url.length > 0) {
      return firstResult.url;
    }

    // Handle base64 response (gpt-image-2 path)
    const b64Data: string | undefined = firstResult?.b64_json;
    if (typeof b64Data === 'string' && b64Data.length > 0) {
      return uploadBase64Image(b64Data, req.userId);
    }

    console.error('Image generation returned empty result');
    return null;
  } catch (err) {
    console.error('Image generation failed:', err);
    return null;
  }
}

/**
 * Decode a base64 PNG image and upload it to R2 storage.
 * Returns a presigned download URL for the uploaded image.
 */
async function uploadBase64Image(b64Data: string, userId?: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(b64Data, 'base64');
    const userPrefix = userId || 'anonymous';
    const storageKey = `generated-images/${userPrefix}/${Date.now()}.png`;

    const uploadUrl = presignUpload(storageKey, 3600);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: new Uint8Array(buffer),
    });

    if (!uploadRes.ok) {
      console.error(`Failed to upload generated image (${uploadRes.status})`);
      return null;
    }

    return presignDownload(storageKey);
  } catch (err) {
    console.error('Failed to upload base64 image to storage:', err);
    return null;
  }
}
