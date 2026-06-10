export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title } = body;

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_CREATE_BASE_URL}/integrations/chat-gpt/conversationgpt4`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ANYTHING_PROJECT_TOKEN}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a viral social media copywriter specializing in hooks for short-form video content (TikTok, Reels, Shorts). Write hooks that create massive curiosity gaps, use pattern interrupts, and make people HAVE to watch. Keep it under 15 words. Make it punchy, bold, and impossible to ignore. Start with action or emotion — never with "I" or "You".`,
            },
            {
              role: 'user',
              content: `Write one viral hook sentence for a short-form video clip titled: "${title}". Return ONLY the hook text, nothing else.`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    return Response.json({ hook: data.choices[0].message.content.replace(/^["']|["']$/g, '') });
  } catch (error) {
    console.error('Generate hook error:', error);
    return Response.json({
      hook: `This ${title?.split(' ').slice(0, 3).join(' ')} will change how you think about content forever.`,
    });
  }
}
