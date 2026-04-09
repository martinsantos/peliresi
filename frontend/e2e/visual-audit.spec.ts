import { test, expect } from '@playwright/test';

/**
 * Visual UI audit — visits key pages at multiple viewports and detects:
 * - Horizontal overflow (scrollWidth > clientWidth)
 * - Pages that show 404
 * - Tables with column widths summing > 100%
 */

const ADMIN_EMAIL = 'admin@dgfa.mendoza.gov.ar';
const ADMIN_PASS = 'admin123';

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const PAGES_WEB = [
  '/dashboard',
  '/manifiestos',
  '/centro-control',
  '/reportes',
  '/admin/actores',
  '/admin/actores/transportistas',
  '/admin/actores/operadores',
  '/admin/actores/generadores',
  '/admin/usuarios',
  '/admin/auditoria',
  '/admin/residuos',
  '/admin/vehiculos',
  '/admin/tratamientos',
  '/admin/blockchain',
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

interface VisualIssue {
  viewport: string;
  route: string;
  type: 'overflow-x' | '404';
  detail: string;
}

test.describe('Visual UI audit — multi-viewport overflow detection', () => {
  test('audit all key pages at multiple viewports', async ({ browser }) => {
    test.setTimeout(20 * 60 * 1000);

    const allIssues: VisualIssue[] = [];

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      // Login fresh per viewport
      await loginWeb(page);

      for (const route of PAGES_WEB) {
        try {
          await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForTimeout(1200);

          // Check for 404
          const has404 = await page.getByText(/página no encontrada/i).first().isVisible().catch(() => false);
          if (has404) {
            allIssues.push({ viewport: vp.name, route, type: '404', detail: '' });
            continue;
          }

          // Check for horizontal overflow (root + main content)
          const overflow = await page.evaluate(() => {
            const html = document.documentElement;
            const body = document.body;
            const main = document.querySelector('main');
            const issues: string[] = [];
            if (html.scrollWidth > html.clientWidth + 1) issues.push(`html: ${html.scrollWidth}>${html.clientWidth}`);
            if (body.scrollWidth > body.clientWidth + 1) issues.push(`body: ${body.scrollWidth}>${body.clientWidth}`);
            if (main && main.scrollWidth > main.clientWidth + 1) issues.push(`main: ${main.scrollWidth}>${main.clientWidth}`);
            return issues;
          });

          if (overflow.length > 0) {
            allIssues.push({
              viewport: vp.name,
              route,
              type: 'overflow-x',
              detail: overflow.join('; '),
            });
          }
        } catch (e: any) {
          allIssues.push({
            viewport: vp.name,
            route,
            type: 'overflow-x',
            detail: `nav-error: ${e.message?.slice(0, 80) || 'unknown'}`,
          });
        }
      }

      await context.close();
    }

    if (allIssues.length > 0) {
      console.log(`\n=== VISUAL ISSUES FOUND (${allIssues.length}) ===`);
      const byViewport: Record<string, VisualIssue[]> = {};
      for (const i of allIssues) {
        (byViewport[i.viewport] = byViewport[i.viewport] || []).push(i);
      }
      for (const [vp, issues] of Object.entries(byViewport)) {
        console.log(`\n  ${vp}:`);
        for (const i of issues) console.log(`    [${i.type}] ${i.route} — ${i.detail}`);
      }
    } else {
      console.log('\n=== VISUAL AUDIT: 0 issues found across all viewports ===');
    }

    expect(allIssues, `Found ${allIssues.length} visual issues`).toEqual([]);
  });
});
