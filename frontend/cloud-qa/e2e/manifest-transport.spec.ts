import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix, readablePageHeading } from './helpers';

async function choose(page: Page, label: string, option: RegExp) {
  await page.getByRole('button', { name: label, exact: true }).click();
  // Opening a searchable choice must not focus the keyboard on a phone.
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
  await page.getByRole('option', { name: option }).click();
}

async function destination(page: Page, info: TestInfo) {
  await login(page, info);
  await page.goto(prefix(info) + '/manifiestos/nuevo');
  await choose(page, 'Generador *', /^QA Generador 1 /);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await choose(page, 'Tipo de Residuo *', /^Y1 - /);
  await page.getByLabel('Cantidad *', { exact: true }).fill('15');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await choose(page, 'Transportista *', /^QA Transporte 1 /);
}

async function proof(page: Page, info: TestInfo, name: string) {
  const help = page.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true });
  await expect(help).toHaveCount(1);
  expect(await help.evaluate(el => Boolean(el.closest('header')))).toBe(true);
  await readablePageHeading(page);
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
}

test('explicit second vehicle and driver persist in real manifest and PDF on this surface', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await destination(page, info);
  await expect(page.getByRole('button', { name: 'Vehículo (opcional)', exact: true })).toHaveText(/Elegir vehículo/);
  await expect(page.getByRole('button', { name: 'Chofer (opcional)', exact: true })).toHaveText(/Elegir chofer/);
  await page.getByRole('button', { name: 'Vehículo (opcional)', exact: true }).click();
  await expect(page.getByRole('option', { name: /QA-INACTIVO/ })).toHaveCount(0);
  await page.getByRole('option', { name: /^QA002ZZ/ }).click();
  await choose(page, 'Chofer (opcional)', /^QA Segundo /);
  await choose(page, 'Operador / Destino *', /^QA Operador 1 /);
  await page.getByRole('button', { name: 'Vehículo (opcional)', exact: true }).scrollIntoViewIfNeeded();
  await proof(page, info, 'transport-selection');
  const creation = page.waitForResponse(r => r.url().endsWith('/api/manifiestos') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
  const response = await creation;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toMatchObject({ vehiculoId: 'manifest-qa-second-vehicle', choferId: 'manifest-qa-second-driver' });
  const created = (await response.json()).data.manifiesto;
  await expect(page).toHaveURL(new RegExp(prefix(info) + '/manifiestos/' + created.id + '$'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Transporte asignado', exact: true })).toBeVisible();
  await expect(page.getByText('QA002ZZ · QA Segundo', { exact: true })).toBeVisible();
  await expect(page.getByText('QA Segundo', { exact: true })).toBeVisible();
  await page.getByText('QA Segundo', { exact: true }).scrollIntoViewIfNeeded();
  await proof(page, info, 'transport-persisted');
  const pdf = page.waitForResponse(r => r.url().endsWith('/api/pdf/manifiesto/' + created.id));
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  const pdfResponse = await pdf;
  expect(pdfResponse.status()).toBe(200);
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe('%PDF-');
  expect(errors).toEqual([]);
});

test('carrier and modality changes clear only fleet selections and never infer replacements', async ({ page }, info) => {
  await destination(page, info);
  await choose(page, 'Vehículo (opcional)', /^QA002ZZ/);
  await choose(page, 'Chofer (opcional)', /^QA Segundo /);
  await choose(page, 'Transportista *', /^QA Transporte 2 /);
  await expect(page.getByRole('button', { name: 'Vehículo (opcional)', exact: true })).toHaveText(/Elegir vehículo/);
  await expect(page.getByRole('button', { name: 'Chofer (opcional)', exact: true })).toHaveText(/Elegir chofer/);
  await page.getByRole('button', { name: 'Vehículo (opcional)', exact: true }).click();
  await expect(page.getByRole('option', { name: /^QA002ZZ/ })).toHaveCount(0);
  await page.getByRole('option', { name: /^QA0002/ }).click();
  await page.getByRole('button', { name: /In Situ/ }).click();
  await expect(page.getByRole('button', { name: 'Vehículo (opcional)', exact: true })).toHaveCount(0);
  await choose(page, 'Operador / Destino *', /^QA Operador 1 /);
  const creation = page.waitForResponse(r => r.url().endsWith('/api/manifiestos') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
  const response = await creation; expect(response.status()).toBe(201);
  const sent = response.request().postDataJSON();
  expect(sent).not.toHaveProperty('vehiculoId'); expect(sent).not.toHaveProperty('choferId');
  expect(sent).not.toHaveProperty('transportistaId'); expect(sent.residuos[0].cantidad).toBe(15);
  expect((await response.json()).data.manifiesto.asignacionTransporte).toBeNull();
});
