import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';

// Read-only visual pass of the UI/UX review branch: real synthetic logins, no API interception
// beyond the shared offline font/tile fixtures, no submissions.
const journeys: Record<string, string[]> = {
  admin: ['/dashboard', '/admin/solicitudes', '/admin/actores/generadores/nuevo', '/centro-control'],
  generador: ['/dashboard', '/manifiestos', '/manifiestos/nuevo'],
  transportista: ['/dashboard', '/manifiestos'],
  operador: ['/dashboard', '/manifiestos'],
  inspector: ['/dashboard', '/inspecciones'],
};

function watch(page: Page) {
  const errors: string[] = [], messages: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) messages.push(m.text()); });
  return { errors, messages };
}

async function capture(page: Page, info: TestInfo, name: string, seen: ReturnType<typeof watch>) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const proof = {
    name, url: page.url(), title: await page.title(), viewport: page.viewportSize(),
    rootText: (await page.locator('#root').innerText()).trim().length,
    overlay: await page.locator('vite-error-overlay,nextjs-portal').count(),
    overflowX: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    errors: [...seen.errors], console: [...seen.messages],
  };
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: false });
  await info.attach(name, { body: Buffer.from(JSON.stringify(proof)), contentType: 'application/json' });
  expect.soft(proof.rootText, name + ' root has content').toBeGreaterThan(30);
  expect.soft(proof.overlay, name + ' no error overlay').toBe(0);
  expect.soft(proof.overflowX, name + ' no horizontal page scroll').toBeLessThanOrEqual(1);
  expect.soft(proof.errors, name + ' no page errors').toEqual([]);
  seen.errors.length = 0; seen.messages.length = 0;
}

test('public entry: account claim and app viewport', async ({ page }, info) => {
  const seen = watch(page);
  await page.goto(prefix(info) + '/reclamar');
  await expect(page.getByLabel('CUIT *')).toHaveAttribute('inputmode', 'numeric');
  if (info.project.name === 'app') {
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).not.toMatch(/user-scalable=no|maximum-scale/);
  }
  await capture(page, info, 'reclamar', seen);
  await page.goto(prefix(info) + '/login');
  await capture(page, info, 'login', seen);
});

for (const [user, paths] of Object.entries(journeys)) {
  test('role ' + user + ' main screens', async ({ page }, info) => {
    const seen = watch(page);
    await login(page, info, user);
    for (const route of paths) {
      await page.goto(prefix(info) + route);
      await capture(page, info, user + route.replaceAll('/', '-'), seen);
    }
  });
}
