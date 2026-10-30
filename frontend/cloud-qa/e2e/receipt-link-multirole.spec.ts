import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
test.beforeAll(async () => { await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); });

for (const source of ['campana', 'avisos'] as const) {
  test(`comprobante repetido: ${source} abre la actividad vinculada`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page, info, fixture.owner.split('@')[0]);
    await page.goto(`${prefix(info)}/mi-solicitud?solicitud=${fixture.generator}`);
    const selection = page.getByLabel('Solicitud por actividad');
    await expect(selection).toHaveValue(fixture.generator);
    if (source === 'campana') {
      await page.getByRole('button', { name: /^Notificaciones/ }).click();
      const panel = page.getByRole('region', { name: 'Notificaciones recientes' });
      await panel.getByRole('button').filter({ hasText: 'Comprobante repetido' }).first().click();
    } else {
      await page.goto(`${prefix(info)}/notificaciones`);
      await page.getByRole('button', { name: 'Abrir aviso: Comprobante repetido', exact: true }).first().click();
    }
    await expect.poll(() => new URL(page.url()).pathname).toBe(`${prefix(info)}/mi-solicitud`);
    await expect.poll(() => new URL(page.url()).searchParams.get('solicitud')).not.toBe(fixture.generator);
    const actual = new URL(page.url()).searchParams.get('solicitud');
    await expect(selection).toBeVisible();
    if (actual === fixture.operator) await expect(selection).toHaveValue(fixture.operator);
    writeFileSync(info.outputPath('observed.json'), JSON.stringify({ synthetic: true, source, surface: info.project.name,
      hasExactTarget: actual === fixture.operator, selectedCorrectly: await selection.inputValue() === fixture.operator }, null, 2));
    await page.screenshot({ path: info.outputPath('destino.png'), animations: 'disabled' });
    expect(actual).toBe(fixture.operator);
    await expect(selection).toHaveValue(fixture.operator);
    await expect(page.getByText('Inscripción de Operador', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('el correo renderizado abre la misma solicitud después de ingresar', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  await page.addInitScript(() => localStorage.setItem('sitrep_onboarding_GENERADOR', 'true'));
  await page.setContent(fixture.mailHtml);
  const link = page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`);
  await expect(link).toHaveCount(1);
  const target = new URL((await link.getAttribute('href'))!);
  expect(target.pathname).toBe(`${prefix(info)}/mi-solicitud`);
  expect(target.searchParams.get('solicitud')).toBe(fixture.operator);
  await link.click(); await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Correo electrónico o CUIT').fill(fixture.owner);
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(target.href);
  await expect(page.getByLabel('Solicitud por actividad')).toHaveValue(fixture.operator);
  await expect(page.getByText('Inscripción de Operador', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('correo-destino.png'), animations: 'disabled' });
});
