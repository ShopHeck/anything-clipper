// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildFfmpegArgs } from './ffmpeg';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const realFightFixture = process.env.REAL_FIGHT_FIXTURE;
const workDir = mkdtempSync(path.join(os.tmpdir(), 'real-fight-render-'));
const output = path.join(workDir, 'output.mp4');

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe.skipIf(!realFightFixture || !existsSync(realFightFixture))(
  'real fight render smoke',
  () => {
    it('reframes genuine fight footage into a vertical sponsor deliverable', () => {
      const probe = JSON.parse(
        execFileSync(
          FFPROBE,
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', realFightFixture!],
          { encoding: 'utf8' }
        )
      );
      const duration = Number(probe.format.duration);
      expect(duration).toBeGreaterThan(0.5);

      const args = buildFfmpegArgs({
        spec: {
          sourceUrl: realFightFixture!,
          startSec: 0,
          endSec: Math.min(duration, 4),
          aspect: '9:16',
          sourceHasAudio: false,
          loudnessNormalize: false,
        },
        trimmedCuts: [],
        outputDurationSec: Math.min(duration, 4),
        assPath: null,
        outPath: output,
      });
      execFileSync(FFMPEG, args);
      const rendered = JSON.parse(
        execFileSync(
          FFPROBE,
          ['-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', output],
          { encoding: 'utf8' }
        )
      );
      expect(rendered.streams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codec_name: 'h264', width: 1080, height: 1920 }),
        ])
      );
    }, 30_000);
  }
);
