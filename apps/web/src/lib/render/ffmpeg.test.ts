import { describe, expect, it } from 'vitest';
import { buildFfmpegArgs, piecewiseLinearExpr } from './ffmpeg';
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

  it('adds a sponsor logo inside the vertical safe area', () => {
    const args = buildFfmpegArgs({
      spec: {
        ...baseSpec,
        sponsor: {
          sponsorName: 'ACME Fight Gear',
          logoUrl: 'https://cdn.example.com/acme.png',
          placement: 'top-right',
          opacity: 0.85,
          safeAreaPercent: 8,
          accentColor: '#FFCC00',
          callToAction: 'Shop ACME',
        },
      },
      trimmedCuts: [],
      outputDurationSec: 60,
      assPath: null,
      outPath: '/tmp/out.mp4',
    });

    expect(args.join(' ')).toContain('-i https://cdn.example.com/acme.png');
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('overlay=x=W-w-86:y=154');
    expect(graph).toContain('colorchannelmixer=aa=0.85');
  });

  it('adds bounded silence for fight footage without an audio stream', () => {
    const args = buildFfmpegArgs({
      spec: { ...baseSpec, sourceHasAudio: false },
      trimmedCuts: [],
      outputDurationSec: 60,
      assPath: null,
      outPath: '/tmp/out.mp4',
    });

    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('anullsrc=channel_layout=stereo:sample_rate=48000');
    expect(graph).toContain('atrim=duration=60[a]');
    expect(graph).not.toContain('[0:a]');
  });

  it('keeps existing source and music input indexes when sponsor branding is added', () => {
    const args = buildFfmpegArgs({
      spec: {
        ...baseSpec,
        music: { url: 'https://example.com/track.mp3', volume: 0.2 },
        sponsor: {
          sponsorName: 'ACME',
          logoUrl: 'https://cdn.example.com/acme.png',
          placement: 'bottom-left',
          opacity: 1,
          safeAreaPercent: 8,
        },
      },
      trimmedCuts: [],
      outputDurationSec: 60,
      assPath: null,
      outPath: '/tmp/out.mp4',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('[1:a]volume=0.2[bed]');
    expect(graph).toContain('[2:v]');
  });
});
