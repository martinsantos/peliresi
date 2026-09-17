import { test, expect, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASS, GENERADOR_EMAIL, GENERADOR_PASS, TRANSPORTISTA_EMAIL, TRANSPORTISTA_PASS, OPERADOR_EMAIL, OPERADOR_PASS, loginWithCredentials } from './helpers/auth';

const DEMO_ROLES = [
  { role: 'ADMIN', label: 'Administrador DGFA', email: ADMIN_EMAIL, password: ADMIN_PASS },
  { role: 'GENERADOR', label: 'Generador', email: GENERADOR_EMAIL, password: GENERADOR_PASS },
  { role: 'TRANSPORTISTA', label: 'Transportista', email: TRANSPORTISTA_EMAIL, password: TRANSPORTISTA_PASS },
  { role: 'OPERADOR', label: 'Operador', email: OPERADOR_EMAIL, password: OPERADOR_PASS },
];

async function clearSession(page: Page) {
  // `about:blank` has an opaque origin and rejects localStorage access.
  if (page.url() === 'about:blank') {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
  }
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('sitrep_access_token');
    localStorage.removeItem('sitrep_refresh_token');
    localStorage.removeItem('sitrep_impersonation');
  });
  await page.context().clearCookies();
}

async function loginOnWeb(page: Page, user: typeof DEMO_ROLES[number]) {
  await loginWithCredentials(page, {
    email: user.email,
    password: user.password,
    onboardingRole: user.role,
    startPath: '/login',
    clickLoginLink: false,
  });
  await expect(page).not.toHaveURL(/\/login$/);
}

test.describe('Demo access and root-admin impersonation', () => {
  test.beforeEach(({}, testInfo) => {
    // Four login attempts are intentionally shared in one browser context;
    // running this suite in both projects would trip the production limiter.
    testInfo.skip(testInfo.project.name !== 'chromium', 'Runs once against the VPN target to avoid duplicate login bursts');
    testInfo.setTimeout(180_000);
  });

  test('each demo role opens the web UI and /app from the same session', async ({ page }) => {
    for (const user of DEMO_ROLES) {
      await clearSession(page);
      await loginOnWeb(page, user);

      await expect(page.locator('main, aside, nav').first()).toBeVisible();
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      await page.goto('/app/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(/Inicio/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('main').first()).toBeVisible();

      if (user.role !== 'ADMIN') {
        await page.goto('/app/switch-user', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/app\/dashboard$/);
        await expect(page.getByTestId('user-switcher-page')).toHaveCount(0);
      }
    }
  });

  test('ADMIN impersonates an active user and returns to the exact PWA location', async ({ page }) => {
    await loginOnWeb(page, DEMO_ROLES[0]);

    const adminReturnPath = '/app/switch-user?rol=GENERADOR&page=2#resultados';
    await page.goto(adminReturnPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('user-switcher-page')).toBeVisible();
    // Select a visible GENERADOR row from the real API-backed list. This
    // avoids assuming a particular pagination order while still exercising a
    // role different from ADMIN and the full UI click path.
    const targetButton = page.locator('[data-testid^="impersonate-user-"]').filter({ hasText: /Generador/i }).first();
    await expect(targetButton).toBeVisible({ timeout: 15_000 });
    await targetButton.click();

    await page.waitForURL(/\/app\/dashboard$/);
    await expect(page.getByTestId('impersonation-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Generador/i).first()).toBeVisible();

    // Reload proves that the impersonated principal and the saved admin
    // location both survive a fresh application mount.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('impersonation-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Inicio/i).first()).toBeVisible();

    await page.getByTestId('exit-impersonation').click();
    await page.waitForURL((url) => `${url.pathname}${url.search}${url.hash}` === adminReturnPath);
    await expect(page.getByTestId('user-switcher-page')).toBeVisible({ timeout: 15_000 });
  });
});
