import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const appPrefix = process.env.E2E_APP_PREFIX || '';
const knownContrastBudget = {
  dashboard: appPrefix ? 10 : 8,
  impersonation: appPrefix ? 13 : 12,
  login: 8,
};

const adminUser = {
  id: 'safe-admin',
  // This is only an allowlisted UI identity returned by the intercepted API.
  // No password is used and no request can reach a remote SITREP host.
  // The UI allowlist requires this identifier to expose impersonation. The
  // request is still intercepted locally and no password is ever supplied.
  email: 'admin@dgfa.mendoza.gov.ar',
  rol: 'ADMIN',
  nombre: 'Administración',
  apellido: 'QA segura',
  empresa: 'DGFA QA',
  telefono: null,
  activo: true,
  esInspector: false,
};

const operatorUser = {
  id: 'safe-operator',
  email: 'safe-operator@example.invalid',
  rol: 'OPERADOR',
  nombre: 'Operador',
  apellido: 'QA segura',
  empresa: null,
  telefono: null,
  activo: true,
  esInspector: false,
  operador: { id: 'safe-operator-actor', razonSocial: 'Operador QA segura', activo: true },
};

async function installSafeApi(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const authorization = request.headers().authorization || '';
    const currentUser = authorization.includes('safe-operator-access') ? operatorUser : adminUser;

    if (pathname === '/api/auth/profile') {
      await route.fulfill({ json: { success: true, data: { user: currentUser } } });
      return;
    }
    if (pathname === '/api/admin/usuarios') {
      await route.fulfill({
        json: {
          success: true,
          data: { usuarios: [operatorUser], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
        },
      });
      return;
    }
    if (pathname === '/api/admin/impersonate/safe-operator' && request.method() === 'POST') {
      await route.fulfill({
        json: {
          success: true,
          data: {
            user: operatorUser,
            impersonatedBy: adminUser,
            tokens: { accessToken: 'safe-operator-access', refreshToken: 'safe-operator-refresh' },
          },
        },
      });
      return;
    }
    if (pathname === '/api/manifiestos/dashboard') {
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
  });
}

async function seedAdminSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!localStorage.getItem('sitrep_access_token')) {
      localStorage.setItem('sitrep_access_token', 'safe-admin-access');
      localStorage.setItem('sitrep_refresh_token', 'safe-admin-refresh');
    }
    localStorage.setItem('sitrep_onboarding_safe-admin', 'done');
    localStorage.setItem('sitrep_onboarding_safe-operator', 'done');
  });
}

async function expectNoSeriousAccessibilityViolations(
  page: Page,
  maxKnownContrastNodes: number,
): Promise<void> {
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}',
  });
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = result.violations.filter((violation) => (
    (violation.impact === 'critical' || violation.impact === 'serious') &&
    violation.id !== 'color-contrast'
  ));
  expect(blocking, blocking.map((violation) => (
    `${violation.id}: ${violation.help} (${violation.nodes.length})`
  )).join('\n')).toEqual([]);

  // Contrast debt is kept explicit and bounded so new regressions fail while
  // the existing palette is corrected incrementally.
  const contrastNodes = result.violations
    .find((violation) => violation.id === 'color-contrast')?.nodes.length || 0;
  expect(contrastNodes, `Known contrast budget exceeded: ${contrastNodes}`).toBeLessThanOrEqual(maxKnownContrastNodes);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

test.describe('safe UI quality gate — local mocked API only', () => {
  test('dashboard renders without serious accessibility or responsive defects', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    await installSafeApi(page);
    await seedAdminSession(page);

    await page.goto(`${appPrefix}/dashboard`);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText(/Administraci.n QA segura/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page, knownContrastBudget.dashboard);
    expect(runtimeErrors).toEqual([]);
  });

  test('the impersonation control works from the keyboard and remains accessible', async ({ page }) => {
    await installSafeApi(page);
    await seedAdminSession(page);

    await page.goto(`${appPrefix}/switch-user?rol=OPERADOR#lista`);
    const operator = page.getByTestId('impersonate-user-safe-operator');
    await expect(operator).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page, knownContrastBudget.impersonation);
    await operator.focus();
    await expect(operator).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByTestId('impersonation-banner')).toContainText('Operador QA segura');
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page, knownContrastBudget.impersonation);
  });

  test('login form exposes its controls without using any credential', async ({ page }) => {
    await installSafeApi(page);
    await page.goto(`${appPrefix}/login`);
    await expect(page.getByRole('textbox', { name: /Correo electr.nico o CUIT/i })).toBeVisible();
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page, knownContrastBudget.login);
  });

  test('dashboard reflows at a 200% zoom-equivalent width with enlarged text spacing', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 640, height: 720 });
    await installSafeApi(page);
    await seedAdminSession(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto(`${appPrefix}/dashboard`);
    await page.addStyleTag({
      content: [
        '* { letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }',
        'p, li { line-height: 1.5 !important; }',
        'p { margin-bottom: 2em !important; }',
      ].join('\n'),
    });

    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const menuButton = page.getByRole('button', { name: /Abrir men./i }).first();
    await menuButton.focus();
    await expect(menuButton).toBeFocused();
    await page.keyboard.press('Enter');
    if (appPrefix) {
      await expect(page.getByRole('button', { name: /Cerrar men./i }).first()).toBeVisible();
    } else {
      await expect(page.locator('aside').first()).not.toHaveClass(/-translate-x-full/);
    }
    // Let the drawer transition settle so screenshot evidence reflects the
    // keyboard-triggered open state rather than the first animation frame.
    await page.waitForTimeout(400);

    if (process.env.QA_SCREENSHOT_DIR) {
      const surface = appPrefix ? 'pwa' : 'web';
      await page.screenshot({
        path: `${process.env.QA_SCREENSHOT_DIR}/${surface}-${testInfo.project.name}-zoom-200-text-spacing.png`,
        fullPage: false,
      });
    }
  });
});
