import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('administration sees distinct GPS observations and context on historical notices', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-observation-private.json'), 'utf8'));
  const item = fixture.cases[info.project.name], errors: string[] = [], writes: string[] = [];
  await login(page, info, fixture.receiverName);
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  await page.goto(prefix(info) + '/notificaciones');
  const inbox = page.getByRole('list', { name: 'Avisos', exact: true });
  const older = inbox.locator('li').filter({ hasText: item.historicalTitle });
  await expect(older).toContainText(`Manifiesto ${item.numero}`);
  await expect(older).toContainText('Velocidad anormalmente alta detectada: 250 km/h');
  await expect(older).toContainText('La hora de captura puede ser anterior a la recepción');
  for (const title of ['GPS: posible velocidad elevada', 'GPS: posible parada', 'GPS: sin posiciones recibidas']) {
    const card = inbox.locator('li').filter({ hasText: title }).filter({ hasText: item.numero });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Hora de captura no disponible');
    await expect(card).toContainText('Verificá el caso con transporte');
  }
  await older.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('gps-historical-inbox.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
  const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
  await expect(bell).toContainText('GPS:');
  await expect(bell).toContainText('Hora de captura no disponible');
  await expect(bell).toContainText('QA-GPS-OBS-');
  await page.screenshot({ path: info.outputPath('gps-bell.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: 'Cerrar notificaciones' }).click();
  await page.goto(`${prefix(info)}/notificaciones/${item.historicalId}`);
  const detail = page.getByRole('region', { name: 'Aviso recibido', exact: true });
  await expect(detail).toContainText(`Manifiesto ${item.numero}`);
  await expect(detail).toContainText('La hora de captura puede ser anterior a la recepción');
  await expect(detail).toContainText('Velocidad anormalmente alta detectada: 250 km/h');
  await page.goto(`${prefix(info)}/alertas`);
  await page.getByRole('tab', { name: /Reglas/ }).click();
  await page.getByRole('button', { name: 'Nueva Regla', exact: true }).click();
  const ruleDialog = page.getByRole('dialog', { name: 'Nueva Regla', exact: true });
  await ruleDialog.getByRole('button', { name: 'Evento', exact: true }).click();
  await page.getByRole('option', { name: 'Desvío de Ruta', exact: true }).click();
  await expect(ruleDialog).toContainText('El seguimiento GPS actual no activa esta regla');
  await expect(ruleDialog).toContainText('no compara una ruta autorizada');
  await page.screenshot({ path: info.outputPath('gps-route-warning.png'), animations: 'disabled', scale: 'css' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]); expect(writes).toEqual([]);
  writeFileSync(info.outputPath('gps-administration-proof.json'), JSON.stringify({ surface: info.project.name, manifest: item.numero,
    historicalTextPreserved: true, classes: 3, bell: true, routeRuleWarning: true, errors, writes, synthetic: true }));
});

test('the generator receives the configured GPS rule with the same context', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-observation-private.json'), 'utf8'));
  const item = fixture.cases[info.project.name], errors: string[] = [], writes: string[] = [];
  await login(page, info, 'generador');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  await page.goto(prefix(info) + '/notificaciones');
  const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: item.ruleName });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(item.numero);
  await expect(card).toContainText('Hora de captura no disponible');
  await expect(card).toContainText('Verificá el caso con transporte');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('gps-generator-rule.png'), animations: 'disabled', scale: 'css' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]); expect(writes).toEqual([]);
  writeFileSync(info.outputPath('gps-generator-proof.json'), JSON.stringify({ surface: info.project.name, manifest: item.numero,
    configuredRule: true, errors, writes, synthetic: true }));
});
