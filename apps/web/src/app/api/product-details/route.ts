import { aiErrorResponse, chatCompletionJson } from '@/app/api/utils/ai';
import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'ai.product-details', {
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

  try {
    const { url } = await request.json();
    if (!url) return Response.json({ error: 'URL required' }, { status: 400 });

    // Step 1: Scrape the product page
    const scrapeRes = await fetch(
      `${process.env.NEXT_PUBLIC_CREATE_BASE_URL}/integrations/web-scraping/post`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ANYTHING_PROJECT_TOKEN}`,
        },
        body: JSON.stringify({ url, getText: true }),
      }
    );

    let pageText = '';
    if (scrapeRes.ok) {
      pageText = await scrapeRes.text();
      // Trim to avoid token overflow
      pageText = pageText.slice(0, 4000);
    }

    if (!pageText) {
      return Response.json(
        {
          error:
            'Could not read that product page. Check the URL is public and try again — we never invent product data.',
        },
        { status: 422 }
      );
    }

    // Step 2: Use GPT to extract structured product info (including image URLs)
    const product = await chatCompletionJson(
      [
        {
          role: 'system',
          content: `You are an e-commerce data extractor. Extract product details from webpage text. Only report details actually present in the page content — never invent prices, ratings, or sales numbers. Also extract any image URLs you find (og:image meta tags, img src attributes, or any image URLs in the page content).`,
        },
        {
          role: 'user',
          content: `Extract product details from this TikTok Shop product page.

URL: ${url}

Page content (may be partial):
${pageText}

For features, return 4-6 bullet point benefits found on the page that would resonate in a UGC video. Make them benefit-focused, not just feature descriptions.

For imageUrls, extract any product image URLs found in the page content (from img tags, og:image meta tags, or any image URL patterns). Return only valid absolute URLs.`,
        },
      ],
      {
        name: 'product_details',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Full product name' },
            price: { type: 'string', description: 'Current sale price e.g. $24.99' },
            originalPrice: {
              type: 'string',
              description: 'Original price before discount e.g. $49.99',
            },
            discount: { type: 'string', description: 'Discount percentage e.g. 50%' },
            rating: { type: 'string', description: 'Star rating e.g. 4.8' },
            soldCount: { type: 'string', description: 'Units sold e.g. 12.4K+' },
            shopName: { type: 'string', description: 'Shop or brand name' },
            category: {
              type: 'string',
              description: 'Product category e.g. skincare, fitness, fashion',
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of 4-6 benefit-focused selling points for UGC videos',
            },
            imageUrls: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Product image URLs found on the page (og:image, img src, CDN URLs)',
            },
          },
          required: [
            'name',
            'price',
            'rating',
            'soldCount',
            'shopName',
            'category',
            'features',
            'imageUrls',
          ],
          additionalProperties: false,
        },
      }
    );

    return Response.json({ product });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
