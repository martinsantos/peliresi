import { expect, type Page } from '@playwright/test';

export async function createExceptionalJourney(page: Page, prefix: string, hideKeyboard = async () => {}) {
  await page.goto('http://127.0.0.1:4177' + prefix + '/manifiestos');
  await page.getByRole('link', { name: 'Baja intensidad · revisión posterior', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar operación', exact: true }).click();
  for (const actor of ['Generador', 'Transportista']) {
    await page.getByLabel(actor + ' · Nombre o razón social', { exact: true }).fill('QA Externo ' + actor);
    await page.getByLabel(actor + ' · Identificación declarada', { exact: true }).fill('QA identidad sintética sin alta');
    await page.getByLabel(actor + ' · Domicilio', { exact: true }).fill('QA Calle de prueba 123');
  }
  await page.getByLabel('Patente declarada', { exact: true }).fill('QA-EXTERNO');
  await page.getByLabel('Corriente', { exact: true }).fill('Y1');
  await page.getByLabel('Cantidad', { exact: true }).fill('10');
  await page.getByLabel('Motivo del registro excepcional', { exact: true }).fill('QA registrar actividad sin alta');
  await hideKeyboard();
  const response = page.waitForResponse(r => r.url().endsWith('/api/manifiestos/baja-intensidad') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar operación', exact: true }).click();
  const saved = await response; expect(saved.status()).toBe(201);
  const record = (await saved.json()).data.registro;
  expect(record.numeroOficial).toBeNull();
  await expect(page).toHaveURL(new RegExp('registro=' + record.id));
  await page.reload();
  await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Registrado');
  await expect(page.getByRole('region', { name: 'Revisión original' })).toContainText('Pendiente de conformidad');
  return record.id as string;
}
async function action(page: Page, button: string, hideKeyboard: () => Promise<void>, region?: string) {
  await page.getByLabel('Nota de la acción', { exact: true }).fill('QA evidencia registrada ' + button);
  await hideKeyboard();
  const response = page.waitForResponse(r => /\/baja-intensidad\/[^/]+\/eventos$/.test(r.url()) && r.request().method() === 'POST');
  const parent = region ? page.getByRole('region', { name: region, exact: true }) : page;
  await parent.getByRole('button', { name: button, exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByLabel('Nota de la acción', { exact: true })).toHaveValue('');
}
export async function continueExceptionalJourney(page: Page, hideKeyboard = async () => {}) {
  await action(page, 'Registrar retirado', hideKeyboard);
  await page.getByRole('button', { name: 'Registrar diferencia', exact: true }).click();
  await page.getByLabel('Corriente', { exact: true }).fill('Y2');
  await page.getByLabel('Cantidad', { exact: true }).fill('12');
  await action(page, 'Guardar diferencia', hideKeyboard);
  await expect(page.getByRole('region', { name: 'Revisión diferencia 1' })).toContainText('Pendiente de conformidad');
  await action(page, 'Registrar recibido', hideKeyboard);
  await action(page, 'Registrar tratado', hideKeyboard);
  await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Tratado');
  await action(page, 'Solicitar revisión', hideKeyboard, 'Revisión original');
  await action(page, 'Solicitar revisión', hideKeyboard, 'Revisión diferencia 1');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Revisión original' })).toContainText('Revisión solicitada');
  await expect(page.getByRole('region', { name: 'Revisión diferencia 1' })).toContainText('Revisión solicitada');
  await expect(page.getByText('Y1 · 10 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Y2 · 12 kg', { exact: true })).toBeVisible();
}
export async function reviewExceptionalJourney(page: Page, prefix: string, id: string, hideKeyboard = async () => {}) {
  await page.goto('http://127.0.0.1:4177' + prefix + '/manifiestos/baja-intensidad?registro=' + id);
  await action(page, 'Aprobar post facto', hideKeyboard, 'Revisión original');
  await expect(page.getByRole('region', { name: 'Revisión diferencia 1' })).toContainText('Pendiente de conformidad');
  await action(page, 'Observar', hideKeyboard, 'Revisión diferencia 1');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Revisión original' })).toContainText('Conformidad aprobada');
  await expect(page.getByRole('region', { name: 'Revisión diferencia 1' })).toContainText('Observada · requiere atención');
  await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Tratado');
  await expect(page.getByText('Sin número oficial', { exact: false })).toBeVisible();
}
