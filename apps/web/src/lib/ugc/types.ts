// Types for the UGC video composition engine.
// Mirrors the render pipeline's RenderSpec pattern, adapted for
// composing a new video from still images or video clips + voiceover audio.

import type { AspectRatio, SpecWord } from '@/lib/render/types';

/** Direction of the Ken Burns effect applied to a still image. */
export type ZoomDirection = 'in' | 'out' | 'pan-left' | 'pan-right';

/** Vertical position for text overlays drawn via drawtext. */
export type OverlayPosition = 'top' | 'center' | 'bottom';

/** A single scene in the UGC video composition timeline. */
export interface UGCScene {
  /** Start time in the output timeline (seconds). */
  startSec: number;
  /** End time in the output timeline (seconds). */
  endSec: number;
  /** URL to the still image displayed during this scene. */
  imageUrl: string;
  /** Ken Burns zoom/pan direction for this scene. Defaults to 'in'. */
  zoomDirection?: ZoomDirection;
  /** Optional text overlay drawn on top of the image. */
  overlayText?: string;
  /** Vertical position for the text overlay. Defaults to 'bottom'. */
  overlayPosition?: OverlayPosition;
  /** When true, this scene uses a video clip instead of a still image. */
  isVideoClip?: boolean;
  /** URL to the video clip file (when isVideoClip is true). */
  videoUrl?: string;
}

/** Full render specification for a UGC video composition. */
export interface UGCRenderSpec {
  /** URL to the TTS voiceover MP3 (primary timeline driver). */
  ttsAudioUrl: string;
  /** Ordered scenes composing the video timeline. */
  scenes: UGCScene[];
  /** Optional background music URL (looped, mixed under voiceover). */
  backgroundMusicUrl?: string;
  /** Volume level for background music (0-1). Defaults to 0.15. */
  backgroundMusicVolume?: number;
  /** Word-level timestamps for karaoke captions (SpecWord format). */
  captions: SpecWord[];
  /** Output aspect ratio. Typically 9:16 for short-form vertical. */
  aspect: AspectRatio;
  /** Caption template ID for ASS styling. */
  captionTemplateId: string;
  /** Caption vertical position. */
  captionPosition?: 'bottom' | 'center' | 'top';
  /** Output FPS. Defaults to 30. */
  fps?: number;
}
