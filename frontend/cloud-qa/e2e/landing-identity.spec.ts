import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const evidence = '/tmp/sitrep-landing-qa';

test.beforeEach(async ({ context }) => {
  // Candidate public pages only: no session, backend, business records or delivery.
  await context.route('**/api/**', route => route.fulfill({ status: 503,
    contentType: 'application/json', body: JSON.stringify({ message: 'No backend in public visual QA' }) }));
  await mkdir(evidence, { recursive: true });
});

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

for (const width of [1440, 768, 360, 320]) {
  test(`masthead, title, navigation and assets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 640 ? 800 : 1000 });
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    const badAssets: string[] = [];
    page.on('response', response => {
      if (response.status() >= 400 && /\.(?:js|css|svg|webp)(?:\?|$)/.test(response.url())) badAssets.push(response.url());
    });
    await page.goto('/');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText('SITREP Sistema de trazabilidad de residuos peligrosos');
    await page.evaluate(() => document.fonts.ready);
    const mark = page.getByTestId('landing-wordmark');
    expect(Math.abs((await mark.boundingBox())!.x - (await title.boundingBox())!.x)).toBeLessThan(1);
    await expect(mark).toHaveCSS('color', 'rgb(27, 94, 60)');
    const government = page.getByAltText('Mendoza — Gobierno de la Provincia');
    await expect(government).toBeVisible();
    await expect.poll(() => government.evaluate((img: HTMLImageElement) =>
      img.complete && img.naturalWidth >= img.clientWidth * devicePixelRatio)).toBe(true);
    const nav = page.getByRole('navigation', { name: 'Acceso al sistema' });
    const govBox = (await government.boundingBox())!;
    const navBox = (await nav.boundingBox())!;
    if (width >= 640) {
      expect(Math.abs(govBox.y + govBox.height / 2 - navBox.y - navBox.height / 2)).toBeLessThan(1);
      expect(govBox.x + govBox.width).toBeLessThan(navBox.x);
    } else {
      expect(govBox.y + govBox.height).toBeLessThan(navBox.y);
    }
    for (const link of await nav.getByRole('link').all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await noOverflow(page);
    await page.screenshot({ path: `${evidence}/landing-${width}.png`, fullPage: true });
    const hero = (await page.locator('.institutional-hero').boundingBox())!;
    await page.screenshot({ path: `${evidence}/landing-header-${width}.png`,
      clip: { x: 0, y: 0, width, height: Math.ceil(hero.y + hero.height) } });
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name: 'Instalar App', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name: 'Ingresar', exact: true })).toBeFocused();
    await page.getByRole('link', { name: 'Solicitar inscripción', exact: true }).click();
    await expect(page).toHaveURL(/#perfiles$/);
    await expect.poll(async () => (await page.locator('#perfiles').boundingBox())!.y).toBeGreaterThanOrEqual((await page.locator('header').boundingBox())!.height - 1);
    for (const tipo of ['generador', 'transportista', 'operador']) {
      await expect(page.locator(`a[href="/inscripcion/${tipo}"]`)).toBeVisible();
      await expect(page.locator(`a[href="/inscripcion/${tipo}?modo=revision"]`)).toBeVisible();
    }
    await page.getByRole('link', { name: 'Instalar App', exact: true }).click();
    await expect(page).toHaveURL(/#instalar$/);
    await expect(page.locator('#instalar')).toBeVisible();
    await noOverflow(page);
    await page.getByRole('link', { name: 'Ingresar', exact: true }).click();
    await expect(page.locator('#login-password')).toBeVisible();
    expect(errors).toEqual([]);
    expect(badAssets).toEqual([]);
  });
}

test('app login keeps the existing brand, fields and mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('http://127.0.0.1:4188/app/login');
  await expect(page.locator('#login-password')).toBeVisible();
  await expect(page.locator('#login-identifier')).toBeVisible();
  await expect(page.locator('[data-sitrep-mark]').first()).toHaveAttribute('src', '/app/favicon.svg');
  await noOverflow(page);
  await page.screenshot({ path: `${evidence}/app-login-360.png`, fullPage: true });
});
