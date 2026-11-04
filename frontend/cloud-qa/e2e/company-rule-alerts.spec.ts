import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test('representative opens a configured alert in the authorized activity and site', async ({ page }, info) => {
 const f = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'company-rule-browser.json'), 'utf8'));
 expect(f.member).toMatch(/@night-qa\.invalid$/);
 const errors: string[] = [], writes: string[] = [];
 await login(page, info, f.member.split('@')[0]);
 if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
 page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => {
  if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
 });
 await page.goto(prefix(info) + '/notificaciones');
 const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: f.title });
 await expect(card).toHaveCount(1); await expect(card).toContainText(f.numero);
 await page.screenshot({ path: info.outputPath('representative-alert-inbox.png'), animations: 'disabled', scale: 'css' });
 await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
 const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
 await expect(bell).toContainText(f.title);
 await page.screenshot({ path: info.outputPath('representative-alert-bell.png'), animations: 'disabled', scale: 'css' });
 await page.getByRole('button', { name: 'Cerrar notificaciones' }).click();
 await card.getByRole('button', { name: `Abrir aviso: ${f.title}` }).click();
 await expect(page).toHaveURL(new RegExp(`/notificaciones/${f.notice}(?:[/?#]|$)`));
 await expect(page.getByText(/Generador ·/)).toBeVisible();
 const action = page.getByRole('button', { name: /Usar Generador y abrir manifiesto|Abrir manifiesto/ });
 await expect(action).toBeVisible();
 // A fixed mobile navigation can obscure an element that Playwright considers
 // inside the viewport. Check that ordinary scrolling can reveal all of it.
 await action.evaluate(element => element.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
 const rect = await action.boundingBox();
 expect(rect).not.toBeNull(); expect(rect!.height).toBeGreaterThanOrEqual(44);
 expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 const geometry = await action.evaluate(element => {
  const r = element.getBoundingClientRect();
  const points = [[r.left + 5, r.top + 5], [r.right - 5, r.top + 5], [r.left + 5, r.bottom - 5], [r.right - 5, r.bottom - 5]]
   .map(([x, y]) => { const hit = document.elementFromPoint(x, y); return { x, y, hit: hit?.tagName, inside: element.contains(hit) }; });
  const main = element.closest('main');
  return { points, scrollMargin: getComputedStyle(element).scrollMarginBottom, scrollTop: main?.scrollTop, scrollHeight: main?.scrollHeight, clientHeight: main?.clientHeight };
 });
 expect(geometry.points.every(point => point.inside), JSON.stringify(geometry)).toBe(true);
 await page.screenshot({ path: info.outputPath('representative-alert-context.png'), animations: 'disabled', scale: 'css' });
 await action.click();
 await expect(page).toHaveURL(new RegExp(`/manifiestos/${f.manifestId}(?:[/?#]|$)`));
 await expect(page.getByText(f.numero, { exact: true }).first()).toBeVisible();
 await page.screenshot({ path: info.outputPath('representative-alert-manifest.png'), animations: 'disabled', scale: 'css' });
 expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(errors).toEqual([]);
 expect(writes.every(value => value === `PUT /api/notificaciones/${f.notice}/leida`)).toBe(true);
});
