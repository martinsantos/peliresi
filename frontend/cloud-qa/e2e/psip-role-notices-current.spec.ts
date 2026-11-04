import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';
import { assertCloudDatabase } from '../safety';

type Case = { id: string; noticeId: string; role: 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' };
const labels = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' } as const;
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-context-fixture.json'), 'utf8')) as { email: string; cases: Case[] };

async function openNotice(page: Page, info: TestInfo, item: Case) {
  await page.goto(`${prefix(info)}/notificaciones/${item.noticeId}`);
  const notice = page.getByRole('region', { name: 'Aviso recibido' });
  await expect(notice.getByRole('heading')).toBeVisible();
  const switchRole = notice.getByRole('button', { name: `Usar ${labels[item.role]} y abrir requerimiento`, exact: true });
  if (await switchRole.isVisible()) await switchRole.click();
  else await notice.getByRole('link', { name: 'Consultar requerimiento y estado →', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/requerimientos/${item.id}(?:[?#].*)?$`));
  await expect(page.getByTestId('inspection-next-step')).toContainText('Tenés requerimientos por responder');
  await expect(page.getByRole('link', { name: 'Mis inspecciones', exact: true })).toHaveCount(0);
}

test('multi-role notices open only their requirement and preserve separate unsent replies', async ({ page }, info) => {
  await assertCloudDatabase();
  expect(fixture.email).toBe('draft-multirole-20261024@night-qa.invalid');
  expect(fixture.cases.map(item => item.role)).toEqual(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']);
  const errors: string[] = [], mutations: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, fixture.email.split('@')[0]);
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  for (const item of fixture.cases) {
    expect(item.id).toMatch(/^qa-psip-context-/);
    await openNotice(page, info, item);
    const reply = page.getByRole('button', { name: 'Responder requerimiento #2', exact: true });
    await expect(reply).toBeEnabled();
    await reply.click();
    const marker = `Respuesta artificial sin enviar ${info.project.name} ${item.role}`;
    await page.getByRole('textbox', { name: 'Contenido', exact: true }).fill(marker);
    await expect.poll(() => page.evaluate(value => Object.keys(localStorage).some(key => key.startsWith('sitrep_exchange_draft_v2_') && localStorage.getItem(key)?.includes(value)), marker)).toBe(true);
    for (const width of [320, 393]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    await page.getByTestId('inspection-next-step').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`requirement-${item.role.toLowerCase()}.png`), animations: 'disabled' });
  }
  const first = fixture.cases[0];
  await openNotice(page, info, first);
  const expected = `Respuesta artificial sin enviar ${info.project.name} ${first.role}`;
  const resumedAt = Date.now();
  await expect(page.getByRole('textbox', { name: 'Contenido', exact: true })).toHaveValue(expected, { timeout: 10_000 });
  info.annotations.push({ type: 'draft-recovery-ms', description: String(Date.now() - resumedAt) });
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Contenido', exact: true })).toHaveValue(expected, { timeout: 10_000 });
  expect(mutations).toEqual([]);
  expect(errors).toEqual([]);
});
