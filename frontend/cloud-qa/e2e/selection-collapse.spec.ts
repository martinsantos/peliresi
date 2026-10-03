import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, nonObstructingNotices, prefix } from './helpers';

function health(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return errors;
}

async function proof(page: Page, info: TestInfo, name: string) {
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
}

test('shared searchable actor selection shows choices first and keeps deliberate search and Escape usable', async ({ page }, info) => {
  const errors = health(page);
  await login(page, info);
  await page.goto(`${prefix(info)}/manifiestos/nuevo`);
  await expect(page.getByRole('main').getByRole('heading', { name: 'Nuevo Manifiesto', exact: true })).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Generador *', exact: true });
  await trigger.click();
  const search = page.getByRole('textbox', { name: 'Buscar Generador *', exact: true });
  await expect(page.getByRole('option', { name: /QA Generador 1/ })).toBeVisible();
  await expect(search).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.matches('input, textarea, [contenteditable="true"]'))).toBe(false);
  await proof(page, info, 'select-choices-before-search');
  await page.getByRole('option', { name: /QA Generador 1/ }).click();
  await expect(trigger).toContainText('QA Generador 1');
  await trigger.click();
  await search.click();
  await expect(search).toBeFocused();
  await search.fill('QA Generador 2');
  await expect(page.getByRole('option')).toHaveCount(1);
  await search.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(trigger).toContainText('QA Generador 1');
  await expect(trigger).toBeFocused();
  await trigger.press('ArrowDown');
  await expect(page.getByRole('option', { name: /QA Generador 1/ })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(search).toBeFocused();
  await search.fill('QA Generador 2');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('option', { name: /QA Generador 2/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('QA Generador 2');
  await proof(page, info, 'select-actor-confirmed');
  expect(errors).toEqual([]);
});

test('inspection indexes do not focus search and closing a focused control preserves its saved observation', async ({ page }, info) => {
  const errors = health(page);
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección', exact: true });
  await dialog.getByRole('combobox', { name: 'Actor inspeccionado', exact: true }).selectOption({ label: 'QA Generador 1' });
  const created = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const inspection = (await response.json()).data;
  expect(inspection.items.length).toBeGreaterThan(1);
  const started = page.waitForResponse(response => response.url().endsWith(`/api/inspecciones/${inspection.id}/estado`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Iniciar visita', exact: true }).click();
  expect((await started).status()).toBe(200);
  await page.getByRole('navigation', { name: 'Secciones del expediente' }).getByRole('link', { name: 'Controles', exact: true }).click();
  await page.getByRole('link', { name: 'En campo', exact: true }).click();
  const jump = page.getByRole('button', { name: /^Ir a un control:/ });
  await jump.click();
  const search = page.getByRole('searchbox', { name: 'Buscar control', exact: true });
  await expect(search).not.toBeFocused();
  const field = inspection.items[0];
  const index = page.getByRole('navigation', { name: 'Índice de controles', exact: true });
  await expect(index.getByRole('button').first()).toBeVisible();
  await proof(page, info, 'inspection-options-no-autofocus');
  await index.getByRole('button').filter({ hasText: field.etiqueta }).click();
  const row = page.locator(`[id="control-${field.id}"]`);
  const header = row.locator('button[aria-controls]').first();
  const observation = row.getByRole('textbox', { name: `Observación: ${field.etiqueta}`, exact: true });
  await observation.fill('QA observación conservada al plegar');
  const focused = page.getByRole('button', { name: 'Volver al control actual', exact: true });
  if (await focused.isVisible()) await focused.click();
  await header.scrollIntoViewIfNeeded();
  const before = (await header.boundingBox())!;
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(observation).toHaveCount(0);
  await expect(page.locator('#checklist button[aria-controls^="control-detail-"][aria-expanded="true"]')).toHaveCount(0);
  const after = (await header.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
  await proof(page, info, 'inspection-current-control-closed');
  await header.click();
  await expect(observation).toHaveValue('QA observación conservada al plegar');
  const saved = page.waitForResponse(response => response.url().endsWith(`/api/inspecciones/${inspection.id}/borrador`) && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  const acknowledged = await saved;
  expect(acknowledged.status()).toBe(200);
  expect((await acknowledged.json()).data.items.find((item: { id: string }) => item.id === field.id).observacion).toBe('QA observación conservada al plegar');
  await expect(page.getByRole('banner').getByLabel('Función actual')).toHaveText('Inspector');
  await expect(page.getByText('Cambios confirmados en el servidor', { exact: true })).toBeVisible();
  await nonObstructingNotices(page);
  await expect(page.getByRole('region', { name: 'Avisos del sistema' }).getByRole('status')).toHaveCount(1);
  await proof(page, info, 'inspection-save-notice-safe');
  await page.getByRole('region', { name: 'Avisos del sistema' }).getByRole('button', { name: 'Cerrar notificación' }).last().click();
  await page.reload();
  await expect(observation).toHaveValue('QA observación conservada al plegar');

  await page.getByRole('link', { name: 'Datos declarados', exact: true }).click();
  const declaredJump = page.getByRole('button', { name: /^Ir a un dato declarado:/ });
  await declaredJump.click();
  const declaredSearch = page.getByRole('searchbox', { name: 'Buscar dato declarado', exact: true });
  await expect(declaredSearch).not.toBeFocused();
  const declaredIndex = page.getByRole('navigation', { name: 'Datos declarados', exact: true });
  const first = declaredIndex.getByRole('button').first();
  await expect(first).toBeVisible();
  const label = (await first.locator('span.block.text-sm').textContent())!;
  await declaredSearch.click();
  await declaredSearch.fill(label);
  await expect(declaredSearch).toBeFocused();
  await declaredIndex.getByRole('button').first().click();
  const detail = page.getByRole('textbox', { name: 'Valor verificado: ' + label, exact: true });
  await expect(detail).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar detalle', exact: true }).click();
  await expect(detail).toHaveCount(0);
  const groups = page.locator('#declaracion button.sticky[aria-expanded]');
  for (const group of await groups.all()) {
    if (await group.getAttribute('aria-expanded') === 'true') await group.click();
  }
  await expect(page.locator('#declaracion button.sticky[aria-expanded="true"]')).toHaveCount(0);
  await proof(page, info, 'inspection-declared-groups-closed');
  expect(errors).toEqual([]);
});

test('control center closes every active header without forcing another panel open and retains the trip filter', async ({ page }, info) => {
  const errors = health(page);
  await login(page, info);
  const activity = page.waitForResponse(response => response.url().includes('/api/centro-control/actividad') && response.status() === 200);
  await page.goto(`${prefix(info)}/centro-control`);
  await activity;
  const agenda = page.getByRole('region', { name: 'Agenda y viajes', exact: true });
  const active = agenda.getByRole('button', { name: /^Viajes Activos/ });
  if (await active.getAttribute('aria-expanded') !== 'true') await active.click();
  await agenda.getByPlaceholder('Buscar por número o transportista...').fill('QA filtro conservado');
  await expect(active).toContainText('0 filtrados');
  for (const name of ['Viajes Activos', 'Viajes Realizados', 'Inspecciones']) {
    const header = agenda.getByRole('button', { name: new RegExp('^' + name) });
    if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
    await expect(agenda.locator('button[aria-expanded="true"]')).toHaveCount(1);
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    await expect(agenda.locator('button[aria-expanded="true"]')).toHaveCount(0);
    await expect(agenda.getByPlaceholder('Buscar por número o transportista...')).toHaveCount(0);
    await expect(active).toContainText('0 filtrados');
    expect((await header.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await active.click();
  await expect(agenda.getByPlaceholder('Buscar por número o transportista...')).toHaveValue('QA filtro conservado');
  await active.focus();
  await active.press('Space');
  await expect(active).toHaveAttribute('aria-expanded', 'false');
  await active.press('Space');
  await expect(active).toHaveAttribute('aria-expanded', 'true');
  await active.click();
  await agenda.scrollIntoViewIfNeeded();
  await proof(page, info, 'control-all-headers-closed');
  expect(errors).toEqual([]);
});
