import { expect, test } from '@playwright/test';
test('classroom: direct CAP records, collapsible teams, mobile index and reusable OCR', async ({ page }, info) => {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', async route => {
    const r = route.request();
    if (!['GET', 'HEAD'].includes(r.method()) || new URL(r.url()).pathname.startsWith('/api/')) {
      writes.push(r.method() + ' ' + r.url()); await route.abort(); return;
    }
    await route.continue();
  });
  await page.goto('/manual/');
  await page.getByRole('link', { name: 'Recorrido de capacitación por rol', exact: true }).click();
  await expect(page).toHaveTitle(/Capacitación: recorrido por rol/);
  await expect(page.locator('#tutorialTitle')).toHaveText('Capacitación: recorrido por rol');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.locator('#safetyNote')).toContainText('sin validez oficial');
  await expect(page.locator('.practice-team')).toHaveCount(15);
  await expect(page.locator('.practice-team[open]')).toHaveCount(0);
  const steps = page.locator('.guide-step');
  const team = steps.nth(2).locator('.practice-team').first();
  const summary = team.locator('summary');
  await summary.scrollIntoViewIfNeeded();
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(team).toHaveAttribute('open', '');
  await expect(team.getByText('CAP-1-BORRADOR', { exact: true })).toBeVisible();
  await expect(team.locator('a').first()).toHaveAttribute('href', '/manifiestos/cap-20261012-manifiesto-1-BORRADOR');
  await expect(team.locator('a').nth(1)).toHaveAttribute('href', '/app/manifiestos/cap-20261012-manifiesto-1-BORRADOR');
  await summary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('classroom-cap-records.png'), animations: 'disabled' });
  await summary.click(); await expect(team).not.toHaveAttribute('open');
  for (const stepIndex of [2, 3, 4]) {
    for (const group of await steps.nth(stepIndex).locator('.practice-team').all()) {
      await group.locator('summary').click();
      for (const link of await group.locator('a').all()) {
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener');
        expect(await link.getAttribute('href')).toMatch(/^\/(?:app\/)?(?:manifiestos|mis-inspecciones|inspecciones|soporte)\/cap-20261012-/);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await group.locator('summary').click();
    }
  }
  const fixture = await page.request.get('/manual/fixtures/licencia-capacitacion.png');
  expect(fixture.status()).toBe(200); expect(fixture.headers()['content-type']).toContain('image/png');
  expect((await fixture.body()).subarray(1, 4).toString()).toBe('PNG');
  for (const img of await page.locator('img.guide-image').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  }
  if (info.project.name !== 'web-desktop') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
  await page.getByRole('navigation', { name: 'Pasos de la guía' }).getByRole('link', { name: /Inspector y autoridad/ }).click();
  await expect(page).toHaveURL(/#paso-4-inspector-y-autoridad-20-min$/);
  await page.reload();
  await expect(page.locator('#tutorialIndex a[aria-current="step"]')).toContainText('Inspector y autoridad');
  await expect(steps.nth(3).getByRole('heading')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('classroom-inspection-step.png'), animations: 'disabled' });
  await page.goto('/manual/search.html?q=CAP');
  await expect(page.getByRole('link', { name: /Capacitación: recorrido por rol/ }).first()).toBeVisible();
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
