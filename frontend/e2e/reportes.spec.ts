import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@dgfa.mendoza.gov.ar';
const ADMIN_PASS = 'admin123';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/');
  const loginBtn = page.getByText(/iniciar sesión/i).first();
  await loginBtn.waitFor({ timeout: 15000 });
  await loginBtn.click();
  await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 10000 });
  await page.locator('input[type="email"], input[placeholder*="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[placeholder="********"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();
  await expect(page.locator('aside, main, nav').first()).toBeVisible({ timeout: 20000 });
}

test.describe('Reportes', () => {
  test.beforeEach(async ({ page }) => {
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
