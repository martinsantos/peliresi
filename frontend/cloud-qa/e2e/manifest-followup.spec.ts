import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login } from './helpers';

const out = process.env.QA_ARTIFACTS!;
let fixture: { synthetic: boolean; email: string; manifestId: string; numero: string; records: { key: string; notice: string; title: string }[] };
test.beforeAll(async () => { await assertCloudDatabase(); fixture = JSON.parse(readFileSync(path.join(out, 'fixture.json'), 'utf8')); expect(fixture.synthetic).toBe(true); });
for (const key of ['seguimiento', 'incidente']) for (const source of ['campana', 'correo']) {
  test(`${key} desde ${source}: actividad autorizada`, async ({ page }, info) => {
    const record = fixture.records.find(item => item.key === key)!; expect(record).toBeTruthy();
    if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 800 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    if (source === 'campana') {
      await login(page, info, fixture.email.split('@')[0]);
      await page.getByRole('button', { name: /^Notificaciones/ }).click();
      await page.getByRole('region', { name: 'Notificaciones recientes' }).getByRole('button').filter({ hasText: record.title }).click();
    } else {
      await isolatedMapTiles(page, info);
      await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.37.${key === 'seguimiento' ? 1 : 2}.${info.project.name === 'app' ? 2 : 1}`, url: 'http://127.0.0.1:4177' }]);
      await page.addInitScript(() => { for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) localStorage.setItem('sitrep_onboarding_' + role, 'true'); });
      await page.setContent(readFileSync(path.join(out, key + '-mail.html'), 'utf8'));
      await page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`).click();
      await expect(page).toHaveURL(/\/login$/); await page.getByLabel('Correo electrónico o CUIT').fill(fixture.email);
      await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
      const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
    }
    await expect(page).toHaveURL(new RegExp(`/notificaciones/${record.notice}(?:[/?#]|$)`));
    const region = page.getByRole('region', { name: 'Actividades con acceso al manifiesto' });
    const action = region.getByRole('button', { name: 'Abrir como Operador' }); await expect(action).toBeVisible();
    await expect(region.getByRole('button', { name: 'Abrir como Generador' })).toHaveCount(0);
    await action.click(); await expect(page).toHaveURL(new RegExp(`/manifiestos/${fixture.manifestId}(?:[/?#]|$)`));
    await expect(page.getByText(fixture.numero, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
