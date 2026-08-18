import { describe, expect, it } from 'vitest';
import { clipPersistenceValues, mapPersistedClip } from './persist';

describe('clip persistence', () => {
  it('keeps fight metadata through a save/reload mapping', () => {
    const values = clipPersistenceValues({
      id: 'clip-0',
      title: 'Knockdown',
      hook: 'He never saw it coming',
      score: 91,
      platforms: ['TikTok'],
      start: 12,
      end: 28,
      duration: '0:16',
      reason: 'Complete exchange',
      thumbnail: 'from-violet-800 to-purple-900',
      keywords: ['knockdown'],
      momentType: 'knockdown',
      round: 2,
      fighterNames: ['Mike Heckert', 'Opponent'],
      sponsorFriendly: true,
      contentMode: 'sponsor',
    });

    expect(values).toMatchObject({
      moment_type: 'knockdown',
      fight_round: 2,
      fighter_names: ['Mike Heckert', 'Opponent'],
      sponsor_friendly: true,
      content_mode: 'sponsor',
      keywords: ['knockdown'],
    });

    expect(
      mapPersistedClip({
        id: values.id,
        title: values.title,
        hook: values.hook,
        score: values.score,
        platforms: values.platforms,
        start_time: values.start_time,
        end_time: values.end_time,
        duration_label: values.duration_label,
        reason: values.reason,
        thumbnail: values.thumbnail,
        keywords: values.keywords,
        moment_type: values.moment_type,
        fight_round: values.fight_round,
        fighter_names: values.fighter_names,
        sponsor_friendly: values.sponsor_friendly,
        content_mode: values.content_mode,
      })
    ).toMatchObject({
      momentType: 'knockdown',
      round: 2,
      fighterNames: ['Mike Heckert', 'Opponent'],
      sponsorFriendly: true,
      contentMode: 'sponsor',
      keywords: ['knockdown'],
      start_time: 12,
      end_time: 28,
    });
  });

  it('does not invent missing fight metadata', () => {
    const values = clipPersistenceValues({
      id: 'clip-1',
      title: 'Generic',
      hook: 'Hook',
      score: 70,
      platforms: [],
      start: 0,
      end: 10,
      duration: '0:10',
      reason: '',
    });
    expect(values.moment_type).toBeNull();
    expect(values.fight_round).toBeNull();
    expect(values.fighter_names).toEqual([]);
    expect(values.content_mode).toBeNull();
  });
});
