export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transcript } = body;

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
              content:
                'You are an expert video editor and content strategist specializing in short-form viral content. Give concise, actionable editing suggestions to improve video retention and virality. Keep suggestions to 2-3 sentences max.',
            },
            {
              role: 'user',
              content: `Analyze this video transcript and give one specific, actionable editing suggestion to improve its viral potential and viewer retention:\n\n"${transcript}"`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    return Response.json({ suggestion: data.choices[0].message.content });
  } catch (error) {
    console.error('AI suggest error:', error);
    return Response.json({
      suggestion:
        'Try cutting the intro and starting at the first strong insight. Hook viewers immediately — the first 3 seconds determine 80% of your retention rate.',
    });
  }
}
