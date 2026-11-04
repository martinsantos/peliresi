import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { login, prefix } from './helpers';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'legacy-company-notice-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
let db: any, original: any;
test.beforeAll(async () => {
 await assertCloudDatabase(); expect(fixture.member).toMatch(/@night-qa\.invalid$/);
 db = new PrismaClient();
 const member = await db.usuario.findUniqueOrThrow({ where: { email: fixture.member } });
 original = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: fixture.grant } });
 expect(original.usuarioId).toBe(member.id); expect(original.activa).toBe(true);
 await db.autorizacionEmpresa.update({ where: { id: original.id }, data: { activa: false } });
});
test.afterAll(async () => {
 if (db && original) await db.autorizacionEmpresa.update({ where: { id: original.id }, data: { activa: original.activa,
  todosEstablecimientos: original.todosEstablecimientos, establecimientoIds: original.establecimientoIds, updatedAt: original.updatedAt } });
 if (db) await db.$disconnect();
});
test('revoked representative sees no private proposal, addendum or certificate notice', async ({ page }, info) => {
 const errors: string[] = [], writes: string[] = [];
 await login(page, info, fixture.member.split('@')[0]);
 if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
 page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => {
  if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method());
 });
 for (const id of fixture.notices) {
  await page.goto(prefix(info) + '/notificaciones/' + id);
  const article = page.getByRole('region', { name: 'Aviso recibido' }).locator('article');
  await expect(article.getByRole('heading', { name: 'Aviso no disponible' })).toBeVisible();
  await expect(article).not.toContainText(fixture.numero);
  await expect(article.getByRole('link', { name: /Abrir manifiesto|Ver certificación|Abrir adenda/i })).toHaveCount(0);
 }
 await page.screenshot({ path: info.outputPath('revoked-company-notice.png'), animations: 'disabled', scale: 'css' });
 expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(errors).toEqual([]); expect(writes).toEqual([]);
});
