import { describe, expect, it } from 'vitest';
import { matchVideosToJobs, parseVideoList, VideoStats } from './tiktok';

describe('parseVideoList', () => {
  it('extracts stats and tolerates missing fields', () => {
    const parsed = parseVideoList({
      data: {
        videos: [
          { id: 'v1', create_time: 100, view_count: 5000, like_count: 200 },
          { id: 'v2', create_time: 200, share_count: 10 },
          { create_time: 300 }, // no id → dropped
        ],
      },
    });
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      id: 'v1',
      createTimeSec: 100,
      views: 5000,
      likes: 200,
      comments: 0,
      shares: 0,
    });
    expect(parsed[1].shares).toBe(10);
  });

  it('returns [] for malformed input', () => {
    expect(parseVideoList(null)).toEqual([]);
    expect(parseVideoList({ data: {} })).toEqual([]);
  });
});

describe('matchVideosToJobs', () => {
  const videos: VideoStats[] = [
    { id: 'vA', createTimeSec: 1000, views: 10, likes: 1, comments: 0, shares: 0 },
    { id: 'vB', createTimeSec: 2000, views: 20, likes: 2, comments: 0, shares: 0 },
  ];

  it('matches each job to the closest video within tolerance', () => {
    const jobs = [
      { jobId: 'jobA', publishedAtSec: 1010 },
      { jobId: 'jobB', publishedAtSec: 2005 },
    ];
    const matched = matchVideosToJobs(jobs, videos, 60);
    expect(matched.get('jobA')?.id).toBe('vA');
    expect(matched.get('jobB')?.id).toBe('vB');
  });

  it('does not reuse a video across jobs (closest wins)', () => {
    const jobs = [
      { jobId: 'closer', publishedAtSec: 1005 },
      { jobId: 'farther', publishedAtSec: 1030 },
    ];
    const matched = matchVideosToJobs(jobs, videos, 60);
    expect(matched.get('closer')?.id).toBe('vA');
    // 'farther' can't also take vA; vB is out of tolerance → unmatched.
    expect(matched.has('farther')).toBe(false);
  });

  it('drops matches beyond tolerance', () => {
    const matched = matchVideosToJobs([{ jobId: 'j', publishedAtSec: 9999 }], videos, 60);
    expect(matched.size).toBe(0);
  });
});
