// Shared types for the TTS voiceover generation service.

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface TTSRequest {
  text: string;
  voice?: TTSVoice;
  speed?: number;
}

export interface TTSResult {
  audioUrl: string;
  durationSec: number;
}

/** Per-section timing marker for video composition sync. */
export interface SectionTiming {
  section: string;
  startSec: number;
  endSec: number;
}

/** Full UGC script object with 5 natural sections for authentic video content. */
export interface UGCScript {
  hook: string;
  problem: string;
  solution: string;
  demo: string;
  cta: string;
}

/** Extended script interface that includes Pexels search queries per section. */
export interface UGCScriptWithQueries extends UGCScript {
  /** Maps section names to Pexels video search query strings. */
  searchQueries: Record<string, string>;
}

export interface ScriptToAudioResult {
  audioUrl: string;
  durationSec: number;
  timings: SectionTiming[];
}
