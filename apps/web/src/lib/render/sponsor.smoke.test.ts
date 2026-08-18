// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFfmpegArgs } from './ffmpeg';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const workDir = mkdtempSync(path.join(os.tmpdir(), 'sponsor-render-'));
const source = path.join(workDir, 'source.mp4');
const logo = path.join(workDir, 'logo.png');
const output = path.join(workDir, 'output.mp4');

beforeAll(() => {
  execFileSync(FFMPEG, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=640x360:rate=30:duration=2',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=220:sample_rate=48000:duration=2',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    source,
  ]);
  execFileSync(FFMPEG, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=#ffcc00:s=240x80',
    '-frames:v',
    '1',
    logo,
  ]);
});

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe('sponsor render smoke', () => {
  it('renders a branded vertical H.264/AAC MP4 end to end', () => {
    const args = buildFfmpegArgs({
      spec: {
        sourceUrl: source,
        startSec: 0,
        endSec: 2,
        aspect: '9:16',
        sponsor: {
          sponsorName: 'ACME',
          logoUrl: logo,
          placement: 'top-right',
          opacity: 0.85,
          safeAreaPercent: 8,
        },
      },
      trimmedCuts: [],
      outputDurationSec: 2,
      assPath: null,
      outPath: output,
    });
    execFileSync(FFMPEG, args);
    const probe = JSON.parse(
      execFileSync(
        FFPROBE,
        ['-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', output],
        { encoding: 'utf8' }
      )
    );
    expect(probe.streams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codec_name: 'h264', width: 1080, height: 1920 }),
        expect.objectContaining({ codec_name: 'aac' }),
      ])
    );
  }, 30_000);
});
