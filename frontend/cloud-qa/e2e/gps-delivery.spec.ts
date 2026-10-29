import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

// These ordering scenarios start with two explicitly saved points. Keep the
// simulated sensor quiet so a new fix does not change the number under test;
// the separate GPS safety suite checks preservation of a new last fix.
async function keepSensorQuiet(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition() { return 1; }, getCurrentPosition() {}, clearWatch() {},
    } });
  });
}

test.beforeAll(async () => { await assertCloudDatabase(); });

test('preserves unsent GPS before confirming delivery', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-delivery-private.json'), 'utf8'));
  const manifest = fixture.cases[info.project.name];
  const queueKey = `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner), manifest.id]))}`;
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [], events: string[] = [];
  let gpsBlocked = true, deliveryRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`)) {
      deliveryRequests++; events.push('delivery-request');
    }
  });
  page.on('response', response => {
    if (response.request().method() === 'POST' && response.url().endsWith(`/manifiestos/${manifest.id}/ubicacion-idempotente`) && response.status() === 200) events.push('gps-accepted');
  });
  await keepSensorQuiet(page);
  await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => {
    if (gpsBlocked) await route.abort('failed'); else await route.continue();
  });
  const pending = [{ lat: -33.123, lng: -68.123, speed: null, heading: null }, { lat: -33.456, lng: -68.456, speed: null, heading: null }];
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(({ key, points }) => localStorage.setItem(key, JSON.stringify(points)), { key: queueKey, points: pending });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText('2 pendientes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    await page.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    const deliveryDialog = page.getByRole('dialog', { name:'Confirmar Entrega?', exact:true });
    await expect(deliveryDialog.getByRole('alert')).toContainText('Ubicaciones pendientes');
    await expect(deliveryDialog.getByRole('alert')).toBeVisible();
    await expect(deliveryDialog.getByRole('alert')).toBeFocused();
    expect(deliveryRequests).toBe(0);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), queueKey)).toEqual(pending.map(point => ({ ...point, puntoId: expect.any(String) })));
    await page.screenshot({ path: info.outputPath('entrega-ubicaciones-pendientes.png'), animations: 'disabled' });

    gpsBlocked = false;
    const delivered = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`));
    await page.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    expect((await delivered).status()).toBe(200);
    expect(events.slice(0, 3)).toEqual(['gps-accepted', 'gps-accepted', 'delivery-request']);
    expect(deliveryRequests).toBe(1);
    expect(await page.evaluate(key => localStorage.getItem(key), queueKey)).toBeNull();
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('gps-delivery-proof.json'), JSON.stringify({ surface: info.project.name, events, simulatedGps: true }));
  } finally { await context.close(); }
});

test('retries an offline delivery without resending an acknowledged location', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-delivery-private.json'), 'utf8'));
  const manifest = fixture.offlineCases[info.project.name];
  const queueKey = `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner), manifest.id]))}`;
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [], events: string[] = [];
  let mode: 'blocked' | 'partial' | 'allow' = 'blocked', accepted = 0, deliveries = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`)) { deliveries++; events.push('delivery-request'); }
  });
  page.on('response', response => {
    if (response.request().method() === 'POST' && response.url().endsWith(`/manifiestos/${manifest.id}/ubicacion-idempotente`) && response.status() === 200) { accepted++; events.push('gps-accepted'); }
  });
  await keepSensorQuiet(page);
  await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => {
    if (mode === 'blocked' || (mode === 'partial' && accepted > 0)) await route.abort('failed'); else await route.continue();
  });
  const pending = [{ lat: -33.123, lng: -68.123, speed: null, heading: null }, { lat: -33.456, lng: -68.456, speed: null, heading: null }];
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(({ key, points }) => localStorage.setItem(key, JSON.stringify(points)), { key: queueKey, points: pending });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText('2 pendientes', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar entrega', exact: true })).toBeEnabled();
    await expect.poll(() => page.evaluate(id => Object.keys(localStorage).some(key => {
      if (!key.startsWith('viaje_snapshot_v2_')) return false;
      const saved=JSON.parse(localStorage.getItem(key)||'{}');
      return saved.id===id && typeof saved.handoffActive==='boolean';
    }), manifest.id)).toBe(true);
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    await page.getByRole('button', { name: 'Sí, Confirmar Entrega', exact: true }).click();
    await expect(page.getByText('Entrega pendiente', { exact: true }).last()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText:'Entrega guardada. Se intentará enviar o comprobar al sincronizar' })).toBeVisible();
    await expect(page.getByRole('button', { name:'Confirmar entrega', exact:true })).toHaveCount(0);
    expect(deliveries).toBe(0);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), queueKey)).toEqual(pending.map(point => ({ ...point, puntoId: expect.any(String) })));
    await page.getByRole('link', { name:'Ver todos mis viajes', exact:true }).click();
    await page.goBack();
    await expect(page.getByRole('status').filter({ hasText:'Entrega guardada. Se intentará enviar o comprobar al sincronizar' })).toBeVisible();
    await expect(page.getByRole('button', { name:'Confirmar entrega', exact:true })).toHaveCount(0);

    mode = 'partial';
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    const notice = page.getByRole('status').filter({ hasText: 'Hay cambios esperando reintento' });
    await expect(notice).toBeVisible({ timeout: 20000 });
    expect(accepted).toBe(1);
    expect(deliveries).toBe(0);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), queueKey)).toEqual([{ ...pending[1], puntoId: expect.any(String) }]);
    mode = 'allow';
    const delivered = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega-idempotente`));
    await notice.getByRole('button', { name: 'Reintentar', exact: true }).click();
    expect((await delivered).status()).toBe(200);
    expect(events.slice(0, 3)).toEqual(['gps-accepted', 'gps-accepted', 'delivery-request']);
    expect(deliveries).toBe(1);
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), queueKey)).toBeNull();
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('gps-offline-delivery-proof.json'), JSON.stringify({ surface: info.project.name, events, simulatedGps: true }));
  } finally { await context.close(); }
});

