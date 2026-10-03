import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

test('proactive context audit captures actor location and map layer controls', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await login(page, info);
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección', exact: true });
  await dialog.getByLabel('Actor inspeccionado', { exact: true }).selectOption({ label: 'QA Generador 1' });
  await dialog.getByLabel('Ubicación prevista', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('01-inspection-location.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.goto(`${prefix(info)}/centro-control`);
  await expect(page.getByRole('heading', { name: 'Mapa de Actividad', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generadores', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('02-control-layers.png'), animations: 'disabled' });
  await page.getByRole('heading', { name: 'Mapa de Actividad', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('03-control-map.png'), animations: 'disabled' });

  await page.goto(`${prefix(info)}/reportes`);
  await page.getByRole('navigation', { name: 'Tipos de reporte' }).getByRole('button', { name: 'Mapa de Actores', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.getByRole('button', { name: /^Op\. Fijos/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('04-report-map-layers.png'), animations: 'disabled' });
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
  await info.attach('audit-context', { body: JSON.stringify({ url: page.url(), viewport: page.viewportSize(), errors, phase: 'before', businessAPIIntercepted: false }), contentType: 'application/json' });
});
