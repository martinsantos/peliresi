import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { isolatedMapTiles, prefix } from './helpers';
const fixture = JSON.parse(readFileSync(process.env.QA_ARTIFACTS! + '/fixture.json', 'utf8'));

for (const item of fixture.mails) test(`corrected mail, login and destination: ${item.id}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await isolatedMapTiles(page, info);
  expect(fixture.externalDelivery).toBe(false);
  expect(fixture.capClosed).toBe(true);
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.11.34.${1 + info.workerIndex + info.parallelIndex + fixture.mails.indexOf(item)}`, url: 'http://127.0.0.1:4177' }]);
  await page.addInitScript(() => localStorage.setItem('sitrep_onboarding_GENERADOR', 'true'));
  await page.setContent(item.html);
  await expect(page.locator('h1')).toHaveText(item.subject.replace('[SITREP] ', ''));
  const metadata = JSON.parse(item.notice.datos || '{}');
  if (metadata.tipo === 'adenda_manifiesto') {
    await expect(page.locator('body')).toContainText('aprobación individual');
    await expect(page.locator('body')).toContainText('No representa la decisión de las otras partes ni el cierre documental');
  } else if (metadata.tipo === 'comprobante_repetido') {
    await expect(page.locator('body')).toContainText('no acredita un pago nuevo');
    await expect(page.locator('body')).toContainText('huella del archivo');
  } else {
    await expect(page.locator('body')).toContainText('no confirma que se haya emitido una certificación');
    await expect(page.locator('body')).toContainText('firma y emisión expresa del operador');
  }
  for (const image of await page.locator('img').all()) await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('correo.png'), fullPage: true });
  const action = page.getByRole('link').first(), href = new URL((await action.getAttribute('href'))!);
  expect(href.origin).toBe('http://127.0.0.1:4177');
  await expect(action).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(action).toHaveCSS('background-color', 'rgb(27, 94, 60)');
  if (info.project.name === 'app') await page.goto(prefix(info) + href.pathname + href.search + href.hash);
  else await action.click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Correo electrónico o CUIT').fill('generador@night-qa.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const login = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await login).status()).toBe(200);
  await expect(page).toHaveURL('http://127.0.0.1:4177' + prefix(info) + href.pathname);
  const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  await expect(welcome).toBeVisible();
  await welcome.click();
  await expect(welcome).toHaveCount(0);
  if (metadata.tipo === 'comprobante_repetido') {
    const notices = page.getByRole('list', { name: 'Avisos', exact: true }).getByRole('listitem').filter({ hasText: 'Comprobante repetido' });
    await expect(notices).toHaveCount(2);
    await expect(notices.first()).toContainText('no acredita un pago nuevo');
  } else {
    await expect(page.getByText('QA-CORREOS-0001', { exact: false }).first()).toBeVisible();
    if (metadata.tipo === 'adenda_manifiesto') await expect(page.getByText('QA decisión individual', { exact: false }).first()).toBeVisible();
    else {
      await expect(page.getByRole('region', { name: 'Certificaciones', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Descargar (parcial|final)/ })).toHaveCount(0);
    }
  }
  await expect(page).toHaveTitle(/SITREP/);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.getByText('Capacitación · sin validez oficial')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('destino.png'), animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('manual explains the three distinct events without changing its layout', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await isolatedMapTiles(page, info);
  await page.goto('/manual/tutorial.html?guide=correos-decisiones-documentos');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('22px "Material Symbols Rounded"'))).toBe(true);
  await expect(page.locator('.material-symbols-rounded').first()).toHaveCSS('font-family', '"Material Symbols Rounded"');
  await expect(page.locator('#tutorialTitle')).toHaveText('Correos: decisiones, comprobantes y certificados');
  await expect(page.locator('.guide-step')).toHaveCount(3);
  for (const text of ['aprobación individual', 'no acredita un pago nuevo', 'emisión expresa del operador', 'permanecen apagados']) await expect(page.locator('body')).toContainText(text);
  if (info.project.name !== 'web-desktop') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
  await page.locator('#tutorialIndex a').last().click();
  await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ ratio: 1 });
  await page.reload();await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath('manual.png'), animations: 'disabled' });
  expect(errors).toEqual([]);
});
