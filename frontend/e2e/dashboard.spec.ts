import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@dgfa.mendoza.gov.ar';
const ADMIN_PASS = 'admin123';

test.describe('Dashboard', () => {
  test('login and verify dashboard loads with navigation', async ({ page }) => {
    await page.goto('/');

    // Click "Iniciar sesión" on landing
    const loginLink = page.getByRole('link', { name: /iniciar sesión/i }).or(
      page.getByText(/iniciar sesión/i)
    ).first();
    await loginLink.waitFor({ timeout: 15000 });
    await loginLink.click();

    // Fill login form
    await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 10000 });
    await page.locator('input[type="email"], input[placeholder*="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"], input[placeholder="********"]').fill(ADMIN_PASS);
    await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();

    // Wait for dashboard — sidebar aside element
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 20000 });

    // Verify main content area exists
    await expect(page.locator('main').first()).toBeVisible({ timeout: 5000 });

    // Verify navigation contains expected links
    const navText = await page.locator('aside').first().textContent();
    expect(navText).toContain('Dashboard');
  });
});
