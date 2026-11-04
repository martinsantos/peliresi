import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { isolatedMapTiles } from './helpers';

test('user and PSIP guides preserve navigation, current screenshots and clear delivery boundaries', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  const errors: string[] = [], business: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) business.push(request.method()); });
  await page.goto('/manual/tutorial.html?guide=administrador-editar-usuarios');
  await expect(page.locator('#tutorialTitle')).toHaveText('Editar una cuenta sin alterar su identidad');
  await expect(page.locator('.guide-step')).toHaveCount(3);
  for (const phrase of ['apellido', 'Inactivo', 'Pendiente']) await expect(page.locator('body')).toContainText(phrase);
  const provenance = await (await page.request.get('/manual/circuit-review-capture-provenance.json')).json();
  expect(provenance.synthetic).toBe(true); expect(provenance.productionCapture).toBe(false); expect(provenance.edited).toBe(false);
  for (const image of await page.locator('img.guide-image').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  for (const file of provenance.files) {
    const response = await page.request.get('/manual/screenshots/' + file.file);
    expect(response.status()).toBe(200); expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(file.sha256);
  }
  if (info.project.name !== 'web-desktop') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
  await page.locator('#tutorialIndex a').last().click();
  await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ ratio: 1 });
  await page.reload(); await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('manual-user-edit.png'), animations: 'disabled' });
  await page.goto('/manual/tutorial.html?guide=psip-flujo-inspecciones');
  await expect(page.locator('#tutorialTitle')).toHaveText('PSIP: del control al seguimiento de la inspección');
  for (const phrase of ['Administración: organizar la agenda', 'Guardar la misma fecha no agrega otro aviso', 'inspector reemplazado', 'actuaciones nuevas requiere habilitación explícita', 'correo y push siguen apagados', 'sólo-campana no se reenvían']) await expect(page.locator('body')).toContainText(phrase);
  if (info.project.name !== 'web-desktop') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
  await page.locator('#tutorialIndex a').last().click();
  await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await expect.poll(() => page.locator('img.guide-image').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ ratio: 1 });
  await page.reload();
  await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('manual-psip-notices.png'), animations: 'disabled' });
  expect(errors).toEqual([]); expect(business).toEqual([]);
});

test('eventual guide makes the creator, registered parties and independent review explicit', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/manual/tutorial.html?guide=eventuales-aprobaciones-avisos');
  await expect(page.locator('#tutorialTitle')).toHaveText('Eventuales: qué apruebo y quién sigue');
  await expect(page.locator('.guide-step')).toHaveCount(3);
  for (const phrase of ['El creador también debe aprobar expresamente', 'Esperando aprobaciones', 'Un rechazo bloquea el avance', 'No revisa su propia operación', 'CAP cerrado y correo/push apagados']) await expect(page.locator('body')).toContainText(phrase);
  await expect(page.locator('img.guide-image')).toHaveCount(2);
  for (const image of await page.locator('img.guide-image').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  if (info.project.name !== 'web-desktop') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
  await page.locator('#tutorialIndex a').last().click();
  await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ ratio: 1 });
  await page.reload(); await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('manual-eventual-approvals.png'), animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('a selected manual step survives a preceding capture loaded after navigation', async ({ page }, info) => {
  await isolatedMapTiles(page, info);
  let releaseImage!: () => void;
  const heldImage = new Promise<void>(resolve => { releaseImage = resolve; });
  await page.route('**/manual/screenshots/mobile/psip-responder-20261020.png', async route => {
    const response = await route.fetch();
    await heldImage;
    await route.fulfill({ response });
  });
  try {
    await page.goto('/manual/tutorial.html?guide=psip-flujo-inspecciones', { waitUntil: 'domcontentloaded' });
    const capture = page.locator('img.guide-image[src$="psip-responder-20261020.png"]');
    expect(await capture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(0);
    const before = await capture.evaluate(image => image.getBoundingClientRect().height);
    if (info.project.name !== 'web-desktop') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
    await page.locator('#tutorialIndex a').last().click();
    const heading = page.locator('.guide-step').last().getByRole('heading');
    await expect(heading).toBeInViewport({ ratio: 1 });
    releaseImage();
    await expect.poll(() => capture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await capture.evaluate(image => image.getBoundingClientRect().height)).toBeGreaterThan(before + 20);
    await expect(heading).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current', 'step');
    await page.screenshot({ path: info.outputPath('manual-delayed-layout.png'), animations: 'disabled' });
  } finally { releaseImage(); }
});
