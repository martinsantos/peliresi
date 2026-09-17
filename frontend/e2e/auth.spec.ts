import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASS } from './helpers/auth';

async function navigateToLogin(page: import('@playwright/test').Page) {
  await page.goto('/');
  // Landing page has "Iniciar sesión" button — click it to get to login form
  const loginBtn = page.getByRole('link', { name: /iniciar sesión/i }).or(
    page.getByText(/iniciar sesión/i)
  ).first();
  await loginBtn.waitFor({ timeout: 15000 });
  await loginBtn.click();
  // Wait for login form to appear
  await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 10000 });
}

test.describe('Authentication', () => {
  test('shows login page when clicking Iniciar sesión', async ({ page }) => {
    await navigateToLogin(page);
    await expect(page.locator('input[type="email"], input[placeholder*="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[placeholder="********"]')).toBeVisible();
  });

  test('login with valid credentials', async ({ page }) => {
    expect(ADMIN_PASS, 'E2E_ADMIN_PASSWORD is required').toBeTruthy();
    await navigateToLogin(page);
    await page.locator('input[type="email"], input[placeholder*="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"], input[placeholder="********"]').fill(ADMIN_PASS);
    await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();

    // Should navigate away from login — look for dashboard content or nav
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 15000 });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await navigateToLogin(page);
    await page.locator('input[type="email"], input[placeholder*="email"]').fill('bad@email.com');
    await page.locator('input[type="password"], input[placeholder="********"]').fill('wrongpass');
    await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();

    // Should show error toast or message
    await expect(page.getByTestId('auth-error')).toBeVisible({ timeout: 10000 });
  });
});
