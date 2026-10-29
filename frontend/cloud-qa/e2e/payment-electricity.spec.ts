import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { isolatedMapTiles, login, prefix, readablePageHeading } from './helpers';
import { syntheticCuit } from '../synthetic-cuit';
test.beforeEach(async ({ page }, info) => { await isolatedMapTiles(page, info); });
const fixture = () => JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'payment-electricity-fixture.json'), 'utf8'));
const labels = { idComprobante: 'ID Comprobante ATM', cuit: 'CUIT del obligado', codigoTasa: 'Código de tasa', fechaPago: 'Fecha de pago', importe: 'Importe pagado (ARS)', periodo: 'Período / concepto', referenciaLiquidacion: 'Referencia de liquidación o trámite', transaccion: 'Transacción (si figura)', control: 'Control (si figura)' };
async function fillIdentity(page: Page, data: any) {
  const form = page.getByTestId('payment-identity-review'); await form.locator('summary').click();
  for (const [field, label] of Object.entries(labels)) await form.getByLabel(label, { exact: true }).fill(data[field]);
  await form.getByRole('checkbox').check(); return form;
}
function health(page: Page) { const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); return () => expect(errors).toEqual([]); }
async function registrationStage(page: Page, number: number, label: string) {
  const select = page.getByRole('combobox', { name: 'Etapa de la inscripción', exact: true });
  if (await select.isVisible()) await select.selectOption(String(number));
  else await page.getByRole('navigation', { name: 'Etapas de la inscripción' }).getByRole('button', { name: new RegExp(`^Paso ${number} de .*: ${label}$`) }).click();
}

