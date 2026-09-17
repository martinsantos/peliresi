import { test, expect, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASS, loginWithCredentials } from './helpers/auth';

const TARGETS = [
  {
    name: /Ivana\s+Pintos/i,
    role: /Admin de Generadores/i,
    webPath: '/admin/actores/generadores',
    appPath: '/app/admin/actores/generadores',
  },
  {
    name: /Marcia\s+Ardengo/i,
    role: /Admin de Operadores/i,
    webPath: '/admin/actores/operadores',
    appPath: '/app/admin/actores/operadores',
  },
];

async function clearSession(page: Page) {
  if (page.url() === 'about:blank') await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('sitrep_access_token');
    localStorage.removeItem('sitrep_refresh_token');
    localStorage.removeItem('sitrep_impersonation');
  });
}

test.describe('Sector-admin login surface and root-admin impersonation', () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'chromium', 'Runs once against the VPN target');
    testInfo.setTimeout(180_000);
  });

  test('root ADMIN can see and impersonate each active sector-admin in web and PWA', async ({ page }) => {
    await clearSession(page);
    await loginWithCredentials(page, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
      onboardingRole: 'ADMIN',
      startPath: '/login',
      clickLoginLink: false,
    });

    for (const target of TARGETS) {
      await page.goto('/switch-user', { waitUntil: 'domcontentloaded' });
      const targetButton = page
        .locator('[data-testid^="impersonate-user-"]')
        .filter({ hasText: target.name })
        .first();
      await expect(targetButton).toBeVisible({ timeout: 15_000 });
      const impersonationResponsePromise = page.waitForResponse((response) => (
        response.request().method() === 'POST' &&
        response.url().includes('/api/admin/impersonate/')
      ));
      await targetButton.click();
      const impersonationResponse = await impersonationResponsePromise;
      expect(
        impersonationResponse.status(),
        `${target.name} impersonation endpoint must return 200`,
      ).toBe(200);

      await page.waitForURL(/\/dashboard$/);
      await expect(page.getByTestId('impersonation-banner')).toContainText(target.role, { timeout: 15_000 });

      await page.goto(target.webPath, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByTestId('impersonation-banner')).toBeVisible({ timeout: 15_000 });

      await page.goto(target.appPath, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByTestId('impersonation-banner')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('exit-impersonation').click();
      await page.waitForURL(/\/app\/admin\/usuarios$/);
      await expect(page.getByText(/Gestion de Usuarios|Cambiar Usuario/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
