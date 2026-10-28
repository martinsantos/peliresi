import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('an individual trip resumes GPS in one step after permission is granted', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'single-gps-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [], consoleErrors: string[] = [], consoleWarnings: string[] = [];
  let sent = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); else if (message.type() === 'warning') consoleWarnings.push(message.text()); });
  page.on('response', response => {
    if (response.request().method() === 'POST' && response.url().endsWith(`/manifiestos/${manifest.id}/ubicacion`) && response.status() === 200) sent++;
  });
  await page.addInitScript(() => {
    const simulated = { allowed: false, watches: 0, clears: 0, active: new Set<number>() };
    (window as any).__qaGps = simulated;
    const answer = (success: PositionCallback, failure?: PositionErrorCallback | null) => {
      if (!simulated.allowed) failure?.({ code: 1, message: 'Permiso simulado denegado' } as GeolocationPositionError);
      else success({ coords: { latitude: -33.334, longitude: -68.744, accuracy: 10, speed: null, heading: null,
        altitude: null, altitudeAccuracy: null }, timestamp: Date.now() } as GeolocationPosition);
    };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(success: PositionCallback, failure?: PositionErrorCallback) {
        const id = ++simulated.watches; simulated.active.add(id);
        setTimeout(() => { if (simulated.active.has(id)) answer(success, failure); }, 0); return id;
      },
      getCurrentPosition(success: PositionCallback, failure?: PositionErrorCallback) { setTimeout(() => answer(success, failure), 0); },
      clearWatch(id: number) { simulated.clears++; simulated.active.delete(id); },
    } });
    const original = navigator.permissions?.query.bind(navigator.permissions);
    if (navigator.permissions) Object.defineProperty(navigator.permissions, 'query', { configurable: true, value: (descriptor: PermissionDescriptor) =>
      descriptor.name === 'geolocation' ? Promise.resolve({ state: 'denied' }) : original!(descriptor) });
  });
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText(manifest.numero, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Permiso GPS denegado', { exact: true })).toBeVisible();
    await expect(page.getByText('Viaje activo', { exact: true })).toBeVisible();
    const geometry = await page.getByText(manifest.numero, { exact: true }).first().evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      return { lines: range.getClientRects().length, number: element.getBoundingClientRect().toJSON(),
        state: [...document.querySelectorAll('span')].find(item => item.textContent === 'Viaje activo')!.getBoundingClientRect().toJSON() };
    });
    expect(geometry.lines).toBe(1);
    expect(geometry.number.bottom).toBeLessThanOrEqual(geometry.state.top + 1);
    await expect(page.getByText(/permisos de ubicación de SITREP en el navegador o teléfono/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const retry = page.getByRole('button', { name: 'Reintentar GPS', exact: true });
    await expect(retry).toBeVisible();
    await retry.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('gps-denegado.png'), animations: 'disabled' });
    expect(sent).toBe(0);
    const denialNotice=page.getByRole('alert').filter({hasText:'Permiso de ubicación denegado'});
    const noticeWasVisible=await denialNotice.isVisible();
    await page.evaluate(() => { (window as any).__qaGps.allowed = true; });
    await retry.click();
    if(noticeWasVisible) await expect(denialNotice).not.toBeVisible({timeout:1000});
    await expect(page.getByText('GPS activo', { exact: true })).toBeVisible();
    await expect.poll(() => sent, { timeout: 45000 }).toBeGreaterThanOrEqual(1);
    await expect(page.getByText(/^Actualizado \d/)).toBeVisible();
    const state = await page.evaluate(() => ({ watches: (window as any).__qaGps.watches, clears: (window as any).__qaGps.clears }));
    expect(state.watches).toBe(2); expect(state.clears).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('gps-recuperado.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Pausar', exact: true }).first().click();
    await expect(page.getByText('Seguimiento GPS pausado. Reanudá el viaje para compartir ubicación.', { exact: true })).toBeVisible();
    await expect(page.getByText('GPS activo', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reintentar GPS', exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('gps-pausado.png'), animations: 'disabled' });
    expect(errors).toEqual([]); expect(consoleErrors).toEqual([]);
    writeFileSync(info.outputPath('single-gps-proof.json'), JSON.stringify({ surface: info.project.name, id: manifest.id, sent, consoleErrors: 0, consoleWarnings, ...state }));
  } finally { await context.close(); }
});

test('the office monitor shows the recovered position for that same trip', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'single-gps-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name], errors: string[] = [], writes: string[] = [];
  await login(page, info, 'admin');
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  const received = page.waitForResponse(response => response.url().endsWith('/api/centro-control/monitor-live') && response.status() === 200);
  await page.goto(prefix(info) + '/monitor');
  const data = (await (await received).json()).data;
  const trip = data.enTransito.find((item: { manifiestoId: string }) => item.manifiestoId === manifest.id);
  expect(trip, 'The same artificial trip must appear in the monitor response').toBeTruthy();
  expect(trip.ultimaPosicion.latitud).toBeCloseTo(-33.334, 3);
  expect(trip.ultimaPosicion.longitud).toBeCloseTo(-68.744, 3);
  expect(Number.isFinite(Date.parse(trip.ultimaPosicion.timestamp))).toBe(true);
  const marker = page.getByTitle('Viaje en tránsito: ' + manifest.numero, { exact: true });
  await expect(marker).toHaveCount(1);
  await marker.focus(); await marker.press('Enter');
  const popup = page.getByTestId('monitor-live-popup');
  await expect(popup).toContainText(manifest.numero);
  await expect(popup.getByLabel('Última posición recibida')).toContainText('Última posición');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('monitor-posicion-recuperada.png'), animations: 'disabled', scale: 'css' });
  expect(errors).toEqual([]); expect(writes).toEqual([]);
});

