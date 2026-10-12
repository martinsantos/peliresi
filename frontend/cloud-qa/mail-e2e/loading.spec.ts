import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { prefix } from '../e2e/helpers';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'mail-fixture.json'), 'utf8'));
test('branded loading yields to real application data and respects reduced motion', async ({ page }, info) => {
  expect(fixture.database).toBe('sitrep_night_qa_20260926');
  expect(fixture.externalDelivery).toBe(false);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: '127.12.3.' + (info.project.name === 'app' ? '3' : info.project.name === 'web-desktop' ? '1' : '2'), url: 'http://127.0.0.1:4177' }]);
  await page.addInitScript(() => localStorage.setItem('sitrep_onboarding_GENERADOR', 'true'));
  // Hold the real request, then release it unchanged. No fabricated form data.
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/solicitudes/mis-solicitudes', async route => { await wait; await route.continue(); });
  try {
    await page.goto(prefix(info) + '/mi-solicitud');
    await page.getByLabel('Correo electrónico o CUIT').fill('pending-mail@night-qa.invalid');
    await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    // First-login welcome is intentional. Dismiss it through the actual UI,
    // not by hiding the overlay or relying on an obsolete localStorage key.
    const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
    await expect(welcome).toBeVisible();
    await welcome.click();
    await expect(welcome).toHaveCount(0);
    const loading = page.locator('[data-form-skeleton]');
    await expect(loading).toBeVisible();
    await expect(loading.getByRole('status')).toHaveText('Cargando tu solicitud…');
    await loading.getByRole('status').click({ trial: true });
    await expect(loading.locator('input,textarea,button')).toHaveCount(0);
    await expect(loading.locator('[data-sitrep-cycle] path')).toHaveCount(3);
    await expect(loading.locator('.sitrep-spinner')).toHaveCSS('animation-name', 'sitrep-loading-turn');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(loading.locator('.sitrep-spinner')).toHaveCSS('animation-name', 'none');
    await expect(loading.locator('.sitrep-skeleton').first()).toHaveCSS('animation-name', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page).toHaveTitle(/SITREP/);
    await page.screenshot({ path: info.outputPath('loading-application.png'), animations: 'disabled' });
    release();
    await expect(loading).toHaveCount(0);
    await expect(page.getByText('QA observación pendiente verificado', { exact: true })).toBeVisible();
    const message = page.getByPlaceholder('Escribe un mensaje...');
    await message.click({ trial: true });
    await message.fill('Respuesta de prueba todavía sin enviar');
    await expect(message).toHaveValue('Respuesta de prueba todavía sin enviar');
    await page.screenshot({ path: info.outputPath('loaded-application.png'), animations: 'disabled' });
    expect(errors).toEqual([]);
  } finally { release(); }
});
