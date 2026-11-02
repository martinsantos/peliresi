import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test('representative opens an administrative correction in their authorized company', async ({ page }, info) => {
 const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'reversion-notices-private.json'), 'utf8'));
 const item = fixture.cases[info.project.name]; expect(item).toBeTruthy();
 expect(fixture.member).toMatch(/@night-qa\.invalid$/);
 const errors: string[] = [], writes: string[] = [];
 await login(page, info, fixture.member.split('@')[0]);
 if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
 page.on('pageerror', error => errors.push(error.message));
 page.on('request', request => {
  if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + new URL(request.url()).pathname);
 });
 await page.goto(prefix(info) + '/notificaciones');
 const card = page.getByRole('list', { name: 'Avisos', exact: true }).locator('li')
  .filter({ hasText: 'Estado del manifiesto corregido' }).filter({ hasText: item.numero });
 await expect(card).toHaveCount(1);
 await page.screenshot({ path: info.outputPath('reversion-inbox.png'), animations: 'disabled', scale: 'css' });
 await card.getByRole('button', { name: 'Abrir aviso: Estado del manifiesto corregido' }).click();
 await expect(page).toHaveURL(new RegExp(`/notificaciones/${item.notice}(?:[/?#]|$)`));
 await expect(page.getByText(/Generador ·/)).toBeVisible();
 const action = page.getByRole('button', { name: /Usar Generador y abrir manifiesto|Abrir manifiesto/ });
 await expect(action).toBeVisible(); await action.evaluate(element => element.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
 const rect = await action.boundingBox(); expect(rect).not.toBeNull(); expect(rect!.height).toBeGreaterThanOrEqual(44);
 await page.screenshot({ path: info.outputPath('reversion-company-context.png'), animations: 'disabled', scale: 'css' });
 await action.click(); await expect(page).toHaveURL(new RegExp(`/manifiestos/${item.manifestId}(?:[/?#]|$)`));
 await expect(page.getByText(item.numero, { exact: true }).first()).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(errors).toEqual([]); expect(writes.every(value => value === `PUT /api/notificaciones/${item.notice}/leida`)).toBe(true);
});

test('a historical draft explains why a single signature cannot start it', async ({ page }, info) => {
 const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'reversion-notices-private.json'), 'utf8'));
 await login(page, info, fixture.owner.split('@')[0]);
 if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
 await page.goto(prefix(info) + '/manifiestos/' + fixture.legacyCases.FIJO.draftId);
 await expect(page.getByText(fixture.legacyCases.FIJO.draftNumber, { exact: true }).first()).toBeVisible();
 await expect(page.getByRole('region', { name: 'Aprobaciones pendientes' })).toContainText('Las tres partes deben aprobar');
 await expect(page.getByRole('button', { name: 'Firmar Manifiesto' })).toHaveCount(0);
 await page.screenshot({ path: info.outputPath('historical-draft.png'), animations: 'disabled', scale: 'css' });
});

test('an old in-situ record cannot start reception without three recorded approvals', async ({ page }, info) => {
 const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'reversion-notices-private.json'), 'utf8'));
 await login(page, info, 'operador');
 if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
 await page.goto(prefix(info) + '/manifiestos/' + fixture.legacyCases.IN_SITU.oldId);
 await expect(page.getByText(fixture.legacyCases.IN_SITU.oldNumber, { exact: true }).first()).toBeVisible();
 await expect(page.getByRole('region', { name: 'Aprobaciones pendientes' })).toContainText('Las tres partes deben aprobar');
 await expect(page.getByRole('button', { name: 'Confirmar recepción en origen' })).toBeDisabled();
 await page.screenshot({ path: info.outputPath('historical-in-situ.png'), animations: 'disabled', scale: 'css' });
});

test('transport sees why an older trip is blocked in the detail and direct trip view', async ({ page }, info) => {
 const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'reversion-notices-private.json'), 'utf8'));
 await login(page, info, 'transportista');
 if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
 const id = fixture.legacyCases.FIJO.oldId;
 await page.goto(prefix(info) + '/manifiestos/' + id);
 await expect(page).toHaveURL(new RegExp(`/manifiestos/${id}(?:[/?#]|$)`));
 await expect(page.getByText('Aprobado · registro anterior')).toBeVisible();
 await expect(page.getByRole('region', { name: 'Aprobaciones pendientes' })).toContainText('Las tres partes deben aprobar');
 await expect(page.getByRole('button', { name: 'Confirmar Retiro' })).toBeDisabled();
 await page.goto(prefix(info) + '/transporte/viaje/' + id);
 await expect(page.getByRole('alert')).toContainText('Este manifiesto necesita una nueva propuesta');
 await expect(page.getByText('Tramos de transporte')).toHaveCount(0);
 const alert = await page.getByRole('alert').boundingBox(); expect(alert).not.toBeNull(); expect(alert!.y).toBeLessThan(320);
 await expect(page.getByRole('button', { name: /Confirmar retiro/i })).toHaveCount(0);
 await page.screenshot({ path: info.outputPath('historical-trip.png'), animations: 'disabled', scale: 'css' });
});
