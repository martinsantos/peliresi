import { expect, test } from '@playwright/test';

const adminUser = {
  // Allowlisted UI identifier only; this suite never submits credentials.
  id: 'admin-1', email: 'admin@dgfa.mendoza.gov.ar', rol: 'ADMIN', nombre: 'Admin', apellido: 'QA',
  empresa: 'DGFA', telefono: null, activo: true, esInspector: false,
};

const operatorUser = {
  id: 'operator-user', email: 'safe-multi@example.invalid', rol: 'OPERADOR', nombre: 'Usuario', apellido: 'Multirol',
  empresa: null, telefono: null, activo: true, esInspector: false,
  generador: { id: 'generator-actor', razonSocial: 'Empresa Generadora', activo: true },
  transportista: { id: 'transporter-actor', razonSocial: 'Empresa Transportista', activo: true },
  operador: { id: 'operator-actor', razonSocial: 'Empresa Operadora', activo: true },
};

const appPrefix = process.env.E2E_APP_PREFIX || '';

test.describe('user context persistence and impersonation return', () => {
  test('rehydrates the effective actor and returns to the exact admin location', async ({ page }, testInfo) => {
    const surfaceName = appPrefix ? 'pwa' : 'web';
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem('sitrep_access_token')) {
        localStorage.setItem('sitrep_access_token', 'admin-access');
        localStorage.setItem('sitrep_refresh_token', 'admin-refresh');
      }
      localStorage.setItem('sitrep_onboarding_admin-1', 'done');
      localStorage.setItem('sitrep_onboarding_operator-user', 'done');
    });

    const actorRequests: string[] = [];
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const authorization = request.headers().authorization || '';
      const activeUser = authorization.includes('impersonated-access') ? operatorUser : adminUser;

      if (url.pathname === '/api/auth/profile') {
        await route.fulfill({ json: { success: true, data: { user: activeUser } } });
        return;
      }
      if (url.pathname === '/api/admin/usuarios') {
        await route.fulfill({ json: { success: true, data: { usuarios: [adminUser, operatorUser], pagination: { total: 2 } } } });
        return;
      }
      if (url.pathname === '/api/admin/impersonate/operator-user' && request.method() === 'POST') {
        await route.fulfill({
          json: {
            success: true,
            data: {
              user: operatorUser,
              tokens: { accessToken: 'impersonated-access', refreshToken: 'impersonated-refresh' },
              impersonatedBy: adminUser,
            },
          },
        });
        return;
      }
      if (url.pathname === '/api/actores/operadores/operator-actor') {
        actorRequests.push(url.pathname);
        await route.fulfill({ json: { success: true, data: operatorUser.operador } });
        return;
      }
      if (url.pathname === '/api/manifiestos/dashboard') {
        await route.fulfill({
          json: {
            success: true,
            data: {
              estadisticas: { total: 0, borradores: 0, aprobados: 0, enTransito: 0, entregados: 0, recibidos: 0, tratados: 0 },
              recientes: [], enTransitoList: [],
            },
          },
        });
        return;
      }
      await route.fulfill({ json: { success: true, data: {} } });
    });

    const returnPath = `${appPrefix}/switch-user?rol=OPERADOR&page=2#resultados`;
    await page.goto(returnPath);
    await expect(page.getByTestId('user-switcher-page')).toBeVisible();
    await expect(page.getByTestId('impersonate-user-operator-user')).toContainText('Empresa Operadora');
    await page.evaluate(() => {
      localStorage.setItem('sitrep_user_admin-1_recent_searches', '["admin-only"]');
    });

    await page.getByTestId('impersonate-user-operator-user').click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByTestId('impersonation-banner')).toContainText('Usuario Multirol');

    await page.reload();
    await expect(page.getByTestId('impersonation-banner')).toContainText('Usuario Multirol');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sitrep_user_operator-user_recent_searches'))).toBeNull();
    await page.evaluate(() => {
      localStorage.setItem('sitrep_user_operator-user_recent_searches', '["operator-only"]');
    });
    await page.reload();
    await expect(page.getByTestId('impersonation-banner')).toContainText('Usuario Multirol');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sitrep_user_operator-user_recent_searches'))).toBe('["operator-only"]');
    if (process.env.QA_SCREENSHOT_DIR) {
      await page.screenshot({ path: `${process.env.QA_SCREENSHOT_DIR}/${surfaceName}-${testInfo.project.name}-impersonated-context.png`, fullPage: false });
    }

    await page.goto(`${appPrefix}/mi-perfil`);
    await expect.poll(() => actorRequests).toContain('/api/actores/operadores/operator-actor');

    await page.getByTestId('exit-impersonation').click();
    await page.waitForURL((url) => `${url.pathname}${url.search}${url.hash}` === returnPath);
    await expect(page.getByTestId('user-switcher-page')).toBeVisible();
    if (process.env.QA_SCREENSHOT_DIR) {
      await page.screenshot({ path: `${process.env.QA_SCREENSHOT_DIR}/${surfaceName}-${testInfo.project.name}-restored-admin-location.png`, fullPage: false });
    }
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem('sitrep_access_token'),
      refresh: localStorage.getItem('sitrep_refresh_token'),
      impersonation: localStorage.getItem('sitrep_impersonation'),
      adminRecent: localStorage.getItem('sitrep_user_admin-1_recent_searches'),
      operatorRecent: localStorage.getItem('sitrep_user_operator-user_recent_searches'),
    }))).toEqual({
      access: 'admin-access', refresh: 'admin-refresh', impersonation: null,
      adminRecent: '["admin-only"]', operatorRecent: '["operator-only"]',
    });
    expect(consoleErrors).toEqual([]);
  });
});
