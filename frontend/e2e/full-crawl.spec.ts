import { test, expect } from '@playwright/test';

/**
 * Full crawler — visits every key route in both web and PWA builds,
 * checks for: 404 page, error boundary, console errors, network 500s.
 *
 * Skips routes that need specific roles (use admin only).
 */

const ADMIN_EMAIL = 'admin@dgfa.mendoza.gov.ar';
const ADMIN_PASS = 'admin123';

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
  await page.goto('/');
  const loginBtn = page.getByText(/iniciar sesión/i).first();
  await loginBtn.waitFor({ timeout: 15000 });
  await loginBtn.click();
  await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 10000 });
  await page.locator('input[type="email"], input[placeholder*="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[placeholder="********"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();
  await page.waitForTimeout(2500);
}

async function loginPwa(page: import('@playwright/test').Page) {
  await page.goto('/app/');
  await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[placeholder*="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[placeholder="********"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();
  await page.waitForTimeout(2500);
}

interface CrawlIssue {
  route: string;
  type: '404' | 'console-error' | 'network-500' | 'navigation-error';
  detail: string;
}

async function crawlRoute(
  page: import('@playwright/test').Page,
  basePrefix: string,
  route: string,
  issues: CrawlIssue[],
) {
  const consoleErrors: string[] = [];
  const network500s: string[] = [];

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
    if (resp.status() >= 500) {
      network500s.push(`${resp.status()} ${resp.url().slice(0, 80)}`);
    }
  };

  page.on('console', consoleHandler);
  page.on('response', responseHandler);

  try {
    await page.goto(`${basePrefix}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);

    // Check for 404 page
    const has404 = await page.getByText(/página no encontrada|404/i).first().isVisible().catch(() => false);
    if (has404) issues.push({ route, type: '404', detail: 'Page shows 404 message' });
  } catch (e: any) {
    issues.push({ route, type: 'navigation-error', detail: e.message?.slice(0, 100) || 'unknown' });
  } finally {
    page.off('console', consoleHandler);
    page.off('response', responseHandler);
  }

  for (const err of consoleErrors.slice(0, 3)) {
    issues.push({ route, type: 'console-error', detail: err.slice(0, 150) });
  }
  for (const n5 of network500s) {
    issues.push({ route, type: 'network-500', detail: n5 });
  }
}

test.describe('Full crawl — Web build', () => {
  test('crawl all key web routes as ADMIN', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000); // 15 minutes
    await loginWeb(page);
    const issues: CrawlIssue[] = [];
    for (const route of ROUTES_WEB) {
      await crawlRoute(page, '', route, issues);
    }
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
    for (const route of ROUTES_PWA) {
      await crawlRoute(page, '/app', route, issues);
    }
    if (issues.length > 0) {
      console.log('\n=== PWA CRAWL ISSUES ===');
      for (const i of issues) console.log(`  [${i.type}] ${i.route} → ${i.detail}`);
    }
    expect(issues, `PWA crawl found ${issues.length} issues`).toEqual([]);
  });
});
