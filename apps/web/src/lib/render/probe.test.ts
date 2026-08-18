// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { probeSourceHasAudio } from './probe';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const workDir = mkdtempSync(path.join(os.tmpdir(), 'audio-probe-'));
const silent = path.join(workDir, 'silent.mp4');
const audible = path.join(workDir, 'audible.mp4');

beforeAll(() => {
  execFileSync(FFMPEG, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=320x180:d=0.5',
    '-c:v',
    'libx264',
    silent,
  ]);
  execFileSync(FFMPEG, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=320x180:d=0.5',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=0.5',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    audible,
  ]);
});

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe('probeSourceHasAudio', () => {
  it('detects silent and audible source files', async () => {
    await expect(probeSourceHasAudio(silent)).resolves.toBe(false);
    await expect(probeSourceHasAudio(audible)).resolves.toBe(true);
  });

  it('fails open when the source cannot be probed', async () => {
    await expect(probeSourceHasAudio(path.join(workDir, 'missing.mp4'))).resolves.toBe(true);
  });
});
