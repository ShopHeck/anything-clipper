import { aiErrorResponse } from '@/app/api/utils/ai';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import { generateImage } from '@/lib/assets/image-gen';
import { processProductImages } from '@/lib/assets/product-images';
import { planScenes } from '@/lib/assets/scene-planner';
import type {
  AssetGenerationRequest,
  AssetGenerationResult,
  ProductAssets,
} from '@/lib/assets/types';

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'ai.generate-assets', {
    limit: 15,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const body = (await request.json()) as AssetGenerationRequest;

    if (!body.productData || !body.script || !body.ttsTiming) {
      return Response.json(
        { error: 'productData, script, and ttsTiming are required' },
        { status: 400 }
      );
    }

    if (!body.ttsTiming.timings || body.ttsTiming.timings.length === 0) {
      return Response.json(
        { error: 'ttsTiming.timings must contain at least one section' },
        { status: 400 }
      );
    }

    // Step 1: Process product images from scraped URLs
    const productImageUrls = body.productData.imageUrls || [];
    const processedImages = await processProductImages(productImageUrls, user.id);
    const productImages = processedImages.map((img) => img.storageUrl);

    // Step 2: Generate lifestyle images via AI
    const lifestyleImages: string[] = [];
    const sceneContexts = [
      `person using ${body.productData.name} in daily routine`,
      `happy customer showing results from ${body.productData.name}`,
    ];

    for (const context of sceneContexts) {
      const url = await generateImage({
        productDescription: `${body.productData.name} - ${body.productData.category || 'product'}`,
        sceneContext: context,
        size: '1024x1792',
      });
      if (url) lifestyleImages.push(url);
    }

    // Step 3: Assemble assets
    const assets: ProductAssets = {
      productImages,
      lifestyleImages,
    };

    // Step 4: Plan scenes
    const scenePlan = planScenes({
      timings: body.ttsTiming.timings,
      assets,
      productData: body.productData,
      script: body.script,
    });

    const result: AssetGenerationResult = { assets, scenePlan };
    return Response.json(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
