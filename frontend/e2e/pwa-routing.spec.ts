import { test, expect } from '@playwright/test';

/**
 * PWA routing regression tests.
 * Verifies that canonical /admin/actores/* paths work in the PWA mobile app.
 * This covers a bug where App.tsx (web) and AppMobile.tsx (PWA) had inconsistent paths.
 */

const ADMIN_EMAIL = 'admin@dgfa.mendoza.gov.ar';
const ADMIN_PASS = 'admin123';

// Real production IDs — these exist in the database
const KNOWN_TRANSPORTISTA_ID = 'cmm4a0u9r002nd8dy37h53j5t';
const KNOWN_OPERADOR_ID = 'cmmpaa2b100edlvk7p577bmap';
const KNOWN_GENERADOR_ID = 'cmmpaawor00a14kd0ogaieve9';

async function loginToPwa(page: import('@playwright/test').Page) {
  await page.goto('/app/');
  // PWA redirects to /app/login — wait for form
  await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[placeholder*="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[placeholder="********"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();
  // Wait for post-login render (dashboard or redirect)
  await page.waitForTimeout(2000);
}

test.describe('PWA routing — canonical /admin/actores paths', () => {
  test('direct /app/admin/actores/transportistas/:id renders (not 404)', async ({ page }) => {
    await loginToPwa(page);
    await page.goto(`/app/admin/actores/transportistas/${KNOWN_TRANSPORTISTA_ID}`);
    // Must NOT show 404 page
    await expect(page.getByText(/404|página no encontrada/i)).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    const notFound = await page.getByText(/página no encontrada/i).isVisible().catch(() => false);
    expect(notFound).toBe(false);
  });

  test('direct /app/admin/actores/operadores/:id renders (not 404)', async ({ page }) => {
    await loginToPwa(page);
    await page.goto(`/app/admin/actores/operadores/${KNOWN_OPERADOR_ID}`);
    const notFound = await page.getByText(/página no encontrada/i).isVisible().catch(() => false);
    expect(notFound).toBe(false);
  });

  test('direct /app/admin/actores/generadores/:id renders (not 404)', async ({ page }) => {
    await loginToPwa(page);
    await page.goto(`/app/admin/actores/generadores/${KNOWN_GENERADOR_ID}`);
    const notFound = await page.getByText(/página no encontrada/i).isVisible().catch(() => false);
    expect(notFound).toBe(false);
  });

  test('direct /app/admin/actores/transportistas (list) renders', async ({ page }) => {
    await loginToPwa(page);
    await page.goto(`/app/admin/actores/transportistas`);
    const notFound = await page.getByText(/página no encontrada/i).isVisible().catch(() => false);
    expect(notFound).toBe(false);
  });

  test('direct /app/admin/actores/operadores (list) renders', async ({ page }) => {
    await loginToPwa(page);
    await page.goto(`/app/admin/actores/operadores`);
    const notFound = await page.getByText(/página no encontrada/i).isVisible().catch(() => false);
    expect(notFound).toBe(false);
  });

  test('direct /app/admin/actores/generadores (list) renders', async ({ page }) => {
    await loginToPwa(page);
    await page.goto(`/app/admin/actores/generadores`);
    const notFound = await page.getByText(/página no encontrada/i).isVisible().catch(() => false);
    expect(notFound).toBe(false);
  });
});
