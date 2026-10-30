import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

let fixture: { synthetic: boolean; member: string; notice: string; manifestId: string; numero: string; title: string;
  fixedNotice: string; fixedId: string; fixedNumero: string; carrier: string; mapUrl: string };
test.beforeAll(async () => {
  await assertCloudDatabase();
  fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true); expect(fixture.member).toMatch(/@night-qa\.invalid$/);
  expect(fixture.carrier).toMatch(/@night-qa\.invalid$/);
});

async function openAuthorizedManifest(page: Page, info: TestInfo, origin: boolean) {
  const notice = origin ? fixture.notice : fixture.fixedNotice;
  const manifest = origin ? fixture.manifestId : fixture.fixedId;
  const number = origin ? fixture.numero : fixture.fixedNumero;
  await expect(page).toHaveURL(new RegExp(`/notificaciones/${notice}(?:[/?#]|$)`));
  await expect(page.getByText(number, { exact: false }).first()).toBeVisible();
  if (origin) await expect(page.getByText(/No hay retiro, traslado ni GPS/).first()).toBeVisible();
  else await expect(page.getByText(/El viaje comienza al confirmar el retiro/).first()).toBeVisible();
  const access = page.getByLabel('Acceso al manifiesto por empresa');
  await expect(access.getByText(/^Generador(?: ·|$)/)).toBeVisible();
  const action = access.getByRole('button', { name: /Usar Generador y abrir manifiesto|Abrir manifiesto/ });
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
  await action.click(); await expect(page).toHaveURL(new RegExp(`/manifiestos/${manifest}(?:[/?#]|$)`));
  await expect(page.getByText(number, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test('la campana conserva el mapa de retiro para transporte como enlace independiente', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await login(page, info, fixture.carrier.split('@')[0]);
  await page.getByRole('button', { name: /^Notificaciones/ }).click();
  const bell = page.getByRole('region', { name: 'Notificaciones recientes' });
  const item = bell.getByRole('button').filter({ hasText: fixture.fixedNumero });
  const link = item.locator('..').getByRole('link', { name: 'Ver ubicación del generador' });
  await expect(link).toBeVisible(); await expect(link).toHaveAttribute('href', fixture.mapUrl);
  expect(await link.evaluate(element => element.closest('button'))).toBeNull();
  await link.focus(); await expect(link).toBeFocused();
  await link.scrollIntoViewIfNeeded();
  const rect = await link.boundingBox(); expect(rect).not.toBeNull(); expect(rect!.height).toBeGreaterThanOrEqual(44);
  expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await link.evaluate(element => { const r = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); })).toBe(true);
  await page.screenshot({ path: info.outputPath('campana-mapa.png'), animations: 'disabled', scale: 'css' });
  await item.click(); await expect(page).toHaveURL(new RegExp(`/manifiestos/${fixture.fixedId}(?:[/?#]|$)`));
  expect(errors).toEqual([]);
});

for (const origin of [true, false]) for (const source of (origin ? ['campana', 'avisos', 'correo'] : ['avisos', 'correo']) as Array<'campana' | 'avisos' | 'correo'>) {
  test(`${origin ? 'origen' : 'retiro'}: ${source} abre el manifiesto autorizado`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    const number = origin ? fixture.numero : fixture.fixedNumero;
    const title = origin ? fixture.title : 'Retiro previsto';
    if (source === 'correo') {
      await isolatedMapTiles(page, info);
      await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.35.${origin ? 1 : 2}.${info.project.name === 'app' ? 2 : 1}`, url: 'http://127.0.0.1:4177' }]);
      await page.addInitScript(() => { for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) localStorage.setItem('sitrep_onboarding_' + role, 'true'); });
      await page.setContent(readFileSync(path.join(process.env.QA_ARTIFACTS!, origin ? 'origin-mail.html' : 'fixed-mail.html'), 'utf8'));
      const link = page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`);
      expect(new URL((await link.getAttribute('href'))!).pathname).toBe(prefix(info) + '/notificaciones/' + (origin ? fixture.notice : fixture.fixedNotice));
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
        await bell.getByRole('button').filter({ hasText: number }).click();
      } else {
        await page.goto(prefix(info) + '/notificaciones');
        const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li').filter({ hasText: number });
        await card.getByRole('button', { name: 'Abrir aviso: ' + title }).click();
      }
    }
    await openAuthorizedManifest(page, info, origin); expect(errors).toEqual([]);
  });
}
