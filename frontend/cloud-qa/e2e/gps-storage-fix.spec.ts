import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
async function installStorageFailure(page: Page) {
 await page.addInitScript(() => {
  let watcher: PositionCallback | undefined, coarse: PositionCallback | undefined;
  const original = Storage.prototype.setItem;
  (window as any).__storageTest = { fail: false, failures: 0, ready: () => Boolean(watcher && coarse), emit: () => watcher?.({
   coords: { latitude: -33.62, longitude: -68.62, accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null },
   timestamp: Date.now(),
  } as GeolocationPosition) };
  Storage.prototype.setItem = function (name: string, value: string) {
   if ((window as any).__storageTest.fail && name.startsWith('sitrep_gps_v2_')) {
    (window as any).__storageTest.failures++; throw new DOMException('QA storage full', 'QuotaExceededError');
   }
   return original.call(this, name, value);
  };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
   watchPosition(callback: PositionCallback) { watcher = callback; return 1; },
   getCurrentPosition(callback: PositionCallback) { coarse = callback; }, clearWatch() { watcher = undefined; },
  } });
 });
}

test('another tab waits until the original page saves its GPS after navigation', async ({ browser }, info) => {
 const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-private.json'), 'utf8'));
 const manifest = fixture.cases[info.project.name]['fleet-delivery'], mp = prefix(info);
 const key = `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner), manifest.id]))}`;
 const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
  isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'block' });
 const tracking = await context.newPage(), delivery = await context.newPage(); let deliveryRequests = 0, gpsRequests = 0;
 const errors: string[] = []; tracking.on('pageerror', error => errors.push(error.message)); delivery.on('pageerror', error => errors.push(error.message));
 await installStorageFailure(tracking);
 await tracking.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => { gpsRequests++; await route.continue(); });
 await delivery.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, async route => { deliveryRequests++; await route.continue(); });
 try {
  await login(tracking, info, 'transportista');
  if (info.project.name === 'app') { await tracking.setViewportSize({ width: 320, height: 800 }); await delivery.setViewportSize({ width: 320, height: 800 }); }
  await tracking.goto(`${mp}/transporte/viaje/${manifest.id}`);
  await expect.poll(() => tracking.evaluate(() => (window as any).__storageTest.ready())).toBe(true);
  await tracking.evaluate(() => { (window as any).__storageTest.fail = true; (window as any).__storageTest.emit(); });
  await expect(tracking.getByText('-33.62000, -68.62000', { exact: true })).toBeVisible();
  await tracking.getByRole('link', { name: 'Ver todos mis viajes' }).click();
  await expect(tracking).toHaveURL(new RegExp('/transporte/perfil(?:[/?#]|$)'));
  await expect.poll(() => tracking.evaluate(() => (window as any).__storageTest.failures)).toBeGreaterThan(0);
  await expect(tracking.getByText('Ubicaciones sin guardar', { exact: true })).toBeVisible();
  expect(await tracking.evaluate(name => localStorage.getItem(name), key)).toBeNull();
  expect(await tracking.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(false);
  await expect.poll(() => tracking.evaluate(async id => (await navigator.locks.query()).held.some(lock => lock.name === `sitrep:gps:${id}`), manifest.id)).toBe(true);
  await delivery.goto(mp + '/transporte/cargas');
  await delivery.getByRole('searchbox', { name: 'Número de manifiesto' }).fill(manifest.numero);
  await delivery.getByRole('button', { name: 'Buscar', exact: true }).click();
  await delivery.getByRole('checkbox', { name: `Llevo ${manifest.numero} en este móvil`, exact: true }).check();
  await delivery.getByRole('button', { name: `Entregar ${manifest.numero}`, exact: true }).click();
  await delivery.getByRole('dialog', { name: 'Confirmar entrega', exact: true }).getByRole('button', { name: 'Confirmar entrega de esta carga', exact: true }).click();
  const retryNotice = delivery.getByRole('status').filter({ hasText: 'Hay cambios esperando reintento' });
  await expect(retryNotice).toContainText(/otra pestaña|otra ventana/i, { timeout: 30000 });
  expect(deliveryRequests).toBe(0); expect(gpsRequests).toBe(0);
  await delivery.screenshot({ path: info.outputPath('delivery-blocked-storage.png'), animations: 'disabled', scale: 'css' });
  await tracking.evaluate(() => { (window as any).__storageTest.fail = false; });
  const gpsResponse = tracking.waitForResponse(item => item.request().method() === 'POST' && item.url().endsWith(`/manifiestos/${manifest.id}/ubicacion-idempotente`), { timeout: 90000 });
  await tracking.evaluate(() => history.back());
  await expect(tracking).toHaveURL(new RegExp(`/transporte/viaje/${manifest.id}(?:[/?#]|$)`));
  expect((await gpsResponse).status()).toBe(200);
  await expect.poll(() => tracking.evaluate(name => localStorage.getItem(name), key)).toBeNull();
  await expect(tracking.getByText('Ubicaciones sin guardar', { exact: true })).toHaveCount(0);
  const confirmed = delivery.waitForResponse(item => item.request().method() === 'POST' && item.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`), { timeout: 90000 });
  await tracking.getByRole('link', { name: 'Ver todos mis viajes' }).click();
  await expect.poll(() => tracking.evaluate(async id => !(await navigator.locks.query()).held.some(lock => lock.name === `sitrep:gps:${id}`), manifest.id)).toBe(true);
  const retry = retryNotice.getByRole('button', { name: 'Reintentar', exact: true });
  if (await retry.isVisible() && await retry.isEnabled()) await retry.click();
  expect((await confirmed).status()).toBe(200);
  expect(gpsRequests).toBe(1); expect(deliveryRequests).toBe(1); expect(errors).toEqual([]);
  writeFileSync(info.outputPath('storage-recovered-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true,
   blockedBeforeRecovery: true, warnedBeforeClose: true, gpsRequests, deliveryRequests }));
 } finally { await context.close(); }
});

test('a single storage retry in the delivery dialog saves the fix before confirming', async ({ page }, info) => {
 const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-private.json'), 'utf8'));
 const manifest = fixture.cases[info.project.name]['fleet-other'], mp = prefix(info); let gpsRequests = 0, deliveryRequests = 0;
 await installStorageFailure(page);
 await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => { gpsRequests++; await route.continue(); });
 await page.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, async route => { deliveryRequests++; await route.continue(); });
 await login(page, info, 'transportista'); if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
 await page.goto(`${mp}/transporte/viaje/${manifest.id}`);
 await expect.poll(() => page.evaluate(() => (window as any).__storageTest.ready())).toBe(true);
 await page.evaluate(() => { (window as any).__storageTest.fail = true; (window as any).__storageTest.emit(); });
 await expect(page.getByText('-33.62000, -68.62000', { exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
 const dialog = page.getByRole('dialog', { name: 'Confirmar Entrega?', exact: true });
 await dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
 await expect(dialog.getByRole('alert')).toContainText('Ubicaciones sin guardar');
  await expect(dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true })).toBeDisabled();
 expect(gpsRequests).toBe(0); expect(deliveryRequests).toBe(0);
 await page.screenshot({ path: info.outputPath('retry-storage-dialog.png'), animations: 'disabled', scale: 'css' });
 await page.evaluate(() => { (window as any).__storageTest.fail = false; });
 const gpsResponse = page.waitForResponse(item => item.request().method() === 'POST' && item.url().endsWith(`/manifiestos/${manifest.id}/ubicacion-idempotente`), { timeout: 90000 });
 await dialog.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
 expect((await gpsResponse).status()).toBe(200);
 await expect(dialog.getByRole('alert')).toHaveCount(0, { timeout: 30000 });
  await expect(dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true })).toBeEnabled();
 const confirmed = page.waitForResponse(item => item.request().method() === 'POST' && item.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`), { timeout: 90000 });
 await dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
 expect((await confirmed).status()).toBe(200);
 expect(gpsRequests).toBe(1); expect(deliveryRequests).toBe(1);
});
