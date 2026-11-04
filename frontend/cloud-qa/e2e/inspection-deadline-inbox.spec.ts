import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

const out = process.env.QA_ARTIFACTS!;
const direct = JSON.parse(readFileSync(path.join(out, 'fixture-direct-polished.json'), 'utf8'));
const authority = JSON.parse(readFileSync(path.join(out, 'fixture-authority-polished.json'), 'utf8'));
for (const index of [0, 1, 2, 3]) test(`inbox and bell identify current requirement for recipient ${index + 1}`, async ({ page }, info) => {
  await assertCloudDatabase(); expect(direct.synthetic && authority.synthetic).toBe(true);
  const items = [...direct.cases[info.project.name], { ...authority.cases[info.project.name], email: 'admin@night-qa.invalid',
    noticeId: authority.cases[info.project.name].authorityNoticeId }];
  const errors: string[] = [], warnings: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  const item = items[index];
    expect(item.email).toMatch(/^(?:psip-owner-.*|admin)@night-qa\.invalid$/);
    await login(page, info, item.email.split('@')[0]);
    await page.goto(prefix(info) + '/notificaciones');
    await expect(page).toHaveURL(new RegExp('/notificaciones(?:[?#].*)?$'));
    await expect(page).toHaveTitle(/SITREP/i);
    await expect(page.locator('vite-error-overlay, nextjs-portal')).toHaveCount(0);
    const detail = await page.evaluate(async id => {
      const response = await fetch('/api/notificaciones/' + id, { headers: { Authorization: 'Bearer ' + localStorage.getItem('sitrep_access_token') } });
      return { status: response.status, body: await response.json() };
    }, item.noticeId);
    expect(detail.status).toBe(200); expect(detail.body.data.titulo).toBe('Estado actualizado de requerimiento');
    const number = JSON.parse(detail.body.data.datos).numero as string; expect(number).toMatch(/^QA-DEADLINE-/);
    const list = page.getByRole('list', { name: 'Avisos', exact: true });
    const row = list.getByRole('button', { name: 'Abrir aviso: Estado actualizado de requerimiento', exact: true }).filter({ hasText: number });
    await expect(row).toBeVisible(); await expect(row).toContainText('Se registró una respuesta');
    await expect(row).not.toContainText('Situación registrada al evaluar:');
    await expect(row).not.toContainText('Consultar requerimiento y respuesta');
    await page.screenshot({ path: info.outputPath('bandeja-' + (item.role || 'administrador').toLowerCase() + '.png'), animations: 'disabled' });
    await page.getByRole('button', { name: /^Notificaciones(?: \(.*\))?$/ }).first().click();
    const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
    const bellItem = bell.getByRole('button').filter({ hasText: number });
    if (item.role || await bellItem.count()) {
      await expect(bellItem).toBeVisible(); await expect(bellItem).toContainText('Se registró una respuesta');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await bellItem.click();
    } else {
      await bell.getByRole('button', { name: 'Ver todas las notificaciones', exact: true }).click();
      await expect(row).toBeVisible(); await row.click();
    }
    await expect(page).toHaveURL(new RegExp('/' + (item.role ? 'requerimientos' : 'inspecciones') + '/' + item.inspectionId + '(?:[?#].*)?$'));
    // Each recipient gets a separate browser context; no token is removed while a request is in flight.
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await info.attach('console-warnings.json', { body: Buffer.from(JSON.stringify(warnings)), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
