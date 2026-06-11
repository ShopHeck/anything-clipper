// Posted-clip analytics for TikTok via the Display API (video/list). The
// Content Posting API doesn't return the public video id, so we match each
// published job to the user's videos by publish time proximity — a documented
// best-effort. Parsing and matching are pure and unit-tested; the network
// call is isolated in fetchTikTokVideos.

export interface VideoStats {
  id: string;
  createTimeSec: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

interface RawVideo {
  id?: string;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

export function parseVideoList(apiResponse: unknown): VideoStats[] {
  const videos = (apiResponse as { data?: { videos?: RawVideo[] } } | undefined)?.data?.videos;
  if (!Array.isArray(videos)) return [];
  return videos
    .filter((v): v is RawVideo & { id: string } => typeof v.id === 'string')
    .map((v) => ({
      id: v.id,
      createTimeSec: Number(v.create_time ?? 0),
      views: Number(v.view_count ?? 0),
      likes: Number(v.like_count ?? 0),
      comments: Number(v.comment_count ?? 0),
      shares: Number(v.share_count ?? 0),
    }));
}

export interface JobToMatch {
  jobId: string;
  publishedAtSec: number;
}

// Match each job to the closest video by creation time within tolerance.
// Each video is used at most once (closest job wins) to avoid double-counting.
export function matchVideosToJobs(
  jobs: JobToMatch[],
  videos: VideoStats[],
  toleranceSec = 3600
): Map<string, VideoStats> {
  const result = new Map<string, VideoStats>();
  const usedVideos = new Set<string>();

  // Greedy by smallest time delta across all job/video pairs.
  const pairs: Array<{ jobId: string; video: VideoStats; delta: number }> = [];
  for (const job of jobs) {
    for (const video of videos) {
      const delta = Math.abs(video.createTimeSec - job.publishedAtSec);
      if (delta <= toleranceSec) pairs.push({ jobId: job.jobId, video, delta });
    }
  }
  pairs.sort((a, b) => a.delta - b.delta);

  for (const { jobId, video } of pairs) {
    if (result.has(jobId) || usedVideos.has(video.id)) continue;
    result.set(jobId, video);
    usedVideos.add(video.id);
  }
  return result;
}

// Fetch the connected account's recent videos with public stats.
// Requires the video.list scope on the access token.
export async function fetchTikTokVideos(accessToken: string): Promise<VideoStats[]> {
  const res = await fetch(
    'https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,view_count,like_count,comment_count,share_count',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: 20 }),
    }
  );
  if (!res.ok) {
    throw new Error(`TikTok video list failed (${res.status})`);
  }
  return parseVideoList(await res.json());
}
