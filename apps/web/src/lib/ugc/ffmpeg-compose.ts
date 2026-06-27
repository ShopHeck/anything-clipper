// Builds FFmpeg arguments for UGC video composition from still images.
//
// Approach:
// 1. TTS audio is the primary timeline driver (its duration = video duration)
// 2. Each scene is a still image with Ken Burns effect (zoompan filter)
// 3. Scenes are composed via a complex filtergraph that concatenates
//    individual zoompan streams
// 4. Captions are burned via the ASS subtitle filter
// 5. Text overlays are drawn via the drawtext filter
// 6. Background music is mixed under the voiceover at low volume
// 7. Output: H.264 MP4 with AAC audio, same quality as existing pipeline

import { ASPECT_DIMENSIONS } from '@/lib/render/types';
import type { UGCRenderSpec, UGCScene, ZoomDirection } from './types';

export interface BuildUGCFfmpegArgsInput {
  spec: UGCRenderSpec;
  /** Path to the TTS audio file on disk. */
  ttsAudioPath: string;
  /** Paths to scene image files on disk (same order as spec.scenes). */
  sceneImagePaths: string[];
  /** Path to the background music file on disk (if any). */
  musicPath?: string;
  /** Path to the generated ASS subtitle file (if any). */
  assPath?: string;
  /** Output MP4 file path. */
  outPath: string;
  /** Total video duration in seconds (from TTS audio). */
  totalDurationSec: number;
}

/**
 * Build the zoompan filter expression for a Ken Burns effect.
 *
 * - 'in': slowly zoom in from 1.0 to 1.15
 * - 'out': start at 1.15 and slowly zoom out to 1.0
 * - 'pan-left': keep zoom at 1.1, pan x from right to left
 * - 'pan-right': keep zoom at 1.1, pan x from left to right
 */
export function buildZoompanFilter(
  direction: ZoomDirection,
  durationFrames: number,
  width: number,
  height: number
): string {
  // zoompan filter: z=zoom expression, x/y=position, d=duration in frames,
  // s=output size, fps=frame rate
  const size = `${width}x${height}`;

  switch (direction) {
    case 'in':
      // Zoom from 1.0 to 1.15 over the duration
      return `zoompan=z='min(1+0.15*on/${durationFrames}\\,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${durationFrames}:s=${size}:fps=30`;
    case 'out':
      // Zoom from 1.15 to 1.0 over the duration
      return `zoompan=z='max(1.15-0.15*on/${durationFrames}\\,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${durationFrames}:s=${size}:fps=30`;
    case 'pan-left':
      // Fixed zoom at 1.1, pan from right to left
      return `zoompan=z='1.1':x='iw/2-(iw/zoom/2)+iw*0.05*(1-on/${durationFrames})':y='ih/2-(ih/zoom/2)':d=${durationFrames}:s=${size}:fps=30`;
    case 'pan-right':
      // Fixed zoom at 1.1, pan from left to right
      return `zoompan=z='1.1':x='iw/2-(iw/zoom/2)+iw*0.05*(on/${durationFrames}-1)':y='ih/2-(ih/zoom/2)':d=${durationFrames}:s=${size}:fps=30`;
    default:
      // Default to zoom in
      return `zoompan=z='min(1+0.15*on/${durationFrames}\\,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${durationFrames}:s=${size}:fps=30`;
  }
}

/**
 * Build the drawtext filter expression for a text overlay.
 * Draws centered text with a semi-transparent box background.
 */
function buildDrawtextFilter(
  text: string,
  position: 'top' | 'center' | 'bottom',
  width: number,
  height: number
): string {
  const escaped = text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "\u2019")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%');

  const fontSize = Math.round(height * 0.035);
  const yExpr =
    position === 'top'
      ? `${Math.round(height * 0.12)}`
      : position === 'center'
        ? `(h-text_h)/2`
        : `${Math.round(height * 0.78)}`;

  return `drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=${yExpr}:box=1:boxcolor=black@0.6:boxborderw=12`;
}

// Escape file paths for use in ffmpeg filtergraph expressions.
function escapeFilterPath(p: string): string {
  return p
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/ /g, '\\ ')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Build FFmpeg arguments for a complete UGC video composition.
 *
 * The filtergraph structure:
 * - Each image input gets: scale to output size, zoompan, setpts, optional drawtext
 * - All video streams are concatenated
 * - TTS audio is the primary audio
 * - Optional music is mixed under the voiceover
 * - ASS captions are burned on top
 */
export function buildUGCFfmpegArgs(input: BuildUGCFfmpegArgsInput): string[] {
  const { spec, ttsAudioPath, sceneImagePaths, musicPath, assPath, outPath, totalDurationSec } =
    input;
  const [width, height] = ASPECT_DIMENSIONS[spec.aspect];
  const fps = spec.fps ?? 30;

  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1'];

  // --- Inputs ---
  // Input images: each looped for its scene duration
  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    const duration = scene.endSec - scene.startSec;
    args.push('-loop', '1', '-t', String(duration), '-i', sceneImagePaths[i]);
  }

  // TTS audio input (index = scenes.length)
  const ttsInputIdx = spec.scenes.length;
  args.push('-i', ttsAudioPath);

  // Optional background music input (index = scenes.length + 1)
  let musicInputIdx: number | undefined;
  if (musicPath) {
    musicInputIdx = spec.scenes.length + 1;
    args.push('-stream_loop', '-1', '-i', musicPath);
  }

  // --- Filtergraph ---
  const filterParts: string[] = [];

  // Process each scene: scale + zoompan + optional drawtext
  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    const duration = scene.endSec - scene.startSec;
    const durationFrames = Math.ceil(duration * fps);

    const zoompanDir = scene.zoomDirection ?? 'in';
    const zoompanFilter = buildZoompanFilter(zoompanDir, durationFrames, width, height);

    let sceneFilters = `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},${zoompanFilter},setpts=PTS-STARTPTS`;

    // Add text overlay if present
    if (scene.overlayText) {
      const drawtextFilter = buildDrawtextFilter(
        scene.overlayText,
        scene.overlayPosition ?? 'bottom',
        width,
        height
      );
      sceneFilters += `,${drawtextFilter}`;
    }

    sceneFilters += `[scene${i}]`;
    filterParts.push(sceneFilters);
  }

  // Concatenate all scene video streams
  const concatInputs = spec.scenes.map((_, i) => `[scene${i}]`).join('');
  filterParts.push(`${concatInputs}concat=n=${spec.scenes.length}:v=1:a=0[vraw]`);

  // Burn ASS captions if provided
  if (assPath) {
    // Use the subtitles filter which handles paths more reliably across platforms
    filterParts.push(`[vraw]subtitles=filename=${escapeFilterPath(assPath)}[v]`);
  } else {
    filterParts.push(`[vraw]null[v]`);
  }

  // Audio: TTS + optional music mix
  if (musicInputIdx !== undefined) {
    const musicVol = Math.min(Math.max(spec.backgroundMusicVolume ?? 0.15, 0), 1);
    filterParts.push(`[${ttsInputIdx}:a]anull[voice]`);
    filterParts.push(`[${musicInputIdx}:a]volume=${musicVol}[bed]`);
    filterParts.push(`[voice][bed]amix=inputs=2:duration=first:normalize=0[a]`);
  } else {
    filterParts.push(`[${ttsInputIdx}:a]anull[a]`);
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[v]', '-map', '[a]');

  // Encoding settings (match existing pipeline)
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '19',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    outPath
  );

  return args;
}