test('reviewer identifies the original and completes the registration with visible reservation', async ({ page }, info) => {
  const healthy = health(page), data = fixture().cases[info.project.name].clean;
  await login(page, info); await page.goto(`${prefix(info)}/admin/solicitudes/${data.id}`);
  await expect(page.getByRole('heading', { name: 'Documentos', exact: true })).toBeVisible(); await readablePageHeading(page);
  const form = await fillIdentity(page, data.identity);
  const colors = await form.getByRole('button', { name: 'Confirmar y reservar pago', exact: true }).evaluate(element => ({ foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
  expect(colors.foreground).toBe('rgb(255, 255, 255)');
  const rgb = colors.background.match(/\d+/g)!.slice(0, 3).map(value => { const c = Number(value) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  expect(1.05 / (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] + 0.05)).toBeGreaterThanOrEqual(4.5);
  const saved = page.waitForResponse(response => response.url().endsWith('/identidad-pago') && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Confirmar y reservar pago', exact: true }).click(); expect((await saved).status()).toBe(200);
  const reservation = page.getByRole('status').filter({ hasText: 'Pago reservado para este trámite' }); await expect(reservation).toBeVisible();
  const card = page.locator('div.border.rounded-xl.p-3').filter({ hasText: 'COMPROBANTE PAGO' }); await expect(card).toHaveCount(1);
  const reviewed = page.waitForResponse(response => response.url().endsWith(`/documentos/${data.docId}/revisar`));
  await card.getByRole('button', { name: /^Aprobar documento / }).click(); expect((await reviewed).status()).toBe(200);
  await reservation.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('payment-reserved.png'), animations: 'disabled' });
  const approval = page.waitForResponse(response => response.url().endsWith(`/solicitudes/${data.id}/aprobar`));
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click(); await page.getByRole('dialog', { name: 'Confirmar Aprobacion' }).getByRole('button', { name: 'Confirmar Aprobacion', exact: true }).click();
  expect((await approval).status()).toBe(200); await expect(page.getByText('Aprobada', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); healthy();
});

test('another application cannot reuse the payment and keeps the entered review data on conflict', async ({ page }, info) => {
  const healthy = health(page), data = fixture().cases[info.project.name].conflict;
  await login(page, info); await page.goto(`${prefix(info)}/admin/solicitudes/${data.id}`);
  const form = await fillIdentity(page, data.identity);
  const refused = page.waitForResponse(response => response.url().endsWith('/identidad-pago') && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Confirmar y reservar pago', exact: true }).click(); expect((await refused).status()).toBe(409);
  const warning = form.getByRole('alert'); await expect(warning).toContainText('otro trámite'); await expect(form.getByLabel('ID Comprobante ATM', { exact: true })).toHaveValue(data.identity.idComprobante);
  await warning.scrollIntoViewIfNeeded(); await expect(form.getByRole('button', { name: 'Confirmar y reservar pago', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('payment-conflict.png'), animations: 'disabled' }); healthy();
});

test('applicant uploads an electrical invoice, sees tariff evidence after reload and retains declared HP', async ({ page }, info) => {
  const healthy = health(page), id = randomUUID(), issuer = info.project.name === 'app' ? 'Cooperativa Empresa Electrica de Godoy Cruz' : 'EDEMSA';
  await page.goto(`${prefix(info)}/inscripcion/generador`);
  await page.getByLabel('Nombre completo *', { exact: true }).fill('QA Electricidad ' + id);
  await page.getByLabel('Email *', { exact: true }).fill(id + '@night-qa.invalid'); await page.getByLabel('CUIT *', { exact: true }).fill(syntheticCuit(Date.now()));
  await page.getByLabel('Contraseña *', { exact: true }).fill('OnlyLocal-NightQA-2026!'); await page.getByLabel('Confirmar contraseña *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const created = page.waitForResponse(response => response.url().endsWith('/solicitudes/iniciar') && response.request().method() === 'POST', { timeout: 20000 });
  await page.getByRole('button', { name: 'Crear cuenta y continuar', exact: true }).click(); const response = await created; expect(response.status()).toBe(201); const candidate = (await response.json()).data.solicitudId;
  await page.getByPlaceholder('Empresa S.A.', { exact: true }).fill('Establecimiento artificial ' + id); await page.getByPlaceholder('Calle 123, Ciudad', { exact: true }).fill('Planta artificial Mendoza 123');
  await registrationStage(page, 5, 'Actividad');
  await page.getByLabel('Personal en planta', { exact: true }).fill('32'); await page.getByLabel('Potencia instalada (HP)', { exact: true }).fill('120'); await page.getByLabel('Superficie cubierta (m²)', { exact: true }).fill('1250'); await page.getByLabel('Zona del establecimiento', { exact: true }).selectOption('zona_industrial');
  await registrationStage(page, 6, 'Documentos');
  const row = page.getByTestId('registration-document-FACTURA_ELECTRICA'); await expect(row).toBeVisible();
  const backendRequire = createRequire(new URL('../../../backend/package.json', import.meta.url)), sharp = backendRequire('sharp');
  const lines = [issuer, 'FACTURA ARTIFICIAL - SIN VALIDEZ', 'Tarifa: T2 R BT', 'Consumo facturado: 1250 kWh', 'Potencia contratada: 45 kW', 'NIC: 900000001', 'Periodo: 2026/10'];
  const image = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="white"/>${lines.map((line, index) => `<text x="50" y="${70 + index * 75}" font-family="DejaVu Sans" font-size="32">${line}</text>`).join('')}</svg>`)).png().toBuffer();
  const posted = page.waitForResponse(result => result.url().endsWith(`/solicitudes/${candidate}/documentos`) && result.request().method() === 'POST');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), row.getByRole('button', { name: 'Adjuntar', exact: true }).click()]); await chooser.setFiles({ name: 'Factura-artificial.png', mimeType: 'image/png', buffer: image });
  const uploaded = await posted; expect(uploaded.status()).toBe(201); const doc = (await uploaded.json()).data.documento;
  expect(doc.analisis).toMatchObject({ motor: 'TESSERACT', documentKind: 'FACTURA_ELECTRICA', electricidad: { campos: { categoriaTarifaria: 'T2RBT', consumoKwh: '1250', potenciaContratadaKw: '45' } } });
  await expect(row).toContainText('Guardado'); await page.reload();
  const evidence = page.getByLabel('Lectura de factura eléctrica', { exact: true }); await expect(evidence).toContainText('T2RBT'); await expect(evidence).toContainText('1250 kWh'); await expect(evidence).toContainText('45 kW');
  await evidence.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('electricity-evidence.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await registrationStage(page, 5, 'Actividad');
  await expect(page.getByLabel('Potencia instalada (HP)', { exact: true })).toHaveValue('120'); healthy();
});

test('the existing manual renders payment reservation and electricity evidence without changing its navigation', async ({ page }, info) => {
  const healthy = health(page), business: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) business.push(request.method()); });
  await page.goto('/manual/tutorial.html?guide=alta-borradores-ocr');
  await expect(page.locator('#tutorialTitle')).toHaveText('Alta: documentos, OCR y borradores'); await expect(page).toHaveTitle(/SITREP/);
  await expect(page.locator('.guide-step')).toHaveCount(4); await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.locator('body')).toContainText('Identificar y reservar pago ATM'); await expect(page.locator('body')).toContainText('no garantiza leer todas las facturas históricas');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  if (info.project.name !== 'web-desktop') await page.getByRole('button', { name: /Índice del tutorial/ }).click();
  await page.getByRole('navigation', { name: 'Pasos de la guía' }).getByRole('link', { name: /Revisar antes de presentar/ }).click();
  await expect.poll(() => page.locator('.guide-step').nth(2).locator('img.guide-image').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const heading = page.locator('.guide-step').last().getByRole('heading', { name: 'Revisar antes de presentar', exact: true }); await expect(heading).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('manual-payments-electricity.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); expect(business).toEqual([]); healthy();
});
