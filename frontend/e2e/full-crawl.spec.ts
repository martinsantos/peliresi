import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASS, loginAsAdmin, loginWithCredentials } from './helpers/auth';

/**
 * Full crawler — visits every key route in both web and PWA builds,
 * checks for: 404 page, error boundary, console errors, network 500s.
 *
 * Skips routes that need specific roles (use admin only).
 */

// Real production IDs
const KNOWN = {
  manifiestoId: 'cmnajhaw206fhga9dgw6pg3qh',
  transportistaId: 'cmm4a0u9r002nd8dy37h53j5t',
  operadorId: 'cmmpaa2b100edlvk7p577bmap',
  generadorId: 'cmmpaawor00a14kd0ogaieve9',
};

// Routes to crawl in both web and PWA
const ROUTES_WEB = [
  '/dashboard',
  '/centro-control',
  '/manifiestos',
  '/manifiestos/nuevo',
  `/manifiestos/${KNOWN.manifiestoId}`,
  '/reportes',
  '/alertas',
  '/configuracion',
  '/mi-perfil',
  '/ayuda',
  '/admin/usuarios',
  '/admin/actores',
  '/admin/actores/transportistas',
  `/admin/actores/transportistas/${KNOWN.transportistaId}`,
  '/admin/actores/generadores',
  `/admin/actores/generadores/${KNOWN.generadorId}`,
  '/admin/actores/operadores',
  `/admin/actores/operadores/${KNOWN.operadorId}`,
  '/admin/vehiculos',
  '/admin/residuos',
  '/admin/tratamientos',
  '/admin/blockchain',
  '/admin/auditoria',
  '/admin/renovaciones',
  '/admin/solicitudes',
  '/admin/carga-masiva',
];

const ROUTES_PWA = [
  '/dashboard',
  '/centro-control',
  '/manifiestos',
  `/manifiestos/${KNOWN.manifiestoId}`,
  '/reportes',
  '/alertas',
  '/notificaciones',
  '/configuracion',
  '/mi-perfil',
  '/admin/usuarios',
  '/admin/actores',
  '/admin/actores/transportistas',
  `/admin/actores/transportistas/${KNOWN.transportistaId}`,
  '/admin/actores/generadores',
  `/admin/actores/generadores/${KNOWN.generadorId}`,
  '/admin/actores/operadores',
  `/admin/actores/operadores/${KNOWN.operadorId}`,
  '/admin/vehiculos',
  '/admin/residuos',
  '/admin/tratamientos',
  '/admin/auditoria',
  '/escaner-qr',
  '/estadisticas',
];

async function loginWeb(page: import('@playwright/test').Page) {
  await loginAsAdmin(page);
}

async function loginPwa(page: import('@playwright/test').Page) {
  await loginWithCredentials(page, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
    onboardingRole: 'ADMIN',
    startPath: '/app/',
    clickLoginLink: false,
  });
}

interface CrawlIssue {
  route: string;
  type: '404' | 'console-error' | 'network-error' | 'navigation-error';
  detail: string;
}

async function crawlRoute(
  page: import('@playwright/test').Page,
  basePrefix: string,
  route: string,
  issues: CrawlIssue[],
) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  const consoleHandler = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out known noise
      if (text.includes('Failed to load resource: the server responded with a status of 404')) return;
      if (text.includes('manifest.json')) return;
      consoleErrors.push(text);
    }
  };
  const responseHandler = (resp: any) => {
    if (resp.status() >= 500 || resp.status() === 408) {
      networkErrors.push(`${resp.status()} ${resp.url().slice(0, 180)}`);
    }
  };
  const requestFailedHandler = (request: any) => {
    const failure = request.failure();
    networkErrors.push(`${failure?.errorText || 'request failed'} ${request.url().slice(0, 180)}`);
  };

  page.on('console', consoleHandler);
  page.on('response', responseHandler);
  page.on('requestfailed', requestFailedHandler);

  try {
    await page.goto(`${basePrefix}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Check for the actual NotFound page. Operational pages can legitimately
    // render "404" inside alert/error content, so do not match any 404 text.
    const has404Code = await page.getByRole('heading', { name: /^404$/ }).isVisible().catch(() => false);
    const has404Title = await page.getByRole('heading', { name: /página no encontrada/i }).isVisible().catch(() => false);
    const has404 = has404Code && has404Title;
    if (has404) issues.push({ route, type: '404', detail: 'Page shows 404 message' });
  } catch (e: any) {
    issues.push({ route, type: 'navigation-error', detail: e.message?.slice(0, 100) || 'unknown' });
  } finally {
    page.off('console', consoleHandler);
    page.off('response', responseHandler);
    page.off('requestfailed', requestFailedHandler);
  }

  for (const err of consoleErrors.slice(0, 3)) {
    issues.push({ route, type: 'console-error', detail: err.slice(0, 150) });
  }
  for (const failure of networkErrors.slice(0, 5)) {
    issues.push({ route, type: 'network-error', detail: failure });
  }
}

async function crawlRoutesWithFreshPages(
  authenticatedPage: import('@playwright/test').Page,
  basePrefix: string,
  routes: string[],
  issues: CrawlIssue[],
) {
  const context = authenticatedPage.context();
  await authenticatedPage.close();

  for (const route of routes) {
    const routePage = await context.newPage();
    try {
      await crawlRoute(routePage, basePrefix, route, issues);
    } finally {
      if (!routePage.isClosed()) await routePage.close();
    }
  }
}

test.describe('Full crawl — Web build', () => {
  test('crawl all key web routes as ADMIN', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000); // 15 minutes
    await loginWeb(page);
    const issues: CrawlIssue[] = [];
    await crawlRoutesWithFreshPages(page, '', ROUTES_WEB, issues);
    if (issues.length > 0) {
      console.log('\n=== WEB CRAWL ISSUES ===');
      for (const i of issues) console.log(`  [${i.type}] ${i.route} → ${i.detail}`);
    }
    expect(issues, `Web crawl found ${issues.length} issues`).toEqual([]);
  });
});

test.describe('Full crawl — PWA build', () => {
  test('crawl all key PWA routes as ADMIN', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);
    await loginPwa(page);
    const issues: CrawlIssue[] = [];
    await crawlRoutesWithFreshPages(page, '/app', ROUTES_PWA, issues);
    if (issues.length > 0) {
      console.log('\n=== PWA CRAWL ISSUES ===');
      for (const i of issues) console.log(`  [${i.type}] ${i.route} → ${i.detail}`);
    }
    expect(issues, `PWA crawl found ${issues.length} issues`).toEqual([]);
  });
});
