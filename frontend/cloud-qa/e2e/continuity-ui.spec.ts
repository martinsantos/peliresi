import { expect, test, type Page } from '@playwright/test';
import { login, prefix } from './helpers';

async function choose(page: Page, label: string, pattern: RegExp) {
  const input = page.getByRole('button', { name: label, exact: true });
  if (await input.isEnabled()) {
    await input.click();
    await page.getByRole('option', { name: pattern }).click();
  }
}
for (const role of ['admin', 'generador', 'transportista', 'operador']) {
  test(role + ': form survives leaving, reload and explicit discard', async ({ page }, info) => {
    await login(page, info, role);
    const writes: string[] = [];
    page.on('request', request => { if (request.method() !== 'GET' && /\/api\/manifiestos(?:\/|$)/.test(new URL(request.url()).pathname)) writes.push(request.method() + ' ' + request.url()); });
    await page.goto(prefix(info) + '/manifiestos/nuevo');
    await choose(page, 'Generador *', /^QA Generador 1 /);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await choose(page, 'Tipo de Residuo *', /^Y1 - /);
    await page.getByLabel('Cantidad *', { exact: true }).fill('12.5');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await choose(page, 'Transportista *', /^QA Transporte 1 /);
    await choose(page, 'Operador / Destino *', /^QA Operador 1 /);
    const note = 'Borrador QA: conservar ñ, cantidad y destino ' + role;
    await page.getByLabel('Observaciones', { exact: true }).fill(note);
    await page.getByRole('button', { name: 'Volver a Manifiestos', exact: true }).click();
    await page.getByRole('button', { name: 'Nuevo Manifiesto', exact: true }).click();
    await expect(page.getByLabel('Observaciones', { exact: true })).toHaveValue(note);
    await expect(page.getByText('Borrador recuperado · guardado en esta pestaña')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Observaciones', { exact: true })).toHaveValue(note);
    await expect(page.getByRole('button', { name: 'Transportista *', exact: true })).toContainText('QA Transporte 1');
    await expect(page.getByRole('button', { name: 'Operador / Destino *', exact: true })).toContainText('QA Operador 1');
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    await expect(page.getByLabel('Cantidad *', { exact: true })).toHaveValue('12.5');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await page.screenshot({ path: info.outputPath(role + '-recovered-form.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Descartar borrador', exact: true }).click();
    await page.getByRole('button', { name: 'Conservar', exact: true }).click();
    await expect(page.getByLabel('Observaciones', { exact: true })).toHaveValue(note);
    await page.getByRole('button', { name: 'Descartar borrador', exact: true }).click();
    await page.getByRole('button', { name: 'Sí, descartar', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Generador *', exact: true })).toBeVisible();
    await expect(page.getByLabel('Observaciones', { exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('manifest filters survive detail, return, reload and a new-form round trip', async ({ page }, info) => {
  await login(page, info);
  await page.goto(prefix(info) + '/manifiestos');
  await page.getByRole('button', { name: 'En curso', exact: true }).click();
  const filtered = page.url();
  expect(new URL(filtered).searchParams.get('fase')).toBeTruthy();
  await page.getByRole('button', { name: /^Ver manifiesto / }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/manifiestos\/[^/?]+$/);
  // App's BrowserRouter owns /app as its basename; route state is relative to it.
  await expect.poll(() => page.evaluate(() => history.state?.usr?.manifestListReturn)).toBe(new URL(filtered).pathname.replace(/^\/app(?=\/)/, '') + new URL(filtered).search);
  await page.getByRole('button', { name: 'Volver a Manifiestos', exact: true }).click();
  await expect(page).toHaveURL(filtered);
  await expect(page.getByRole('button', { name: 'En curso', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'En curso', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Nuevo Manifiesto', exact: true }).click();
  await page.getByRole('button', { name: 'Volver a Manifiestos', exact: true }).click();
  await expect(page).toHaveURL(filtered);
  await page.screenshot({ path: info.outputPath('filters-return.png'), animations: 'disabled' });
  await page.getByLabel('Buscar manifiestos', { exact: true }).fill('2026');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByLabel('Desde', { exact: true }).fill('2026-01-01');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-12-31');
  await expect(page).toHaveURL(/fechaHasta=2026-12-31/);
  const combined = page.url();
  expect(new URL(combined).searchParams.get('q')).toBe('2026');
  expect(new URL(combined).searchParams.get('fechaDesde')).toBe('2026-01-01');
  expect(new URL(combined).searchParams.get('fase')).toBe('en_curso');
  await page.getByRole('button', { name: /^Ver manifiesto / }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: 'Volver a Manifiestos', exact: true }).click();
  await expect(page).toHaveURL(combined);
  await expect(page.getByLabel('Buscar manifiestos', { exact: true })).toHaveValue('2026');
  await expect(page.getByText('Desde 01/01/2026', { exact: true })).toBeVisible();
  await expect(page.getByText('Hasta 31/12/2026', { exact: true })).toBeVisible();
});

test('inspection mobile controls disclose filters and retain the selected stage', async ({ page }, info) => {
  await login(page, info);
  await page.goto(prefix(info) + '/inspecciones');
  for (const width of [390, 320, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const toggle = page.getByRole('button', { name: 'Filtros de inspecciones', exact: true });
    const state = page.getByLabel('Filtrar por estado', { exact: true });
    if (width < 640) {
      await expect(state).not.toBeVisible();
      const firstRow = page.locator('[data-testid^="inspection-row-"]').first();
      await expect(firstRow).toBeVisible();
      expect((await firstRow.boundingBox())!.y).toBeLessThan(650);
      await toggle.click();
      await expect(state).toBeVisible();
      await page.getByLabel('Filtrar por tipo de inspección').selectOption('ESPONTANEA');
      await expect(toggle).toContainText('1');
      await toggle.click();
      await expect(page.getByText('Espontánea / denuncia', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await toggle.click();
      await page.getByLabel('Filtrar por tipo de inspección').selectOption('');
      await toggle.click();
    } else await expect(state).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('inspections-' + width + '.png'), animations: 'disabled' });
  }
});

