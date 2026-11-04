import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

let fixture: { synthetic: boolean; email: string; manifestId: string; numero: string; notice: string; adenda?: string; singleNotice?: string };
test.beforeAll(async () => {
  await assertCloudDatabase();
  fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true); expect(fixture.email).toBe('draft-multirole-20261024@night-qa.invalid');
});

if (process.env.QA_OWNER_PHASE === 'after') test('single-role email opens the owned notice and then the manifest', async ({ page }, info) => {
  expect(fixture.singleNotice).toBeTruthy();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await isolatedMapTiles(page, info);
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.36.5.${info.project.name === 'app' ? 2 : 1}`, url: 'http://127.0.0.1:4177' }]);
  await page.addInitScript(() => localStorage.setItem('sitrep_onboarding_GENERADOR', 'true'));
  await page.setContent(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'single-mail.html'), 'utf8'));
  await page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`).click();
  await expect(page).toHaveURL(/\/login$/); await page.getByLabel('Correo electrónico o CUIT').fill('generador@night-qa.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/notificaciones/${fixture.singleNotice}(?:[/?#]|$)`));
  await page.getByRole('link', { name: /Abrir manifiesto y ver qué sigue/ }).click();
  await expect(page).toHaveURL(new RegExp(`/manifiestos/${fixture.manifestId}(?:[/?#]|$)`));
  await expect(page.getByText(fixture.numero, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

const sources = process.env.QA_OWNER_PHASE === 'before' ? ['campana', 'correo', 'enlace-anterior'] as const
  : ['campana', 'correo', 'enlace-anterior', 'adenda-anterior'] as const;
for (const source of sources) test(`${source}: titular multirrol abre el manifiesto de Operador`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  const before = process.env.QA_OWNER_PHASE === 'before';
  if (source === 'adenda-anterior') {
    expect(fixture.adenda).toBeTruthy(); await login(page, info, fixture.email.split('@')[0]);
    await page.goto(prefix(info) + '/manifiestos/' + fixture.manifestId + '/adendas?adenda=' + fixture.adenda);
  } else if (source === 'campana') {
    await login(page, info, fixture.email.split('@')[0]);
    await page.getByRole('button', { name: /^Notificaciones/ }).click();
    const bell = page.getByRole('region', { name: 'Notificaciones recientes' });
    await bell.getByRole('button').filter({ hasText: fixture.numero }).click();
  } else {
    await isolatedMapTiles(page, info);
    await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.36.${source === 'correo' ? 1 : 2}.${info.project.name === 'app' ? 2 : 1}`, url: 'http://127.0.0.1:4177' }]);
    await page.addInitScript(() => { for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) localStorage.setItem('sitrep_onboarding_' + role, 'true'); });
    await page.setContent(readFileSync(path.join(process.env.QA_ARTIFACTS!, before || source === 'enlace-anterior' ? 'before-mail.html' : 'after-mail.html'), 'utf8'));
    await page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`).click();
    await expect(page).toHaveURL(/\/login$/); await page.getByLabel('Correo electrónico o CUIT').fill(fixture.email);
    await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
    const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
  }
  if (before) {
    await expect(page).toHaveURL(new RegExp(`/manifiestos/${fixture.manifestId}(?:[/?#]|$)`));
    await expect(page.getByText('Manifiesto no encontrado')).toBeVisible();
  } else {
    if (source === 'campana' || source === 'correo') await expect(page).toHaveURL(new RegExp(`/notificaciones/${fixture.notice}(?:[/?#]|$)`));
    const access = page.getByRole('region', { name: 'Actividades con acceso al manifiesto' });
    await expect(access).toBeVisible();
    const action = access.getByRole('button', { name: 'Abrir como Operador' });
    await expect(action).toBeVisible();
    await expect(access.getByRole('button', { name: 'Abrir como Generador' })).toHaveCount(0);
    await action.scrollIntoViewIfNeeded(); const bounds = await action.boundingBox(); expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(await action.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); })).toBe(true);
    await page.screenshot({ path: info.outputPath('actividad.png'), animations: 'disabled', scale: 'css' });
    await action.click(); await expect(page).toHaveURL(new RegExp(`/manifiestos/${fixture.manifestId}(?:[/?#]|$)`));
    if (source === 'adenda-anterior') {
      await expect(page).toHaveURL(new RegExp(`/adendas\\?adenda=${fixture.adenda}$`));
      await expect(page.getByText('QA adenda para enlace anterior')).toBeVisible();
    } else await expect(page.getByText(fixture.numero, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  if (before) await page.screenshot({ path: info.outputPath('antes.png'), animations: 'disabled', scale: 'css' });
  expect(errors).toEqual([]);
});
