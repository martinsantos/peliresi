import { test, expect } from '@playwright/test';

/**
 * PWA load test — visits all canonical /app/admin/actores/* routes
 * in rapid succession to detect any routing, console or network errors
 * under load-ish conditions (not true stress, but broader coverage).
 */

const ADMIN_EMAIL = 'admin@dgfa.mendoza.gov.ar';
const ADMIN_PASS = 'admin123';

const KNOWN = {
  transportistaId: 'cmm4a0u9r002nd8dy37h53j5t',
  operadorId: 'cmmpaa2b100edlvk7p577bmap',
  generadorId: 'cmmpaawor00a14kd0ogaieve9',
  manifiestoId: 'cmnajhaw206fhga9dgw6pg3qh',
};

const PWA_ROUTES = [
  // actores canonical
  '/admin/actores',
  '/admin/actores/transportistas',
  `/admin/actores/transportistas/${KNOWN.transportistaId}`,
  '/admin/actores/operadores',
  `/admin/actores/operadores/${KNOWN.operadorId}`,
  '/admin/actores/generadores',
  `/admin/actores/generadores/${KNOWN.generadorId}`,
  // admin lists
  '/admin/usuarios',
  '/admin/vehiculos',
  '/admin/residuos',
  '/admin/tratamientos',
  '/admin/blockchain',
  '/admin/auditoria',
  // main pages
  '/dashboard',
  '/manifiestos',
  `/manifiestos/${KNOWN.manifiestoId}`,
  '/reportes',
  '/alertas',
  '/centro-control',
];

async function loginPwa(page: import('@playwright/test').Page) {
  await page.goto('/app/');
  await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[placeholder*="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[placeholder="********"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /iniciar|entrar|ingresar/i }).click();
  await page.waitForTimeout(2500);
}

interface Issue {
  route: string;
  iteration: number;
  type: '404' | 'console-error' | 'network-500' | 'nav-error';
  detail: string;
}

test.describe('PWA load — rapid sequential navigation', () => {
  test('visit all canonical routes 3x as ADMIN', async ({ page }) => {
    test.setTimeout(25 * 60 * 1000); // 25 min
    await loginPwa(page);

    const issues: Issue[] = [];
    const ITERATIONS = 3;

    for (let iter = 1; iter <= ITERATIONS; iter++) {
      for (const route of PWA_ROUTES) {
        const consoleErrs: string[] = [];
        const net500: string[] = [];

        const onConsole = (msg: any) => {
          if (msg.type() === 'error') {
            const t = msg.text();
            if (t.includes('manifest.json')) return;
            if (t.includes('Failed to load resource: the server responded with a status of 404')) return;
            consoleErrs.push(t);
          }
        };
        const onResponse = (resp: any) => {
          if (resp.status() >= 500) net500.push(`${resp.status()} ${resp.url().slice(0, 80)}`);
        };

        page.on('console', onConsole);
        page.on('response', onResponse);

        try {
          await page.goto(`/app${route}`, { waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForTimeout(800);
          const has404 = await page.getByText(/página no encontrada/i).first().isVisible().catch(() => false);
          if (has404) issues.push({ route, iteration: iter, type: '404', detail: '' });
        } catch (e: any) {
          issues.push({ route, iteration: iter, type: 'nav-error', detail: e.message?.slice(0, 80) || '' });
        } finally {
          page.off('console', onConsole);
          page.off('response', onResponse);
        }

        for (const err of consoleErrs.slice(0, 1)) {
          issues.push({ route, iteration: iter, type: 'console-error', detail: err.slice(0, 120) });
        }
        for (const n of net500) {
          issues.push({ route, iteration: iter, type: 'network-500', detail: n });
        }
      }
    }

    const total = PWA_ROUTES.length * ITERATIONS;
    console.log(`\n=== PWA LOAD: ${total} visits, ${issues.length} issues ===`);
    for (const i of issues) {
      console.log(`  [${i.type}] iter${i.iteration} ${i.route} — ${i.detail}`);
    }
    expect(issues, `${issues.length} issues in ${total} PWA visits`).toEqual([]);
  });
});
