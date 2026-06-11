// End-to-end smoke test of the render plan against a real ffmpeg binary:
// trim + cut removal + animated crop/zoom + karaoke ASS captions + music
// mix. Generates synthetic media with lavfi so no fixtures are needed.
// Skipped automatically when ffmpeg is not installed.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildAss, groupWordsIntoLines } from '../captions/ass';
import { getCaptionTemplate } from '../captions/templates';
import { buildFfmpegArgs } from './ffmpeg';
import { mapWordsToOutput, normalizeCuts, outputDuration } from './time';
import { RenderSpec } from './types';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const hasFfmpeg = spawnSync(FFMPEG, ['-version'], { stdio: 'ignore' }).status === 0;

describe.skipIf(!hasFfmpeg)('render pipeline (ffmpeg smoke)', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'render-smoke-'));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('renders trim + cuts + crop keyframes + captions + music to MP4', () => {
    const sourcePath = path.join(dir, 'source.mp4');
    const musicPath = path.join(dir, 'music.mp3');
    const outPath = path.join(dir, 'out.mp4');
    const assPath = path.join(dir, 'captions.ass');

    execFileSync(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=20',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=20',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest',
      sourcePath,
    ]);
    execFileSync(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'sine=frequency=220:duration=5',
      musicPath,
    ]);

    const spec: RenderSpec = {
      sourceUrl: sourcePath,
      startSec: 2,
      endSec: 18,
      aspect: '9:16',
      cuts: [{ start: 6, end: 9 }],
      captions: {
        templateId: 'mrBeast',
        words: Array.from({ length: 30 }, (_, i) => ({
          text: `word${i}`,
          start: 2 + i * 0.5,
          end: 2 + (i + 1) * 0.5,
        })),
        position: 'bottom',
      },
      cropKeyframes: [
        { t: 0, x: 0.2 },
        { t: 16, x: 0.8 },
      ],
      zoomKeyframes: [
        { t: 2, scale: 1 },
        { t: 3, scale: 1.15 },
        { t: 4, scale: 1 },
      ],
      music: { url: musicPath, volume: 0.3 },
      loudnessNormalize: true,
    };

    const cuts = normalizeCuts(spec.cuts!, spec.startSec, spec.endSec);
    const expectedDuration = outputDuration(spec.startSec, spec.endSec, cuts); // 13s
    const outputWords = mapWordsToOutput(
      spec.captions!.words,
      spec.startSec,
      spec.endSec,
      cuts
    );
    writeFileSync(
      assPath,
      buildAss(groupWordsIntoLines(outputWords), {
        template: getCaptionTemplate('mrBeast'),
        playResX: 1080,
        playResY: 1920,
        position: 'bottom',
      })
    );

    const args = buildFfmpegArgs({
      spec,
      trimmedCuts: cuts.map((c) => ({
        start: c.start - spec.startSec,
        end: c.end - spec.startSec,
      })),
      outputDurationSec: expectedDuration,
      assPath,
      outPath,
    });

    const render = spawnSync(FFMPEG, args, { encoding: 'utf8', timeout: 240_000 });
    expect(render.status, render.stderr?.slice(-800)).toBe(0);

    const probe = JSON.parse(
      execFileSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-show_entries', 'stream=width,height,codec_name',
        '-of', 'json',
        outPath,
      ]).toString()
    );

    const video = probe.streams.find((s: { codec_name: string }) => s.codec_name === 'h264');
    expect(video).toBeTruthy();
    expect(video.width).toBe(1080);
    expect(video.height).toBe(1920);
    expect(probe.streams.some((s: { codec_name: string }) => s.codec_name === 'aac')).toBe(true);
    // 16s window minus the 3s cut ≈ 13s output.
    expect(Number(probe.format.duration)).toBeGreaterThan(12);
    expect(Number(probe.format.duration)).toBeLessThan(14);
  }, 300_000);

  it('halves output duration at 2x speed', () => {
    const sourcePath = path.join(dir, 'speed-src.mp4');
    const outPath = path.join(dir, 'speed-out.mp4');
    execFileSync(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=10',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest',
      sourcePath,
    ]);

    const spec: RenderSpec = {
      sourceUrl: sourcePath,
      startSec: 0,
      endSec: 10,
      aspect: '9:16',
      speed: 2,
    };

    const args = buildFfmpegArgs({
      spec,
      trimmedCuts: [],
      outputDurationSec: 5,
      assPath: null,
      outPath,
    });
    const render = spawnSync(FFMPEG, args, { encoding: 'utf8', timeout: 120_000 });
    expect(render.status, render.stderr?.slice(-800)).toBe(0);

    const probe = JSON.parse(
      execFileSync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', outPath,
      ]).toString()
    );
    // 10s at 2x ≈ 5s.
    expect(Number(probe.format.duration)).toBeGreaterThan(4.3);
    expect(Number(probe.format.duration)).toBeLessThan(5.7);
  }, 180_000);
});
