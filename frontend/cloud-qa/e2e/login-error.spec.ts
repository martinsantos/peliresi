import { test, expect } from '@playwright/test';
import { directTrainingLogin } from '../direct-training-login';
import { prefix } from './helpers';

for (const [status, message] of [
  [401, 'Credenciales inválidas'],
  [429, 'Demasiados intentos de autenticación para esta cuenta, intente de nuevo en un minuto'],
] as const) {
  test(`keeps ${status} visible, then accepts the real training generator login`, async ({ page }, info) => {
    // Inject the failure in this browser only: never consume the live class's failed-login quota.
    await page.route('**/api/auth/login', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message }) }));
    await page.goto(prefix(info) + '/login');
    await page.getByLabel('Correo electrónico o CUIT').fill('generador@capacitacion.invalid');
    await page.getByLabel('Contraseña', { exact: true }).fill('synthetic-injected-failure');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath('error-visible.png') });
    await page.unroute('**/api/auth/login');
    await directTrainingLogin(page, info, 'generador', { manifests: new Set(), eventuals: new Set() });
    await expect(page.getByRole('heading', { name: info.project.name === 'app' ? 'Mis trámites' : 'Mis Manifiestos Recientes', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: info.project.name === 'app' ? 'Mis trámites' : 'Mis Manifiestos Recientes', exact: true })).toBeVisible();
    await expect(page.getByText('Capacitación · sin validez oficial', { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath('generador-sesion-persistente.png') });
  });
}
