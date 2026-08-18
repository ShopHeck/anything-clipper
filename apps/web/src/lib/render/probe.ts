import { spawn } from 'node:child_process';

const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export function probeSourceHasAudio(sourceUrl: string): Promise<boolean> {
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
      resolve(value);
    };
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.on('error', () => finish(true));
    proc.on('close', (code) => finish(code === 0 ? stdout.trim().length > 0 : true));
  });
}
