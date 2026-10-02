import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudEnvironment } from './safety.ts';

type NativeNode = Record<string, string>;
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
export function readNativeWindow(): string {
  assertCloudEnvironment();
  const file = '/data/local/tmp/sitrep-cloud-qa-window.xml';
  try {
    execFileSync('adb', ['shell', 'uiautomator', 'dump', file], { encoding: 'utf8', timeout: 20000 });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error('Native UI dump failed: ' + failure.message + '\n' + (failure.stdout || '') + (failure.stderr || ''));
  }
  const xml = execFileSync('adb', ['shell', 'cat', file], { encoding: 'utf8', timeout: 5000 });
  nativeNodes(xml);
  return xml;
}
export async function dismissObservedChromePrompts(output: string): Promise<void> {
  // Do not mix a long-running Playwright UIAutomator instrumentation with the
  // one-shot native dump: run7 reproduced tap timeout, dump failures and hanging
  // teardown. ADB taps use bounds from fresh OS evidence, not guessed coordinates.
  let xml = readNativeWindow();
  await writeFile(path.join(output, 'native-window-latest.xml'), xml);
  for (const [title, button] of [['Chrome notifications make things easier', 'No thanks'], ['Running in Chrome', 'Got it']]) {
    if (!nativeNodes(xml).some(node => node.package === 'com.android.chrome' && node.text === title)) continue;
    await writeFile(path.join(output, 'native-' + button.replaceAll(' ', '-') + '-before.xml'), xml);
    const point = chromeButtonPoint(xml, button);
    execFileSync('adb', ['shell', 'input', 'tap', String(point.x), String(point.y)], { timeout: 5000 });
    xml = readNativeWindow();
    await writeFile(path.join(output, 'native-' + button.replaceAll(' ', '-') + '-after.xml'), xml);
    assert.ok(!nativeNodes(xml).some(node => node.package === 'com.android.chrome' && node.text === title),
      'Observed native prompt must actually close after the tap');
    console.log('Dismissed observed native Chrome prompt: ' + title);
  }
}
