import { test, expect } from '@playwright/test';
import { isolatedMapTiles, prefix } from './helpers';

for (const [status, message] of [
  [401, 'Credenciales inválidas'],
  [429, 'Demasiados intentos de autenticación para esta cuenta, intente de nuevo en un minuto'],
] as const) test(`login ${status} remains visible and the same form recovers into a real non-CAP session`, async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.11.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`, url: 'http://127.0.0.1:4177' }]);
  await page.addInitScript(() => localStorage.setItem('sitrep_onboarding_GENERADOR', 'true'));
  // Browser-local failure only; never exhaust a shared account's real login quota.
  await page.route('**/api/auth/login', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message }) }));
  await page.goto(prefix(info) + '/login');
  const email = page.getByLabel('Correo electrónico o CUIT'), password = page.getByLabel('Contraseña', { exact: true });
  await email.fill('generador@night-qa.invalid'); await password.fill('synthetic-failure');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(message);
  await expect(page).toHaveURL(new RegExp(prefix(info) + '/login$'));
  await expect(email).toHaveValue('generador@night-qa.invalid');
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('sitrep_access_token'))).toBeNull();
  await page.screenshot({ path: info.outputPath('login-error-visible.png'), animations: 'disabled' });
  await page.unroute('**/api/auth/login');
  const nextStatus = status === 401 ? 429 : 401;
  const nextMessage = status === 401 ? 'Demasiados intentos: esperá un minuto' : 'Credenciales inválidas: revisá tu contraseña';
  await page.route('**/api/auth/login', route => route.fulfill({ status: nextStatus, contentType: 'application/json', body: JSON.stringify({ success: false, message: nextMessage }) }));
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(nextMessage);
  await expect(email).toHaveValue('generador@night-qa.invalid');
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('login-latest-error-visible.png'), animations: 'disabled' });
  await page.unroute('**/api/auth/login');
  await password.fill('OnlyLocal-NightQA-2026!');
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await response).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/); await expect(page.getByRole('banner')).toBeVisible();
  await page.reload(); await expect(page.getByRole('banner')).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
  const profile = await page.request.get('/api/auth/profile', { headers: { Authorization: 'Bearer ' + token } });
  expect(profile.status()).toBe(200);
  const user = (await profile.json()).data.user; expect(user.email).toBe('generador@night-qa.invalid'); expect(user.rol).toBe('GENERADOR'); expect(user.training).toBeFalsy();
  await expect(page.getByText('Capacitación · sin validez oficial', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('login-session-restored.png'), animations: 'disabled' });
});
