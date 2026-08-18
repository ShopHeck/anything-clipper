// Translates a RenderSpec into ffmpeg arguments: trim, cut removal,
// aspect crop (with animated reframe/zoom keyframes), burned ASS captions,
// music mix, and loudness normalization — encoded to H.264 MP4.
//
// IMPORTANT: keyframe times passed here must already be in OUTPUT time
// (see lib/render/time.ts) because they are applied after cut removal.
import { ASPECT_DIMENSIONS, CutRange, RenderSpec } from './types';

export interface FfmpegPlan {
  args: string[];
  outputDurationSec: number;
}

// Piecewise-linear interpolation expression over `t` for filter params.
export function piecewiseLinearExpr(
  keyframes: Array<{ t: number; v: number }>,
  fallback: number
): string {
  const kfs = [...keyframes].sort((a, b) => a.t - b.t);
  if (kfs.length === 0) return String(fallback);
  if (kfs.length === 1) return String(kfs[0].v);

  // Innermost: hold last value after the final keyframe.
  let expr = String(kfs[kfs.length - 1].v);
  for (let i = kfs.length - 2; i >= 0; i--) {
    const a = kfs[i];
    const b = kfs[i + 1];
    const span = Math.max(b.t - a.t, 0.001);
    const segment = `(${a.v}+(${b.v}-${a.v})*(t-${a.t})/${span})`;
    expr = `if(lt(t\\,${b.t})\\,${segment}\\,${expr})`;
  }
  // Hold first value before the first keyframe.
  return `if(lt(t\\,${kfs[0].t})\\,${kfs[0].v}\\,${expr})`;
}

// select/aselect expression that drops the cut ranges. Cut times here are
// relative to the TRIMMED input (t=0 at spec.startSec) since trimming
// happens via input options.
function buildKeepExpr(cuts: CutRange[]): string {
  const betweens = cuts.map((c) => `between(t\\,${c.start}\\,${c.end})`).join('+');
  return `not(${betweens})`;
}

// Paths inside filtergraphs need ':' and '\' escaped.
function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

export interface BuildArgsInput {
  spec: RenderSpec;
  // Cut ranges normalized and shifted to trimmed-input time (start at 0).
  trimmedCuts: CutRange[];
  outputDurationSec: number;
  assPath: string | null;
  outPath: string;
}

export function buildFfmpegArgs(input: BuildArgsInput): string[] {
  const { spec, trimmedCuts, assPath, outPath } = input;
  const [width, height] = ASPECT_DIMENSIONS[spec.aspect];
  const fps = spec.fps ?? 30;
  const targetRatio = (width / height).toFixed(6);

  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1'];

  // Input 0: source, trimmed via input options (frame-accurate with re-encode).
  args.push('-ss', String(spec.startSec), '-t', String(spec.endSec - spec.startSec));
  args.push('-i', spec.sourceUrl);

  // Input 1 (optional): music bed.
  if (spec.music) {
    args.push('-stream_loop', '-1', '-i', spec.music.url);
  }
  const sponsorInputIndex = spec.sponsor?.logoUrl ? (spec.music ? 2 : 1) : null;
  if (spec.sponsor?.logoUrl) {
    args.push('-loop', '1', '-i', spec.sponsor.logoUrl);
  }

  const videoFilters: string[] = [];
  const audioFilters: string[] = [];

  if (trimmedCuts.length > 0) {
    const keep = buildKeepExpr(trimmedCuts);
    videoFilters.push(`select='${keep}'`, 'setpts=N/FRAME_RATE/TB');
    audioFilters.push(`aselect='${keep}'`, 'asetpts=N/SR/TB');
  }

  // Aspect crop sized off the source (iw/ih), with optional animated
  // horizontal reframe (cropKeyframes) and zoom punch-ins (zoomKeyframes).
  const zoomExpr =
    spec.zoomKeyframes && spec.zoomKeyframes.length > 0
      ? piecewiseLinearExpr(
          spec.zoomKeyframes.map((k) => ({ t: k.t, v: k.scale })),
          1
        )
      : '1';
  const xCenterExpr =
    spec.cropKeyframes && spec.cropKeyframes.length > 0
      ? piecewiseLinearExpr(
          spec.cropKeyframes.map((k) => ({ t: k.t, v: k.x })),
          0.5
        )
      : '0.5';

  const cropW = `min(iw\\,ih*${targetRatio})/(${zoomExpr})`;
  const cropH = `min(ih\\,iw/${targetRatio})/(${zoomExpr})`;
  videoFilters.push(`crop=w='${cropW}':h='${cropH}':x='(iw-ow)*(${xCenterExpr})':y='(ih-oh)/2'`);
  videoFilters.push(`scale=${width}:${height}`, 'setsar=1', `fps=${fps}`);

  if (assPath) {
    videoFilters.push(`ass='${escapeFilterPath(assPath)}'`);
  }

  if (spec.sourceHasAudio !== false && spec.loudnessNormalize !== false) {
    audioFilters.push('loudnorm=I=-14:TP=-1.5:LRA=11');
  }

  const filterParts: string[] = [];
  if (sponsorInputIndex !== null && spec.sponsor) {
    const safeArea = (spec.sponsor.safeAreaPercent ?? 8) / 100;
    const marginX = Math.round(width * safeArea);
    const marginY = Math.round(height * safeArea);
    const maxLogoW = Math.round(width * 0.22);
    const opacity = Math.min(1, Math.max(0.25, spec.sponsor.opacity ?? 0.9));
    const placement = spec.sponsor.placement ?? 'top-right';
    const x = placement.endsWith('right') ? `W-w-${marginX}` : String(marginX);
    const y = placement.startsWith('bottom') ? `H-h-${marginY}` : String(marginY);
    filterParts.push(`[0:v]${videoFilters.join(',')}[basev]`);
    filterParts.push(
      `[${sponsorInputIndex}:v]scale=${maxLogoW}:-1:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=${opacity}[sponsorlogo]`
    );
    filterParts.push(`[basev][sponsorlogo]overlay=x=${x}:y=${y}:shortest=1[v]`);
  } else {
    filterParts.push(`[0:v]${videoFilters.join(',')}[v]`);
  }

  if (spec.music && spec.sourceHasAudio !== false) {
    const musicVol = Math.min(Math.max(spec.music.volume, 0), 1);
    filterParts.push(`[0:a]${audioFilters.join(',') || 'anull'}[voice]`);
    filterParts.push(`[1:a]volume=${musicVol}[bed]`);
    filterParts.push(`[voice][bed]amix=inputs=2:duration=first:normalize=0[a]`);
  } else if (spec.music) {
    const musicVol = Math.min(Math.max(spec.music.volume, 0), 1);
    filterParts.push(`[1:a]volume=${musicVol},atrim=duration=${input.outputDurationSec}[a]`);
  } else if (spec.sourceHasAudio === false) {
    filterParts.push(
      `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${input.outputDurationSec}[a]`
    );
  } else {
    filterParts.push(`[0:a]${audioFilters.join(',') || 'anull'}[a]`);
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[v]', '-map', '[a]');
  // No -shortest: the video and voice tracks are already bounded by the trim
  // window/cuts, and amix=duration=first caps the looped music bed to the
  // voice length. (-shortest + loudnorm + amix interact badly and truncate.)
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
    '-movflags',
    '+faststart',
    outPath
  );

  return args;
}
