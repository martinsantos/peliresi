import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test('representative opens a state notice in the authorized company and site', async ({ page }, info) => {
 const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'state-notice-company-private.json'), 'utf8'));
 const item = fixture.cases[info.project.name]; expect(item).toBeTruthy();
 expect(fixture.member).toMatch(/@night-qa\.invalid$/);
 const errors: string[] = [], writes: string[] = [];
 await login(page, info, fixture.member.split('@')[0]);
 if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
 page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => {
  if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
 });
 await page.goto(prefix(info) + '/notificaciones');
 const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li')
  .filter({ hasText: 'Retiro confirmado' }).filter({ hasText: item.numero });
 await expect(card).toHaveCount(1);
 await page.screenshot({ path: info.outputPath('representative-state-inbox.png'), animations: 'disabled', scale: 'css' });
 await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
 const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
 await expect(bell).toContainText('Manifiesto cancelado');
 await page.screenshot({ path: info.outputPath('representative-state-bell.png'), animations: 'disabled', scale: 'css' });
 await page.getByRole('button', { name: 'Cerrar notificaciones' }).click();
 await card.getByRole('button', { name: 'Abrir aviso: Retiro confirmado' }).click();
 await expect(page).toHaveURL(new RegExp(`/notificaciones/${item.notice}(?:[/?#]|$)`));
 await expect(page.getByText(/Generador ·/)).toBeVisible();
 const action = page.getByRole('button', { name: /Usar Generador y abrir manifiesto|Abrir manifiesto/ });
 await expect(action).toBeVisible();
 await action.evaluate(element => element.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
 const rect = await action.boundingBox(); expect(rect).not.toBeNull(); expect(rect!.height).toBeGreaterThanOrEqual(44);
 expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 await page.screenshot({ path: info.outputPath('representative-state-context.png'), animations: 'disabled', scale: 'css' });
 await action.click();
 await expect(page).toHaveURL(new RegExp(`/manifiestos/${item.manifestId}(?:[/?#]|$)`));
 await expect(page.getByText(item.numero, { exact: true }).first()).toBeVisible();
 await page.screenshot({ path: info.outputPath('representative-state-manifest.png'), animations: 'disabled', scale: 'css' });
 expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(errors).toEqual([]);
 expect(writes.every(value => value === `PUT /api/notificaciones/${item.notice}/leida`)).toBe(true);
});
