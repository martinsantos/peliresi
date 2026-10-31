import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

const run = ['final', 'polished'].includes(process.env.QA_DIRECT_RUN || '') ? '-' + process.env.QA_DIRECT_RUN : '';
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, `fixture-direct${run}.json`), 'utf8'));
test('direct recipients see the current requirement after answering, without a new sweep', async ({ page }, info) => {
  await assertCloudDatabase(); expect(fixture.synthetic).toBe(true);
  const items = fixture.cases[info.project.name];
  expect(items.map((item: any) => item.role)).toEqual(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const item of items) {
    expect(item.email).toMatch(/^psip-owner-.*@night-qa\.invalid$/);
    if (page.url() !== 'about:blank') { await page.evaluate(() => localStorage.clear()); await page.context().clearCookies(); }
    await login(page, info, item.email.split('@')[0]);
    await page.goto(prefix(info) + '/notificaciones/' + item.noticeId);
    const notice = page.getByRole('region', { name: 'Aviso recibido' });
    await expect(notice).toContainText('Sin respuesta del inspeccionado');
    await notice.getByRole('link', { name: 'Consultar requerimiento y estado →', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/requerimientos/' + item.inspectionId + '(?:[?#].*)?$'));
    await page.getByRole('button', { name: /^Responder requerimiento #/ }).click();
    await page.getByRole('combobox', { name: 'Tipo de actuación', exact: true }).selectOption('RESPUESTA');
    await page.getByLabel('Contenido', { exact: true }).fill('QA respuesta artificial del titular.');
    const saved = page.waitForResponse(response => response.url().endsWith('/inspecciones/' + item.inspectionId + '/intercambios') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Presentar en expediente', exact: true }).click();
    expect((await saved).status()).toBe(201);
    await expect(page.getByTestId('inspection-next-step')).toContainText('Tu presentación está registrada');
    await page.goto(prefix(info) + '/notificaciones/' + item.noticeId);
    await expect(notice.getByRole('heading', { name: 'Estado actualizado de requerimiento', exact: true })).toBeVisible();
    await expect(notice).not.toContainText('Sin respuesta del inspeccionado');
    await expect(notice).toContainText('Se registró una respuesta');
    await expect(notice).toContainText('QA-DEADLINE-DIRECT-');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('directo-' + item.role.toLowerCase() + '.png'), animations: 'disabled' });
  }
  expect(errors).toEqual([]);
});
