// Executes a render job end-to-end: builds the ffmpeg plan from the stored
// spec, runs ffmpeg with live progress written back to the DB, uploads the
// MP4 to object storage, and stamps clips.rendered_url for publishing.
import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sql from '@/app/api/utils/sql';
import { presignDownload, presignUpload, storageConfigured } from '@/app/api/utils/storage';
import { buildAss, groupWordsIntoLines } from '@/lib/captions/ass';
import { getCaptionTemplate } from '@/lib/captions/templates';
import { analyzeReframe } from '@/lib/clip/reframe-analyze';
import { buildFfmpegArgs } from './ffmpeg';
import { mapWordsToOutput, normalizeCuts, outputDuration, sourceToOutputTime } from './time';
import { ASPECT_DIMENSIONS, RenderSpec } from './types';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

export interface RenderResult {
  status: 'completed' | 'failed';
  outputKey?: string;
  outputPath?: string;
  error?: string;
}

async function uploadToStorage(localPath: string, key: string): Promise<void> {
  const body = await readFile(localPath);
  const res = await fetch(presignUpload(key, 3600), {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Storage upload failed (${res.status})`);
  }
}

function runFfmpeg(
  args: string[],
  totalDurationSec: number,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; stderrTail: string }> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrTail = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      // -progress pipe:1 emits key=value lines; out_time_us tracks output position.
      const m = /out_time_us=(\d+)/.exec(chunk.toString());
      if (m && totalDurationSec > 0) {
        const pct = Math.min(99, Math.round((Number(m[1]) / 1e6 / totalDurationSec) * 100));
        onProgress(pct);
      }
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2000);
    });
    proc.on('error', (err) => {
      resolve({ ok: false, stderrTail: `${err.message}\n${stderrTail}` });
    });
    proc.on('close', (code) => {
      resolve({ ok: code === 0, stderrTail });
    });
  });
}

export async function processRenderJob(jobId: string): Promise<RenderResult> {
  const [job] = await sql`
    SELECT id, user_id, project_id, clip_id, spec, status
    FROM render_jobs WHERE id = ${jobId}
  `;
  if (!job) return { status: 'failed', error: 'Job not found' };
  if (job.status === 'completed') return { status: 'completed', outputKey: job.output_key };
  if (job.status === 'processing') return { status: 'failed', error: 'Job already processing' };

  await sql`
    UPDATE render_jobs SET status = 'processing', progress = 0, started_at = NOW(), error_msg = NULL
    WHERE id = ${jobId}
  `;
  if (job.clip_id) {
    await sql`
      UPDATE clips SET render_status = 'processing'
      WHERE id = ${job.clip_id} AND project_id = ${job.project_id}
    `;
  }

  const spec = job.spec as RenderSpec;
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'render-'));
  const outPath = path.join(workDir, 'output.mp4');

  try {
    const cuts = normalizeCuts(spec.cuts ?? [], spec.startSec, spec.endSec);
    // Global speed compresses the post-cut output time domain; caption words
    // and crop/zoom keyframes are divided by it so they stay in sync with the
    // sped-up video (ffmpeg applies the matching setpts/atempo).
    const speed = spec.speed && spec.speed > 0 ? spec.speed : 1;
    const durationSec = outputDuration(spec.startSec, spec.endSec, cuts) / speed;
    if (durationSec < 0.5) {
      throw new Error('Nothing left to render — the clip range minus cuts is empty.');
    }

    // Captions → ASS file (word times mapped into output time, then sped up).
    let assPath: string | null = null;
    if (spec.captions && spec.captions.words.length > 0) {
      const outputWords = mapWordsToOutput(
        spec.captions.words,
        spec.startSec,
        spec.endSec,
        cuts
      ).map((w) => ({ text: w.text, start: w.start / speed, end: w.end / speed }));
      if (outputWords.length > 0) {
        const [width, height] = ASPECT_DIMENSIONS[spec.aspect];
        // Brand kit can override the caption highlight color.
        const baseTemplate = getCaptionTemplate(spec.captions.templateId);
        const template = spec.brand?.captionColor
          ? { ...baseTemplate, highlightColor: spec.brand.captionColor }
          : baseTemplate;
        const ass = buildAss(groupWordsIntoLines(outputWords), {
          template,
          playResX: width,
          playResY: height,
          position: spec.captions.position,
        });
        assPath = path.join(workDir, 'captions.ass');
        await writeFile(assPath, ass, 'utf8');
      }
    }

    // Reframe/zoom keyframes are stored in source time; shift them into
    // output time so they line up after trims and cuts.
    const shiftKeyframes = <K extends { t: number }>(kfs: K[] | undefined): K[] =>
      (kfs ?? [])
        .map((k) => {
          const t = sourceToOutputTime(k.t, spec.startSec, cuts);
          return t === null ? null : { ...k, t: t / speed };
        })
        .filter((k): k is K => k !== null);

    // Active-speaker auto-reframe: only when opted in and the caller didn't
    // pass explicit crop keyframes — keeps default center-crop unchanged.
    let cropKeyframes = spec.cropKeyframes;
    if (spec.autoReframe && (!cropKeyframes || cropKeyframes.length === 0)) {
      try {
        await sql`UPDATE render_jobs SET progress = 2 WHERE id = ${jobId}`.catch(() => {});
        cropKeyframes = await analyzeReframe({
          ffmpegPath: FFMPEG,
          sourceUrl: spec.sourceUrl,
          startSec: spec.startSec,
          endSec: spec.endSec,
        });
      } catch (err) {
        console.error('Auto-reframe analysis failed; using center crop:', err);
      }
    }

    const args = buildFfmpegArgs({
      spec: {
        ...spec,
        cropKeyframes: shiftKeyframes(cropKeyframes),
        zoomKeyframes: shiftKeyframes(spec.zoomKeyframes),
      },
      trimmedCuts: cuts.map((c) => ({
        start: c.start - spec.startSec,
        end: c.end - spec.startSec,
      })),
      outputDurationSec: durationSec,
      assPath,
      outPath,
    });

    let lastWritten = 0;
    const result = await runFfmpeg(args, durationSec, (pct) => {
      // Throttle DB writes to ~1 per 5% step.
      if (pct - lastWritten >= 5) {
        lastWritten = pct;
        sql`UPDATE render_jobs SET progress = ${pct} WHERE id = ${jobId}`.catch(() => {});
      }
    });

    if (!result.ok) {
      throw new Error(`ffmpeg failed: ${result.stderrTail.slice(-500) || 'unknown error'}`);
    }

    if (storageConfigured()) {
      const outputKey = `renders/${job.user_id}/${jobId}.mp4`;
      await uploadToStorage(outPath, outputKey);
      const renderedUrl = presignDownload(outputKey);

      await sql`
        UPDATE render_jobs SET status = 'completed', progress = 100,
          output_key = ${outputKey}, completed_at = NOW()
        WHERE id = ${jobId}
      `;
      if (job.clip_id) {
        await sql`
          UPDATE clips SET rendered_url = ${renderedUrl}, render_status = 'completed'
          WHERE id = ${job.clip_id} AND project_id = ${job.project_id}
        `;
      }
      await rm(workDir, { recursive: true, force: true });
      return { status: 'completed', outputKey };
    }

    // No object storage configured (dev): keep the file locally and let the
    // download route stream it. Publishing still requires storage.
    const keepPath = path.join(os.tmpdir(), `render-output-${jobId}.mp4`);
    await copyFile(outPath, keepPath);
    await rm(workDir, { recursive: true, force: true });
    await sql`
      UPDATE render_jobs SET status = 'completed', progress = 100,
        output_path = ${keepPath}, completed_at = NOW()
      WHERE id = ${jobId}
    `;
    if (job.clip_id) {
      await sql`
        UPDATE clips SET render_status = 'completed'
        WHERE id = ${job.clip_id} AND project_id = ${job.project_id}
      `;
    }
    return { status: 'completed', outputPath: keepPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    await sql`
      UPDATE render_jobs SET status = 'failed', error_msg = ${msg.slice(0, 600)} WHERE id = ${jobId}
    `;
    if (job.clip_id) {
      await sql`
        UPDATE clips SET render_status = 'failed'
        WHERE id = ${job.clip_id} AND project_id = ${job.project_id}
      `;
    }
    return { status: 'failed', error: msg };
  }
}
