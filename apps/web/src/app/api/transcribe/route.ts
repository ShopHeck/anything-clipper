// Submit a transcription job to AssemblyAI with all quality features enabled.
// Accepts: { fileUrl: string }
// Returns: { transcriptId: string, status: string }

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileUrl } = body as { fileUrl: string };

    if (!fileUrl) {
      return Response.json({ error: 'fileUrl is required' }, { status: 400 });
    }

    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          error:
            'ASSEMBLYAI_API_KEY is not configured. Add it in your project environment variables.',
        },
        { status: 500 }
      );
    }

    const res = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: fileUrl,
        // Word-level timestamps for frame-accurate captions
        // (returned by default; explicit here for clarity)
        punctuate: true,
        format_text: true,
        // Speaker labels help segment multi-person content
        speaker_labels: false, // keep off — adds latency; enable if needed
        // Auto highlights detects key phrases for viral scoring
        auto_highlights: true,
        // Language detection
        language_detection: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      console.error('AssemblyAI submit error:', res.status, errText);

      if (res.status === 401) {
        return Response.json(
          {
            error:
              'Invalid AssemblyAI API key. Check your ASSEMBLYAI_API_KEY environment variable.',
          },
          { status: 401 }
        );
      }

      return Response.json(
        { error: `Failed to start transcription (${res.status}). Please try again.` },
        { status: 500 }
      );
    }

    const data = await res.json();
    return Response.json({ transcriptId: data.id, status: data.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Transcribe submit error:', msg);
    return Response.json({ error: `Internal error: ${msg}` }, { status: 500 });
  }
}
