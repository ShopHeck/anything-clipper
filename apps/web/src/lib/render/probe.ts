import { spawn } from 'node:child_process';

const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
export const DEFAULT_AUDIO_PROBE_TIMEOUT_MS = 8_000;

export function probeSourceHasAudio(
  sourceUrl: string,
  timeoutMs = DEFAULT_AUDIO_PROBE_TIMEOUT_MS
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(FFPROBE, [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=index',
      '-of',
      'csv=p=0',
      sourceUrl,
    ]);
    let stdout = '';
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!proc.killed) proc.kill('SIGKILL');
      resolve(value);
    };
    const timer = setTimeout(() => finish(true), Math.max(1, timeoutMs));
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString().slice(0, 256);
    });
    proc.on('error', () => finish(true));
    proc.on('close', (code) => finish(code === 0 ? stdout.trim().length > 0 : true));
  });
}
