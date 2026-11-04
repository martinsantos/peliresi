import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test('baseline: another tab may deliver after an unsaved fix is left in the first page', async ({ browser }, info) => {
 const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-private.json'), 'utf8'));
 const manifest = fixture.cases[info.project.name]['fleet-delivery'], mp = prefix(info);
 const key = `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner), manifest.id]))}`;
 const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
  isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'block' });
 const tracking = await context.newPage(), delivery = await context.newPage();
 let deliveryRequests = 0, gpsRequests = 0;
 await tracking.addInitScript(() => {
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
 await delivery.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, async route => { deliveryRequests++; await route.continue(); });
 await delivery.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => { gpsRequests++; await route.continue(); });
 try {
  await login(tracking, info, 'transportista');
  if (info.project.name === 'app') { await tracking.setViewportSize({ width: 320, height: 800 }); await delivery.setViewportSize({ width: 320, height: 800 }); }
  await tracking.goto(`${mp}/transporte/viaje/${manifest.id}`);
  await expect.poll(() => tracking.evaluate(() => (window as any).__storageTest.ready())).toBe(true);
  await tracking.evaluate(() => { (window as any).__storageTest.fail = true; (window as any).__storageTest.emit(); });
  await expect(tracking.getByText('Viaje activo', { exact: true })).toBeVisible();
  await expect(tracking.getByText('-33.62000, -68.62000', { exact: true })).toBeVisible();
  await tracking.getByRole('link', { name: 'Ver todos mis viajes' }).click();
  await expect(tracking).toHaveURL(new RegExp('/transporte/perfil(?:[/?#]|$)'));
  await expect.poll(() => tracking.evaluate(() => (window as any).__storageTest.failures)).toBeGreaterThan(0);
  expect(await tracking.evaluate(name => localStorage.getItem(name), key)).toBeNull();
  await expect.poll(() => tracking.evaluate(async id => !(await navigator.locks.query()).held.some(lock => lock.name === `sitrep:gps:${id}`), manifest.id)).toBe(true);
  await delivery.goto(mp + '/transporte/cargas');
  await delivery.getByRole('searchbox', { name: 'Número de manifiesto' }).fill(manifest.numero);
  await delivery.getByRole('button', { name: 'Buscar', exact: true }).click();
  await delivery.getByRole('checkbox', { name: `Llevo ${manifest.numero} en este móvil`, exact: true }).check();
  await delivery.getByRole('button', { name: `Entregar ${manifest.numero}`, exact: true }).click();
  const response = delivery.waitForResponse(item => item.request().method() === 'POST' && item.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`), { timeout: 90000 });
  await delivery.getByRole('dialog', { name: 'Confirmar entrega', exact: true }).getByRole('button', { name: 'Confirmar entrega de esta carga', exact: true }).click();
  expect((await response).status()).toBe(200);
  expect(deliveryRequests).toBe(1); expect(gpsRequests).toBe(0);
  await delivery.screenshot({ path: info.outputPath('delivery-after-storage-failure.png'), animations: 'disabled', scale: 'css' });
  writeFileSync(info.outputPath('storage-baseline-proof.json'), JSON.stringify({ surface: info.project.name, synthetic: true,
   failedStorageWrites: await tracking.evaluate(() => (window as any).__storageTest.failures), gpsRequests, deliveryRequests }));
 } finally { await context.close(); }
});
