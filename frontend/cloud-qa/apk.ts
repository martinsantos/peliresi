import { _android as android, type BrowserContext, type Page } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment } from './safety.ts';
import { dismissObservedChromePrompts, nativeNodes, readNativeWindow } from './native-window.ts';
import { apkCredentials, apkRequestAllowed } from './apk-auth-policy.ts';
import { trainingCredentials, trainingRequestAllowed } from './apk-training-policy.ts';
import { trainingJourney } from './apk-training-journey.ts';
import { freezeCloudPlayStore, assertStableSystemPackages } from './system-packages.ts';
import { withinDeadline } from './deadline.ts';

const training = process.env.QA_APK_TRAINING === 'true';
if (training) assertCloudEnvironment(); else await assertCloudDatabase();
const output = path.join(process.env.QA_ARTIFACTS!, 'apk');
await mkdir(output, { recursive: true });
const packageBaseline = training ? freezeCloudPlayStore() : undefined;
if (training) {
  // android-run.ts previously provided this preparation before apk.ts.
  // A standalone run needs it too: Chrome ignores its temporary CDP socket
  // arguments without the debug-app setting on this Play Store emulator.
  // freezeCloudPlayStore above has already rejected physical/local devices.
  execFileSync('adb', ['shell', 'am', 'set-debug-app', '--persistent', 'com.android.chrome'], { timeout: 5000 });
  execFileSync('adb', ['shell', 'svc', 'power', 'stayon', 'true'], { timeout: 5000 });
}
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
const authenticated = process.env.QA_APK_AUTHENTICATED === 'true';
const credentials = authenticated ? (training ? trainingCredentials : apkCredentials)(process.env.QA_APK_CREDENTIALS) : undefined;
delete process.env.QA_APK_CREDENTIALS;
if (credentials) console.log('::add-mask::' + credentials.password);
const blockedRequests: Array<{ method: string; path: string }> = [];
let context: BrowserContext | undefined;
let page: Page | undefined;
const devices = await android.devices();
assert.equal(devices.length, 1);
const device = devices[0];
device.setDefaultTimeout(25000);
android.setDefaultTimeout(25000);
const check = async (name: string, task: () => Promise<void>) => {
  console.log('START signed APK ' + name);
  try { await task(); results.push({ name, status: 'PASS' }); console.log('PASS signed APK ' + name); }
  catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = credentials ? rawMessage.replaceAll(credentials.password, '[REDACTED]') : rawMessage;
    results.push({ name, status: 'FAIL', error: message }); console.error('FAIL signed APK ' + name + ': ' + message);
    await withinDeadline('APK failure screenshot', 5000, () =>
      device.screenshot({ path: path.join(output, name + '-FAIL.png') })).catch(() => {});
    if (training && page) {
      await withinDeadline('APK failure DOM', 5000, async () => {
        await writeFile(path.join(output, name + '-DOM.txt'), await page!.locator('body').ariaSnapshot());
        await writeFile(path.join(output, name + '-form.json'), JSON.stringify(await page!.locator('main input:invalid,main textarea:invalid,main select:invalid').evaluateAll(elements =>
          elements.map(el => ({ name: el.getAttribute('name'), label: el.getAttribute('aria-label'),
            message: (el as HTMLInputElement).validationMessage }))), null, 2));
      }).catch(() => {});
    }
  }
  await writeFile(path.join(output, 'progress.json'), JSON.stringify({ results, attemptedWrites, pageErrors }, null, 2));
};
const openOriginal = async (state: 'login' | 'authenticated' = 'login') => {
  const launched = adb('shell', 'am', 'start', '-W', '-n', activity);
  assert.doesNotMatch(launched, /Error:|Exception/);
  // Activity launch may briefly retain a closing custom-tab target while the
  // native splash is foreground. Require the actual OS Chrome compositor, then choose a
  // live DOM target that has finished rendering the same login form.
  await expect.poll(async () => {
    try {
      await dismissObservedChromePrompts(output);
      return nativeNodes(await readNativeWindow()).some(node=>node['resource-id']==='com.android.chrome:id/compositor_view_holder');
    } catch (error) {
      // The signed APK's launch splash temporarily has no accessibility root.
      // This is not a ready window: keep the same bounded readiness check,
      // never restart the app or treat missing native evidence as a pass.
      if (String(error).includes('null root node returned by UiTestAutomationBridge')) return false;
      throw error;
    }
  }, { timeout: 45000 }).toBe(true);
  await expect.poll(async () => {
    const candidates = context!.pages().filter(item => !item.isClosed()
      && item.url().startsWith('https://sitrep.ultimamilla.com.ar/app/')).reverse();
    for (const candidate of candidates) {
      try {
        if (state === 'login' ? await candidate.getByLabel('Correo electrónico o CUIT').isVisible()
          : !/\/login$/.test(candidate.url()) && await candidate.getByRole('banner').isVisible()) { page = candidate; return true; }
      } catch { /* A closing native custom tab is not the newly opened app. */ }
    }
    return false;
  }, { timeout: 40000 }).toBe(true);
  assert.ok(page);
  if (state === 'login') {
    await expect(page.getByLabel('Correo electrónico o CUIT')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  } else await expect(page.getByRole('banner')).toBeVisible();
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
    console.log('APK driver: attaching Chrome');
    context = await withinDeadline('APK Chrome attachment', 30000, () =>
      device.launchBrowser({ hasTouch: true, args: ['--no-first-run', '--no-default-browser-check'] }));
    context.setDefaultTimeout(25000);
    context.setDefaultNavigationTimeout(30000);
    console.log('APK driver: Chrome attached');
    context.on('page', target => target.on('pageerror', error => pageErrors.push(error.message)));
    // Production safety guard. Allowed responses are real, never mocked.
    // Synthetic functional tests in android.ts do not intercept business APIs.
    await context.route('https://sitrep.ultimamilla.com.ar/api/**', async route => {
      const request = route.request();
      const allowed = training && credentials ? trainingRequestAllowed(request.url(), request.method(), request.postData(), request.headers().authorization, credentials.id)
        : apkRequestAllowed(request.url(), request.method(), request.postData(), authenticated);
      if (!allowed) {
        const pathname = new URL(request.url()).pathname;
        blockedRequests.push({ method: request.method(), path: pathname });
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) attemptedWrites.push(request.method() + ' ' + pathname);
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
    const nativeWindow = await readNativeWindow();
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
  if (credentials && training) {
    await check('original-apk-training-roles-and-own-inspection-exchanges', async () => {
      assert.ok(page && context);
      await trainingJourney(page, credentials, async name => {
        await device.screenshot({ path: path.join(output, name + '-device.png') });
      }, async () => {
        adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
        adb('shell', 'am', 'force-stop', pkg);
        await openOriginal('authenticated');
        return page!;
      });
    });
    await check('training-no-operational-business-writes-or-page-errors', async () => {
      expect(attemptedWrites).toEqual([]); expect(pageErrors).toEqual([]);
      // Default selector reads operational users before its training tab is chosen.
      // Those reads are deliberately denied; never load real people into QA artifacts.
      expect(blockedRequests.every(r => r.method === 'GET')).toBe(true);
      assert.ok(packageBaseline);
      await writeFile(path.join(output, 'system-packages.json'), JSON.stringify(assertStableSystemPackages(packageBaseline), null, 2));
    });
  } else if (credentials) {
    await check('original-authenticated-login-own-identity', async () => {
      assert.ok(page && context);
      await page.getByLabel('Correo electrónico o CUIT').fill(credentials.email);
      await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
      const login = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login'
        && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).tap();
      const response = await login;
      assert.equal(response.status(), 200);
      const body = await response.json();
      assert.equal(body.data.user.id, credentials.id);
      assert.equal(body.data.user.rol, 'GENERADOR');
      for (const actor of ['generador', 'operador', 'transportista']) assert.equal(body.data.user[actor], null);
      await expect(page).not.toHaveURL(/\/login$/);
      await dismissObservedChromePrompts(output);
      await expect(page.getByRole('banner')).toBeVisible();
      const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
      await expect(welcome).toBeVisible({ timeout: 10000 });
      await welcome.tap();
      await expect(welcome).toHaveCount(0);
      await device.screenshot({ path: path.join(output, 'authenticated-own-dashboard-device.png') });
    });
    await check('original-authenticated-manifest-list-is-empty-and-reloads', async () => {
      assert.ok(results.some(item => item.name === 'original-authenticated-login-own-identity' && item.status === 'PASS'));
      const list = page!.waitForResponse(response => new URL(response.url()).pathname === '/api/manifiestos'
        && response.request().method() === 'GET');
      await page!.goto('https://sitrep.ultimamilla.com.ar/app/manifiestos');
      const response = await list; assert.equal(response.status(), 200);
      const body = await response.json();
      assert.ok(Array.isArray(body.data.manifiestos) && body.data.manifiestos.length === 0,
        'An actorless QA account must receive no manifests; do not save unexpected records');
      await expect(page!.getByText('No se encontraron manifiestos', { exact: true })).toBeVisible();
      await page!.reload();
      await expect(page!).toHaveURL(/\/app\/manifiestos$/);
      await expect(page!.getByText('No se encontraron manifiestos', { exact: true })).toBeVisible();
      await device.screenshot({ path: path.join(output, 'authenticated-own-empty-manifests-device.png') });
    });
    await check('original-authenticated-session-survives-apk-relaunch', async () => {
      assert.ok(results.some(item => item.name === 'original-authenticated-login-own-identity' && item.status === 'PASS'));
      adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
      adb('shell', 'am', 'force-stop', pkg);
      await openOriginal('authenticated');
      const identity = await page!.evaluate(async () => {
        const token = localStorage.getItem('sitrep_access_token');
        const response = await fetch('/api/auth/profile', { headers: { Authorization: 'Bearer ' + token } });
        const body = await response.json();
        return { status: response.status, id: body.data?.user?.id, role: body.data?.user?.rol };
      });
      assert.deepEqual(identity, { status: 200, id: credentials.id, role: 'GENERADOR' });
      const native = await readNativeWindow();
      assert.doesNotMatch(native, /resource-id="com.android.chrome:id\/(?:url_bar|toolbar|custom_tabs_toolbar|location_bar)"/);
      await device.screenshot({ path: path.join(output, 'authenticated-relaunched-device.png') });
    });
    await check('original-authenticated-logout-clears-session-and-protects-route', async () => {
      assert.ok(results.some(item => item.name === 'original-authenticated-login-own-identity' && item.status === 'PASS'));
      await page!.getByRole('button', { name: 'Abrir menu', exact: true }).tap();
      await page!.getByRole('button', { name: 'Cerrar Sesión', exact: true }).tap();
      await expect(page!).toHaveURL(/\/app\/login$/);
      assert.equal(await page!.evaluate(() => localStorage.getItem('sitrep_access_token')), null);
      await page!.goto('https://sitrep.ultimamilla.com.ar/app/manifiestos');
      await expect(page!).toHaveURL(/\/app\/login$/);
      await expect(page!.getByLabel('Correo electrónico o CUIT')).toBeVisible();
      await device.screenshot({ path: path.join(output, 'authenticated-logout-protected-device.png') });
    });
    await check('authenticated-no-business-writes-or-runtime-errors', async () => {
      expect(attemptedWrites).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(blockedRequests).toEqual([]);
    });
  }
} finally {
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ commit: process.env.GITHUB_SHA,
    installedOriginalCandidate: results[0]?.status === 'PASS', authenticated, training, results, attemptedWrites, blockedRequests, pageErrors,
    passed: results.filter(item => item.status === 'PASS').length,
    failed: results.filter(item => item.status === 'FAIL').length,
    limitations: ['Candidate in Downloads; installed version on human phone remains unknown',
      training ? 'Original APK training with exclusive temporary teacher: synthetic school replies only, no operational business mutations'
        : credentials ? 'Original APK authenticated with temporary GENERADOR account without actor: session and own empty list only; no business mutations'
        : 'Original APK production origin: anonymous read-only launch, not authenticated production writes',
      'Synthetic end-to-end uses Chrome on the same actual Android OS, not a modified or re-signed APK',
      'Emulator, not physical phone, microphone, noisy environment or battery validation'],
  }, null, 2));
  await withinDeadline('APK context cleanup', 5000, async () => { await context?.close(); }).catch(() => {});
  await withinDeadline('APK device cleanup', 5000, () => device.close()).catch(() => {});
}
if (results.some(item => item.status === 'FAIL')) process.exitCode = 1;
