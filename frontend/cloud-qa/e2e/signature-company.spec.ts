import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

let fixture: { synthetic: boolean; member: string; notice: string; multi: string; multiNotice: string; manifestId: string; numero: string; title: string };
test.beforeAll(async () => {
  await assertCloudDatabase();
  fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true); expect(fixture.member).toMatch(/@night-qa\.invalid$/);
});

async function openAuthorizedManifest(page: Page, info: TestInfo, notice = fixture.notice, role: 'Generador' | 'Transporte' = 'Generador') {
  await expect(page).toHaveURL(new RegExp(`/notificaciones/${notice}(?:[/?#]|$)`));
  await expect(page.getByText(fixture.numero, { exact: false }).first()).toBeVisible();
  const access = page.getByLabel('Acceso al manifiesto por empresa');
  await expect(access.getByText(new RegExp('^' + role + '(?: ·|$)'))).toBeVisible();
  const action = access.getByRole('button', { name: new RegExp('Usar ' + role + ' y abrir manifiesto|Abrir manifiesto') });
  await expect(action).toBeVisible();
  await action.evaluate(element => element.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
  const rect = await action.boundingBox(); expect(rect).not.toBeNull(); expect(rect!.height).toBeGreaterThanOrEqual(44);
  expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await action.evaluate(element => {
    const r = element.getBoundingClientRect();
    return [[r.left + 5, r.top + 5], [r.right - 5, r.top + 5], [r.left + 5, r.bottom - 5], [r.right - 5, r.bottom - 5]]
      .every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
  })).toBe(true);
  await page.screenshot({ path: info.outputPath('aviso-contexto.png'), animations: 'disabled', scale: 'css' });
  await action.click(); await expect(page).toHaveURL(new RegExp(`/manifiestos/${fixture.manifestId}(?:[/?#]|$)`));
  await expect(page.getByText(fixture.numero, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

for (const source of ['campana', 'avisos', 'correo'] as const) test(`${source} abre el recordatorio con la actividad autorizada`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  if (source === 'correo') {
    await isolatedMapTiles(page, info);
    await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.33.12.${info.project.name === 'app' ? 2 : 1}`, url: 'http://127.0.0.1:4177' }]);
    await page.addInitScript(() => { for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) localStorage.setItem('sitrep_onboarding_' + role, 'true'); });
    await page.setContent(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'representative-mail.html'), 'utf8'));
    const link = page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`);
    expect(new URL((await link.getAttribute('href'))!).pathname).toBe(prefix(info) + '/notificaciones/' + fixture.notice);
    await link.click(); await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Correo electrónico o CUIT').fill(fixture.member);
    await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
    const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
  } else {
    await login(page, info, fixture.member.split('@')[0]);
    if (source === 'campana') {
      await page.getByRole('button', { name: /^Notificaciones/ }).click();
      const bell = page.getByRole('region', { name: 'Notificaciones recientes' });
      await bell.getByRole('button').filter({ hasText: fixture.numero }).click();
    } else {
      await page.goto(prefix(info) + '/notificaciones');
      const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: fixture.numero });
      await card.getByRole('button', { name: 'Abrir aviso: ' + fixture.title }).click();
    }
  }
  await openAuthorizedManifest(page, info); expect(errors).toEqual([]);
});

for (const source of ['avisos', 'correo'] as const) test(`cuenta multirrol abre ${source} con la empresa transportista`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  if (source === 'avisos') {
    await login(page, info, fixture.multi.split('@')[0]); await page.goto(prefix(info) + '/notificaciones');
    const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: fixture.numero });
    await card.getByRole('button', { name: 'Abrir aviso: ' + fixture.title }).click();
  } else {
    await isolatedMapTiles(page, info);
    await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.33.13.${info.project.name === 'app' ? 2 : 1}`, url: 'http://127.0.0.1:4177' }]);
    await page.addInitScript(() => { for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) localStorage.setItem('sitrep_onboarding_' + role, 'true'); });
    await page.setContent(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'multirole-mail.html'), 'utf8'));
    await page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`).click();
    await expect(page).toHaveURL(/\/login$/); await page.getByLabel('Correo electrónico o CUIT').fill(fixture.multi);
    await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
    const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
  }
  await openAuthorizedManifest(page, info, fixture.multiNotice, 'Transporte'); expect(errors).toEqual([]);
});

for (const preference of ['web', 'app'] as const) test(`el botón principal respeta la preferencia ${preference}`, async ({ page, browser }, info) => {
  await login(page, info, fixture.member.split('@')[0]); await page.goto(prefix(info) + '/configuracion?tab=apariencia');
  const settings = page.getByRole('region', { name: 'Dónde abrir los enlaces' });
  const choices = [settings.getByRole('radio', { name: /Según el dispositivo/ }), settings.getByRole('radio', { name: /Siempre web/ }),
    settings.getByRole('radio', { name: /Siempre app/ })];
  let original = -1;
  for (let i = 0; i < choices.length; i++) if (await choices[i].isChecked()) original = i;
  expect(original).toBeGreaterThanOrEqual(0);
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    const choice = choices[preference === 'web' ? 1 : 2];
    if (!await choice.isChecked()) { await choice.check(); await expect(settings.getByRole('status')).toContainText('Preferencia guardada'); }
    context = await browser.newContext({ ...info.project.use, baseURL: 'http://127.0.0.1:4177' } as any);
    const other = await context.newPage(); await isolatedMapTiles(other, info);
    await context.addCookies([{ name: 'sitrep_qa_client', value: `127.34.${preference === 'web' ? 1 : 2}.${info.project.name === 'app' ? 2 : 1}`, url: 'http://127.0.0.1:4177' }]);
    await other.setContent(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'representative-mail.html'), 'utf8'));
    await other.locator('[data-mail-action="preferred"]').click(); await expect(other).toHaveURL(/\/login$/);
    await other.getByLabel('Correo electrónico o CUIT').fill(fixture.member);
    await other.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
    const response = other.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
    await other.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
    await expect(other).toHaveURL('http://127.0.0.1:4177' + (preference === 'app' ? '/app' : '') + '/notificaciones/' + fixture.notice);
    await openAuthorizedManifest(other, info);
  } finally {
    await context?.close();
    if (original >= 0 && !await choices[original].isChecked()) {
      await choices[original].check(); await expect(settings.getByRole('status')).toContainText('Preferencia guardada');
    }
  }
});
