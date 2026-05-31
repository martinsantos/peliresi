import { test, expect } from '@playwright/test';
import { loginAsTransportista } from './helpers/auth';

test.describe('Transportista Flow', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    await loginAsTransportista(page);
  });

  test('dashboard loads after login', async ({ page }) => {
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/dashboard|panel|manifiestos|bienvenido/i);
  });

  test('tracking page loads', async ({ page }) => {
    await page.goto('/centro-control');
    await page.waitForLoadState('networkidle');
    // Verify page loaded without 404
    const notFound = page.getByText(/página no encontrada/i);
    const has404 = await notFound.isVisible().catch(() => false);
    expect(has404).toBe(false);
    // Check for map or tracking-related content
    const mapOrContent = page.locator(
      '[class*="leaflet"], [class*="map"], [class*="Map"], canvas, [class*="tracking"], [class*="Tracking"], h1, h2'
    ).first();
    await expect(mapOrContent).toBeVisible({ timeout: 10000 });
  });

  test('can access manifiestos page', async ({ page }) => {
    await page.goto('/manifiestos');
    await page.waitForLoadState('networkidle');
    const notFound = page.getByText(/página no encontrada/i);
    const has404 = await notFound.isVisible().catch(() => false);
    expect(has404).toBe(false);
    const headingOrTable = page.locator('h1, h2, table, [class*="manifiesto"]').first();
    await expect(headingOrTable).toBeVisible({ timeout: 10000 });
  });
});
