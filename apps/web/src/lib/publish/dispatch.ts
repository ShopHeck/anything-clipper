// Platform-agnostic publish routing. The scheduler and the per-platform
// routes both go through dispatchPublish so adding a platform is one case.
import { PublishResult } from './tiktok';
import { publishTikTokJob } from './tiktok';
import { publishYouTubeJob } from './youtube';
import { publishInstagramJob } from './instagram';

export const SUPPORTED_PLATFORMS = ['TikTok', 'YouTube', 'Instagram'] as const;
export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

export function isSupportedPlatform(p: string): p is Platform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(p);
}

export async function dispatchPublish(
  platform: string,
  jobId: string,
  userId: string
): Promise<PublishResult> {
  switch (platform) {
    case 'TikTok':
      return publishTikTokJob(jobId, userId);
    case 'YouTube':
      return publishYouTubeJob(jobId, userId);
    case 'Instagram':
      return publishInstagramJob(jobId, userId);
    default:
      return {
        ok: false,
        status: 400,
        error: `Publishing to ${platform} is not available yet.`,
      };
  }
}

// Caption/description assembly shared by adapters. Hashtags are normalized to
// `#tag`; YouTube Shorts additionally needs the #Shorts tag to be classified
// as a Short.
export function normalizeHashtags(hashtags: unknown): string[] {
  if (!Array.isArray(hashtags)) return [];
  return hashtags
    .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    .map((h) => (h.startsWith('#') ? h : `#${h}`));
}

export function buildCaption(
  title: string | null,
  caption: string | null,
  hashtags: unknown,
  maxLen: number
): string {
  const tags = normalizeHashtags(hashtags).join(' ');
  return [caption || title || 'Check this out!', tags].filter(Boolean).join(' ').slice(0, maxLen);
}

export interface YouTubeMetadata {
  title: string;
  description: string;
}

// YouTube Shorts: keep a punchy title (<=100 chars) and ensure #Shorts is in
// the description so the video is treated as a Short.
export function buildYouTubeMetadata(
  clipTitle: string | null,
  caption: string | null,
  hashtags: unknown
): YouTubeMetadata {
  const title = (clipTitle || caption || 'New Short').slice(0, 100);
  const tagList = normalizeHashtags(hashtags);
  if (!tagList.some((t) => t.toLowerCase() === '#shorts')) {
    tagList.push('#Shorts');
  }
  const description = [caption || '', tagList.join(' ')].filter(Boolean).join('\n\n').slice(0, 4900);
  return { title, description };
}
