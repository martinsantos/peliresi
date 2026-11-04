import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { login, prefix, readablePageHeading } from './helpers';
const fixture = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/authority-browser-fixture.json', 'utf8'));
const labels: Record<string, string> = { ADMIN: 'Administración', ADMIN_GENERADOR: 'Administración de Generadores', ADMIN_OPERADOR: 'Administración de Operadores', ADMIN_TRANSPORTISTA: 'Administración de Transporte' };
async function findNotice(page: Page, numero: string, title: string) {
  const list = page.getByRole('list', { name: 'Avisos', exact: true });
  const notice = list.getByRole('listitem').filter({ hasText: numero }).filter({ hasText: title });
  for (let attempt = 0; attempt < 10; attempt++) {
    await expect(list).toBeVisible();
    if (await notice.count()) { await expect(notice).toBeVisible(); return notice; }
    const next = page.getByRole('button', { name: 'Siguiente página', exact: true });
    await expect(next).toBeEnabled();
    const loaded = page.waitForResponse(r => r.url().includes('/api/notificaciones?') && r.request().method() === 'GET' && r.status() === 200);
    await next.click(); await loaded;
    await expect(list).toBeVisible();
  }
  throw new Error('No se encontró el aviso de ' + numero + ': ' + title);
}
async function evidence(page: Page, info: TestInfo, name: string) {
  await expect(page).toHaveTitle(/SITREP/); await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.getByText('Capacitación · sin validez oficial', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await readablePageHeading(page); await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
}
for (const account of fixture.authorities as Array<{ alias: string; rol: string }>) {
  test(`${account.rol}: authority notice opens finding and records its own decision`, async ({ page, browser }, info) => {
    const entry = fixture.cases[info.project.name + ':' + account.alias], errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await login(page, info, account.alias); await page.goto(prefix(info) + '/notificaciones');
    const notice = await findNotice(page, entry.numero, 'Nueva corriente aprobada post facto');
    await expect(notice).toBeVisible(); await expect(notice).toContainText('adenda v1. Y21');
    await notice.getByRole('button', { name: /^Abrir aviso:/ }).click();
    await expect(page).toHaveURL(new RegExp('/manifiestos/' + entry.manifestId + '/adendas$'));
    const card = page.getByRole('region', { name: 'Adenda ' + entry.adendaId, exact: true });
    await expect(card).toContainText('Y21'); await expect(card.getByRole('button', { name: 'Aprobar post facto', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Informar hallazgo', exact: true })).toHaveCount(0);
    await evidence(page, info, 'authority-finding');
    const note = 'QA autoridad ' + account.rol + ': revisar evidencia de la corriente';
    await card.getByLabel('Motivo de resolución', { exact: true }).fill(note);
    const response = page.waitForResponse(r => r.url().endsWith('/' + entry.adendaId + '/revisiones') && r.request().method() === 'POST');
    await card.getByRole('button', { name: 'Observar', exact: true }).click();
    const saved = await response; expect(saved.status()).toBe(200); expect(saved.headers()['x-sitrep-training']).not.toBe('true');
    await expect(card.getByRole('status', { name: 'Estado de revisión' })).toHaveText('Observada');
    await expect(card.getByLabel('Última revisión')).toContainText(labels[account.rol]);
    await evidence(page, info, 'authority-decision');
    const context = await browser.newContext({ ...info.project.use, baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' });
    try {
      const operator = await context.newPage(); operator.on('pageerror', e => errors.push(e.message)); operator.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await login(operator, info, 'operador'); await operator.goto(prefix(info) + '/notificaciones');
      const result = await findNotice(operator, entry.numero, 'Adenda observada');
      await expect(result).toBeVisible(); await result.getByRole('button', { name: /^Abrir aviso:/ }).click();
      await expect(operator).toHaveURL(new RegExp('/manifiestos/' + entry.manifestId + '/adendas$'));
      const finding = operator.getByRole('region', { name: 'Adenda ' + entry.adendaId, exact: true });
      await expect(finding.getByLabel('Última revisión')).toContainText(note); await expect(finding.getByLabel('Última revisión')).toContainText(labels[account.rol]);
      await expect(finding.getByRole('button', { name: 'Aprobar post facto' })).toHaveCount(0);
      await evidence(operator, info, 'operator-receives-authority');
    } finally { await context.close(); }
    expect(errors).toEqual([]); writeFileSync(info.outputPath('proof.json'), JSON.stringify({ surface: info.project.name, authorityRole: account.rol, actualLogins: 2, errors, cap: false, decision: 'OBSERVADA' }));
  });
}
