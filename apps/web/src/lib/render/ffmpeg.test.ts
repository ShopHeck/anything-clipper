import { describe, expect, it } from 'vitest';
import { buildAtempoChain, buildFfmpegArgs, piecewiseLinearExpr } from './ffmpeg';
import { RenderSpec } from './types';

const baseSpec: RenderSpec = {
  sourceUrl: 'https://example.com/video.mp4',
  startSec: 10,
  endSec: 70,
  aspect: '9:16',
};

describe('piecewiseLinearExpr', () => {
  it('returns the fallback with no keyframes', () => {
    expect(piecewiseLinearExpr([], 0.5)).toBe('0.5');
  });

  it('holds a single keyframe value', () => {
    expect(piecewiseLinearExpr([{ t: 2, v: 0.3 }], 0.5)).toBe('0.3');
  });

  it('interpolates between keyframes', () => {
    const expr = piecewiseLinearExpr(
      [
        { t: 0, v: 0 },
        { t: 10, v: 1 },
      ],
      0.5
    );
    expect(expr).toContain('(0+(1-0)*(t-0)/10)');
    expect(expr).toContain('lt(t\\,10)');
  });
});

describe('buildAtempoChain', () => {
  it('uses a single atempo within the valid range', () => {
    expect(buildAtempoChain(1.5)).toEqual(['atempo=1.5000']);
  });

  it('chains atempo for speeds above 2x', () => {
    expect(buildAtempoChain(2.5)).toEqual(['atempo=2.0', 'atempo=1.2500']);
  });

  it('chains atempo for speeds below 0.5x', () => {
    expect(buildAtempoChain(0.25)).toEqual(['atempo=0.5', 'atempo=0.5000']);
  });
});

describe('buildFfmpegArgs', () => {
  it('trims via input options and encodes H.264 MP4', () => {
    const args = buildFfmpegArgs({
      spec: baseSpec,
      trimmedCuts: [],
      outputDurationSec: 60,
      assPath: null,
      outPath: '/tmp/out.mp4',
    });
    const joined = args.join(' ');
    expect(joined).toContain('-ss 10 -t 60 -i https://example.com/video.mp4');
    expect(joined).toContain('-c:v libx264');
    expect(joined).toContain('+faststart');
    expect(joined).toContain('scale=1080:1920');
    expect(args[args.length - 1]).toBe('/tmp/out.mp4');
  });

  it('adds select filters when cuts are present', () => {
    const args = buildFfmpegArgs({
      spec: baseSpec,
      trimmedCuts: [{ start: 5, end: 8 }],
      outputDurationSec: 57,
      assPath: null,
      outPath: '/tmp/out.mp4',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain("select='not(between(t\\,5\\,8))'");
    expect(graph).toContain('setpts=N/FRAME_RATE/TB');
    expect(graph).toContain("aselect='not(between(t\\,5\\,8))'");
  });

  it('burns ASS captions when provided', () => {
    const args = buildFfmpegArgs({
      spec: baseSpec,
      trimmedCuts: [],
      outputDurationSec: 60,
      assPath: '/tmp/captions.ass',
      outPath: '/tmp/out.mp4',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain("ass='/tmp/captions.ass'");
  });

  it('applies global speed via setpts and atempo', () => {
    const args = buildFfmpegArgs({
      spec: { ...baseSpec, speed: 1.5 },
      trimmedCuts: [],
      outputDurationSec: 40,
      assPath: null,
      outPath: '/tmp/out.mp4',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('setpts=PTS/1.5');
    expect(graph).toContain('atempo=1.5000');
  });

  it('omits speed filters at 1x', () => {
    const args = buildFfmpegArgs({
      spec: { ...baseSpec, speed: 1 },
      trimmedCuts: [],
      outputDurationSec: 60,
      assPath: null,
      outPath: '/tmp/out.mp4',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).not.toContain('atempo');
    expect(graph).not.toContain('PTS/');
  });

  it('mixes a music bed at the requested volume', () => {
    const args = buildFfmpegArgs({
      spec: { ...baseSpec, music: { url: 'https://example.com/track.mp3', volume: 0.3 } },
      trimmedCuts: [],
      outputDurationSec: 60,
      assPath: null,
      outPath: '/tmp/out.mp4',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(args.join(' ')).toContain('-stream_loop -1 -i https://example.com/track.mp3');
    expect(graph).toContain('volume=0.3[bed]');
    expect(graph).toContain('amix=inputs=2:duration=first:normalize=0');
  });
});
