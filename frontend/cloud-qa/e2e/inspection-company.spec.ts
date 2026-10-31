import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

type Scenario = { role: 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR'; id: string; noticeId: string };
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'inspection-company-fixture.json'), 'utf8')) as {
  email: string; cases: Record<string, Scenario[]>;
};
const labels = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador' } as const;

async function getApi(page: Page, route: string) {
  return page.evaluate(async endpoint => {
    const response = await fetch('/api' + endpoint, { headers: { Authorization: 'Bearer ' + localStorage.getItem('sitrep_access_token') } });
    return { status: response.status, body: await response.json() };
  }, route);
}
test('representatives receive and answer requirements without accessing the inspections module', async ({ page, browser }, info) => {
  await assertCloudDatabase();
  expect(fixture.email).toMatch(/@night-qa\.invalid$/);
  const cases = fixture.cases[info.project.name];
  expect(cases.map(item => item.role)).toEqual(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, fixture.email.split('@')[0]);
  const authority = await browser.newContext({ viewport: page.viewportSize(), baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' });
  try {
    const admin = await authority.newPage(); admin.on('pageerror', error => errors.push(error.message));
    await login(admin, info, 'admin');
    for (const item of cases) {
      const detail = await getApi(page, '/notificaciones/' + item.noticeId);
      expect(detail.status).toBe(200);
      const number = JSON.parse(detail.body.data.datos).numero as string;
      await page.goto(prefix(info) + '/notificaciones');
      const list = page.getByRole('list', { name: 'Avisos', exact: true });
      const action = list.getByRole('button', { name: 'Abrir aviso: PSIP · Nuevo requerimiento', exact: true }).filter({ hasText: number });
      await expect(action).toBeVisible(); await action.click();
      await expect(page).toHaveURL(new RegExp('/notificaciones/' + item.noticeId + '$'));
      const notice = page.getByRole('region', { name: 'Aviso recibido' });
      await expect(notice).toContainText(number);
      await notice.getByRole('button', { name: `Usar ${labels[item.role]} y abrir requerimiento`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp('/requerimientos/' + item.id + '(?:[?#].*)?$'));
      await expect(page.getByTestId('inspection-next-step')).toContainText('Tenés requerimientos por responder');
      await expect(page.getByRole('link', { name: 'Mis inspecciones', exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath('requerimiento-' + item.role.toLowerCase() + '.png'), animations: 'disabled' });
      await page.getByRole('button', { name: /^Responder requerimiento #/ }).click();
      await page.getByRole('combobox', { name: 'Tipo de actuación', exact: true }).selectOption('RESPUESTA');
      await page.getByLabel('Contenido', { exact: true }).fill('QA respuesta artificial presentada por una persona autorizada de la empresa.');
      const saved = page.waitForResponse(response => response.url().endsWith('/inspecciones/' + item.id + '/intercambios') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
      const response = await saved; expect(response.status()).toBe(201);
      const exchange = (await response.json()).data;
      await expect(page.getByTestId('inspection-next-step')).toContainText('Tu presentación está registrada');
      const adminNotices = await getApi(admin, '/notificaciones?limit=500');
      expect(adminNotices.status).toBe(200);
      const matching = adminNotices.body.data.notificaciones.filter((n: { datos: string }) => {
        try { return JSON.parse(n.datos || '{}').intercambioId === exchange.id; } catch { return false; }
      });
      expect(matching).toHaveLength(1);
      expect(JSON.parse(matching[0].datos)).toMatchObject({ inspeccionId: item.id, destino: 'inspeccion', evento: 'RESPUESTA' });
    }
    expect(errors).toEqual([]);
  } finally { await authority.close(); }
});
