import { test, expect, type Page } from '@playwright/test';

const KNOWN = {
  manifiestoId: 'cmnajhaw206fhga9dgw6pg3qh',
};

const E2E_USER = {
  id: 'admin-android-ux',
  email: 'admin.android.ux@test.local',
  nombre: 'Admin Android',
  apellido: 'UX',
  rol: 'ADMIN',
  empresa: 'DGFA',
  telefono: '',
  esInspector: false,
};

const E2E_MANIFIESTO = {
  id: KNOWN.manifiestoId,
  numero: 'M-E2E-ANDROID',
  estado: 'APROBADO',
  createdAt: new Date().toISOString(),
  generador: {
    id: 'gen-e2e',
    razonSocial: 'Generador Android UX',
    domicilio: 'Ruta Provincial 1',
  },
  transportista: {
    id: 'trans-e2e',
    razonSocial: 'Transportista Android UX',
  },
  operador: {
    id: 'op-e2e',
    razonSocial: 'Operador Android UX',
  },
  residuos: [
    {
      id: 'res-e2e',
      cantidad: 120,
      unidad: 'KG',
      tipoResiduo: { nombre: 'Residuo de prueba' },
    },
  ],
  eventos: [],
};

function json(data: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

async function setupMockedPwa(page: Page) {
  const unexpectedApiRoutes: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');

    if (path === '/auth/profile') {
      await route.fulfill(json({ success: true, data: { user: E2E_USER } }));
      return;
    }

    if (path === '/health') {
      await route.fulfill(json({ status: 'ok', db: 'connected' }));
      return;
    }

    if (path === '/manifiestos/dashboard') {
      await route.fulfill(json({
        success: true,
        data: {
          manifiestos: {
            total: 4,
            borradores: 0,
            aprobados: 1,
            enTransito: 1,
            entregados: 0,
            recibidos: 0,
            tratados: 1,
            pendientes: 2,
            completados: 1,
          },
          recientes: [],
          enTransitoList: [],
        },
      }));
      return;
    }

    if (path === `/manifiestos/${KNOWN.manifiestoId}`) {
      await route.fulfill(json({ success: true, data: { manifiesto: E2E_MANIFIESTO } }));
      return;
    }

    if (path === '/manifiestos') {
      await route.fulfill(json({
        success: true,
        data: {
          manifiestos: [],
          pagination: { total: 0, page: 1, limit: 10, pages: 1 },
        },
      }));
      return;
    }

    if (path === '/notificaciones') {
      await route.fulfill(json({
        success: true,
        data: { notificaciones: [], noLeidas: 0, total: 0 },
      }));
      return;
    }

    if (path === '/push/vapid-key') {
      await route.fulfill(json({ success: true, data: { publicKey: '' } }));
      return;
    }

    unexpectedApiRoutes.push(`${route.request().method()} ${path}`);
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: `Unhandled Android UX mock route: ${path}` }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('sitrep_access_token', 'android-ux-e2e-token');
    localStorage.setItem('sitrep_refresh_token', 'android-ux-e2e-refresh-token');
    localStorage.setItem('sitrep_onboarding_ADMIN', 'true');
    localStorage.setItem('sitrep_onboarding_GENERADOR', 'true');
    localStorage.setItem('sitrep_onboarding_TRANSPORTISTA', 'true');
    localStorage.setItem('sitrep_onboarding_OPERADOR', 'true');
  });

  return unexpectedApiRoutes;
}

test.describe('Android UX field-grade PWA checks', () => {
  test.use({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true });

  test('dashboard has no horizontal overflow and exposes mobile navigation', async ({ page }) => {
    test.setTimeout(120_000);
    const unexpectedApiRoutes = await setupMockedPwa(page);
    await page.goto('/app/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    await expect(page.getByRole('navigation').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(unexpectedApiRoutes).toEqual([]);
  });

  test('trip route renders as a field screen and never 404s', async ({ page }) => {
    test.setTimeout(120_000);
    const unexpectedApiRoutes = await setupMockedPwa(page);
    await page.goto(`/app/transporte/viaje/${KNOWN.manifiestoId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const notFound = await page.getByText(/pagina no encontrada|página no encontrada|404/i).first().isVisible().catch(() => false);
    expect(notFound).toBe(false);
    await expect(page.getByText('M-E2E-ANDROID').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Listo para retirar')).toBeVisible();
    await expect(page.getByRole('button', { name: /confirmar retiro/i })).toBeVisible();
    expect(unexpectedApiRoutes).toEqual([]);
  });

  test('common touch targets meet minimum Android size', async ({ page }) => {
    test.setTimeout(120_000);
    const unexpectedApiRoutes = await setupMockedPwa(page);
    await page.goto('/app/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const smallTargets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a')).filter((el) => {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        const inPrimaryChrome = el.closest('nav, header, main');
        return visible && inPrimaryChrome && (rect.width < 44 || rect.height < 44);
      }).map((el) => ({
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }));
    });

    expect(smallTargets).toEqual([]);
    expect(unexpectedApiRoutes).toEqual([]);
  });
});
