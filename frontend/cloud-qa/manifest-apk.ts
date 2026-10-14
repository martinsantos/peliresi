/** Installed, separately identified APK against loopback only; no release credentials. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { _android, type Page } from 'playwright';
import { expect } from '@playwright/test';
import { assertCloudDatabase } from './safety.ts';
import { freezeCloudPlayStore, assertStableSystemPackages } from './system-packages.ts';
import { dismissObservedChromePrompts, nativeKeyboardShown, nativeNodes, readNativeWindow } from './native-window.ts';
import { readablePageHeading } from './e2e/helpers.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/tmp/sitrep-manifest-v2');
const output = path.join(process.env.QA_ARTIFACTS!, 'apk');
await mkdir(output, { recursive: true });
const baseline = freezeCloudPlayStore();
const pkg = 'ar.com.ultimamilla.sitrep.manifestqa';
const origin = 'http://127.0.0.1:4177';
const adb = (...args: string[]) => execFileSync('adb', args, { encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
assert.ok(!adb('shell', 'pm', 'list', 'packages', 'ar.com.ultimamilla.sitrep').includes('package:ar.com.ultimamilla.sitrep\n'));
assert.ok(!adb('shell', 'pm', 'list', 'packages', pkg).includes('package:' + pkg));
const candidate = path.join(process.env.RUNNER_TEMP!, 'sitrep-manifest-apk');
const apk = path.join(candidate, 'android/app/build/outputs/apk/debug/app-debug.apk');
const metadata = JSON.parse(await readFile(path.join(candidate, 'candidate.json'), 'utf8'));
assert.equal(metadata.package, pkg); assert.equal(metadata.launchOrigin, origin);
assert.equal(metadata.isolated, true); assert.equal(metadata.distributionAllowed, false);
const sdkTools = path.join(process.env.ANDROID_HOME!, 'build-tools');
const sdkVersion = (await readdir(sdkTools)).filter(v => /^\d+\.\d+\.\d+$/.test(v))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
assert.ok(sdkVersion);
const signature = execFileSync(path.join(sdkTools, sdkVersion, 'apksigner'),
  ['verify', '--verbose', '--print-certs', apk], { encoding: 'utf8', timeout: 15000 });
assert.match(signature, /Signer #1 certificate SHA-256 digest:/);
assert.doesNotMatch(signature, /14302500ef385b217b03efd82118bbb45c68de11930fc803cc500f020e08e1d7/);
await writeFile(path.join(output, 'signature.txt'), signature);
assert.match(adb('install', apk), /Success/);
await writeFile(path.join(output, 'package.txt'), adb('shell', 'dumpsys', 'package', pkg));
await writeFile(path.join(output, 'identity.json'), JSON.stringify({ ...metadata,
  sha256: createHash('sha256').update(await readFile(apk)).digest('hex'), installed: true }, null, 2));
adb('reverse', 'tcp:4177', 'tcp:4177');
adb('shell', 'am', 'set-debug-app', '--persistent', 'com.android.chrome');
adb('shell', 'svc', 'power', 'stayon', 'true');
const devices = await _android.devices();
assert.equal(devices.length, 1);
const device = devices[0]; device.setDefaultTimeout(25000);
const context = await device.launchBrowser({ hasTouch: true, args: ['--no-first-run', '--no-default-browser-check'] });
context.setDefaultTimeout(25000);
context.setDefaultNavigationTimeout(30000);
const errors: string[] = [], unsafe: string[] = [];
const mutations: Array<{ path: string; status: number }> = [];
const results: string[] = [];
let page: Page;
let manifestId = '';
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
  // No product host, secret or API can escape to production. Map tiles/fonts
  // may be read; all writes and every /api request must stay on QA loopback.
  if (/sitrep\.ultimamilla\.com\.ar|mendoza\.gov\.ar|23\.105\.176\.45/.test(url.hostname)
    || ((url.pathname.startsWith('/api/') || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) && url.origin !== origin)) {
    unsafe.push(request.method() + ' ' + url.origin + url.pathname); return route.abort('blockedbyclient');
  }
  return route.continue();
});
context.on('page', target => {
  target.on('pageerror', error => errors.push(error.message));
  target.on('crash', () => errors.push('Android page crash'));
  target.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === origin && url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(response.request().method())) {
      mutations.push({ path: url.pathname, status: response.status() });
    }
  });
});
async function launch(authenticated = false) {
  assert.doesNotMatch(adb('shell', 'am', 'start', '-W', '-n', pkg + '/.LauncherActivity'), /Error:|Exception/);
  await expect.poll(async () => {
    await dismissObservedChromePrompts(output);
    for (const target of context.pages().filter(p => !p.isClosed() && p.url().startsWith(origin + '/app/')).reverse()) {
      if (authenticated ? await target.getByRole('banner').isVisible() && !target.url().endsWith('/login')
        : await target.getByLabel('Correo electrónico o CUIT').isVisible()) { page = target; return true; }
    }
    return false;
  }, { timeout: 45000 }).toBe(true);
  assert.equal(new URL(page.url()).origin, origin);
}
async function proof(name: string) {
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (/\/(manifiestos|transporte\/viaje)\//.test(new URL(page.url()).pathname)) {
    const help = page.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true });
    await expect(help).toHaveCount(1);
    assert.ok(await help.evaluate(el => Boolean(el.closest('header'))), 'Help must not float over manifest actions');
    await readablePageHeading(page);
  }
  await page.screenshot({ path: path.join(output, name + '.png') });
  await dismissObservedChromePrompts(output);
  await device.screenshot({ path: path.join(output, name + '-device.png') });
  await writeFile(path.join(output, name + '-native.xml'), await readNativeWindow());
}
async function keyboard(shown: boolean, name: string) {
  let dump = '';
  await expect.poll(() => {
    dump = adb('shell', 'dumpsys', 'input_method'); return nativeKeyboardShown(dump);
  }, { timeout: 10000 }).toBe(shown);
  await writeFile(path.join(output, name + '-keyboard.txt'), dump);
}
async function hideKeyboard() {
  if (nativeKeyboardShown(adb('shell', 'dumpsys', 'input_method'))) adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
}
async function login(role: string) {
  await page.getByLabel('Correo electrónico o CUIT').fill(role + '@night-qa.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await hideKeyboard();
  const response = page.waitForResponse(r => r.url() === origin + '/api/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).tap();
  expect((await response).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
  await dismissObservedChromePrompts(output);
  const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  await expect(welcome).toBeVisible(); await welcome.tap();
  await expect(welcome).toHaveCount(0);
}
async function logout() {
  await hideKeyboard();
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).tap();
  await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).tap();
  await expect(page).toHaveURL(/\/app\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('sitrep_access_token'))).toBeNull();
}
async function choose(label: string, option: RegExp) {
  await page.getByRole('button', { name: label, exact: true }).tap();
  await page.getByRole('option', { name: option }).tap();
}
async function mutate(button: string, endpoint: string) {
  const response = page.waitForResponse(r => r.url() === origin + `/api/manifiestos/${manifestId}/${endpoint}` && r.request().method() === 'POST');
  await page.getByRole('button', { name: button, exact: true }).tap();
  expect((await response).status()).toBe(200);
}
try {
  await launch(); await proof('01-installed-login'); results.push('Installed isolated APK launches actual login');
  await login('admin');
  await page.goto(origin + '/app/manifiestos/nuevo');
  await choose('Generador *', /^QA Generador 1 /);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).tap();
  await choose('Tipo de Residuo *', /^Y1 - /);
  await page.getByLabel('Cantidad *', { exact: true }).tap();
  await keyboard(true, 'quantity');
  await page.getByLabel('Cantidad *', { exact: true }).fill('17');
  await hideKeyboard();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).tap();
  await choose('Transportista *', /^QA Transporte 1 /);
  await expect(page.getByRole('button', { name: 'Vehículo (opcional)', exact: true })).toHaveText(/Elegir vehículo/);
  await page.getByRole('button', { name: 'Vehículo (opcional)', exact: true }).tap();
  await keyboard(false, 'vehicle-open-no-keyboard');
  await expect(page.getByRole('option', { name: /QA-INACTIVO/ })).toHaveCount(0);
  await page.getByRole('option', { name: /^QA002ZZ/ }).tap();
  await choose('Chofer (opcional)', /^QA Segundo /);
  await choose('Operador / Destino *', /^QA Operador 1 /);
  await proof('02-explicit-assignment');
  const creation = page.waitForResponse(r => r.url() === origin + '/api/manifiestos' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).tap();
  const created = await creation; expect(created.status()).toBe(201);
  manifestId = (await created.json()).data.manifiesto.id;
  await expect(page).toHaveURL(new RegExp('/app/manifiestos/' + manifestId + '$'));
  await page.reload();
  await expect(page.getByText('QA002ZZ · QA Segundo', { exact: true })).toBeVisible();
  await page.getByText('QA Segundo', { exact: true }).scrollIntoViewIfNeeded();
  await proof('03-persisted-assignment'); results.push('Native keyboard and explicit assignment persist');
  // Stop only our APK, keep the shared Chrome profile. No uninstall, clear-data,
  // storage injection or signature override is used at this session boundary.
  adb('shell', 'am', 'force-stop', pkg);
  await launch(true);
  await page.goto(origin + '/app/manifiestos/' + manifestId);
  await expect(page.getByText('QA002ZZ · QA Segundo', { exact: true })).toBeVisible();
  await proof('04-reopened-session'); results.push('APK process restart retains authenticated session');
  await logout(); await login('generador');
  await page.goto(origin + '/app/manifiestos/' + manifestId);
  await page.getByRole('button', { name: 'Firmar Manifiesto', exact: true }).tap();
  const dialog = page.getByRole('dialog', { name: 'Firma del manifiesto', exact: true });
  const canvas = dialog.locator('canvas'); await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  await expect(dialog.getByRole('button', { name: 'Usar firma', exact: true })).toBeDisabled();
  await page.mouse.move(bounds.x + bounds.width * .1, bounds.y + bounds.height * .6);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .2, { steps: 12 });
  await page.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .7, { steps: 12 });
  await page.mouse.up();
  await dialog.getByRole('button', { name: 'Usar firma', exact: true }).tap();
  await mutate('Confirmar y Firmar', 'firmar');
  await logout(); await login('transportista');
  await page.goto(origin + '/app/manifiestos/' + manifestId);
  await expect(page).toHaveURL(new RegExp('/transporte/viaje/' + manifestId + '$'));
  await expect(page.getByLabel('Transporte asignado').getByText('QA002ZZ', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Transporte asignado').getByText('QA Segundo', { exact: true })).toBeVisible();
  await proof('05-carrier-assignment');
  await mutate('Confirmar retiro', 'confirmar-retiro');
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).tap();
  await mutate('Sí, Confirmar Entrega', 'confirmar-entrega');
  await logout(); await login('operador');
  await page.goto(origin + '/app/manifiestos/' + manifestId);
  await mutate('Confirmar Recepcion', 'confirmar-recepcion');
  await page.getByRole('button', { name: 'Registrar Tratamiento', exact: true }).tap();
  await mutate('Confirmar Tratamiento', 'tratamiento');
  await mutate('Cerrar Manifiesto', 'cerrar');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Descargar Certificado', exact: true })).toBeVisible();
  await proof('06-operator-completed'); results.push('Four real role sessions complete current lifecycle');
  const downloadsBefore = new Set(adb('shell', 'ls', '-1', '/sdcard/Download').trim().split(/\r?\n/));
  const downloadResponse = page.waitForResponse(r => r.url() === origin + '/api/pdf/certificado/' + manifestId);
  await page.getByRole('button', { name: 'Descargar Certificado', exact: true }).tap();
  const pdf = await downloadResponse; expect(pdf.status()).toBe(200);
  const bytes = await pdf.body(); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  await writeFile(path.join(output, 'certificate.pdf'), bytes);
  await expect.poll(async () => nativeNodes(await readNativeWindow()).some(node =>
    (node.text || '').startsWith('certificado-')),
  { timeout: 25000, message: 'Native PDF viewer must open the requested certificate' }).toBe(true);
  await proof('06-certificate-requested');
  let savedFile = '';
  await expect.poll(() => {
    const added = adb('shell', 'ls', '-1', '/sdcard/Download').trim().split(/\r?\n/)
      .filter(file => !downloadsBefore.has(file) && /^certificado-[a-zA-Z0-9_.()-]+\.pdf$/.test(file));
    if (added.length === 1) savedFile = added[0];
    return added.length;
  }, { timeout: 25000, message: 'Actual PDF must reach Android Downloads, not merely return HTTP 200' }).toBe(1);
  const savedPath = path.join(output, 'certificate-downloaded-on-device.pdf');
  adb('pull', '/sdcard/Download/' + savedFile, savedPath);
  assert.deepEqual(await readFile(savedPath), bytes, 'Native download must preserve the exact API bytes');
  results.push('Certificate downloaded to Android storage with exact PDF bytes');
  // Run38628501638 visibly opened the real PDF viewer. The web document remains
  // attached behind it; attempting a DOM tap there is not a valid logout test.
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await expect.poll(async () => nativeNodes(await readNativeWindow()).some(node =>
    node.package === 'com.android.chrome' && node.text === 'Abrir menu' && node.class === 'android.widget.Button'),
  { timeout: 15000, message: 'Return from native PDF viewer to the actual SITREP window' }).toBe(true);
  await proof('06-returned-from-pdf'); results.push('Native PDF viewer opens and returns to SITREP');
  await logout(); await page.goto(origin + '/app/manifiestos/' + manifestId);
  await expect(page).toHaveURL(/\/app\/login$/);
  await proof('07-logout-denies-protected-route'); results.push('Logout denies protected route');
  assert.deepEqual(unsafe, []); assert.deepEqual(errors, []);
  assert.ok(mutations.every(r => r.status < 400));
  await writeFile(path.join(output, 'chrome-memory.txt'), adb('shell', 'dumpsys', 'meminfo', 'com.android.chrome', '-s'));
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ completed: true, results, manifestId, mutations, errors, unsafe,
    system: assertStableSystemPackages(baseline), emailSent: 0, originalPackageModified: false,
    limitations: ['Separate debug APK, not an installable update over the production APK',
      'Loopback HTTP Custom Tab fallback, no forged TWA trust or TLS certification',
      'No physical camera, GPS, battery or cellular test', 'One bundled Android PDF viewer tested, not every third-party viewer',
      'Current lifecycle plus MV2-101/102, not the unimplemented approval/addendum V2 workflow',
      'SITREP process reopened; full Chrome/OS restart is separate'] }, null, 2));
} catch (error) {
  await device.screenshot({ path: path.join(output, 'FAIL-device.png') }).catch(() => {});
  if (page!) await writeFile(path.join(output, 'FAIL-dom.txt'), await page.locator('body').ariaSnapshot()).catch(() => {});
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ completed: false, results, manifestId, mutations, errors, unsafe, failure: String(error) }, null, 2));
  throw error;
} finally {
  await context.close(); await device.close();
}
