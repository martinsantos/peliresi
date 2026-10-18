import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { chromeButtonPoint, chromeScrollGesture, nativeKeyboardShown, readNativeWindow } from './native-window.ts';
import { dismissObservedKeyboard } from './apk-keyboard.ts';
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
  const output = path.join(process.env.QA_ARTIFACTS!, 'apk');
  const url = page.url();
  const readKeyboard = async () => execFileSync('adb', ['shell', 'dumpsys', 'input_method'], { encoding: 'utf8', timeout: 5000 });
  const keyboard = await dismissObservedKeyboard(readKeyboard, async () => {
    execFileSync('adb', ['shell', 'input', 'keyevent', 'KEYCODE_BACK'], { timeout: 5000 });
  }, async () => { await expect.poll(async () => nativeKeyboardShown(await readKeyboard())).toBe(false); });
  assert.equal(page.url(), url, 'Closing the keyboard must not navigate away from the form');
  await writeFile(path.join(output, evidence + '-keyboard.json'), JSON.stringify(keyboard, null, 2));
  await button.scrollIntoViewIfNeeded();
  const reachable = () => button.evaluate(element => {
    const r = element.getBoundingClientRect(), viewport = visualViewport;
    return r.width > 0 && r.height > 0 && r.top >= (viewport?.offsetTop || 0)
      && r.bottom <= (viewport ? viewport.offsetTop + viewport.height : innerHeight)
      && element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  const geometry = async (stage: string) => writeFile(path.join(output, `${evidence}-${stage}-geometry.json`), JSON.stringify(await button.evaluate(element => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    const ancestors = []; let p: Element | null = element;
    while (p) { const s=getComputedStyle(p); const box=p.getBoundingClientRect(); ancestors.push({tag:p.tagName,class:p.className,top:box.top,bottom:box.bottom,height:box.height,client:p.clientHeight,scroll:p.scrollHeight,scrollTop:p.scrollTop,overflow:s.overflowY,touch:s.touchAction}); p=p.parentElement; }
    return {button:{x:r.x,y:r.y,width:r.width,height:r.height},hit:hit?.outerHTML.slice(0,600),viewport:visualViewport?{height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null,innerHeight,ancestors};
  }), null, 2));
  await geometry('before-scroll');
  // CDP layout scrolling on this TWA did not move the Android visual surface.
  // Use bounded, ordinary touch scrolling; never force a covered button.
  for (let attempt = 0; attempt < 3 && !await reachable(); attempt++) {
    const observed = await readNativeWindow();
    const gesture = chromeScrollGesture(observed);
    await writeFile(path.join(output, `${evidence}-scroll-${attempt}.xml`), observed);
    execFileSync('adb', ['shell', 'input', 'swipe', String(gesture.x), String(gesture.fromY), String(gesture.x), String(gesture.toY), '350'], { timeout: 5000 });
    await geometry(`after-scroll-${attempt}`);
  }
  await expect.poll(reachable).toBe(true);
  const xml = await readNativeWindow();
  const point = chromeButtonPoint(xml, label);
  await page.screenshot({ path: path.join(output, evidence + '-visible-submit.png') });
  await writeFile(path.join(output, evidence + '-native-submit.xml'), xml);
  await writeFile(path.join(output, evidence + '-native-submit.json'), JSON.stringify({
    input: 'Android OS tap at fresh accessibility bounds', label, point, keyboardDismissed: keyboard.dismissed,
  }, null, 2));
  execFileSync('adb', ['shell', 'input', 'tap', String(point.x), String(point.y)], { timeout: 5000 });
}
