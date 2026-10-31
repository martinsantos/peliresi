import { expect, test, type Page } from '@playwright/test';
import { readFile, rename, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isolatedMapTiles, login, prefix } from './helpers';

const out = '/work/sitrep/.qa-pwa-continuity-20261031';
const releaseA = process.env.QA_PWA_RELEASE_A || '';
const releaseB = path.join(out, 'release-b');
const live = path.join(out, 'app-current');
const webReleaseA = process.env.QA_PWA_WEB_RELEASE_A || '';
const webReleaseB = path.join(out, 'web-release-b');
const webLive = path.join(out, 'web-current');
const baseline = process.env.QA_PWA_EXPECT_BUG === 'true';
if (process.env.QA_ARTIFACTS !== out || ![
  '/work/sitrep/.qa-inspection-opening-20261031/app-v7',
  path.join(out, 'release-fixed-a'),
].includes(releaseA) || process.env.QA_APP_BUILD !== live || ![
  '/work/sitrep/.qa-inspection-opening-20261031/web-v7',
  path.join(out, 'web-release-fixed-a'),
].includes(webReleaseA) || process.env.QA_WEB_BUILD !== webLive) throw Error('Versiones QA inválidas');

async function selectRelease(target: string) {
  if (target !== releaseA && target !== releaseB) throw Error('Versión QA no permitida');
  const next = path.join(out, 'app-next-' + randomUUID());
  await symlink(target, next, 'dir');
  await rename(next, live);
}
async function selectWebRelease(target: string) {
  if (target !== webReleaseA && target !== webReleaseB) throw Error('Versión web QA no permitida');
  const next = path.join(out, 'web-next-' + randomUUID());
  await symlink(target, next, 'dir');
  await rename(next, webLive);
}
async function controlled(page: Page, app: boolean) {
  const script = app ? '/app/sw-app.js' : '/sw.js';
  await page.waitForFunction(expected => navigator.serviceWorker.controller?.scriptURL.endsWith(expected), script, { timeout: 45_000 });
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');
}
async function installWaiting(page: Page) {
  await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/app/'))?.waiting?.state), { timeout: 45_000 }).toBe('installed');
}
async function appCacheVersion(directory: string) {
  const text = await readFile(path.join(directory, 'sw-app.js'), 'utf8');
  const match = text.match(/const SW_VERSION = '([^']+)'/);
  expect(match?.[1]).toMatch(/^\d{14}$/);
  return match![1];
}
async function makeSecondPage(page: Page, info: Parameters<typeof login>[1]) {
  const second = await page.context().newPage();
  await isolatedMapTiles(second, info);
  return second;
}

test.beforeEach(async () => {
  await selectRelease(releaseA);
  await selectWebRelease(webReleaseA);
});

test('a waiting update does not replace the active application shell', async ({ page }, info) => {
  test.skip(info.project.name !== 'app');
  await login(page, info, 'inspector');
  await controlled(page, true);
  const second = await makeSecondPage(page, info);
  await second.goto('/app/');
  await controlled(second, true);
  const versionA = await appCacheVersion(releaseA), versionB = await appCacheVersion(releaseB);
  expect(versionA).not.toBe(versionB);
  expect(await page.evaluate(async name => (await caches.keys()).includes(name), 'sitrep-app-' + versionA)).toBe(true);
  await selectRelease(releaseB);
  await installWaiting(second);
  await second.goto('/app/');
  await controlled(second, true);
  const observed = await second.evaluate(async name => {
    const registration = await navigator.serviceWorker.getRegistration('/app/');
    const saved = await (await caches.open(name)).match('/app/index.html');
    return { waiting: registration?.waiting?.state, visibleNewRelease: Boolean(document.querySelector('meta[name="sitrep-qa-release"][content="B"]')),
      savedNewRelease: (await saved?.text())?.includes('name="sitrep-qa-release" content="B"') || false };
  }, 'sitrep-app-' + versionA);
  expect(observed.waiting).toBe('installed');
  expect(observed.visibleNewRelease).toBe(baseline);
  expect(observed.savedNewRelease).toBe(baseline);
  await writeFile(info.outputPath('shell-proof.json'), JSON.stringify({ synthetic: true, baseline, ...observed }));
  await second.screenshot({ path: info.outputPath('waiting-update.png'), animations: 'disabled' });
  await second.close();
});

