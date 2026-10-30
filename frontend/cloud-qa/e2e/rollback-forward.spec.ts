import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix, readablePageHeading } from './helpers';

test.beforeAll(async () => {
  await assertCloudDatabase();
  expect(process.env.QA_COMPAT_BACKEND || 'current').toBe('current');
  expect(process.env.QA_ARTIFACTS).toBe('/work/sitrep/.qa-rollback-partial-20261030');
});

test('the current version reopens the received proposal and its three approvals from the prior notice', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'rollback-fixture.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true);
  const item = fixture.cases[info.project.name] as { id: string; numero: string };
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'operador');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(prefix(info) + '/notificaciones');
  const notice = page.getByRole('list', { name: 'Avisos', exact: true }).getByRole('listitem')
    .filter({ hasText: item.numero }).filter({ hasText: 'Coordinación iniciada: tratamiento en origen' });
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: /^Abrir aviso:/ }).click();
  const manifestUrl = new RegExp('/manifiestos/' + item.id + '$');
  await page.waitForURL(url => manifestUrl.test(url.pathname) || /\/notificaciones\/[^/]+$/.test(url.pathname));
  if (/\/notificaciones\/[^/]+$/.test(new URL(page.url()).pathname)) {
    const select = page.getByRole('button', { name: /^(Usar Operador y abrir manifiesto|Abrir manifiesto)$/ });
    await expect(select).toHaveCount(1); await select.click();
  }
  await expect(page).toHaveURL(manifestUrl);
  await expect(page.getByText(item.numero, { exact: false }).first()).toBeVisible();
  const approvals = page.getByRole('region', { name: 'Aprobaciones de las partes' });
  await expect(approvals).toContainText('Aprobaciones registradas');
  for (const name of ['Generador', 'Transporte', 'Operador']) await expect(approvals.getByLabel(name + ': Aprobado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar Recepcion In Situ', exact: true })).toHaveCount(0);
  await readablePageHeading(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('reopened-after-forward.png'), animations: 'disabled' });
});
