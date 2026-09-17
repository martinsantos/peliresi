import { expect, test, type Page, type Route } from '@playwright/test';

const appPrefix = process.env.E2E_APP_PREFIX || '';

type SafeRole =
  | 'ADMIN'
  | 'GENERADOR'
  | 'TRANSPORTISTA'
  | 'OPERADOR'
  | 'AUDITOR'
  | 'ADMIN_TRANSPORTISTA'
  | 'ADMIN_GENERADOR'
  | 'ADMIN_OPERADOR';

interface SafeUserOptions {
  role?: SafeRole;
  forcePasswordChange?: boolean;
  profileStatus?: number;
  dashboardStatus?: number;
  impersonating?: boolean;
}

function safeUser(options: SafeUserOptions = {}) {
  const role = options.role || 'ADMIN';
  return {
    id: `safe-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@example.invalid`,
    rol: role,
    nombre: 'Usuario',
    apellido: role,
    empresa: `Entidad ${role}`,
    telefono: null,
    activo: true,
    esInspector: false,
    forcePasswordChange: options.forcePasswordChange || false,
    ...(role === 'GENERADOR' ? { generador: { id: 'safe-generator', razonSocial: 'Generador seguro', activo: true } } : {}),
    ...(role === 'TRANSPORTISTA' ? { transportista: { id: 'safe-transporter', razonSocial: 'Transportista seguro', activo: true } } : {}),
    ...(role === 'OPERADOR' ? { operador: { id: 'safe-operator', razonSocial: 'Operador seguro', activo: true } } : {}),
  };
}

async function fulfillSafeApi(route: Route, options: SafeUserOptions): Promise<void> {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;

  if (pathname === '/api/auth/profile') {
    if (options.profileStatus && options.profileStatus !== 200) {
      await route.fulfill({ status: options.profileStatus, json: { success: false, message: 'Sesión inválida de prueba' } });
      return;
    }
    const isRestoredAdmin = request.headers().authorization === 'Bearer safe-admin-access';
    await route.fulfill({
      json: {
        success: true,
        data: { user: safeUser(isRestoredAdmin ? { role: 'ADMIN' } : options) },
      },
    });
    return;
  }

  if (pathname === '/api/auth/logout') {
    await route.fulfill({ json: { success: true } });
    return;
  }

  if (pathname === '/api/manifiestos/dashboard') {
    if (options.dashboardStatus && options.dashboardStatus !== 200) {
      await route.fulfill({ status: options.dashboardStatus, json: { success: false, message: 'Fallo controlado' } });
      return;
    }
    await route.fulfill({
      json: {
        success: true,
        data: {
          estadisticas: {
            total: 0, borradores: 0, aprobados: 0, enTransito: 0,
            entregados: 0, recibidos: 0, tratados: 0,
          },
          recientes: [],
          enTransitoList: [],
        },
      },
    });
    return;
  }

  await route.fulfill({ json: { success: true, data: {} } });
}

async function installSafeSession(page: Page, options: SafeUserOptions = {}): Promise<void> {
  await page.route('**/api/**', (route) => fulfillSafeApi(route, options));
  await page.addInitScript((sessionOptions) => {
    // Seed once per tab. Full-page reloads are part of the impersonation exit
    // flow and must not recreate the target session after it was cleared.
    if (sessionStorage.getItem('sitrep_safe_session_seeded') === '1') return;
    sessionStorage.setItem('sitrep_safe_session_seeded', '1');
    localStorage.setItem('sitrep_access_token', 'safe-local-access');
    localStorage.setItem('sitrep_refresh_token', 'safe-local-refresh');
    if (sessionOptions.impersonating) {
      localStorage.setItem('sitrep_impersonation', JSON.stringify({
        adminToken: 'safe-admin-access',
        adminRefreshToken: 'safe-admin-refresh',
        adminUser: {
          id: 'safe-admin', nombre: 'Admin Seguro', email: 'admin@example.invalid', rol: 'ADMIN',
        },
        adminReturnPath: sessionOptions.appPrefix
          ? '/app/admin/usuarios?rol=TRANSPORTISTA#resultados'
          : '/admin/usuarios?rol=TRANSPORTISTA#resultados',
      }));
    }
  }, { impersonating: options.impersonating === true, appPrefix });
}

