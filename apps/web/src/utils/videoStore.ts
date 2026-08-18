// Module-level singleton that persists across client-side navigations
// within the same browser tab session.

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  highlight: boolean;
  deleted: boolean;
  viralScore?: number;
}

export interface ViralClip {
  id: string;
  title: string;
  hook: string;
  start: number;
  end: number;
  duration: string;
  score: number;
  platforms: string[];
  reason: string;
  thumbnail?: string;
  keywords?: string[];
  momentType?: string;
  round?: number;
  fighterNames?: string[];
  sponsorFriendly?: boolean;
  contentMode?: 'generic' | 'fight' | 'sponsor';
}

interface VideoStore {
  projectId: string | null; // DB project ID for persistence
  objectUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  transcript: TranscriptSegment[];
  clips: ViralClip[];
  overallScore: number;
  totalDuration: number; // seconds
}

const store: VideoStore = {
  projectId: null,
  objectUrl: null,
  fileName: null,
  fileSize: null,
  transcript: [],
  clips: [],
  overallScore: 0,
  totalDuration: 0,
};

export const videoStore = {
  setProjectId(id: string) {
    store.projectId = id;
  },

  getProjectId() {
    return store.projectId;
  },

  setVideo(file: File) {
    // Revoke old URL to free memory
    if (store.objectUrl) {
      URL.revokeObjectURL(store.objectUrl);
    }
    store.objectUrl = URL.createObjectURL(file);
    store.fileName = file.name;
    store.fileSize = file.size;
  },

  setTranscript(segments: TranscriptSegment[], totalDuration: number) {
    store.transcript = segments;
    store.totalDuration = totalDuration;
  },

  setClips(clips: ViralClip[]) {
    store.clips = clips;
  },

  setOverallScore(score: number) {
    store.overallScore = score;
  },

  getAll(): VideoStore {
    return { ...store };
  },

  getObjectUrl() {
    return store.objectUrl;
  },

  getFileName() {
    return store.fileName;
  },

  getTranscript() {
    return store.transcript;
  },

  getClips() {
    return store.clips;
  },

  getOverallScore() {
    return store.overallScore;
  },

  getTotalDuration() {
    return store.totalDuration;
  },

  hasVideo() {
    return store.objectUrl !== null;
  },

  clear() {
    if (store.objectUrl) {
      URL.revokeObjectURL(store.objectUrl);
    }
    store.objectUrl = null;
    store.fileName = null;
    store.fileSize = null;
    store.transcript = [];
    store.clips = [];
    store.overallScore = 0;
    store.totalDuration = 0;
  },
};
