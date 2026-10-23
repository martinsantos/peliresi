import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix, readablePageHeading } from './helpers';

const fixture = () => {
  const data = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'concurrency-browser-fixture.json'), 'utf8'));
  expect(data).toMatchObject({ database: 'sitrep_night_qa_20260926', previewOnly: true, externalDelivery: false });
  expect(data.assigned).toHaveLength(2);
  expect(data.handoffs).toHaveLength(2);
  expect(data.longTrip.expectedIds).toHaveLength(500);
  return data;
};
async function proof(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
}
async function openTrip(page: Page, number: string) {
  const marker = page.getByTitle(`Viaje en tránsito: ${number}`, { exact: true });
  await expect(marker).toHaveCount(1);
  await marker.focus();
  await marker.press('Enter');
  const popup = page.getByTestId('monitor-live-popup');
  await expect(popup.getByText(number, { exact: true })).toBeVisible();
  return popup;
}

test('Monitor popups keep each original and replacement vehicle with its own driver', async ({ page }, info) => {
  const data = fixture(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'admin');
  const received = page.waitForResponse(response => response.url().endsWith('/api/centro-control/monitor-live') && response.status() === 200);
  await page.goto(prefix(info) + '/monitor');
  const actual = (await (await received).json()).data;
  for (const [index, expected] of [...data.assigned, ...data.handoffs].entries()) {
    const current = actual.enTransito.find((trip: any) => trip.manifiestoId === expected.id);
    expect(current).toBeTruthy();
    expect(current.vehiculo.patente).toBe(expected.expected);
    expect(current.chofer.nombre).toBe(expected.driver);
    if (expected.point) {
      expect(current.ultimaPosicion).toMatchObject(expected.point);
      expect(current.tramoActual).toMatchObject({ tipo: expected.tipo, gpsRecibido: true });
    }
    const popup = await openTrip(page, expected.numero);
    await expect(popup).toContainText(expected.expected);
    await expect(popup).toContainText('Chofer: ' + expected.driver);
    const frame = page.locator('.leaflet-popup');
    await expect.poll(() => frame.evaluate(el => {
      const bounds = el.getBoundingClientRect(), map = el.closest('.leaflet-container')!.getBoundingClientRect();
      return bounds.left >= Math.max(0, map.left) - 1 && bounds.right <= Math.min(innerWidth, map.right) + 1
        && bounds.top >= Math.max(0, map.top) - 1 && bounds.bottom <= Math.min(innerHeight, map.bottom) + 1;
    })).toBe(true);
    await proof(page, info, 'assigned-vehicle-' + index);
    await frame.locator('.leaflet-popup-close-button').click();
    await expect(popup).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('the office sees the newest long-trip position and the API retains its latest 500 ordered samples', async ({ page }, info) => {
  const data = fixture(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'admin');
  const received = page.waitForResponse(response => response.url().endsWith('/api/centro-control/monitor-live') && response.status() === 200);
  await page.goto(prefix(info) + '/monitor');
  const response = await received, actual = (await response.json()).data;
  const current = actual.enTransito.find((trip: any) => trip.manifiestoId === data.longTrip.id);
  const history = await page.request.get('/api/manifiestos/' + data.longTrip.id + '/viaje-actual', {
    headers: { Authorization: response.request().headers().authorization },
  });
  expect(history.status()).toBe(200);
  const route = await history.json();
  expect(route.data.map((point: any) => point.id)).toEqual(data.longTrip.expectedIds);
  expect(route.ventana).toMatchObject({ limite: 500, hayAnteriores: true, orden: 'timestamp_asc_id_asc' });
  // Compare persisted coordinates exactly across APIs. PostgreSQL's decimal
  // serialization can differ from the fixture's intermediate JS arithmetic.
  // Exact ID order above still establishes which 500 samples must be returned.
  const latest = route.data.at(-1);
  expect(latest.id).toBe(data.longTrip.latest.id);
  expect(latest.timestamp).toBe(data.longTrip.latest.timestamp);
  expect(current.ultimaPosicion).toMatchObject({ latitud: latest.latitud, longitud: latest.longitud, timestamp: latest.timestamp });
  expect(current.ruta).toHaveLength(30);
  expect(current.ruta.at(-1)).toMatchObject({ lat: latest.latitud, lng: latest.longitud });
  const popup = await openTrip(page, data.longTrip.numero);
  await expect(popup).toContainText('30 pts');
  await proof(page, info, 'long-trip-current-position');
  await info.attach('gps-window', { contentType: 'application/json', body: JSON.stringify({ latest: current.ultimaPosicion, window: route.ventana, returned: route.data.length, physicalAndroid: false }) });
  expect(errors).toEqual([]);
});

async function choose(page: Page, name: string, value: RegExp) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('option', { name: value }).click();
}
test('429 explains recovery and preserves the complete proposal until an explicit successful retry', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'operador');
  await page.goto(prefix(info) + '/manifiestos/nuevo');
  await choose(page, 'Generador *', /^QA Generador 1 /);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await choose(page, 'Tipo de Residuo *', /^Y1 - /);
  await page.getByLabel('Cantidad *', { exact: true }).fill('23');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await choose(page, 'Transportista *', /^QA Transporte 1 /);
  await choose(page, 'Vehículo (opcional)', /^QA002ZZ/);
  await choose(page, 'Chofer (opcional)', /^QA Segundo/);
  await page.getByLabel('Fecha estimada de retiro', { exact: true }).fill('2099-12-25');
  const note = 'QA reintento sin perder la propuesta ' + info.project.name;
  await page.getByLabel('Observaciones', { exact: true }).fill(note);
  const sent: any[] = []; let rejectedAt = 0;
  // Only the admission failure is simulated. The second submission uses the
  // actual API and isolated DB; no successful business response is fabricated.
  await page.route('**/api/manifiestos', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    sent.push(route.request().postDataJSON());
    if (sent.length === 1) {
      rejectedAt = Date.now();
      return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '1' },
        body: JSON.stringify({ success: false, code: 'RATE_LIMITED', retryAfterSeconds: 1, message: 'QA límite temporal' }) });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
  await expect(page.getByText('Esperá un momento', { exact: true })).toBeVisible();
  await expect(page.getByText(/Podés reintentar en 1 segundo/).first()).toBeVisible();
  await expect(page.getByText(/No hace falta recargar la página/).first()).toBeVisible();
  await expect(page).toHaveURL(/\/manifiestos\/nuevo$/);
  await expect(page.getByLabel('Observaciones', { exact: true })).toHaveValue(note);
  await expect(page.getByLabel('Fecha estimada de retiro', { exact: true })).toHaveValue('2099-12-25');
  await expect(page.getByRole('button', { name: 'Vehículo (opcional)', exact: true })).toContainText('QA002ZZ');
  await expect(page.getByRole('button', { name: 'Chofer (opcional)', exact: true })).toContainText('QA Segundo');
  await readablePageHeading(page);
  await proof(page, info, 'proposal-rate-limited');
  await expect.poll(() => Date.now() - rejectedAt).toBeGreaterThanOrEqual(1100);
  expect(sent).toHaveLength(1); // No automatic replay of a business write.
  const succeeded = page.waitForResponse(response => response.url().endsWith('/api/manifiestos') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
  const created = (await (await succeeded).json()).data.manifiesto;
  await expect(page).toHaveURL(new RegExp('/manifiestos/' + created.id + '$'));
  expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]);
  expect(sent[1]).toMatchObject({ observaciones: note, fechaEstimadaRetiro: '2099-12-25', residuos: [{ cantidad: 23, unidad: 'kg' }] });
  await expect(page.getByRole('region', { name: 'Aprobaciones de las partes' })).toBeVisible();
  await proof(page, info, 'proposal-retry-success');
  expect(errors).toEqual([]);
});