test.describe('safe session and resilience gate — local mocked API only', () => {
  test('the installed surface declares a scoped manifest and never caches API responses', async ({ request }) => {
    const workerPath = appPrefix ? '/app/sw-app.js' : '/sw.js';
    const manifestPath = appPrefix ? '/app/manifest-app.json' : '/manifest.json';
    const expectedScope = appPrefix ? '/app/' : '/';

    const workerResponse = await request.get(workerPath);
    expect(workerResponse.status()).toBe(200);
    const worker = await workerResponse.text();
    expect(worker).toContain("url.pathname.startsWith('/api/')");
    expect(worker).toContain('url.origin !== self.location.origin');

    const manifestResponse = await request.get(manifestPath);
    expect(manifestResponse.status()).toBe(200);
    const manifest = await manifestResponse.json();
    expect(manifest.scope).toBe(expectedScope);
    expect(manifest.start_url).toBe(expectedScope);
  });

  test('an invalid persisted token is cleared and returns to login', async ({ page }) => {
    await installSafeSession(page, { profileStatus: 401 });

    await page.goto(`${appPrefix}/dashboard`);
    await page.waitForURL(new RegExp(`${appPrefix}/login$`));
    await expect(page.getByRole('textbox', { name: /Correo electr.nico o CUIT/i })).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem('sitrep_access_token'),
      refresh: localStorage.getItem('sitrep_refresh_token'),
    }))).toEqual({ access: null, refresh: null });
  });

  test('a direct forbidden route never renders privileged user administration', async ({ page }) => {
    await installSafeSession(page, { role: 'GENERADOR' });

    await page.goto(`${appPrefix}/admin/usuarios`);
    if (appPrefix) {
      await page.waitForURL(new RegExp(`${appPrefix}/dashboard$`));
      await expect(page.getByTestId('app-shell')).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'Acceso denegado' })).toBeVisible();
    }
    await expect(page.getByTestId('user-switcher-page')).not.toBeVisible();
  });

  test('a restricted account is confined to its request status page', async ({ page }) => {
    await installSafeSession(page, { role: 'GENERADOR' });
    await page.addInitScript(() => {
      localStorage.setItem('sitrep_restricted_session', '1');
      localStorage.setItem('sitrep_solicitud_id', 'safe-request');
    });

    await page.goto(`${appPrefix}/dashboard`);
    await page.waitForURL(new RegExp(`${appPrefix}/mi-solicitud$`));
  });

  test('forced password change takes precedence over the requested deep link', async ({ page }) => {
    await installSafeSession(page, { role: 'OPERADOR', forcePasswordChange: true });

    await page.goto(`${appPrefix}/manifiestos/safe-manifest`);
    await page.waitForURL(new RegExp(`${appPrefix}/configuracion\\?tab=seguridad$`));
  });

  test('impersonation bypasses only the target password gate and remains navigable', async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await installSafeSession(page, { role: 'TRANSPORTISTA', forcePasswordChange: true, impersonating: true });

    await page.goto(`${appPrefix}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`${appPrefix}/dashboard$`));
    await expect(page.getByTestId('impersonation-banner')).toBeVisible();
    await expect(page.getByTestId('app-shell')).toBeVisible();

    const manifestsPath = `${appPrefix}/manifiestos`;
    await page.goto(manifestsPath);
    await expect(page).toHaveURL(new RegExp(`${manifestsPath}$`));
    await expect(page.getByTestId('app-shell')).toBeVisible();

    await page.goto(`${appPrefix}/configuracion?tab=seguridad`);
    await expect(page.getByText(/Las credenciales est.n protegidas durante la impersonaci.n/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();

    if (process.env.QA_SCREENSHOT_DIR) {
      const surface = appPrefix ? 'pwa' : 'web';
      await page.screenshot({
        path: `${process.env.QA_SCREENSHOT_DIR}/${surface}-${testInfo.project.name}-impersonation-safe-navigation.png`,
        fullPage: false,
      });
    }

    await page.getByTestId('exit-impersonation').click();
    const expectedReturn = appPrefix
      ? '/app/admin/usuarios?rol=TRANSPORTISTA#resultados'
      : '/admin/usuarios?rol=TRANSPORTISTA#resultados';
    await page.waitForURL(url => `${url.pathname}${url.search}${url.hash}` === expectedReturn);
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem('sitrep_access_token'),
      refresh: localStorage.getItem('sitrep_refresh_token'),
      impersonation: localStorage.getItem('sitrep_impersonation'),
    }))).toEqual({
      access: 'safe-admin-access',
      refresh: 'safe-admin-refresh',
      impersonation: null,
    });
    expect(runtimeErrors).toEqual([]);
  });

  test('offline and restored states are visible without losing the current page', async ({ page, context }, testInfo) => {
    await installSafeSession(page);
    await page.goto(`${appPrefix}/dashboard`);
    await expect(page.locator('main')).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByRole('status')).toContainText('Sin conexion');
    await expect(page).toHaveURL(new RegExp(`${appPrefix}/dashboard$`));
    if (process.env.QA_SCREENSHOT_DIR) {
      const surface = appPrefix ? 'pwa' : 'web';
      await page.screenshot({
        path: `${process.env.QA_SCREENSHOT_DIR}/${surface}-${testInfo.project.name}-offline.png`,
        fullPage: false,
      });
    }

    await context.setOffline(false);
    await expect(page.getByRole('status')).toContainText('Conexion restaurada');
    await expect(page).toHaveURL(new RegExp(`${appPrefix}/dashboard$`));
  });

  test('dashboard API failure produces a recoverable error state instead of a blank page', async ({ page }, testInfo) => {
    test.slow();
    await installSafeSession(page, { dashboardStatus: 503 });

    await page.goto(`${appPrefix}/dashboard`);
    if (appPrefix) {
      await expect(page.getByText(/No pudimos actualizar el resumen/)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    } else {
      await expect(page.getByText('Error al cargar datos del dashboard')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Verifica tu conexión e intenta nuevamente')).toBeVisible();
    }
    await expect(page.locator('body')).not.toBeEmpty();
    if (process.env.QA_SCREENSHOT_DIR) {
      const surface = appPrefix ? 'pwa' : 'web';
      await page.screenshot({
        path: `${process.env.QA_SCREENSHOT_DIR}/${surface}-${testInfo.project.name}-dashboard-error.png`,
        fullPage: false,
      });
    }
  });

  test('logout removes the current principal context but does not erase another principal', async ({ page }) => {
    await installSafeSession(page);
    await page.addInitScript(() => {
      localStorage.setItem('sitrep_user_safe-admin_recent_searches', '["admin-secret"]');
      localStorage.setItem('sitrep_user_other-user_recent_searches', '["other-secret"]');
      localStorage.setItem('sitrep_active_trip_id', 'legacy-trip');
      localStorage.setItem('viaje_snapshot_legacy-trip', '{"estado":"EN_TRANSITO"}');
      localStorage.setItem('gps_pending_legacy-trip', '[{"latitud":-32.8}]');
    });
    await page.goto(`${appPrefix}/dashboard`);

    if (appPrefix) {
      await page.getByRole('button', { name: /Abrir menu/i }).click();
      await page.getByRole('button', { name: /Cerrar Sesi.n/i }).click();
    } else {
      if ((page.viewportSize()?.width || 1280) < 768) {
        await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
        await expect(page.locator('aside')).not.toHaveClass(/-translate-x-full/);
      }
      await page.getByRole('button', { name: /Mi Cuenta/i }).click();
      await page.getByRole('button', { name: /Cerrar sesi.n/i }).click();
    }

    await page.waitForURL(new RegExp(`${appPrefix}/login$`));
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem('sitrep_access_token'),
      refresh: localStorage.getItem('sitrep_refresh_token'),
      current: localStorage.getItem('sitrep_user_safe-admin_recent_searches'),
      other: localStorage.getItem('sitrep_user_other-user_recent_searches'),
      legacyTrip: localStorage.getItem('sitrep_active_trip_id'),
      legacySnapshot: localStorage.getItem('viaje_snapshot_legacy-trip'),
      legacyGps: localStorage.getItem('gps_pending_legacy-trip'),
    }))).toEqual({
      access: null,
      refresh: null,
      current: null,
      other: '["other-secret"]',
      legacyTrip: null,
      legacySnapshot: null,
      legacyGps: null,
    });
  });
});
