import type { ViralClip } from '@/utils/videoStore';

export interface PersistedClipRow {
  id: string;
  title: string;
  hook: string | null;
  score: number | null;
  platforms: string[] | null;
  start_time: number;
  end_time: number;
  duration_label: string | null;
  reason: string | null;
  thumbnail: string | null;
  keywords?: unknown;
  moment_type?: string | null;
  fight_round?: number | null;
  fighter_names?: unknown;
  sponsor_friendly?: boolean | null;
  content_mode?: string | null;
  rendered_url?: string | null;
  render_status?: string | null;
  created_at?: string;
}

export interface ClipPersistenceValues {
  id: string;
  title: string;
  hook: string;
  score: number;
  platforms: string[];
  start_time: number;
  end_time: number;
  duration_label: string;
  reason: string;
  thumbnail: string;
  keywords: string[];
  moment_type: string | null;
  fight_round: number | null;
  fighter_names: string[];
  sponsor_friendly: boolean | null;
  content_mode: string | null;
}

export function clipPersistenceValues(
  clip: Partial<ViralClip> & { id?: string }
): ClipPersistenceValues {
  return {
    id: String(clip.id ?? ''),
    title: String(clip.title ?? ''),
    hook: String(clip.hook ?? ''),
    score: Number.isFinite(clip.score) ? Number(clip.score) : 75,
    platforms: Array.isArray(clip.platforms) ? clip.platforms.map(String) : [],
    start_time: Number(clip.start ?? 0) || 0,
    end_time: Number(clip.end ?? 0) || 0,
    duration_label: String(clip.duration ?? '0:00'),
    reason: String(clip.reason ?? ''),
    thumbnail: String(clip.thumbnail ?? ''),
    keywords: stringList(clip.keywords),
    moment_type: clip.momentType ? String(clip.momentType) : null,
    fight_round: Number.isInteger(clip.round) ? Number(clip.round) : null,
    fighter_names: stringList(clip.fighterNames),
    sponsor_friendly: typeof clip.sponsorFriendly === 'boolean' ? clip.sponsorFriendly : null,
    content_mode: clip.contentMode ? String(clip.contentMode) : null,
  };
}

export function mapPersistedClip(row: PersistedClipRow): ViralClip & {
  start_time: number;
  end_time: number;
  duration_label: string;
  rendered_url?: string | null;
  render_status?: string | null;
  created_at?: string;
} {
  return {
    id: row.id,
    title: row.title,
    hook: row.hook ?? '',
    score: row.score ?? 75,
    platforms: row.platforms ?? [],
    start: row.start_time,
    end: row.end_time,
    duration: row.duration_label ?? '0:00',
    reason: row.reason ?? '',
    thumbnail: row.thumbnail ?? '',
    keywords: stringList(row.keywords),
    momentType: row.moment_type ?? undefined,
    round: row.fight_round ?? undefined,
    fighterNames: stringList(row.fighter_names),
    sponsorFriendly: row.sponsor_friendly ?? undefined,
    contentMode: isContentMode(row.content_mode) ? row.content_mode : undefined,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_label: row.duration_label ?? '0:00',
    rendered_url: row.rendered_url,
    render_status: row.render_status,
    created_at: row.created_at,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function isContentMode(value: string | null | undefined): value is ViralClip['contentMode'] {
  return value === 'generic' || value === 'fight' || value === 'sponsor';
}