test('updating one app tab leaves a previously loaded screen available to another tab', async ({ page }, info) => {
  test.skip(info.project.name !== 'app');
  await login(page, info, 'inspector');
  await controlled(page, true);
  const second = await makeSecondPage(page, info);
  await second.goto('/app/inspecciones');
  await controlled(second, true);
  await expect(second.getByRole('button', { name: 'Nueva inspección', exact: true })).toBeVisible();
  const chunk = await second.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name)
    .find(url => /\/app\/assets\/InspeccionesPageV2-[\w-]+\.js/.test(url)) || '');
  expect(chunk).toBeTruthy();
  expect(await page.evaluate(url => performance.getEntriesByType('resource').some(entry => entry.name === url), chunk)).toBe(false);
  const versionA = await appCacheVersion(releaseA);
  await expect.poll(() => second.evaluate(async url => Boolean(await caches.match(url)), chunk)).toBe(true);
  await selectRelease(releaseB);
  await installWaiting(second);
  await page.evaluate(() => {
    (window as any).__qaControllerChanges = 0;
    navigator.serviceWorker.addEventListener('controllerchange', () => { (window as any).__qaControllerChanges++; });
  });
  await second.getByRole('button', { name: /Nueva versión disponible — Actualizar cuando termines/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__qaControllerChanges), { timeout: 45_000 }).toBeGreaterThan(0);
  const beforeNavigation = await page.evaluate(async ({ name, url }) => ({
    oldCacheRetained: (await caches.keys()).includes(name),
    oldChunkRetained: Boolean(await caches.match(url)),
  }), { name: 'sitrep-app-' + versionA, url: chunk });
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Menú de la aplicación', exact: true }).getByRole('link', { name: 'Inspecciones', exact: true }).click();
  if (baseline) {
    await expect(page.getByRole('heading', { name: 'No pudimos abrir esta pantalla', exact: true })).toBeVisible({ timeout: 30_000 });
    expect(beforeNavigation.oldCacheRetained).toBe(false);
    expect(beforeNavigation.oldChunkRetained).toBe(false);
  } else {
    await expect(page.getByRole('button', { name: 'Nueva inspección', exact: true })).toBeVisible({ timeout: 30_000 });
    expect(beforeNavigation.oldCacheRetained).toBe(true);
    expect(beforeNavigation.oldChunkRetained).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('other-tab-after-update.png'), animations: 'disabled' });
  await writeFile(info.outputPath('tab-proof.json'), JSON.stringify({ synthetic: true, baseline, ...beforeNavigation }));
  await second.close();
});

test('a saved opening is available after reload while offline', async ({ page }, info) => {
  await login(page, info, 'inspector');
  await controlled(page, info.project.name === 'app');
  await page.goto(prefix(info) + '/inspecciones');
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA borrador sin conexión con service worker');
  await page.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
  const cachedApi = await page.evaluate(async () => {
    const result: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        const pathname = new URL(request.url).pathname;
        if (/^\/(?:app\/)?api(?:\/|$)/.test(pathname)) result.push(pathname);
      }
    }
    return result;
  });
  expect(cachedApi).toEqual([]);
  let writes = 0;
  page.on('request', request => { if (request.url().endsWith('/api/inspecciones') && request.method() === 'POST') writes++; });
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continuar apertura', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(page.getByLabel('Descripción inicial')).toHaveValue('QA borrador sin conexión con service worker');
  await expect(page.getByRole('button', { name: 'Crear expediente', exact: true })).toBeDisabled();
  expect(writes).toBe(0);
  await page.screenshot({ path: info.outputPath('offline-draft.png'), animations: 'disabled' });
  await page.context().setOffline(false);
  await expect(page.getByRole('button', { name: 'Crear expediente', exact: true })).toBeEnabled();
  expect(writes).toBe(0);
  await writeFile(info.outputPath('offline-proof.json'), JSON.stringify({ synthetic: true, surface: info.project.name, automaticWrites: 0 }));
});

