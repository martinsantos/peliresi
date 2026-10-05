import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

test('packaged manual: home -> real alert tutorial -> captured sources -> mobile index and reload, without business writes', async ({ page }, info) => {
  const errors: string[] = [], businessRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) businessRequests.push(request.method() + ' ' + request.url()); });
  page.on('response', response => {
    if (new URL(response.url()).pathname.startsWith('/manual/') && response.status() >= 400) errors.push(response.status() + ' ' + response.url());
  });
  await page.goto('/manual/');
  await expect(page.getByRole('heading', { name: '¿Cómo podemos ayudarte?', exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/SITREP/);
  const tutorial = page.locator('#popularList').getByRole('link', { name: 'Configurar alertas y seguir sus avisos', exact: true });
  await expect(tutorial).toBeVisible();
  await tutorial.click();
  await expect(page).toHaveURL(/tutorial\.html\?guide=administrador-alertas-proactivas/);
  await expect(page.locator('#tutorialTitle')).toHaveText('Configurar alertas y seguir sus avisos');
  await expect(page.locator('#safetyNote')).toContainText('pendiente de publicación');
  await expect(page.locator('#safetyNote')).toContainText('No activa correo ni push');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.locator('.guide-step')).toHaveCount(7);
  await page.screenshot({ path: info.outputPath('manual-alerts-first-step.png'), animations: 'disabled' });

  const provenanceResponse = await page.request.get('/manual/capture-provenance.json');
  expect(provenanceResponse.status()).toBe(200);
  const provenance = await provenanceResponse.json();
  expect(provenance.synthetic).toBe(true); expect(provenance.productionCapture).toBe(false);
  for (const item of provenance.files) {
    const imageResponse = await page.request.get('/manual/screenshots/' + item.file);
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()['content-type']).toBe('image/png');
    expect(createHash('sha256').update(await imageResponse.body()).digest('hex')).toBe(item.sha256);
  }
  for (const image of await page.locator('img.guide-image').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await expect(image.locator('xpath=ancestor::figure/figcaption')).toContainText('Datos sintéticos');
  }
  if (info.project.name !== 'web-desktop') {
    const toggle = page.getByRole('button', { name: /Índice del tutorial/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
  await page.getByRole('navigation', { name: 'Pasos de la guía' }).getByRole('link', { name: /Comprobar el origen y los límites/ }).click();
  await expect(page).toHaveURL(/#paso-7-comprobar-el-origen-y-los-limites$/);
  const finalStep = page.locator('.guide-step').last();
  await expect(finalStep.getByRole('heading', { name: 'Comprobar el origen y los límites' })).toBeVisible();
  await expect(finalStep).toContainText('todavía no son reglas operativas');
  if (info.project.name !== 'web-desktop') await expect(page.getByRole('button', { name: /Índice del tutorial/ })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('manual-alerts-index-destination.png'), animations: 'disabled' });
  await page.reload();
  await expect(page.locator('#tutorialTitle')).toHaveText('Configurar alertas y seguir sus avisos');
  await expect(page.locator('#tutorialIndex a[aria-current="step"]')).toContainText('Comprobar el origen y los límites');
  expect(businessRequests).toEqual([]);
  await info.attach('manual-console-health', { body: JSON.stringify(errors), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
