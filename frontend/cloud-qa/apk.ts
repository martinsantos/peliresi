import { _android as android, type BrowserContext, type Page } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';
import { dismissObservedChromePrompts, nativeNodes, readNativeWindow } from './native-window.ts';

await assertCloudDatabase();
const output = path.join(process.env.QA_ARTIFACTS!, 'apk');
await mkdir(output, { recursive: true });
const pkg = 'ar.com.ultimamilla.sitrep';
const activity = pkg + '/ar.com.ultimamilla.sitrep.LauncherActivity';
const transfer = path.join(process.env.RUNNER_TEMP!, 'sitrep-apk-transfer');
async function locateOriginal(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    assert.equal(entry.isSymbolicLink(), false);
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await locateOriginal(file));
    else if (entry.name === 'sitrep-original-candidate.apk') results.push(file);
  }
  return results;
}
const adb = (...args: string[]) => execFileSync('adb', args, { encoding: 'utf8', timeout: 45000 });
const results: Array<{ name: string; status: string; error?: string }> = [];
const attemptedWrites: string[] = [];
const pageErrors: string[] = [];
let context: BrowserContext | undefined;
let page: Page | undefined;
const devices = await android.devices();
assert.equal(devices.length, 1);
const device = devices[0];
device.setDefaultTimeout(25000);
const check = async (name: string, task: () => Promise<void>) => {
  try { await task(); results.push({ name, status: 'PASS' }); console.log('PASS signed APK ' + name); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'FAIL', error: message }); console.error('FAIL signed APK ' + name + ': ' + message);
    await device.screenshot({ path: path.join(output, name + '-FAIL.png') }).catch(() => {});
  }
};
const openOriginal = async () => {
  const launched = adb('shell', 'am', 'start', '-W', '-n', activity);
  assert.doesNotMatch(launched, /Error:|Exception/);
  // Activity launch may briefly retain a closing custom-tab target while the
  // native splash is foreground. Require the actual OS Chrome compositor, then choose a
  // live DOM target that has finished rendering the same login form.
  await expect.poll(() => nativeNodes(readNativeWindow()).some(node =>
    node['resource-id'] === 'com.android.chrome:id/compositor_view_holder'), { timeout: 45000 }).toBe(true);
  await expect.poll(async () => {
    const candidates = context!.pages().filter(item => !item.isClosed()
      && item.url().startsWith('https://sitrep.ultimamilla.com.ar/app/')).reverse();
    for (const candidate of candidates) {
      try {
        if (await candidate.getByLabel('Correo electrónico o CUIT').isVisible()) { page = candidate; return true; }
      } catch { /* A closing native custom tab is not the newly opened app. */ }
    }
    return false;
  }, { timeout: 40000 }).toBe(true);
  assert.ok(page);
  await expect(page.getByLabel('Correo electrónico o CUIT')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/SITREP/);
  assert.equal(new URL(page.url()).origin, 'https://sitrep.ultimamilla.com.ar');
  assert.equal(await page.evaluate(() => isSecureContext), true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await dismissObservedChromePrompts(output);
};
try {
  await check('original-signature-and-Android-installation', async () => {
    const originals = await locateOriginal(transfer);
    assert.equal(originals.length, 1, 'Exactly one unchanged signed candidate must be received');
    const candidate = originals[0];
    const bytes = await readFile(candidate);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256, '4200e6d857e3a161e15bcfd161c44b54fc76245d8e9f4e3a093f973b06ad4bf5');
    const signature = execFileSync(path.join(process.env.ANDROID_HOME!, 'build-tools/35.0.0/apksigner'),
      ['verify', '--verbose', '--print-certs', candidate], { encoding: 'utf8', timeout: 45000 });
    assert.match(signature, /14302500ef385b217b03efd82118bbb45c68de11930fc803cc500f020e08e1d7/);
    await writeFile(path.join(output, 'signature.txt'), signature);
    const installed = adb('install', '-r', candidate);
    assert.match(installed, /Success/);
    const metadata = adb('shell', 'dumpsys', 'package', pkg);
    assert.match(metadata, /versionCode=2\b/); assert.match(metadata, /versionName=1\.0\.0\b/);
    await writeFile(path.join(output, 'package.txt'), metadata);
    await writeFile(path.join(output, 'identity.json'), JSON.stringify({ sha256, package: pkg,
      versionName: '1.0.0', versionCode: 2, originalUnmodified: true, AndroidInstalled: true,
      physicallyInstalledVersionConfirmed: false }, null, 2));
  });
  await check('original-launch-public-login-brand-and-TLS', async () => {
    assert.ok(results.find(item => item.name === 'original-signature-and-Android-installation' && item.status === 'PASS'));
    context = await device.launchBrowser({ hasTouch: true, args: ['--no-first-run', '--no-default-browser-check'] });
    context.on('page', target => target.on('pageerror', error => pageErrors.push(error.message)));
    // Safety guard ONLY for anonymous production smoke. Synthetic functional
    // tests in android.ts do not intercept business APIs or fake any response.
    await context.route('https://sitrep.ultimamilla.com.ar/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        attemptedWrites.push(route.request().method() + ' ' + new URL(route.request().url()).pathname);
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    await openOriginal();
    const images = await page!.locator('img').evaluateAll(elements => elements.map(element => ({
      alt: element.alt, width: element.naturalWidth, complete: element.complete,
    })));
    expect(images.some(item => /Mendoza|SITREP/i.test(item.alt) && item.width > 0 && item.complete)).toBe(true);
    await page!.screenshot({ path: path.join(output, 'original-public-login.png') });
    await device.screenshot({ path: path.join(output, 'original-public-login-device.png') });
    const activities = adb('shell', 'dumpsys', 'activity', 'activities');
    await writeFile(path.join(output, 'launch-activities.txt'), activities);
    const nativeWindow = readNativeWindow();
    assert.equal(nativeWindow.includes('com.android.chrome:id/url_bar'), false, 'Original APK must launch as TWA, not a browser URL tab');
    assert.doesNotMatch(nativeWindow, /resource-id="com.android.chrome:id\/(?:toolbar|custom_tabs_toolbar|location_bar)"/);
    await writeFile(path.join(output, 'launch-window.xml'), nativeWindow);
    await writeFile(path.join(output, 'public-launch.json'), JSON.stringify({
      url: page!.url(), normalTLS: true, loggedIn: false, images,
      chromeUrlBarInNativeTree: nativeWindow.includes('com.android.chrome:id/url_bar'),
      chromeToolbarInNativeTree: /resource-id="com.android.chrome:id\/(?:toolbar|custom_tabs_toolbar|location_bar)"/.test(nativeWindow),
    }, null, 2));
  });
  await check('original-relaunch-after-app-process-stop', async () => {
    assert.ok(context);
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    adb('shell', 'am', 'force-stop', pkg);
    await openOriginal();
    await device.screenshot({ path: path.join(output, 'original-restarted-device.png') });
  });
  await check('anonymous-read-only-no-page-errors', async () => {
    assert.ok(page && new URL(page.url()).origin === 'https://sitrep.ultimamilla.com.ar', 'Public launch must actually have happened');
    expect(attemptedWrites).toEqual([]); expect(pageErrors).toEqual([]);
  });
} finally {
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ commit: process.env.GITHUB_SHA,
    installedOriginalCandidate: results[0]?.status === 'PASS', results, attemptedWrites, pageErrors,
    passed: results.filter(item => item.status === 'PASS').length,
    failed: results.filter(item => item.status === 'FAIL').length,
    limitations: ['Candidate in Downloads; installed version on human phone remains unknown',
      'Original APK production origin: anonymous read-only launch, not authenticated production writes',
      'Synthetic end-to-end uses Chrome on the same actual Android OS, not a modified or re-signed APK',
      'Emulator, not physical phone, microphone, noisy environment or battery validation'],
  }, null, 2));
  await context?.close().catch(() => {}); await device.close();
}
if (results.some(item => item.status === 'FAIL')) process.exitCode = 1;