test('an opening in another tab remains editable and recoverable after an update', async ({ page }, info) => {
  test.skip(baseline);
  const app = info.project.name === 'app';
  await login(page, info, 'inspector');
  await controlled(page, app);
  await page.goto(prefix(info) + '/inspecciones');
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  const note = 'QA borrador conservado durante actualización ' + info.project.name;
  await page.getByLabel('Descripción inicial').fill(note);
  const second = await makeSecondPage(page, info);
  await second.goto(prefix(info) + '/');
  await controlled(second, app);
  if (app) {
    await selectRelease(releaseB);
    await installWaiting(second);
  } else {
    await selectWebRelease(webReleaseB);
    await second.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    await expect.poll(() => second.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.waiting?.state), { timeout: 45_000 }).toBe('installed');
  }
  await page.evaluate(() => {
    (window as any).__qaControllerChanges = 0;
    navigator.serviceWorker.addEventListener('controllerchange', () => { (window as any).__qaControllerChanges++; });
  });
  let writes = 0;
  page.on('request', request => { if (request.url().endsWith('/api/inspecciones') && request.method() === 'POST') writes++; });
  const update = second.getByRole('button', { name: /Nueva versión disponible — Actualizar cuando termines/ });
  try {
    await expect(update).toBeVisible({ timeout: 15_000 });
  } catch (error) {
    const status = await second.evaluate(async scope => {
      const reg = await navigator.serviceWorker.getRegistration(scope);
      return { path: location.pathname, controller: navigator.serviceWorker.controller?.state,
        active: reg?.active?.state, installing: reg?.installing?.state, waiting: reg?.waiting?.state };
    }, app ? '/app/' : '/');
    await writeFile(info.outputPath('missing-update-status.json'), JSON.stringify(status));
    throw error;
  }
  await update.click({ timeout: 5_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__qaControllerChanges), { timeout: 45_000 }).toBeGreaterThan(0);
  await expect(page.getByLabel('Descripción inicial')).toHaveValue(note);
  await page.getByLabel('Descripción inicial').fill(note + ' · edición posterior');
  await page.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(page.getByLabel('Descripción inicial')).toHaveValue(note + ' · edición posterior');
  expect(writes).toBe(0);
  await page.screenshot({ path: info.outputPath('draft-after-update.png'), animations: 'disabled' });
  await writeFile(info.outputPath('draft-update-proof.json'), JSON.stringify({ synthetic: true, surface: info.project.name, automaticWrites: writes }));
  await second.close();
});

test('updating one web tab keeps a previously loaded screen available to another tab', async ({ page }, info) => {
  test.skip(info.project.name !== 'web-desktop');
  await login(page, info, 'inspector');
  await controlled(page, false);
  const second = await makeSecondPage(page, info);
  await second.goto('/inspecciones');
  await controlled(second, false);
  await expect(second.getByRole('button', { name: 'Nueva inspección', exact: true })).toBeVisible();
  const chunk = await second.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name)
    .find(url => /\/assets\/InspeccionesPageV2-[\w-]+\.js/.test(url)) || '');
  expect(chunk).toBeTruthy();
  expect(await page.evaluate(url => performance.getEntriesByType('resource').some(entry => entry.name === url), chunk)).toBe(false);
  const sw = await readFile(path.join(webReleaseA, 'sw.js'), 'utf8');
  const cacheName = sw.match(/const CACHE_NAME = '([^']+)'/)?.[1];
  expect(cacheName).toBeTruthy();
  await expect.poll(() => second.evaluate(async url => Boolean(await caches.match(url)), chunk)).toBe(true);
  await selectWebRelease(webReleaseB);
  await second.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
  await expect.poll(() => second.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.waiting?.state), { timeout: 45_000 }).toBe('installed');
  await page.evaluate(() => {
    (window as any).__qaControllerChanges = 0;
    navigator.serviceWorker.addEventListener('controllerchange', () => { (window as any).__qaControllerChanges++; });
  });
  await second.getByRole('button', { name: /Nueva versión disponible — Actualizar cuando termines/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__qaControllerChanges), { timeout: 45_000 }).toBeGreaterThan(0);
  const beforeNavigation = await page.evaluate(async ({ name, url }) => {
    const names = await caches.keys();
    const cachesWithChunk = [];
    for (const key of names) if (await (await caches.open(key)).match(url)) cachesWithChunk.push(key);
    return { oldCacheRetained: names.includes(name!), oldChunkRetained: cachesWithChunk.length > 0, cachesWithChunk };
  }, { name: cacheName, url: chunk });
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('link', { name: 'Inspecciones', exact: true }).click();
  if (baseline) {
    await expect(page.getByRole('heading', { name: 'No pudimos abrir esta pantalla', exact: true })).toBeVisible({ timeout: 30_000 });
  } else {
    await expect(page.getByRole('button', { name: 'Nueva inspección', exact: true })).toBeVisible({ timeout: 30_000 });
    expect(beforeNavigation.oldChunkRetained).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('web-other-tab-after-update.png'), animations: 'disabled' });
  await writeFile(info.outputPath('web-tab-proof.json'), JSON.stringify({ synthetic: true, baseline, ...beforeNavigation }));
  await second.close();
});

