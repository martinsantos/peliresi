import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

function earliestSyntheticSlot() {
  const raw=execFileSync('psql',['-U','qa','-h','127.0.0.1','-p','55440','-d','sitrep_night_qa_20260926','-X','-tA','-c',`SELECT json_build_object('database',current_database(),'host',inet_server_addr(),'port',inet_server_port(),'first',COALESCE(min("fechaProgramada"),now())) FROM inspecciones`],{encoding:'utf8'});
  const row=JSON.parse(raw.trim()); assert.equal(row.database,'sitrep_night_qa_20260926'); assert.equal(row.host,'127.0.0.1'); assert.equal(row.port,55440);
  // Stable first-page fixture even after repeated suites; production order is unchanged.
  return new Date(new Date(row.first).getTime()-2*86400000).toISOString().slice(0,16);
}

const consoleLogs = new WeakMap<Page, Array<{ level: string; message: string }>>();
test.afterEach(async ({ page }, info) => {
  await info.attach('console-health', { body: JSON.stringify(consoleLogs.get(page) || [], null, 2), contentType: 'application/json' });
});
function health(page: Page) {
  const errors: string[] = [];
  const messages: Array<{ level: string; message: string }> = [];
  consoleLogs.set(page, messages);
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) messages.push({ level: message.type(), message: message.text() });
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return errors;
}
async function visibleProof(page: Page, info: TestInfo, name: string) {
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test('control center queries real layers, refreshes and opens the exact active inspection', async ({ page }, info) => {
  await login(page, info);
  const errors = health(page);
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('GENERADOR');
  await page.getByRole('combobox', { name: 'Actor inspeccionado', exact: true }).selectOption({ label: 'QA Generador 2' });
  // Put this scheduled fixture before the many existing undated QA drafts.
  // The operational list is legitimately ordered by scheduled date, not newest ID.
  await page.getByLabel('Fecha programada', { exact: true }).fill(earliestSyntheticSlot());
  const creation = page.waitForResponse(r => r.url().endsWith('/api/inspecciones') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const saved = await creation;
  expect(saved.status()).toBe(201);
  const inspection = (await saved.json()).data;
  const start = page.waitForResponse(r => r.url().endsWith(`/inspecciones/${inspection.id}/estado`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Iniciar visita', exact: true }).click();
  expect((await start).status()).toBe(200);
  const activity = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad') && r.status() === 200);
  const operations = page.waitForResponse(r => r.url().includes('/api/inspecciones/operaciones') && r.status() === 200);
  await page.goto(`${prefix(info)}/centro-control`);
  const stats = (await (await activity).json()).data;
  const agenda = (await (await operations).json()).data;
  expect(agenda.items.some((r: { id: string }) => r.id === inspection.id)).toBe(true);
  await expect(page.getByText('Total Manifiestos', { exact: true })).toBeVisible();
  await expect(page.getByText('Total Manifiestos', { exact: true }).locator('..')).toContainText(String(stats.estadisticas.totalManifiestos));
  const layer = page.getByRole('button', { name: 'Generadores', exact: true });
  await expect(layer).toHaveAttribute('aria-pressed', 'true');
  const changed = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad') && !new URL(r.url()).searchParams.get('capas')?.includes('generadores') && r.status() === 200);
  await layer.click();
  await changed;
  await expect(layer).toHaveAttribute('aria-pressed', 'false');
  const refreshed = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad') && r.status() === 200);
  await page.getByTitle('Actualizar ahora', { exact: true }).click();
  await refreshed;
  const inspectionPanel = page.locator('button[aria-expanded]').filter({ hasText: /^Inspecciones/ });
  await inspectionPanel.click();
  await expect(inspectionPanel).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: new RegExp(inspection.numero) }).click();
  await visibleProof(page, info, 'control-selected-inspection');
  await page.getByRole('button', { name: 'Abrir expediente', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/inspecciones/${inspection.id}`));
  await expect(page.getByRole('heading', { name: inspection.numero, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('monitor LIVE, PLAYBACK and FORECAST query real data and expose usable controls', async ({ page }, info) => {
  await login(page, info);
  const errors = health(page);
  await page.goto(`${prefix(info)}/centro-control`);
  const live = page.waitForResponse(r => r.url().includes('/api/centro-control/monitor-live'), { timeout: 15_000 });
  await page.goto(`${prefix(info)}/monitor`);
  await expect(page).toHaveURL(new RegExp(`${prefix(info)}/monitor$`));
  const liveResponse = await live;
  expect(liveResponse.status()).toBe(200);
  const liveData = (await liveResponse.json()).data;
  expect(Number.isFinite(liveData.estadisticas.total)).toBe(true);
  const header = page.locator('.wr-layout-header');
  await expect(header.getByRole('button', { name: 'LIVE', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(header.getByRole('button', { name: 'PLAYBACK', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(header.getByRole('button', { name: 'FORECAST', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.wr-layout-bottom')).toContainText(String(liveData.estadisticas.total));
  await expect(page.getByText('Agenda activa · lugares de visita', { exact: true })).toBeVisible();
  await visibleProof(page, info, 'monitor-live');
  const timeline = page.waitForResponse(r => r.url().includes('/api/centro-control/timeline'));
  await header.getByRole('button', { name: 'PLAYBACK', exact: true }).click();
  const timelineResponse = await timeline;
  expect(timelineResponse.status()).toBe(200);
  const timelineData = (await timelineResponse.json()).data;
  expect(timelineData.eventos.length).toBeGreaterThan(0);
  await expect(page.getByText('Creados', { exact: true })).toBeVisible();
  await visibleProof(page, info, 'monitor-playback');
  const forecast = page.waitForResponse(r => r.url().includes('/api/centro-control/forecast'));
  await header.getByRole('button', { name: 'FORECAST', exact: true }).click();
  const forecastResponse = await forecast;
  expect(forecastResponse.status()).toBe(200);
  const forecastData = (await forecastResponse.json()).data;
  expect(Array.isArray(forecastData.pendienteRetiro)).toBe(true);
  await expect(page.getByText(`Pendiente Retiro (${forecastData.pendienteRetiro.length})`, { exact: true })).toBeVisible();
  await visibleProof(page, info, 'monitor-forecast');
  await header.getByTitle('Cerrar (Esc)', { exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/centro-control$'));
  expect(errors).toEqual([]);
});

test('carrier control center does not expose inspection operations', async ({ page }, info) => {
  await login(page, info, 'transportista');
  const errors = health(page);
  await page.goto(`${prefix(info)}/centro-control`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Inspecciones', exact: true })).toHaveCount(0);
  await expect(page.getByText('Inspecciones activas', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Total Manifiestos', { exact: true })).toBeVisible();
  await visibleProof(page, info, 'carrier-control-center');
  expect(errors).toEqual([]);
});

test('distribution total matches the real complete state aggregation', async ({ page }, info) => {
  await login(page, info);
  const errors = health(page);
  const response = page.waitForResponse(r => r.url().includes('/api/centro-control/actividad') && r.status() === 200);
  await page.goto(`${prefix(info)}/centro-control`);
  const stats = (await (await response).json()).data.estadisticas;
  // Stage-event activity is intentionally a separate cohort. Distribution and
  // headline must use the same created-period aggregation, including cancellations.
  expect(stats.distribucionPorEstado).toBeDefined();
  const expectedTotal = Object.values(stats.distribucionPorEstado).reduce<number>((sum, count) => sum + Number(count), 0);
  expect(expectedTotal).toBe(stats.totalManifiestos);
  await expect(page.getByText('Total Manifiestos', { exact: true }).locator('..')).toContainText(String(expectedTotal));
  await page.locator('summary').filter({ hasText: 'Actividad y estadísticas del período' }).click();
  await expect(page.getByText('Total manifiestos', { exact: true }).locator('..')).toContainText(String(expectedTotal));
  for (const [state, count] of Object.entries(stats.distribucionPorEstado)) {
    if (Number(count) > 0) await expect(page.getByText(state.replace(/_/g, ' '), { exact: true }).last()).toBeVisible();
  }
  await page.getByText('Total manifiestos', { exact: true }).scrollIntoViewIfNeeded();
  await visibleProof(page, info, 'complete-state-distribution');
  expect(errors).toEqual([]);
});