test('retry preserves queued points without resending one already accepted', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'single-gps-private.json'), 'utf8'));
  const manifest = fixture.queueCases[info.project.name];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [];
  await page.clock.install();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const simulated: any = { allowed: true, lat: -33.111, lon: -68.111, watches: 0, active: new Map() };
    const point = () => ({ coords: { latitude: simulated.lat, longitude: simulated.lon, accuracy: 10, speed: null, heading: null,
      altitude: null, altitudeAccuracy: null }, timestamp: Date.now() } as GeolocationPosition);
    const denied = () => ({ code: 1, message: 'Permiso simulado denegado' } as GeolocationPositionError);
    simulated.emit = (lat: number, lon: number) => { simulated.lat = lat; simulated.lon = lon; for (const watch of simulated.active.values()) watch.success(point()); };
    simulated.deny = () => { simulated.allowed = false; for (const watch of simulated.active.values()) watch.failure?.(denied()); };
    (window as any).__qaGpsQueue = simulated;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(success: PositionCallback, failure?: PositionErrorCallback) {
        const id = ++simulated.watches; simulated.active.set(id, { success, failure });
        setTimeout(() => { if (simulated.active.has(id)) simulated.allowed ? success(point()) : failure?.(denied()); }, 0); return id;
      },
      getCurrentPosition(success: PositionCallback, failure?: PositionErrorCallback) { setTimeout(() => simulated.allowed ? success(point()) : failure?.(denied()), 0); },
      clearWatch(id: number) { simulated.active.delete(id); },
    } });
    const original = navigator.permissions?.query.bind(navigator.permissions);
    if (navigator.permissions) Object.defineProperty(navigator.permissions, 'query', { configurable: true, value: (descriptor: PermissionDescriptor) =>
      descriptor.name === 'geolocation' ? Promise.resolve({ state: 'granted' }) : original!(descriptor) });
  });
  let attempts = 0, acknowledged = 0, acceptedStatus = 0, release!: () => void;
  const heldResponse = new Promise<void>(resolve => { release = resolve; });
  page.on('response', response => {
    if (response.request().method() === 'POST' && response.url().endsWith(`/manifiestos/${manifest.id}/ubicacion`) && response.status() === 200) acknowledged++;
  });
  await page.route(`**/api/manifiestos/${manifest.id}/ubicacion`, async route => {
    attempts++;
    if (attempts <= 2) { await route.abort('internetdisconnected'); return; }
    if (attempts === 3) {
      const response = await route.fetch(); acceptedStatus = response.status();
      await heldResponse; await route.fulfill({ response }); return;
    }
    await route.continue();
  });
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText('GPS activo', { exact: true })).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    expect(attempts).toBe(0);
    await page.clock.runFor(30000);
    await expect(page.getByText('1 pendiente', { exact: true })).toBeVisible();
    await page.evaluate(() => (window as any).__qaGpsQueue.emit(-33.222, -68.222));
    await page.clock.runFor(30000);
    await expect(page.getByText('2 pendientes', { exact: true })).toBeVisible();
    await page.clock.runFor(30000);
    await expect.poll(() => acceptedStatus, { timeout: 15000 }).toBe(200);
    await page.evaluate(() => (window as any).__qaGpsQueue.deny());
    const deniedStatus = page.getByText('Permiso GPS denegado', { exact: true });
    await expect(deniedStatus).toBeVisible();
    await deniedStatus.scrollIntoViewIfNeeded();
    await expect(page.getByText('2 pendientes', { exact: true })).toBeVisible();
    await expect(page.getByText('Sin enviar', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('gps-cola-sin-permiso.png'), animations: 'disabled' });
    await page.evaluate(() => { (window as any).__qaGpsQueue.allowed = true; });
    await page.getByRole('button', { name: 'Reintentar GPS', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reintentando GPS', exact: true })).toBeDisabled();
    release();
    await expect.poll(() => page.evaluate(() => (window as any).__qaGpsQueue.watches), { timeout: 15000 }).toBe(2);
    await page.clock.runFor(1000);
    await expect(page.getByText('GPS activo', { exact: true })).toBeVisible();
    await expect.poll(() => acknowledged, { timeout: 15000 }).toBe(2);
    await expect(page.getByText('2 pendientes', { exact: true })).toHaveCount(0);
    expect(attempts).toBe(4);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('gps-cola-recuperada.png'), animations: 'disabled' });
    writeFileSync(info.outputPath('queue-proof.json'), JSON.stringify({ surface: info.project.name, attempts, acknowledged, simulatedClock: true }));
  } finally { release(); await context.close(); }
});
