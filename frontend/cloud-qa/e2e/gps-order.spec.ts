import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
const fixture = () => JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-order-private.json'), 'utf8'));

async function installGps(page: Page) {
  await page.clock.install();
  await page.addInitScript(() => {
    let watch: PositionCallback | undefined, coarse: PositionCallback | undefined;
    const make = (lat: number, lon: number, timestamp: number) => ({ coords: { latitude: lat, longitude: lon,
      accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null }, timestamp } as GeolocationPosition);
    (window as any).__qaGpsOrder = { ready: () => Boolean(watch),
      watch: (lat: number, lon: number, timestamp: number) => watch?.(make(lat, lon, timestamp)),
      coarse: (lat: number, lon: number, timestamp: number) => coarse?.(make(lat, lon, timestamp)),
      coarseReady: () => Boolean(coarse) };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(success: PositionCallback) { watch = success; return 1; },
      getCurrentPosition(success: PositionCallback) { coarse = success; },
      clearWatch() { watch = undefined; },
    } });
  });
}

async function emit(page: Page, kind: 'watch' | 'coarse', lat: number, lon: number, timestamp: number) {
  await page.evaluate(({ kind, lat, lon, timestamp }) => (window as any).__qaGpsOrder[kind](lat, lon, timestamp), { kind, lat, lon, timestamp });
}

