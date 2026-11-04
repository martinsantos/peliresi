import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { activeGpsQueueKey, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('checks a lost GPS response after delivery without changing stored points', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-receipt-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  let key:string;
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [];
  let accepted = 0, aborted = false, reference = '';
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.addInitScript(() => {
    const fix = () => ({ coords: { latitude: -33.777, longitude: -68.777, accuracy: 10, speed: null, heading: null,
      altitude: null, altitudeAccuracy: null }, timestamp: Date.now() } as GeolocationPosition);
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(success: PositionCallback) { setTimeout(() => success(fix()), 0); return 1; },
      getCurrentPosition(success: PositionCallback) { setTimeout(() => success(fix()), 0); }, clearWatch() {},
    } });
  });
  await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => {
    reference = route.request().postDataJSON().puntoId;
    accepted = (await route.fetch()).status();
    await route.abort('connectionreset'); aborted = true;
  });
  try {
    await login(page, info, 'transportista');
    key=await activeGpsQueueKey(page,fixture.owner,manifest.id);
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText('GPS activo', { exact: true })).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.clock.runFor(30000);
    await expect.poll(() => accepted, { timeout: 15000 }).toBe(200);
    await expect.poll(() => aborted, { timeout: 15000 }).toBe(true);
    await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]').length, key)).toBe(1);
    expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!)[0].puntoId, key)).toBe(reference);
    const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
    expect(token).toBeTruthy();
    const delivery = await page.request.post(`/api/manifiestos/${manifest.id}/confirmar-entrega`, { headers: { Authorization: `Bearer ${token}` }, data: {} });
    expect(delivery.status()).toBe(200);
    const missing = randomUUID();
    const retained = await page.evaluate(({ k, missing }) => {
      const points = JSON.parse(localStorage.getItem(k)!);
      points.push({ lat: -33.888, lng: -68.888, speed: null, heading: null, puntoId: missing });
      localStorage.setItem(k, JSON.stringify(points));
      return localStorage.getItem(k);
    }, { k: key, missing });
    // Restore real timers before reload; a paused test clock prevents the
    // session recovery and renders only the loading screen.
    await page.clock.resume();
    await page.reload();
    const card = page.getByRole('region', { name: 'Comprobar recepción de ubicaciones' });
    await expect(card).toBeVisible();
    await expect(page.getByText('No se registraron traspasos de transporte.', { exact: true })).toBeVisible();
    const writes: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method());
    });
    const button = card.getByRole('button', { name: 'Comprobar recepción', exact: true });
    await button.scrollIntoViewIfNeeded();
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    await button.focus(); await button.press('Enter');
    await expect(card.getByRole('status')).toContainText('SITREP confirmó 1 de 2');
    await expect(card.getByRole('status')).toContainText('Las no confirmadas siguen guardadas');
    if (info.project.name === 'app') await expect(page.getByRole('banner').first().getByText('Viaje', { exact: true })).toBeVisible();
    expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(retained);
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('recepcion-gps.png'), animations: 'disabled' });
    expect(errors).toEqual([]);
    const retryPoint = { puntoId: reference, latitud: -33.777, longitud: -68.777 };
    const retry = await page.request.post(`/api/manifiestos/${manifest.id}/ubicacion-idempotente`, { headers: { Authorization: `Bearer ${token}` }, data: retryPoint });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).data.idempotencia).toMatchObject({ puntoId: reference, repetido: true });
    const changed = await page.request.post(`/api/manifiestos/${manifest.id}/ubicacion-idempotente`, { headers: { Authorization: `Bearer ${token}` }, data: { ...retryPoint, latitud: -33.7 } });
    expect(changed.status()).toBe(409);
    const newPoint = await page.request.post(`/api/manifiestos/${manifest.id}/ubicacion-idempotente`, { headers: { Authorization: `Bearer ${token}` }, data: { ...retryPoint, puntoId: missing } });
    expect(newPoint.status()).toBe(404);
    writeFileSync(info.outputPath('receipt-proof.json'), JSON.stringify({ surface: info.project.name, accepted, reference,
      missing, confirmed: 1, unconfirmed: 1, retained: true, writesDuringCheck: writes.length,
      exactRetry: retry.status(), changedRetry: changed.status(), newPoint: newPoint.status(), simulatedGps: true }));
  } finally { await context.close(); }
});
