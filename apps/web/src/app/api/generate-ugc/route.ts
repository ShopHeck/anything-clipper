import { aiErrorResponse, chatCompletionJson } from '@/app/api/utils/ai';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';

interface ProductData {
  name: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  rating: string;
  soldCount: string;
  shopName: string;
  category: string;
  features: string[];
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'ai.generate-ugc', {
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const { product, transcript, niche, templateStyle } = (await request.json()) as {
      product: ProductData;
      transcript?: string;
      niche?: string;
      templateStyle?: string;
    };

    if (!product?.name) {
      return Response.json({ error: 'product is required' }, { status: 400 });
    }

    const stylePrompt =
      templateStyle === 'pov'
        ? 'Use POV: format hooks. Short, punchy, relatable.'
        : templateStyle === 'storytime'
          ? 'Use storytime hooks. Personal, emotional, narrative-driven.'
          : templateStyle === 'bold-hook'
            ? 'Use bold, direct claims. Numbers and stats when possible.'
            : 'Use authentic UGC creator style. Conversational, genuine, excited.';

    const script = await chatCompletionJson(
      [
        {
          role: 'system',
          content: `You are an elite UGC (User Generated Content) video script writer specializing in TikTok Shop affiliate content. You write viral, authentic scripts that drive sales while feeling genuine. You know exactly what hooks stop the scroll, what language builds trust, and what CTAs convert. ${stylePrompt}`,
        },
        {
          role: 'user',
          content: `Write a complete UGC product video script for TikTok/Reels that will drive sales.

Product: ${product.name}
Price: ${product.price}${product.originalPrice ? ` (was ${product.originalPrice})` : ''}
Rating: ${product.rating} stars, ${product.soldCount} sold
Shop: ${product.shopName}
Category: ${product.category}
Key features/benefits:
${product.features.map((f, i) => `${i + 1}. ${f}`).join('\n')}

${transcript ? `Context from their existing video:\n"${transcript.slice(0, 600)}"` : ''}
${niche ? `Creator niche: ${niche}` : ''}

Create a script that sounds authentic, NOT like an ad. Each section should be 1-3 sentences max — tight, punchy, viral.`,
        },
      ],
      {
        name: 'ugc_script',
        schema: {
          type: 'object',
          properties: {
            hook: {
              type: 'string',
              description:
                'First 3 seconds — the scroll-stopper. Under 12 words. Creates massive curiosity or shock.',
            },
            problem: {
              type: 'string',
              description:
                '2-3 sentences. Relate to a problem the audience FEELS. Make it visceral.',
            },
            solution: {
              type: 'string',
              description:
                '2-3 sentences. Introduce the product as THE solution. Mention price casually.',
            },
            demo: {
              type: 'string',
              description:
                '2-3 sentences. Describe what to show on camera — the most impressive feature/result.',
            },
            socialProof: {
              type: 'string',
              description:
                '1-2 sentences. Reference the rating, sold count, or results. Real numbers build trust.',
            },
            cta: {
              type: 'string',
              description:
                'Final CTA. Mention the link in bio / TikTok Shop. Create FOMO if possible.',
            },
            overlayText: {
              type: 'string',
              description:
                'The single most viral text overlay for the video (under 8 words, bold claim)',
            },
            hashtags: {
              type: 'array',
              items: { type: 'string' },
              description: '8-10 hashtags mixing viral (#fyp, #TikTokShop) with niche-specific tags',
            },
          },
          required: [
            'hook',
            'problem',
            'solution',
            'demo',
            'socialProof',
            'cta',
            'overlayText',
            'hashtags',
          ],
          additionalProperties: false,
        },
      }
    );

    return Response.json({ script });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
