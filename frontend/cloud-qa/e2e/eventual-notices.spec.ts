import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
test.beforeAll(async () => { await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); });
async function fitsAndClickable(page: Page, button: Locator) {
 await button.scrollIntoViewIfNeeded(); await expect(button).toBeVisible();
 const geometry = await button.evaluate(element => {
  const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return { height: rect.height, within: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
   hit: !!hit && (hit === element || element.contains(hit)), overflow: document.documentElement.scrollWidth - innerWidth };
 });
 expect(geometry.height).toBeGreaterThanOrEqual(44); expect(geometry.within).toBe(true); expect(geometry.hit).toBe(true); expect(geometry.overflow).toBeLessThanOrEqual(1);
}
test('un representante abre el eventual desde Avisos con la empresa autorizada', async ({ page }, info) => {
 await login(page, info, fixture.member.split('@')[0]);
 await page.goto(`${prefix(info)}/notificaciones`);
 const row = page.locator('li').filter({ hasText: 'BI-' + fixture.recordId });
 await expect(row.first()).toBeVisible(); // creation and later events share the same reference
 await row.filter({ hasText: 'Nuevo eventual' }).getByRole('button', { name: /Abrir aviso: Nuevo eventual/ }).click();
 await expect(page).toHaveURL(new RegExp('/notificaciones/' + fixture.memberNoticeId));
 const action = page.getByRole('button', { name: /^Abrir eventual como Generador de .+$/ });
 const operatorAction = page.getByRole('button', { name: /^Abrir eventual como Operador de .+$/ });
 if (info.project.name === 'app') {
  for (const width of [320, 393]) { await page.setViewportSize({ width, height: 844 }); await fitsAndClickable(page, action); await fitsAndClickable(page, operatorAction); }
 } else { await fitsAndClickable(page, action); await fitsAndClickable(page, operatorAction); }
 await page.screenshot({ path: info.outputPath('representative-notice.png'), animations: 'disabled' });
 await action.click();
 await expect(page).toHaveURL(new RegExp('/manifiestos/baja-intensidad\\?registro=' + fixture.recordId));
 await expect(page.getByText('QA transporte externo').first()).toBeVisible();
});
test('una cuenta multirrol abre el eventual con la actividad involucrada', async ({ page }, info) => {
 await login(page, info, fixture.owner.split('@')[0]);
 await page.goto(`${prefix(info)}/notificaciones/${fixture.operatorNoticeId}`);
 const action = page.getByRole('button', { name: 'Abrir eventual con mi actividad Operador' });
 await fitsAndClickable(page, action); await page.screenshot({ path: info.outputPath('multi-role-notice.png'), animations: 'disabled' });
 await action.click();
 await expect(page).toHaveURL(new RegExp('/manifiestos/baja-intensidad\\?registro=' + fixture.operatorRecordId));
 await expect(page.getByText('QA transporte sin alta').first()).toBeVisible();
});
test('la campana abre el aviso del movimiento de un eventual', async ({ page }, info) => {
 await login(page, info, fixture.member.split('@')[0]);
 await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
 const panel = page.getByRole('region', { name: 'Notificaciones recientes' });
 const item = panel.getByRole('button').filter({ hasText: 'Retiro registrado en el eventual' }).filter({ hasText: 'BI-' + fixture.recordId });
 await expect(item).toHaveCount(1); await item.click();
 await expect(page).toHaveURL(/\/notificaciones\/[a-f0-9]{64}$/);
 await expect(page.getByRole('heading', { name: 'Retiro registrado en el eventual' })).toBeVisible();
 const action = page.getByRole('button', { name: /^Abrir eventual como Generador de .+$/ });
 await fitsAndClickable(page, action); await action.click();
 await expect(page).toHaveURL(new RegExp('/manifiestos/baja-intensidad\\?registro=' + fixture.recordId));
});
test('un aviso anterior deja de exponer el eventual tras revocar ambos permisos', async ({ page }, info) => {
 await login(page, info, fixture.member.split('@')[0]);
 const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
 const grants = await db.autorizacionEmpresa.findMany({ where: { id: { in: [fixture.generatorGrantId, fixture.operatorGrantId] } } });
 expect(grants).toHaveLength(2); expect(grants.every((g: any) => g.usuarioId === fixture.memberId && g.activa && g.todosEstablecimientos)).toBe(true);
 try {
  for (const grant of grants) await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: false, revision: { increment: 1 } } });
  await page.goto(`${prefix(info)}/notificaciones/${fixture.memberNoticeId}`);
  await expect(page.getByRole('heading', { name: 'Aviso no disponible' })).toBeVisible();
  await expect(page.getByText('BI-' + fixture.recordId)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /abrir eventual/i })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('revoked-notice.png'), animations: 'disabled' });
 } finally {
  for (const grant of grants) await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa, revision: grant.revision } });
  await db.$disconnect();
 }
});
for (const preference of ['web', 'app'] as const) test(`el correo renderizado respeta la preferencia ${preference} y abre el aviso tras ingresar`, async ({ page, browser }, info) => {
 const origin = 'http://127.0.0.1:4177';
 await login(page, info, fixture.member.split('@')[0]); await page.goto(prefix(info) + '/configuracion?tab=apariencia');
 const settings = page.getByRole('region', { name: 'Dónde abrir los enlaces' });
 const automatic = settings.getByRole('radio', { name: /Según el dispositivo/ });
 const choice = settings.getByRole('radio', { name: preference === 'web' ? /Siempre web/ : /Siempre app/ });
 await expect(automatic).toBeChecked();
 let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
 try {
  await choice.check(); await expect(settings.getByRole('status')).toContainText('Preferencia guardada');
  context = await browser.newContext({ ...info.project.use, baseURL: origin } as any);
  const other = await context.newPage(); await isolatedMapTiles(other, info);
  await context.addCookies([{ name: 'sitrep_qa_client', value: `127.25.${preference === 'web' ? 93 : 94}.${info.project.name === 'app' ? 2 : 1}`, url: origin }]);
  await other.setContent(fixture.memberMailHtml); await other.locator('[data-mail-action="preferred"]').click();
  await expect(other).toHaveURL(/\/login$/); await other.getByLabel('Correo electrónico o CUIT').fill(fixture.member);
  await other.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const response = other.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await other.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
  const base = origin + (preference === 'app' ? '/app' : '');
  await expect(other).toHaveURL(base + '/notificaciones/' + fixture.memberNoticeId);
  await other.getByRole('button', { name: /^Abrir eventual como Generador de .+$/ }).click();
  await expect(other).toHaveURL(base + '/manifiestos/baja-intensidad?registro=' + fixture.recordId);
  await expect(other.getByText('QA transporte externo').first()).toBeVisible();
  await other.screenshot({ path: info.outputPath('mail-preference.png'), animations: 'disabled' });
 } finally {
  await context?.close(); if (!await automatic.isChecked()) { await automatic.check(); await expect(settings.getByRole('status')).toContainText('Preferencia guardada'); }
 }
});
