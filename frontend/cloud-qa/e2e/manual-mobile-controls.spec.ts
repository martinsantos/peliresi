import { expect, test } from '@playwright/test';
import { isolatedMapTiles } from './helpers';

test('manual access guide preserves the renderer, navigation and explicit pending Android validation', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  const errors: string[] = [], businessRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) businessRequests.push(request.method() + ' ' + request.url()); });
  await page.goto('/manual/tutorial.html?guide=acceso-controles-pantalla');
  await expect(page).toHaveTitle(/SITREP/);
  await expect(page.locator('#tutorialTitle')).toHaveText('Entrar y moverse en una pantalla pequeña');
  await expect(page.locator('#safetyNote')).toContainText('La prueba en Android real queda pendiente');
  await expect(page.locator('.guide-step')).toHaveCount(3);
  for (const step of await page.locator('.guide-step').all()) {
    await step.scrollIntoViewIfNeeded();
    await expect(step).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.locator('#tutorialTitle').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('manual-mobile-controls.png'), animations: 'disabled' });
  await page.reload();
  await expect(page.locator('#tutorialTitle')).toHaveText('Entrar y moverse en una pantalla pequeña');
  expect(errors).toEqual([]); expect(businessRequests).toEqual([]);
});
