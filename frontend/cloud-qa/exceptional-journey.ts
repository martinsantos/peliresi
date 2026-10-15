import { expect, type Page, type Locator } from '@playwright/test';

async function press(page: Page, control: Locator) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await control.tap();
  else await control.click();
}
export async function createExceptionalJourney(page: Page, prefix: string, hideKeyboard = async () => {}, linked?: 'Generador' | 'Transportista', assertNoKeyboard = async () => {}) {
  await page.goto('http://127.0.0.1:4177' + prefix + '/manifiestos');
  await press(page, page.getByRole('link', { name: 'Baja intensidad · revisión posterior', exact: true }));
  await press(page, page.getByRole('button', { name: 'Registrar operación', exact: true }));
  for (const actor of ['Generador', 'Transportista']) {
    await page.getByLabel(actor + ' · Nombre o razón social', { exact: true }).fill('QA Externo ' + actor);
    await page.getByLabel(actor + ' · Identificación declarada', { exact: true }).fill('QA identidad sintética sin alta');
    await page.getByLabel(actor + ' · Domicilio', { exact: true }).fill('QA Calle de prueba 123');
  }
  if (linked) {
    await hideKeyboard();
    await press(page, page.getByRole('button', { name: linked + ' · Buscar en padrón', exact: true }));
    await press(page, page.getByLabel(linked + ' del padrón', { exact: true }));
    await expect(page.getByRole('option', { name: linked === 'Generador' ? /^QA Generador 1 ·/ : /^QA Transporte 1 ·/ })).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
    await assertNoKeyboard();
    await press(page, page.getByRole('option', { name: linked === 'Generador' ? /^QA Generador 1 ·/ : /^QA Transporte 1 ·/ }));
    await assertNoKeyboard();
    await expect(page.getByLabel(linked + ' · Nombre o razón social', { exact: true })).toHaveValue(linked === 'Generador' ? 'QA Generador 1' : 'QA Transporte 1');
  }
  await page.getByLabel('Patente declarada', { exact: true }).fill('QA-EXTERNO');
  await page.getByLabel('Corriente', { exact: true }).fill('Y1');
  await page.getByLabel('Cantidad', { exact: true }).fill('10');
  await page.getByLabel('Motivo del registro excepcional', { exact: true }).fill('QA registrar actividad sin alta');
  await hideKeyboard();
  const response = page.waitForResponse(r => r.url().endsWith('/api/manifiestos/baja-intensidad') && r.request().method() === 'POST');
  await press(page, page.getByRole('button', { name: 'Guardar operación', exact: true }));
  const saved = await response; expect(saved.status()).toBe(201);
  const record = (await saved.json()).data.registro;
  expect(record.numeroOficial).toBeNull();
  if (linked) expect(record.datos[linked.toLowerCase()].padronId).toBeTruthy();
  await expect(page).toHaveURL(new RegExp('registro=' + record.id));
  // Return through the UI before any reload: the fresh list cache must not hide the new record.
  await press(page, page.getByRole('button', { name: 'Ver registros', exact: true }));
  const listed = page.getByRole('button', { name: new RegExp('BI-' + record.id) });
  await expect(listed).toBeVisible();
  await press(page, listed);
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
  await press(page, parent.getByRole('button', { name: button, exact: true }));
  expect((await response).status()).toBe(200);
  await expect(page.getByLabel('Nota de la acción', { exact: true })).toHaveValue('');
}
export async function continueExceptionalJourney(page: Page, hideKeyboard = async () => {}) {
  await action(page, 'Registrar retirado', hideKeyboard);
  await press(page, page.getByRole('button', { name: 'Registrar diferencia', exact: true }));
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
  for (const stage of ['Retirado', 'Recibido', 'Tratado']) await expect(page.getByText('Movimiento registrado · ' + stage, { exact: true })).toBeVisible();
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
