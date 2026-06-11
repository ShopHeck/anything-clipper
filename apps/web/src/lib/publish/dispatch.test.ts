import { describe, expect, it } from 'vitest';
import {
  buildCaption,
  buildYouTubeMetadata,
  isSupportedPlatform,
  normalizeHashtags,
} from './dispatch';

describe('normalizeHashtags', () => {
  it('prefixes # and drops empties/non-strings', () => {
    expect(normalizeHashtags(['fyp', '#viral', '', 3 as unknown as string])).toEqual([
      '#fyp',
      '#viral',
    ]);
  });
  it('returns [] for non-arrays', () => {
    expect(normalizeHashtags(null)).toEqual([]);
  });
});

describe('buildCaption', () => {
  it('joins caption and hashtags and truncates', () => {
    expect(buildCaption('Title', 'Watch this', ['fyp'], 2200)).toBe('Watch this #fyp');
  });
  it('falls back to the title, then a default', () => {
    expect(buildCaption('My Title', null, [], 2200)).toBe('My Title');
    expect(buildCaption(null, null, [], 2200)).toBe('Check this out!');
  });
});

describe('buildYouTubeMetadata', () => {
  it('caps the title at 100 chars and ensures #Shorts', () => {
    const meta = buildYouTubeMetadata('A'.repeat(200), 'desc', ['fyp']);
    expect(meta.title.length).toBe(100);
    expect(meta.description).toContain('#Shorts');
    expect(meta.description).toContain('#fyp');
  });
  it('does not duplicate an existing #shorts tag', () => {
    const meta = buildYouTubeMetadata('t', 'd', ['#Shorts']);
    expect(meta.description.match(/#Shorts/gi)?.length).toBe(1);
  });
});

describe('isSupportedPlatform', () => {
  it('recognizes implemented platforms only', () => {
    expect(isSupportedPlatform('TikTok')).toBe(true);
    expect(isSupportedPlatform('YouTube')).toBe(true);
    expect(isSupportedPlatform('Instagram')).toBe(false);
  });
});
