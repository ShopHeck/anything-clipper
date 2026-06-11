import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { consumeRateLimit, rateLimited } from '@/app/api/utils/limits';
import sql from '@/app/api/utils/sql';
import { groupWordsIntoLines, TimedWord } from '@/lib/captions/ass';
import { buildSubtitles, subtitleContentType, SubtitleFormat } from '@/lib/captions/subtitles';
import { translateLines, translatedLinesToWords } from '@/lib/captions/translate';
import { synthesizeWordsFromSegments } from '@/lib/render/spec';

// GET /api/projects/:id/subtitles?format=srt|vtt&lang=Spanish&clipId=...
// Downloads a subtitle file built from the project's word timestamps,
// optionally translated and/or scoped to a single clip's time window.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') === 'vtt' ? 'vtt' : 'srt') as SubtitleFormat;
  const lang = searchParams.get('lang');
  const clipId = searchParams.get('clipId');

  const [project] = await sql`
    SELECT transcript_words FROM projects WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  let words = (project.transcript_words as TimedWord[] | null) ?? [];
  if (words.length === 0) {
    const segments = await sql`
      SELECT start_time, end_time, segment_text, is_deleted
      FROM transcript_segments WHERE project_id = ${id} ORDER BY sort_order ASC
    `;
    words = synthesizeWordsFromSegments(
      segments.map((s) => ({
        start_time: Number(s.start_time),
        end_time: Number(s.end_time),
        segment_text: s.segment_text as string,
        is_deleted: Boolean(s.is_deleted),
      }))
    );
  }
  if (words.length === 0) {
    return Response.json({ error: 'No transcript available for subtitles' }, { status: 422 });
  }

  // Scope to a clip window, rebasing timestamps to the clip start so the
  // subtitle file lines up with the exported clip.
  if (clipId) {
    const [clip] = await sql`
      SELECT start_time, end_time FROM clips WHERE id = ${clipId} AND project_id = ${id}
    `;
    if (!clip) return Response.json({ error: 'Clip not found' }, { status: 404 });
    const cs = Number(clip.start_time);
    const ce = Number(clip.end_time);
    words = words
      .filter((w) => w.end > cs && w.start < ce)
      .map((w) => ({
        text: w.text,
        start: Math.max(0, w.start - cs),
        end: Math.max(0.05, Math.min(w.end, ce) - cs),
      }));
  }

  if (lang) {
    // Translation hits the paid LLM gateway — rate limit it.
    const limit = await consumeRateLimit(user.id, 'captions.translate', {
      limit: 20,
      windowSec: 3600,
    });
    if (!limit.ok) return rateLimited(limit);

    try {
      const translated = await translateLines(groupWordsIntoLines(words), lang);
      words = translatedLinesToWords(translated);
    } catch (err) {
      console.error('Subtitle translation failed:', err);
      return Response.json(
        { error: 'Translation is temporarily unavailable. Try again shortly.' },
        { status: 502 }
      );
    }
  }

  const body = buildSubtitles(words, format);
  const suffix = lang ? `.${lang.toLowerCase().slice(0, 8)}` : '';
  return new Response(body, {
    headers: {
      'Content-Type': subtitleContentType(format),
      'Content-Disposition': `attachment; filename="captions${suffix}.${format}"`,
    },
  });
}
