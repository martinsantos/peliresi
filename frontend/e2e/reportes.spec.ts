import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Reportes', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    await loginAsAdmin(page);
  });

  test('reportes page loads with tabs', async ({ page }) => {
    await page.goto('/reportes');
    await page.waitForLoadState('networkidle');

    // Should not show 404
    const notFound = page.getByText(/página no encontrada/i);
    const has404 = await notFound.isVisible().catch(() => false);
    expect(has404).toBe(false);

    // Verify tabs are visible — look for common tab labels
    const tabLabels = [
      page.locator('text=Manifiestos').first(),
      page.locator('text=Residuos').first(),
      page.locator('text=Transportistas').first(),
    ];

    // At least one tab should be visible
    let visibleTabFound = false;
    for (const tab of tabLabels) {
      const isVisible = await tab.isVisible().catch(() => false);
      if (isVisible) {
        visibleTabFound = true;
        break;
      }
    }

    expect(visibleTabFound).toBe(true);

    // Fallback: verify page has reportes-related content
    if (!visibleTabFound) {
      const bodyText = await page.textContent('body');
      expect(bodyText).toMatch(/reporte|reportes|estad.stica|gráfico|tablero|indicador/i);
    }
  });

  test('reportes page has heading', async ({ page }) => {
    await page.goto('/reportes');
    await page.waitForLoadState('networkidle');
    // Expect some heading or title on the page
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});
