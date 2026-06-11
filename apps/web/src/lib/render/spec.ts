// Builds a RenderSpec from project data in the DB. Two modes:
//  - 'clip':     trim to one AI clip's start/end (what gets published)
//  - 'timeline': the whole project with deleted segments removed (editor export)
import sql from '@/app/api/utils/sql';
import { presignDownload, storageConfigured } from '@/app/api/utils/storage';
import { AspectRatio, CutRange, RenderSpec, SpecWord } from './types';

export interface RenderRequestOptions {
  mode: 'clip' | 'timeline';
  clipId?: string;
  ratio?: AspectRatio;
  captionTemplateId?: string | null; // null disables captions
  captionPosition?: 'bottom' | 'center' | 'top';
  music?: { url: string; volume: number } | null;
  zoomKeyframes?: Array<{ t: number; scale: number }>;
  cropKeyframes?: Array<{ t: number; x: number }>;
}

interface ProjectRow {
  id: string;
  file_url: string | null;
  storage_key: string | null;
  total_duration: number | null;
  transcript_words: SpecWord[] | null;
}

interface SegmentRow {
  start_time: number;
  end_time: number;
  segment_text: string;
  is_deleted: boolean;
}

// When word-level timestamps weren't captured, approximate them by spreading
// each segment's words evenly across the segment duration. Good enough for
// readable captions; real word timing is captured for new transcriptions.
export function synthesizeWordsFromSegments(segments: SegmentRow[]): SpecWord[] {
  const words: SpecWord[] = [];
  for (const seg of segments) {
    if (seg.is_deleted) continue;
    const tokens = seg.segment_text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const per = (seg.end_time - seg.start_time) / tokens.length;
    tokens.forEach((text, i) => {
      words.push({
        text,
        start: seg.start_time + i * per,
        end: seg.start_time + (i + 1) * per,
      });
    });
  }
  return words;
}

export async function buildRenderSpec(
  userId: string,
  projectId: string,
  opts: RenderRequestOptions
): Promise<{ spec: RenderSpec; clipId: string | null } | { error: string; status: number }> {
  const [project] = (await sql`
    SELECT id, file_url, storage_key, total_duration, transcript_words
    FROM projects WHERE id = ${projectId} AND user_id = ${userId}
  `) as ProjectRow[];
  if (!project) return { error: 'Project not found', status: 404 };

  // Prefer re-signing the durable storage object — stored file_url
  // signatures expire.
  let sourceUrl: string | null = null;
  if (project.storage_key && storageConfigured()) {
    sourceUrl = presignDownload(project.storage_key);
  } else if (project.file_url) {
    sourceUrl = project.file_url;
  }
  if (!sourceUrl) {
    return { error: 'This project has no stored source video to render from.', status: 422 };
  }

  const segments = (await sql`
    SELECT start_time, end_time, segment_text, is_deleted
    FROM transcript_segments WHERE project_id = ${projectId}
    ORDER BY sort_order ASC
  `) as SegmentRow[];

  let startSec = 0;
  let endSec = project.total_duration ?? 0;
  let clipId: string | null = null;

  if (opts.mode === 'clip') {
    if (!opts.clipId) return { error: 'clipId is required for clip renders', status: 400 };
    const [clip] = await sql`
      SELECT id, start_time, end_time FROM clips
      WHERE id = ${opts.clipId} AND project_id = ${projectId}
    `;
    if (!clip) return { error: 'Clip not found', status: 404 };
    startSec = Number(clip.start_time) || 0;
    endSec = Number(clip.end_time) || 0;
    clipId = clip.id;
  } else if (endSec <= 0) {
    const last = segments[segments.length - 1];
    endSec = last ? last.end_time : 0;
  }

  if (endSec - startSec < 0.5) {
    return { error: 'The selected range is too short to render.', status: 422 };
  }

  // Deleted transcript segments become cuts (only relevant inside the window).
  const cuts: CutRange[] = segments
    .filter((s) => s.is_deleted)
    .map((s) => ({ start: s.start_time, end: s.end_time }));

  const words: SpecWord[] =
    Array.isArray(project.transcript_words) && project.transcript_words.length > 0
      ? project.transcript_words
      : synthesizeWordsFromSegments(segments);

  const spec: RenderSpec = {
    sourceUrl,
    startSec,
    endSec,
    aspect: opts.ratio ?? '9:16',
    cuts,
    captions:
      opts.captionTemplateId === null
        ? null
        : {
            templateId: opts.captionTemplateId ?? 'hormozi',
            words,
            position: opts.captionPosition ?? 'bottom',
          },
    cropKeyframes: opts.cropKeyframes,
    zoomKeyframes: opts.zoomKeyframes,
    music: opts.music ?? null,
    loudnessNormalize: true,
  };

  return { spec, clipId };
}
