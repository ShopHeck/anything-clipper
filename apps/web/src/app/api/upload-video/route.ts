// Buffer the full video body and POST it to AssemblyAI's file-upload endpoint.
// Returns { url: "<assemblyai-cdn-url>" }
// Uses Node runtime (not edge) so we can buffer large files reliably.

import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 min for large uploads

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const limit = await consumeRateLimit(user.id, 'upload.video', {
    limit: 15,
    windowSec: 3600,
  });
  if (!limit.ok) return rateLimited(limit);

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

  try {
    // Read the entire body as an ArrayBuffer — safe in Node runtime
    const arrayBuffer = await request.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return Response.json(
        { error: 'Empty file received. Please select a valid video file.' },
        { status: 400 }
      );
    }

    // 500 MB safety limit
    const MAX_BYTES = 500 * 1024 * 1024;
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return Response.json(
        { error: 'File is too large. Maximum size is 500 MB.' },
        { status: 413 }
      );
    }

    const contentType = request.headers.get('content-type') || 'application/octet-stream';

    // Upload to AssemblyAI
    const asmRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': contentType,
        'Transfer-Encoding': 'identity',
      },
      body: Buffer.from(arrayBuffer),
    });

    if (!asmRes.ok) {
      let errText = String(asmRes.status);
      try {
        errText = await asmRes.text();
      } catch {
        /* ignore */
      }
      console.error('AssemblyAI upload error:', asmRes.status, errText);
      return Response.json(
        {
          error: `Upload to AssemblyAI failed (${asmRes.status}). Check your API key and try again.`,
        },
        { status: 502 }
      );
    }

    const data = (await asmRes.json()) as { upload_url?: string };
    if (!data.upload_url) {
      return Response.json(
        { error: 'AssemblyAI did not return an upload URL. Please try again.' },
        { status: 502 }
      );
    }

    return Response.json({ url: data.upload_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('upload-video error:', msg);
    return Response.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}
