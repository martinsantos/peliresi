import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('the configured carrier sees the notice from its own GPS and can open the manifest', async ({ page }, info) => {
  const f = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'transit-atomic-private.json'), 'utf8'));
  const errors: string[] = [], writes: string[] = [];
  await login(page, info, 'transportista');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  await page.goto(prefix(info) + '/notificaciones');
  const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: f.title });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(f.numero);
  await expect(card).toContainText('umbral configurado por Ambiente');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('carrier-duration-notice.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
  const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
  await expect(bell).toContainText(f.title);
  await page.screenshot({ path: info.outputPath('carrier-duration-bell.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: 'Cerrar notificaciones' }).click();
  await card.getByRole('button', { name: `Abrir aviso: ${f.title}` }).click();
  await expect(page).toHaveURL(new RegExp(`/manifiestos/${f.manifestId}(?:[/?#]|$)`));
  await expect(page.getByText(f.numero, { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('carrier-duration-manifest.png'), animations: 'disabled', scale: 'css' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  expect(writes.every(value => value === `PUT /api/notificaciones/${f.carrierNoticeId}/leida`)).toBe(true);
});