test('sends pending GPS before handing the trip to a replacement', async ({ browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-delivery-private.json'), 'utf8'));
  const manifest = fixture.handoffCases[info.project.name];
  const queueKey = `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner), manifest.id]))}`;
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport,
    isMobile: info.project.name === 'app', hasTouch: info.project.name === 'app', serviceWorkers: 'allow' });
  const page = await context.newPage(), errors: string[] = [], events: string[] = [];
  let gpsBlocked = true, handoffs = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith(`/manifiestos/${manifest.id}/tramos`)) { handoffs++; events.push('handoff-request'); }
  });
  page.on('response', response => {
    if (response.request().method() === 'POST' && response.url().endsWith(`/manifiestos/${manifest.id}/ubicacion-idempotente`) && response.status() === 200) events.push('gps-accepted');
  });
  await keepSensorQuiet(page);
  await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`, async route => {
    if (gpsBlocked) await route.abort('failed'); else await route.continue();
  });
  const pending = [{ lat: -33.123, lng: -68.123, speed: null, heading: null }, { lat: -33.456, lng: -68.456, speed: null, heading: null }];
  try {
    await login(page, info, 'transportista');
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(({ key, points }) => localStorage.setItem(key, JSON.stringify(points)), { key: queueKey, points: pending });
    await page.goto(`${prefix(info)}/transporte/viaje/${manifest.id}`);
    await expect(page.getByText('2 pendientes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Registrar traspaso', exact: true }).click();
    await page.getByLabel('Reemplazo').selectOption('EXTERNO');
    await page.getByLabel('Empresa', { exact: true }).fill('QA Reemplazo eventual');
    await page.getByLabel('Motivo del traspaso').fill('Rotura simulada de prueba');
    await page.getByRole('button', { name: 'Confirmar traspaso', exact: true }).click();
    const handoffAlert = page.getByRole('form', { name:'Registrar traspaso de carga' }).getByRole('alert');
    await expect(handoffAlert).toHaveText('No se pudieron enviar las ubicaciones. Revisá la conexión y volvé a intentar.');
    await expect(handoffAlert).toBeVisible();
    await expect(handoffAlert).toBeFocused();
    expect(handoffs).toBe(0);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), queueKey)).toEqual(pending.map(point => ({ ...point, puntoId: expect.any(String) })));
    await expect(page.getByLabel('Empresa', { exact: true })).toHaveValue('QA Reemplazo eventual');
    await page.screenshot({ path: info.outputPath('relevo-ubicaciones-pendientes.png'), animations: 'disabled' });
    gpsBlocked = false;
    const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/manifiestos/${manifest.id}/tramos`));
    await page.getByRole('button', { name: 'Confirmar traspaso', exact: true }).click();
    expect((await response).ok()).toBe(true);
    expect(events.slice(0, 3)).toEqual(['gps-accepted', 'gps-accepted', 'handoff-request']);
    expect(handoffs).toBe(1);
    await expect(page.getByRole('region', { name: 'Acceso GPS del reemplazo' })).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), queueKey)).toBeNull();
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('gps-handoff-proof.json'), JSON.stringify({ surface: info.project.name, events, simulatedGps: true }));
  } finally { await context.close(); }
});
