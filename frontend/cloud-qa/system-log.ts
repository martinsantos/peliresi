import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudEnvironment } from './safety.ts';

/** Diagnostic tail only: a fixed byte cap, not an unbounded zombie collector. */
export class LogTail {
  private bytes = Buffer.alloc(0);
  total = 0;
  readonly maximum: number;
  constructor(maximum: number) {
    assert.ok(Number.isInteger(maximum) && maximum > 0 && maximum <= 2 * 1024 * 1024);
    this.maximum = maximum;
  }
  add(chunk: Buffer | string): void {
    const data = Buffer.from(chunk); this.total += data.length;
    this.bytes = Buffer.concat([this.bytes, data.subarray(-this.maximum)]).subarray(-this.maximum);
  }
  snapshot() {
    return { text: this.bytes.toString('utf8'), totalBytes: this.total,
      retainedBytes: this.bytes.length, truncated: this.total > this.bytes.length };
  }
}

/** Observe the cloud device from first launch through cleanup; never restart it. */
export async function startSystemLog(output: string): Promise<() => Promise<void>> {
  assertCloudEnvironment();
  const started = new Date().toISOString();
  const stdout = new LogTail(2 * 1024 * 1024), stderr = new LogTail(16 * 1024);
  const child = spawn('adb', ['logcat', '-b', 'main', '-b', 'system', '-b', 'crash', '-v', 'threadtime', '*:I'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  const errors: string[] = [];
  child.stdout.on('data', chunk => stdout.add(chunk));
  child.stderr.on('data', chunk => stderr.add(chunk));
  const closed = new Promise<{ code: number | null; signal: string | null }>(resolve => {
    child.on('error', error => errors.push(error.message));
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  let stopped = false;
  return async () => {
    assert.equal(stopped, false, 'Stop each owned collector once'); stopped = true;
    // Only our child handle is signalled. Never kill the ADB daemon or emulator.
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    let exit;
    try { exit = await closed; } finally { clearTimeout(timer); }
    const log = stdout.snapshot(), errorLog = stderr.snapshot();
    await writeFile(path.join(output, 'continuous-system-log.txt'), log.text);
    await writeFile(path.join(output, 'continuous-system-log.json'), JSON.stringify({
      started, stopped: new Date().toISOString(), ...exit, errors,
      totalBytes: log.totalBytes, retainedBytes: log.retainedBytes, truncated: log.truncated,
      stderr: errorLog, maximumBytes: stdout.maximum, diagnosticOnly: true,
    }, null, 2));
  };
}
