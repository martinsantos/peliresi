import { test, expect } from '@playwright/test';
import { isolatedMapTiles, login, prefix } from './helpers';
import { approveExceptionalJourney, createExceptionalJourney } from '../exceptional-journey';

for (const alias of ['generador', 'transportista', 'operador']) test(alias + ' finds an eventual beyond the first page and returns to the same filters', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await login(page, info, alias);
  await page.goto('http://127.0.0.1:4177' + prefix(info) + '/manifiestos/baja-intensidad');
  await page.getByLabel('Buscar eventual', { exact: true }).fill('qa listado');
  await expect(page.getByRole('status').filter({ hasText: /registros · Página 1/ })).toContainText(alias === 'operador' ? '48 registros' : '24 registros');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /registros · Página 2/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Etapa del eventual', exact: true }).selectOption('RETIRADO');
  await expect(page.getByRole('status').filter({ hasText: /registros · Página 1/ })).toContainText(alias === 'operador' ? '24 registros' : '12 registros');
  const row = page.getByRole('button', { name: /^Abrir eventual BI-/ }).first();
  const reference = (await row.getAttribute('aria-label'))!.replace('Abrir eventual ', '');
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(alias + '-filtered-list.png') });
  await row.click();
  await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Retirado');
  await page.getByRole('button', { name: 'Ver registros', exact: true }).click();
  await expect(page.getByLabel('Buscar eventual', { exact: true })).toHaveValue('qa listado');
  await expect(page.getByRole('combobox', { name: 'Etapa del eventual', exact: true })).toHaveValue('RETIRADO');
  await page.getByLabel('Buscar eventual', { exact: true }).fill(reference);
  await expect(page.getByRole('button', { name: /^Abrir eventual BI-/ })).toHaveCount(1);
  await expect(page).toHaveTitle(/SITREP/i); await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('a second party approval refreshes the open eventual while preserving an in-progress note and observed load', async ({ page, browser }, info) => {
  await login(page, info, 'operador');
  const id = await createExceptionalJourney(page, prefix(info), async () => {}, 'Transportista');
  await approveExceptionalJourney(page, 'quien lo creó');
  await page.getByLabel('Nota de la acción', { exact: true }).fill('QA nota preservada durante otra aprobación');
  const context = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const other = await context.newPage(); await login(other, info, 'transportista');
    await other.goto('http://127.0.0.1:4177' + prefix(info) + '/manifiestos/baja-intensidad?registro=' + id);
    await approveExceptionalJourney(other, 'transportista');
    await expect(page.getByText('Aprobación de las partes: aprobado', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/El registro cambió mientras escribías/)).toBeVisible();
    await expect(page.getByLabel('Nota de la acción', { exact: true })).toHaveValue('QA nota preservada durante otra aprobación');
    await expect(page.getByRole('button', { name: 'Registrar retirado', exact: true })).toBeDisabled();
    await page.getByText(/El registro cambió mientras escribías/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('concurrent-note-protected.png') });
    await page.getByRole('button', { name: 'Usar versión actual', exact: true }).click();
    await page.getByRole('button', { name: 'Registrar retirado', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Retirado');
    // A second current revision must not consume a half-written difference either.
    await page.getByRole('button', { name: 'Registrar diferencia', exact: true }).click();
    await page.getByLabel('Corriente', { exact: true }).fill('Y21');
    await page.getByLabel('Cantidad', { exact: true }).fill('12');
    await page.getByLabel('Nota de la acción', { exact: true }).fill('QA carga observada aún sin guardar');
    await expect(other.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Retirado', { timeout: 15000 });
    await other.getByRole('button', { name: 'Registrar recibido', exact: true }).click();
    await expect(page.getByText(/El registro cambió mientras escribías/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('Corriente', { exact: true })).toHaveValue('Y21');
    await expect(page.getByLabel('Cantidad', { exact: true })).toHaveValue('12');
    await expect(page.getByRole('button', { name: 'Guardar diferencia', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Usar versión actual', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar diferencia', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Revisión diferencia 1' })).toBeVisible();
    await page.getByRole('heading', { name: 'Historial', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('concurrent-difference-saved.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  } finally { await context.close(); }
});

test('manual keeps the eventual guide and explains recovery in the existing design', async ({ page }, info) => {
 await isolatedMapTiles(page, info);
 await page.goto('http://127.0.0.1:4177/manual/tutorial.html?guide=eventuales-aprobaciones-avisos');
 await page.evaluate(() => document.fonts.ready);
 expect(await page.evaluate(() => document.fonts.check('22px "Material Symbols Rounded"'))).toBe(true);
 await expect(page.locator('.material-symbols-rounded').first()).toHaveCSS('font-family', '"Material Symbols Rounded"');
 await expect(page.getByRole('heading', { name: 'Eventuales: qué apruebo y quién sigue', exact: true })).toBeVisible();
 await expect(page.getByText(/Para encontrar un registro anterior usá Buscar eventual/)).toBeVisible();
 await page.screenshot({ path: info.outputPath('eventual-manual.png') });
 expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('a lost response is recovered from the exact saved event without a duplicate movement', async ({ page }, info) => {
 await login(page, info, 'operador');
 const id = await createExceptionalJourney(page, prefix(info));
 await approveExceptionalJourney(page, 'quien lo creó');
 await page.getByLabel('Nota de la acción', { exact: true }).fill('QA retiro con respuesta perdida');
 const endpoint = '**/api/manifiestos/baja-intensidad/' + id + '/eventos';
 let requests = 0;
 await page.route(endpoint, async route => {
   requests++; const response = await route.fetch(); expect(response.status()).toBe(200);
   await route.abort('connectionfailed');
 }, { times: 1 });
 await page.getByRole('button', { name: 'Registrar retirado', exact: true }).click();
 await expect(page.getByText('La acción ya estaba guardada. Recuperamos la confirmación sin duplicarla.')).toBeVisible({ timeout: 15000 });
 await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Retirado');
 await expect(page.getByLabel('Nota de la acción', { exact: true })).toHaveValue('');
 expect(requests).toBe(1);
 await page.getByRole('heading', { name: 'Historial', exact: true }).scrollIntoViewIfNeeded();
 await expect(page.getByText('QA retiro con respuesta perdida', { exact: true })).toHaveCount(1);
 await page.screenshot({ path: info.outputPath('lost-response-recovered.png') });
});
