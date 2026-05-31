import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Dashboard', () => {
  test('login and verify dashboard loads with navigation', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsAdmin(page);

    // Wait for dashboard to load — check for main content area or sidebar (aside)
    // Desktop uses <aside> sidebar, mobile uses bottom nav — check for either
    const dashLoaded = page.locator('aside, main, nav').first();
    await expect(dashLoaded).toBeVisible({ timeout: 20000 });

    // Verify main content area exists
    await expect(page.locator('main').first()).toBeVisible({ timeout: 5000 });

    // Verify page has dashboard content (text varies by layout)
    const pageText = await page.textContent('body');
    expect(pageText).toMatch(/dashboard|panel|manifiestos|bienvenido/i);
  });
});
