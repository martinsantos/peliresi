import { test, expect } from '@playwright/test';
import { loginAsOperador } from './helpers/auth';

test.describe('Operador Flow', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    await loginAsOperador(page);
  });

  test('dashboard loads after login', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/dashboard|panel|manifiestos|bienvenido/i);
  });

  test('manifiestos page loads', async ({ page }) => {
    await page.goto('/manifiestos');
    await page.waitForLoadState('networkidle');
    const notFound = page.getByText(/página no encontrada/i);
    const has404 = await notFound.isVisible().catch(() => false);
    expect(has404).toBe(false);
    const headingOrTable = page.locator('h1, h2, table, [class*="manifiesto"]').first();
    await expect(headingOrTable).toBeVisible({ timeout: 10000 });
  });

  test('can access mi-perfil page', async ({ page }) => {
    await page.goto('/mi-perfil');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/perfil|usuario|configuraci.n|contraseña/i);
  });
});
