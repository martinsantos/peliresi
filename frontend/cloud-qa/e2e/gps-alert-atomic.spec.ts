import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('the committed GPS observation is visible from the bell and opens its manifest', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-alert-atomic-private.json'), 'utf8'));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, info, 'admin');
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(prefix(info) + '/notificaciones');
  const inbox = page.getByRole('list', { name: 'Avisos', exact: true });
  const notice = inbox.locator('li').filter({ hasText: fixture.crash.numero }).filter({ hasText: 'GPS: posible velocidad elevada' });
  await expect(notice).toHaveCount(1, { timeout: 20000 });
  await expect(notice).toContainText('Hora de captura no disponible');
  await expect(notice).toContainText('Verificá el caso con transporte');
  await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
  const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
  await expect(bell).toContainText(fixture.crash.numero);
  await expect(bell).toContainText('GPS: posible velocidad elevada');
  await page.screenshot({ path: info.outputPath('campana-gps.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: 'Cerrar notificaciones' }).click();
  await notice.getByRole('button', { name: /^Abrir aviso:/ }).click();
  await expect(page).toHaveURL(new RegExp(prefix(info) + '/manifiestos/' + fixture.crash.id + '$'));
  await expect(page.getByText(fixture.crash.numero, { exact: true }).first()).toBeVisible();
  await page.goto('/manual/tutorial.html?guide=administrador-alertas-proactivas');
  await expect(page.locator('#tutorialTitle')).toHaveText('Configurar alertas y seguir sus avisos');
  const guidance = page.locator('.guide-step').filter({ has: page.getByRole('heading', { name: 'Revisar observaciones del recorrido' }) });
  await expect(guidance).toContainText('Las cuentas ADMIN activas reciben un aviso', { ignoreCase: true });
  await expect(guidance).toContainText('Los avisos anteriores faltantes no se reconstruyen automáticamente.');
  await guidance.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('manual-gps.png'), animations: 'disabled', scale: 'css' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('gps-alert-atomic-browser-proof.json'), JSON.stringify({ surface: info.project.name,
    synthetic: true, bell: true, exactManifest: true, captureTimeCaution: true, manual: true, errors }));
});
