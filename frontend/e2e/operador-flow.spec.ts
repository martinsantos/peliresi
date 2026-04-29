import { test, expect } from '@playwright/test';

const OPERADOR_EMAIL = 'tratamiento.residuos@planta.com';
const OPERADOR_PASS = 'op123';

async function loginAsOperador(page: import('@playwright/test').Page) {
  await page.goto('/');
  const loginBtn = page.getByText(/iniciar sesión/i).first();
  await loginBtn.waitFor({ timeout: 15000 });
  await loginBtn.click();
  await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 10000 });
  await page.locator('input[type="email"], input[placeholder*="email"]').fill(OPERADOR_EMAIL);
  await page.locator('input[type="password"], input[placeholder="********"]').fill(OPERADOR_PASS);
  await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();
  await expect(page.locator('aside, main, nav').first()).toBeVisible({ timeout: 20000 });
}

test.describe('Operador Flow', () => {
  test.beforeEach(async ({ page }) => {
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