test('installation guidance explains connection and notification limits', async ({ page }, info) => {
  test.skip(info.project.name !== 'app' || baseline);
  await login(page, info, 'inspector');
  await page.evaluate(() => {
    localStorage.removeItem('sitrep_pwa_dismiss');
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
  });
  await expect(page.getByText('Instalá SITREP', { exact: true })).toBeVisible({ timeout: 55_000 });
  await expect(page.getByText('Consultá algunas pantallas guardadas sin conexión', { exact: true })).toBeVisible();
  await expect(page.getByText('Revisá los avisos con la app abierta', { exact: true })).toBeVisible();
  await expect(page.getByText('Para enviar cambios y recibir avisos necesitás conexión.', { exact: true })).toBeVisible();
  const close = page.getByRole('button', { name: 'Cerrar invitación a instalar', exact: true });
  const box = await close.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: info.outputPath('install-guidance.png'), animations: 'disabled' });
  await close.click();
  await expect(page.getByText('Instalá SITREP', { exact: true })).toHaveCount(0);
  await writeFile(info.outputPath('install-proof.json'), JSON.stringify({ synthetic: true, promptEventSimulated: true, nativeInstallationTested: false }));
});

test('login offers an update without erasing credentials being entered', async ({ page }, info) => {
  test.skip(baseline);
  const app = info.project.name === 'app';
  await isolatedMapTiles(page, info);
  await page.goto(prefix(info) + '/login');
  await controlled(page, app);
  await page.getByLabel('Correo electrónico o CUIT').fill('qa-sin-envio@night-qa.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('QA-no-enviar');
  let logins = 0;
  page.on('request', request => { if (request.url().endsWith('/api/auth/login') && request.method() === 'POST') logins++; });
  if (app) {
    await selectRelease(releaseB);
    await installWaiting(page);
  } else {
    await selectWebRelease(webReleaseB);
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.waiting?.state), { timeout: 45_000 }).toBe('installed');
  }
  const update = page.getByRole('button', { name: /Nueva versión disponible — Actualizar cuando termines/ });
  await expect(update).toBeVisible({ timeout: 15_000 });
  await update.click();
  await expect(page.getByRole('alert')).toContainText('Terminá de ingresar o borrá los datos antes de actualizar.');
  await expect(page.getByLabel('Correo electrónico o CUIT')).toHaveValue('qa-sin-envio@night-qa.invalid');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('QA-no-enviar');
  await expect.poll(() => page.evaluate(async scope => (await navigator.serviceWorker.getRegistration(scope))?.waiting?.state, app ? '/app/' : '/')).toBe('installed');
  await page.getByLabel('Correo electrónico o CUIT').clear();
  await page.getByLabel('Contraseña', { exact: true }).clear();
  const reloaded = page.waitForEvent('load', { timeout: 30_000 });
  await update.click();
  await reloaded;
  await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  expect(logins).toBe(0);
  await page.screenshot({ path: info.outputPath('login-update.png'), animations: 'disabled' });
  await writeFile(info.outputPath('login-update-proof.json'), JSON.stringify({ synthetic: true, surface: info.project.name, loginRequests: logins }));
});
