import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('corridor observations show the capture-time limit and preserve the manifest link', async ({ page, browser }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-corridor-context-fixture.json'), 'utf8'));
  const item = fixture.cases[info.project.name], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`API ${response.status()}`); });
  await login(page, info, fixture.receiverName);
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(prefix(info) + '/notificaciones');
  await expect(page.getByRole('heading', { name: /Avisos/i }).first()).toBeVisible();
  const inbox = page.getByRole('list', { name: 'Avisos', exact: true });
  const historical = inbox.locator('li').filter({ hasText: item.historicalTitle });
  await expect(historical).toContainText(fixture.historicalText);
  await expect(historical).toContainText('La hora de captura puede ser anterior a la recepción');
  const current = inbox.locator('li').filter({ hasText: item.numero }).filter({ hasText: 'Tres posiciones recibidas' });
  await expect(current).toHaveCount(1);
  await expect(current).toContainText('GPS: corredor para revisar');
  for (const text of ['Hora de captura no disponible', 'No se compara una ruta vial autorizada', 'Verificá el caso con transporte']) await expect(current).toContainText(text);
  await current.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('corredor-avisos.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
  const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
  const message = bell.getByText(/Tres posiciones recibidas.*superan 50 km/).filter({ hasText: item.numero });
  await expect(message).toHaveCount(1);
  await message.scrollIntoViewIfNeeded();
  await expect(bell).toContainText('GPS: corredor para revisar');
  await expect(message).toContainText('Hora de captura no disponible');
  const geometry = await message.evaluate(element => ({ visibleHeight: element.clientHeight, contentHeight: element.scrollHeight,
    clamp: getComputedStyle(element).getPropertyValue('-webkit-line-clamp') }));
  expect(geometry.contentHeight).toBeLessThanOrEqual(geometry.visibleHeight + 1);
  expect(geometry.clamp).not.toBe('2');
  await page.screenshot({ path: info.outputPath('corredor-campana.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: 'Cerrar notificaciones' }).click();
  await page.goto(`${prefix(info)}/notificaciones/${item.historicalId}`);
  const detail = page.getByRole('region', { name: 'Aviso recibido', exact: true });
  await expect(detail).toContainText(fixture.historicalText);
  await expect(detail).toContainText('La hora de captura puede ser anterior a la recepción');
  await detail.getByRole('link', { name: /Abrir manifiesto/ }).click();
  await expect(page).toHaveURL(new RegExp(`/manifiestos/${item.id}(?:[?#].*)?$`));
  await expect(page.getByText(item.numero, { exact: true }).first()).toBeVisible();
  await page.goto(prefix(info) + '/alertas');
  const oldCase = page.getByRole('article').filter({ hasText: item.previousRule });
  await expect(oldCase).toContainText(fixture.historicalText);
  await expect(oldCase).toContainText('La hora de captura puede ser anterior a la recepción');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: page.viewportSize(), serviceWorkers: 'block' });
  try {
    const generator = await other.newPage(); generator.on('pageerror', error => errors.push(error.message));
    generator.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await login(generator, info, 'generador');
    await generator.goto(prefix(info) + '/notificaciones');
    const configured = generator.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: item.liveRule });
    await expect(configured).toContainText('Hora de captura no disponible');
    await expect(configured).toContainText('No se compara una ruta vial autorizada');
    await expect(configured).toContainText('Verificá el caso con transporte');
    await configured.getByRole('button', { name: `Abrir aviso: ${item.liveRule}`, exact: true }).click();
    await expect(generator).toHaveURL(new RegExp(`/manifiestos/${item.id}(?:[?#].*)?$`));
  } finally { await other.close(); }
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('corridor-browser-proof.json'), JSON.stringify({ surface: info.project.name, oldTextPreserved: true,
    directAndConfiguredNotices: true, bellUnclipped: true, manifestLinks: true, errors, synthetic: true }, null, 2));
});
