import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

test('maps preserve a real missing location instead of creating a Capital marker and retain the carrier in reports', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await login(page, info);
  const activity = page.waitForResponse(response => response.url().includes('/api/centro-control/actividad') && response.status() === 200);
  await page.goto(`${prefix(info)}/centro-control`);
  const data = (await (await activity).json()).data;
  const carrier = data.transportistas.find((actor: { razonSocial: string }) => actor.razonSocial === 'QA Transporte 2');
  if (carrier) expect([carrier.latitud, carrier.longitud]).toEqual([null, null]);
  // Centro's activity filter may legitimately omit an inactive carrier. A
  // department or coordinate must not be invented to make it appear.
  await expect(page.locator('.leaflet-marker-icon[title="QA Transporte 2"]')).toHaveCount(0);
  await page.goto(`${prefix(info)}/reportes`);
  await page.getByRole('navigation', { name: 'Tipos de reporte' }).getByRole('button', { name: 'Mapa de Actores', exact: true }).click();
  const unknown = page.getByRole('button', { name: /^QA Transporte 2/ });
  await expect(unknown).toContainText('Sin ubicación verificada');
  await expect(page.locator('.leaflet-marker-icon[title="QA Transporte 2"]')).toHaveCount(0);
  await expect(page.locator('.leaflet-marker-icon[title="QA Transporte 1"]')).toHaveCount(1);
  await unknown.scrollIntoViewIfNeeded();
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('unlocated-carrier-remains-honest.png'), animations: 'disabled' });
  const layer = page.getByRole('group', { name: 'Capas del mapa' }).getByRole('button', { name: 'Transportistas', exact: true });
  await layer.click();
  await expect(unknown).toHaveCount(0);
  await expect(page.locator('.leaflet-marker-icon[title="QA Transporte 1"]')).toHaveCount(0);
  await layer.click();
  await expect(unknown).toContainText('Sin ubicación verificada');
  await expect(page.locator('.leaflet-marker-icon[title="QA Transporte 1"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
