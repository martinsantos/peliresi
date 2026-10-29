import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('the configured duration notice reaches the generator even without GPS positions', async ({ page }, info) => {
  const f = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'transit-sweep-private.json'), 'utf8'));
  const errors: string[] = [], writes: string[] = [];
  await login(page, info, 'generador');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  await page.goto(prefix(info) + '/notificaciones');
  const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: f.ruleName });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(f.manifesto);
  await expect(card).toContainText('llevaba aproximadamente 25 horas en tránsito');
  await expect(card).toContainText('umbral configurado por Ambiente');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('duration-without-gps.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
  const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
  await expect(bell).toContainText(f.ruleName);
  await expect(bell).toContainText(f.manifesto);
  await page.screenshot({ path: info.outputPath('duration-bell.png'), animations: 'disabled', scale: 'css' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]); expect(writes).toEqual([]);
});
