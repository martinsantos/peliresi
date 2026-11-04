import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { isolatedMapTiles } from './helpers';

test('onboarding help retains four steps, current correction capture and fiscal boundaries without business requests', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.method()); });
  await page.goto('/manual/tutorial.html?guide=alta-borradores-ocr');
  await expect(page.locator('#tutorialTitle')).toHaveText('Alta: documentos, OCR y borradores');
  await expect(page.locator('.guide-step')).toHaveCount(4); await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  for (const phrase of ['Ingresar con mi cuenta', 'Continuar borrador', 'Corregir datos y documentos', 'no reemplaza un adjunto rechazado', 'pestaña Documentos', 'Identificar y reservar pago ATM', 'no garantiza leer todas las facturas históricas', 'ni cambia automáticamente la TEF']) await expect(page.locator('body')).toContainText(phrase);
  const footer = async (name: string) => {
    const geometry = await page.locator('.tutorial-footer-nav').evaluate(nav => ({ inner: innerWidth, visual: visualViewport?.width,
      overflow: [...document.querySelectorAll('body *')].filter(element => !element.closest('.guide-image-wrap')).map(element => { const r = element.getBoundingClientRect(); return { tag: element.tagName, cls: element.className, text: element.textContent?.slice(0, 160), right: r.right, width: r.width }; }).filter(element => element.right > (visualViewport?.width || innerWidth) + 1 && element.width > 0).sort((a,b) => b.right-a.right).slice(0,15),
      controls: [...nav.querySelectorAll('button,.footer-progress')].map(element => { const r = element.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(element); return { id: element.id, left: r.left, right: r.right, text: [...range.getClientRects()].filter(rect => rect.width > 0).map(rect => ({ left: rect.left, right: rect.right })) }; }) }));
    writeFileSync(info.outputPath(name + '-footer.json'), JSON.stringify(geometry));
    const width = page.viewportSize()!.width;
    for (const control of geometry.controls) { expect(control.left).toBeGreaterThanOrEqual(-1); expect(control.right).toBeLessThanOrEqual(width + 1); for (const text of control.text) { expect(text.left).toBeGreaterThanOrEqual(-1); expect(text.right).toBeLessThanOrEqual(width + 1); } }
  };
  await page.evaluate(() => document.fonts.ready.then(() => true)); await footer('first');
  const summary = async () => {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    if (info.project.name !== 'web-desktop') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
    await page.getByRole('navigation', { name: 'Pasos de la guía' }).getByRole('link', { name: /Revisar antes de presentar/ }).click();
    await expect.poll(() => page.locator('.guide-step').nth(2).locator('img.guide-image').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.guide-step').last().getByRole('heading', { name: 'Revisar antes de presentar', exact: true })).toBeInViewport({ ratio: 1 });
  };
  await summary();
  await footer('last');
  const proof = await (await page.request.get('/manual/actor-onboarding-capture-provenance.json')).json();
  expect(proof.browserTestsPassed).toBe(18); expect(proof.productionCapture).toBe(false);
  for (const image of await page.locator('img.guide-image').all()) { await image.scrollIntoViewIfNeeded(); await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true); }
  for (const file of proof.files) {
    const image = page.locator(`img.guide-image[src="screenshots/${file.file}"]`); await image.scrollIntoViewIfNeeded();
    const response = await page.request.get('/manual/screenshots/' + file.file); expect(response.status()).toBe(200);
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(file.sha256);
    await expect(image).toBeVisible();
  }
  await summary();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('manual-onboarding.png'), animations: 'disabled' });
  expect(errors).toEqual([]); expect(requests).toEqual([]);
});
