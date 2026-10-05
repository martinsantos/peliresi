import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudEnvironment } from './safety.ts';

type NativeNode = Record<string, string>;
/** Refuse unknown OS dumps rather than interpreting a missing signal as hidden. */
export function nativeKeyboardShown(dump: string): boolean {
  const states = [...dump.matchAll(/\bmInputShown=(true|false)\b/g)];
  assert.equal(states.length, 1, 'Require one current Android input-method visibility signal');
  return states[0][1] === 'true';
}
const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export function nativeNodes(xml: string): NativeNode[] {
  assert.match(xml, /<hierarchy\b/);
  assert.match(xml, /<\/hierarchy>\s*$/);
  return [...xml.matchAll(/<node\b[^>]*>/g)].map(match => Object.fromEntries(
    [...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], decode(attribute[2])]),
  ));
}
export function chromeButtonPoint(xml: string, text: string): { x: number; y: number } {
  const matches = nativeNodes(xml).filter(node => node.package === 'com.android.chrome'
    && node.text === text && node.enabled === 'true' && node.clickable === 'true');
  assert.equal(matches.length, 1, 'Tap only one currently observed native Chrome button: ' + text);
  const bounds = matches[0].bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  assert.ok(bounds, 'Native bounds must be present, never guessed');
  const [left, top, right, bottom] = bounds.slice(1).map(Number);
  assert.ok(right > left && bottom > top, 'Never tap a zero-area or inverted native node');
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) };
}
const PIXEL_LAUNCHER_ANR = "Pixel Launcher isn't responding";
export function pixelLauncherAnrClosePoint(xml: string): { x: number; y: number } | null {
  const nodes = nativeNodes(xml);
  const titles = nodes.filter(node => node.package === 'android' && node['resource-id'] === 'android:id/alertTitle');
  if (!titles.some(node => node.text === PIXEL_LAUNCHER_ANR)) return null;
  assert.equal(titles.length, 1, 'Never dismiss an ambiguous Android error dialog');
  const buttons = nodes.filter(node => node.package === 'android' && node['resource-id'] === 'android:id/aerr_close'
    && node.text === 'Close app' && node.enabled === 'true' && node.clickable === 'true');
  assert.equal(buttons.length, 1, 'Pixel Launcher recovery requires one observed system Close app button');
  const bounds = buttons[0].bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  assert.ok(bounds, 'Native ANR bounds must be present, never guessed');
  const [left, top, right, bottom] = bounds.slice(1).map(Number);
  assert.ok(right > left && bottom > top, 'Never tap zero-area or inverted ANR bounds');
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) };
}
type NativeCommand = (args: string[], timeout: number) => Promise<string>;
const execute = promisify(execFile);

/** Collect one fresh dump without blocking CDP and the Android ADB poll. */
export async function collectNativeWindow(run: NativeCommand): Promise<string> {
  const file = '/data/local/tmp/sitrep-cloud-qa-window.xml';
  const started = Date.now();
  try {
    const message = await run(['shell', 'uiautomator', 'dump', file], 20000);
    assert.ok(message.includes('UI hierchary dumped to: ' + file) && !message.includes('ERROR:'),
      'Native UI dump did not confirm a fresh window: ' + message.trim());
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: string | number; signal?: string; killed?: boolean };
    // Run89 emitted a dump acknowledgement but exited unsuccessfully. Keep the
    // strict failure and record why; stdout alone never authorizes an XML read.
    const diagnostic = { code: failure.code ?? null, signal: failure.signal ?? null,
      killed: failure.killed ?? false, elapsedMs: Date.now() - started };
    throw new Error('Native UI dump failed: ' + failure.message + '\nNative command diagnostic: '
      + JSON.stringify(diagnostic) + '\n' + (failure.stdout || '') + (failure.stderr || ''));
  }
  const xml = await run(['shell', 'cat', file], 5000);
  nativeNodes(xml);
  return xml;
}
export async function readNativeWindow(): Promise<string> {
  assertCloudEnvironment();
  return collectNativeWindow(async (args, timeout) => (await execute('adb', args, { encoding: 'utf8', timeout })).stdout);
}
export async function dismissObservedChromePrompts(output: string): Promise<void> {
  // Do not mix a long-running Playwright UIAutomator instrumentation with the
  // one-shot native dump: run7 reproduced tap timeout, dump failures and hanging
  // teardown. ADB taps use bounds from fresh OS evidence, not guessed coordinates.
  let xml = await readNativeWindow();
  await writeFile(path.join(output, 'native-window-latest.xml'), xml);
  const launcherClose = pixelLauncherAnrClosePoint(xml);
  if (launcherClose) {
    await writeFile(path.join(output, 'native-Pixel-Launcher-ANR-before.xml'), xml);
    execFileSync('adb', ['shell', 'input', 'tap', String(launcherClose.x), String(launcherClose.y)], { timeout: 5000 });
    xml = await readNativeWindow();
    await writeFile(path.join(output, 'native-Pixel-Launcher-ANR-after.xml'), xml);
    assert.ok(!nativeNodes(xml).some(node => node.package === 'android' && node.text === PIXEL_LAUNCHER_ANR),
      'Observed Pixel Launcher ANR must actually disappear after Close app');
    console.log('Recovered observed emulator Pixel Launcher ANR; application ANRs are never dismissed');
  }
  for (const [title, button] of [['Chrome notifications make things easier', 'No thanks'], ['Running in Chrome', 'Got it']]) {
    if (!nativeNodes(xml).some(node => node.package === 'com.android.chrome' && node.text === title)) continue;
    await writeFile(path.join(output, 'native-' + button.replaceAll(' ', '-') + '-before.xml'), xml);
    const point = chromeButtonPoint(xml, button);
    execFileSync('adb', ['shell', 'input', 'tap', String(point.x), String(point.y)], { timeout: 5000 });
    xml = await readNativeWindow();
    await writeFile(path.join(output, 'native-' + button.replaceAll(' ', '-') + '-after.xml'), xml);
    assert.ok(!nativeNodes(xml).some(node => node.package === 'com.android.chrome' && node.text === title),
      'Observed native prompt must actually close after the tap');
    console.log('Dismissed observed native Chrome prompt: ' + title);
  }
}