test('individual GPS keeps the newer fix and Monitor receives the same position', async ({ browser }, info) => {
  const manifest = fixture().cases[info.project.name].individual, mp = prefix(info);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const office = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), admin = await office.newPage(), errors: string[] = [], payloads: any[] = [];
  page.on('pageerror', error => errors.push(error.message)); admin.on('pageerror', error => errors.push(error.message));
  await installGps(page);
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith(`/manifiestos/${manifest.id}/ubicacion-idempotente`)) payloads.push(request.postDataJSON()); });
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${mp}/transporte/viaje/${manifest.id}`);
    await expect.poll(() => page.evaluate(() => (window as any).__qaGpsOrder.ready() && (window as any).__qaGpsOrder.coarseReady())).toBe(true);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    const now = await page.evaluate(() => Date.now());
    await emit(page, 'watch', -33.11, -68.11, now - 1_000);
    await emit(page, 'coarse', -34.11, -69.11, now - 2_000);
    const received = page.waitForResponse(response => response.url().endsWith(`/manifiestos/${manifest.id}/ubicacion-idempotente`) && response.status() === 200);
    await page.clock.runFor(30_000); await received;
    expect(payloads).toHaveLength(1); expect(payloads[0]).toMatchObject({ latitud: -33.11, longitud: -68.11 });
    await expect(page.getByText('GPS activo', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('viaje-gps-mas-reciente.png'), animations: 'disabled' });

    await login(admin, info, 'admin');
    const monitorResponse = admin.waitForResponse(response => response.url().endsWith('/api/centro-control/monitor-live') && response.status() === 200);
    await admin.goto(mp + '/monitor');
    const trip = (await (await monitorResponse).json()).data.enTransito.find((item: { manifiestoId: string }) => item.manifiestoId === manifest.id);
    expect(trip.ultimaPosicion).toMatchObject({ latitud: -33.11, longitud: -68.11 });
    const marker = admin.getByTitle('Viaje en tránsito: ' + manifest.numero, { exact: true });
    await expect(marker).toHaveCount(1); await marker.focus(); await marker.press('Enter');
    const popup = admin.getByTestId('monitor-live-popup');
    await expect(popup).toContainText(manifest.numero);
    await expect(popup.getByLabel('Última posición recibida')).toContainText('Hora de captura no disponible');
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('individual-proof.json'), JSON.stringify({ surface: info.project.name, simulatedGps: true, sent: payloads.length, monitor: true }));
  } finally { await context.close(); await office.close(); }
});

test('fleet does not send an older callback to either selected load', async ({ browser }, info) => {
  const cases = fixture().cases[info.project.name], mp = prefix(info);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [], payloads: Array<{ id: string; latitud: number }> = [];
  page.on('pageerror', error => errors.push(error.message)); await installGps(page);
  page.on('request', request => {
    const match = request.url().match(/\/api\/manifiestos\/([^/]+)\/ubicacion$/);
    if (request.method() === 'POST' && match) payloads.push({ id: match[1], latitud: request.postDataJSON().latitud });
  });
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(mp + '/transporte/cargas');
    await page.getByRole('searchbox', { name: 'Número de manifiesto' }).fill(cases.prefix + '-FLEET');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    for (const load of [cases.fleetA, cases.fleetB]) await page.getByRole('checkbox', { name: `Llevo ${load.numero} en este móvil`, exact: true }).check();
    await page.getByRole('button', { name: 'Iniciar GPS', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__qaGpsOrder.ready())).toBe(true);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    const now = await page.evaluate(() => Date.now());
    const received = Promise.all([cases.fleetA, cases.fleetB].map((load: { id: string }) => page.waitForResponse(response =>
      response.url().endsWith(`/manifiestos/${load.id}/ubicacion`) && response.request().method() === 'POST' && response.status() === 200)));
    await emit(page, 'watch', -33.22, -68.22, now - 1_000);
    await received;
    await expect.poll(() => payloads.length, { timeout: 15000 }).toBe(2);
    await expect(page.getByRole('region', { name: 'Cargas marcadas' })).toContainText('GPS recibido');
    await page.clock.runFor(30_000);
    await page.waitForTimeout(500);
    expect(payloads).toHaveLength(2);
    await emit(page, 'watch', -34.22, -69.22, now - 2_000);
    await page.waitForTimeout(500);
    expect(payloads).toHaveLength(2); expect(payloads.every(point => point.latitud === -33.22)).toBe(true);
    const updated = Promise.all([cases.fleetA, cases.fleetB].map((load: { id: string }) => page.waitForResponse(response =>
      response.url().endsWith(`/manifiestos/${load.id}/ubicacion`) && response.request().method() === 'POST' && response.status() === 200)));
    await emit(page, 'watch', -33.23, -68.23, now + 30_000);
    await updated; await expect.poll(() => payloads.length, { timeout: 15000 }).toBe(4);
    expect(payloads.filter(point => point.latitud === -33.23)).toHaveLength(2);
    await page.getByRole('region', { name: 'Cargas marcadas' }).screenshot({ path: info.outputPath('flota-gps-recibido.png') });
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('fleet-proof.json'), JSON.stringify({ surface: info.project.name, simulatedGps: true, uploads: payloads.length }));
  } finally { await context.close(); }
});

test('a replacement driver does not send an older callback', async ({ browser }, info) => {
  const data = fixture(), manifest = data.cases[info.project.name].relay, mp = prefix(info);
  const sourceContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport, serviceWorkers: 'allow' });
  const relayContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const source = await sourceContext.newPage(), relay = await relayContext.newPage(), errors: string[] = [], payloads: any[] = [];
  source.on('pageerror', error => errors.push(error.message)); relay.on('pageerror', error => errors.push(error.message));
  await installGps(relay); await isolatedMapTiles(relay, info);
  try {
    await login(source, info, 'transportista');
    const token = await source.evaluate(() => localStorage.getItem('sitrep_access_token'));
    const handoff = await source.request.post(`/api/manifiestos/${manifest.id}/tramos`, { headers: { Authorization: `Bearer ${token}` }, data: {
      id: randomUUID(), anteriorId: null, tipo: 'REGISTRADO', transportistaId: data.replacementId, datos: {}, motivo: 'Relevo artificial para revisar orden GPS',
    } });
    expect(handoff.status()).toBe(201);
    const { tramo, acceso } = (await handoff.json()).data;
    relay.on('request', request => { if (request.method() === 'POST' && request.url().endsWith(`/seguimiento-relevo/${tramo.id}/ubicacion`)) payloads.push(request.postDataJSON()); });
    if (info.project.name === 'app') await relay.setViewportSize({ width: 320, height: 800 });
    await relay.goto(`${mp}/relevo/${tramo.id}#${acceso}`);
    await relay.getByRole('button', { name: 'Compartir ubicación', exact: true }).click();
    await expect.poll(() => relay.evaluate(() => (window as any).__qaGpsOrder.ready())).toBe(true);
    await relay.clock.pauseAt(await relay.evaluate(() => Date.now() + 100));
    const now = await relay.evaluate(() => Date.now());
    await emit(relay, 'watch', -33.33, -68.33, now - 1_000);
    await expect(relay.getByRole('status')).toContainText('Ubicación recibida por SITREP');
    expect(payloads).toHaveLength(1);
    await relay.clock.runFor(30_000);
    await relay.waitForTimeout(500);
    expect(payloads).toHaveLength(1);
    await emit(relay, 'watch', -34.33, -69.33, now - 2_000);
    await relay.waitForTimeout(500);
    expect(payloads).toHaveLength(1); expect(payloads[0]).toMatchObject({ latitud: -33.33, longitud: -68.33 });
    const updated = relay.waitForResponse(response => response.url().endsWith(`/seguimiento-relevo/${tramo.id}/ubicacion`)
      && response.request().method() === 'POST' && response.status() === 200);
    await emit(relay, 'watch', -33.34, -68.34, now + 30_000);
    await updated; await expect.poll(() => payloads.length, { timeout: 15000 }).toBe(2);
    expect(payloads[1]).toMatchObject({ latitud: -33.34, longitud: -68.34 });
    await relay.screenshot({ path: info.outputPath('relevo-gps-recibido.png'), animations: 'disabled' });
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('relay-proof.json'), JSON.stringify({ surface: info.project.name, simulatedGps: true, uploads: payloads.length }));
  } finally { await sourceContext.close(); await relayContext.close(); }
});