test('temporary profile rejection on focus preserves the signed-in identity and unfinished form', async ({ page }, info) => {
  await login(page, info, 'operador');
  await page.goto(prefix(info) + '/manifiestos/nuevo');
  await choose(page, 'Generador *', /^QA Generador 1 /);
  const identifier = page.getByRole('button', { name: 'Generador *', exact: true });
  const originalCredential = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
  expect(Boolean(originalCredential)).toBe(true);
  for (const status of [429, 503]) {
    await page.route('**/api/auth/profile', route => route.fulfill({ status, contentType: 'application/json',
      headers: status === 429 ? { 'Retry-After': '1' } : {},
      body: JSON.stringify({ success: false, code: status === 429 ? 'RATE_LIMITED' : 'ADMISSION_UNAVAILABLE', message: 'QA interrupción temporal', retryAfterSeconds: 1 }) }));
    const rejected = page.waitForResponse(response => response.url().endsWith('/api/auth/profile') && response.status() === status);
    // Simulate the browser's focus event, without invoking product handlers or
    // fabricating an authenticated profile. Physical Android remains deferred.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await rejected;
    await expect(page).toHaveURL(/\/manifiestos\/nuevo$/);
    await expect(identifier).toContainText('QA Generador 1');
    expect(await page.evaluate(expected => localStorage.getItem('sitrep_access_token') === expected, originalCredential)).toBe(true);
    await proof(page, info, 'profile-temporary-' + status);
    await page.unroute('**/api/auth/profile');
    const recovered = page.waitForResponse(response => response.url().endsWith('/api/auth/profile') && response.status() === 200);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const restored = (await (await recovered).json()).data.user;
    expect(restored.rol).toBe('OPERADOR');
    await expect(identifier).toContainText('QA Generador 1');
    await expect(page).toHaveURL(/\/manifiestos\/nuevo$/);
  }
});
