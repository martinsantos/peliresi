import { test, expect } from '@playwright/test';
import { isolatedMapTiles } from './helpers';

test('the new load, custody and notice guides retain the manual design, images and step navigation', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  const errors: string[] = [], business: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) business.push(request.method() + ' ' + request.url()); });
  for (const [id, title, steps, images] of [
    ['transporte-cargas-simultaneas', 'Llevar varias cargas en el mismo móvil', 3, 2],
    ['transporte-relevo', 'Relevar el transporte por una rotura', 4, 3],
    ['manifiestos-avisos', 'Enterarte de aprobaciones y cambios', 3, 1],
  ] as const) {
    await page.goto('/manual/tutorial.html?guide=' + id);
    await expect(page.locator('#tutorialTitle')).toHaveText(title);
    await expect(page.locator('.guide-step')).toHaveCount(steps);
    expect(await page.locator('img.guide-image').count()).toBeGreaterThanOrEqual(images);
    for (const image of await page.locator('img.guide-image').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
    if (info.project.name === 'app') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
    await page.locator('#tutorialIndex a').last().click();
    await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.reload();
    await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current','step');
    await page.screenshot({ path: info.outputPath(id + '.png'), fullPage: true, animations: 'disabled' });
  }
  expect(errors).toEqual([]); expect(business).toEqual([]);
});
