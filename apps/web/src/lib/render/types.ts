// The render spec is what gets stored on a render job and consumed by the
// ffmpeg pipeline. All times are SOURCE seconds unless noted.

export type AspectRatio = '9:16' | '1:1' | '16:9';

export interface SpecWord {
  text: string;
  start: number;
  end: number;
}

export interface CutRange {
  // Range of the SOURCE to remove (deleted segments, silences, fillers).
  start: number;
  end: number;
}

export interface CropKeyframe {
  // Source-time second → normalized horizontal center of the crop window
  // (0 = far left, 0.5 = center, 1 = far right). Used for speaker reframing.
  t: number;
  x: number;
}

export interface ZoomKeyframe {
  // Source-time second → zoom factor (1 = none, 1.15 = punch-in).
  t: number;
  scale: number;
}

export interface SpeedRange {
  // Source-time range played at `rate` (2 = twice as fast).
  start: number;
  end: number;
  rate: number;
}

export interface RenderSpec {
  sourceUrl: string;
  startSec: number;
  endSec: number;
  aspect: AspectRatio;
  fps?: number;
  cuts?: CutRange[];
  captions?: {
    templateId: string;
    words: SpecWord[];
    position?: 'bottom' | 'center' | 'top';
  } | null;
  cropKeyframes?: CropKeyframe[];
  zoomKeyframes?: ZoomKeyframe[];
  speedRanges?: SpeedRange[];
  music?: { url: string; volume: number } | null;
  loudnessNormalize?: boolean;
  // When true and cropKeyframes aren't explicitly provided, the render worker
  // analyzes subject motion and generates reframe keyframes automatically.
  autoReframe?: boolean;
}

export const ASPECT_DIMENSIONS: Record<AspectRatio, [number, number]> = {
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
  '16:9': [1920, 1080],
};
