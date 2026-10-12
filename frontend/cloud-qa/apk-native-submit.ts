import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { chromeButtonPoint, readNativeWindow } from './native-window.ts';
import { assertCloudEnvironment } from './safety.ts';

/** One ordinary OS touch, located from fresh Android accessibility bounds.
 * Chrome128's experimental CDP touch may return without a DOM click while
 * the keyboard is open. Never call handlers or synthesize a server response.
 */
export async function tapApkSubmit(page: Page, evidence: string) {
  assertCloudEnvironment();
  assert.match(evidence, /^(TRANSPORTISTA|GENERADOR|OPERADOR)$/);
  const label = 'Presentar en expediente';
  const button = page.getByRole('button', { name: label, exact: true });
  await expect(button).toBeEnabled();
  await button.scrollIntoViewIfNeeded();
  await expect.poll(() => button.evaluate(element => {
    const r = element.getBoundingClientRect(), viewport = visualViewport;
    return r.width > 0 && r.height > 0 && r.top >= (viewport?.offsetTop || 0)
      && r.bottom <= (viewport ? viewport.offsetTop + viewport.height : innerHeight)
      && element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  const xml = await readNativeWindow();
  const point = chromeButtonPoint(xml, label);
  const output = path.join(process.env.QA_ARTIFACTS!, 'apk');
  await writeFile(path.join(output, evidence + '-native-submit.xml'), xml);
  await writeFile(path.join(output, evidence + '-native-submit.json'), JSON.stringify({
    input: 'Android OS tap at fresh accessibility bounds', label, point, keyboardNotDismissed: true,
  }, null, 2));
  execFileSync('adb', ['shell', 'input', 'tap', String(point.x), String(point.y)], { timeout: 5000 });
}
