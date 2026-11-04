import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('an old device fix is not presented or attached as the current location', async ({ browser }, info) => {
  const baseline = process.env.QA_GPS_STALE_BASELINE === 'true';
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-stale-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [], consoleErrors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.clock.install();
  await page.addInitScript(() => {
    const simulated: any = { mode: 'stale', watches: 0, active: new Map() };
    const point = () => ({ coords: { latitude: -33.334, longitude: -68.744, accuracy: 10, speed: null, heading: null,
      altitude: null, altitudeAccuracy: null }, timestamp: Date.now() - (simulated.mode === 'stale' ? 120000 : 0) } as GeolocationPosition);
    simulated.emit = () => { for (const watch of simulated.active.values()) watch.success(point()); };
    (window as any).__qaGpsAge = simulated;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(success: PositionCallback, failure?: PositionErrorCallback) {
        const id = ++simulated.watches; simulated.active.set(id, { success, failure });
        setTimeout(() => { if (simulated.active.has(id)) success(point()); }, 0); return id;
      },
      getCurrentPosition(success: PositionCallback) { setTimeout(() => success(point()), 0); },
      clearWatch(id: number) { simulated.active.delete(id); },
    } });
    const original = navigator.permissions?.query.bind(navigator.permissions);
    if (navigator.permissions) Object.defineProperty(navigator.permissions, 'query', { configurable: true, value: (descriptor: PermissionDescriptor) =>
      descriptor.name === 'geolocation' ? Promise.resolve({ state: 'granted' }) : original!(descriptor) });
  });
  async function reportIncident(description: string) {
    await page.getByRole('button', { name: 'Incidente', exact: true }).click();
    await page.getByRole('button', { name: 'Otro', exact: true }).click();
    await page.getByPlaceholder('Describe el incidente...').fill(description);
    const response = page.waitForResponse(r => r.url().endsWith(`/manifiestos/${manifest.id}/incidente`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Registrar Incidente', exact: true }).click();
    const result = await response; expect(result.status()).toBe(200);
    return result.request().postDataJSON();
  }
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText(manifest.numero, { exact: true }).first()).toBeVisible();
    if (baseline) {
      await expect(page.getByText('GPS activo', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('baseline-fix-antiguo.png'), animations: 'disabled', scale: 'css' });
      const oldIncident = await reportIncident('QA GPS antiguo');
      expect(oldIncident).toMatchObject({ latitud: -33.334, longitud: -68.744 });
    } else {
      await expect(page.getByText('Última ubicación sin actualizar', { exact: true })).toBeVisible();
      await expect(page.getByText('GPS activo', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Reintentar GPS', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('ubicacion-antigua.png'), animations: 'disabled', scale: 'css' });
      const oldIncident = await reportIncident('QA GPS antiguo');
      expect(oldIncident.latitud).toBeUndefined(); expect(oldIncident.longitud).toBeUndefined();
      await page.evaluate(() => { (window as any).__qaGpsAge.mode = 'fresh'; });
      const retry = page.getByRole('button', { name: 'Reintentar GPS', exact: true });
      const bounds = await retry.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44);
      await retry.click();
      await expect(page.getByText('GPS activo', { exact: true })).toBeVisible();
      const freshIncident = await reportIncident('QA GPS reciente');
      expect(freshIncident).toMatchObject({ latitud: -33.334, longitud: -68.744 });
      await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    }
    if (baseline) await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    let unblockGps = () => {};
    let gpsStarted: Promise<void> | null = null;
    if (!baseline) {
      let markStarted = () => {};
      gpsStarted = new Promise<void>(resolve => { markStarted = resolve; });
      const blocked = new Promise<void>(resolve => { unblockGps = resolve; });
      await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => {
        markStarted();
        await blocked;
        await route.continue();
      });
    }
    const delivery = page.waitForResponse(r => r.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    if (gpsStarted) {
      await Promise.race([gpsStarted, new Promise((_, reject) => setTimeout(() => reject(new Error('No GPS upload to delay')), 20_000))]);
      await page.clock.runFor(61000);
      await expect(page.getByRole('dialog', { name: 'Confirmar Entrega?' })).toContainText('No se adjuntará');
      unblockGps();
    }
    const result = await delivery; expect(result.status()).toBe(200);
    const sent = result.request().postDataJSON();
    if (baseline) expect(sent).toMatchObject({ latitud: -33.334, longitud: -68.744 });
    else { expect(sent.latitud).toBeUndefined(); expect(sent.longitud).toBeUndefined(); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]); expect(consoleErrors).toEqual([]);
    writeFileSync(info.outputPath('proof.json'), JSON.stringify({ surface: info.project.name, baseline, errors, consoleErrors }));
  } finally { await context.close(); }
});

test('delivery retains a recent device location when GPS synchronizes promptly', async ({ browser }, info) => {
  test.skip(process.env.QA_GPS_STALE_BASELINE === 'true', 'The baseline reproduction only requires the stale case.');
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-stale-private.json'), 'utf8'));
  const manifest = fixture.freshCases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const answer = (success: PositionCallback) => success({ coords: { latitude: -33.334, longitude: -68.744,
      accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null }, timestamp: Date.now() } as GeolocationPosition);
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(success: PositionCallback) { setTimeout(() => answer(success), 0); return 1; },
      getCurrentPosition(success: PositionCallback) { setTimeout(() => answer(success), 0); }, clearWatch() {},
    } });
    const original = navigator.permissions?.query.bind(navigator.permissions);
    if (navigator.permissions) Object.defineProperty(navigator.permissions, 'query', { configurable: true, value: (descriptor: PermissionDescriptor) =>
      descriptor.name === 'geolocation' ? Promise.resolve({ state: 'granted' }) : original!(descriptor) });
  });
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText(manifest.numero, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('GPS activo', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirmar Entrega?' });
    await expect(dialog).toContainText('Se adjuntará la ubicación si sigue siendo reciente');
    const response = page.waitForResponse(r => r.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`) && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    const result = await response; expect(result.status()).toBe(200);
    expect(result.request().postDataJSON()).toMatchObject({ latitud: -33.334, longitud: -68.744 });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
