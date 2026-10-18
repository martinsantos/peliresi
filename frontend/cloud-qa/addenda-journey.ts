import { expect, type Page, type Locator } from '@playwright/test';
async function press(page: Page, target: Locator) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await target.tap(); else await target.click();
}
export async function recordOrdinaryAddendum(page: Page, hideKeyboard = async () => {}) {
  await press(page, page.getByRole('link', { name: 'Adendas y revisión posterior', exact: true }));
  await expect(page).toHaveURL(/\/manifiestos\/[^/]+\/adendas$/);
  await press(page, page.getByRole('button', { name: 'Registrar diferencia', exact: true }));
  await page.getByLabel('Corriente observada 1', { exact: true }).fill('Y2');
  await page.getByLabel('Cantidad observada 1', { exact: true }).fill('42');
  await page.getByLabel('Motivo de la adenda', { exact: true }).fill('QA diferencia de carga, continuar y revisar después');
  await hideKeyboard();
  const response = page.waitForResponse(r => /\/api\/manifiestos\/[^/]+\/adendas$/.test(r.url()) && r.request().method() === 'POST');
  await press(page, page.getByRole('button', { name: 'Guardar y solicitar revisión', exact: true }));
  const saved = await response; expect(saved.status()).toBe(201);
  const record = (await saved.json()).data.adenda;
  const region = page.getByRole('region', { name: 'Adenda ' + record.id, exact: true });
  await expect(region.getByRole('status', { name: 'Estado de revisión' })).toHaveText('Pendiente de revisión');
  await page.reload(); await expect(region.getByText('Y2 · 42 kg', { exact: true })).toBeVisible();
  await expect(region.getByRole('heading', { name: 'Declaración conservada' })).toBeVisible();
  await press(page, page.getByRole('link', { name: 'Volver al manifiesto', exact: true }));
  return record.id as string;
}
export async function resolveOrdinaryAddendum(page: Page, id: string, decision: 'Aprobar post facto' | 'Rechazar conformidad', hideKeyboard = async () => {}) {
  const region = page.getByRole('region', { name: 'Adenda ' + id, exact: true });
  await region.getByLabel('Motivo de resolución', { exact: true }).fill('QA revisión posterior con hechos conservados');
  await hideKeyboard();
  const response = page.waitForResponse(r => r.url().endsWith('/adendas/' + id + '/revisiones') && r.request().method() === 'POST');
  await press(page, region.getByRole('button', { name: decision, exact: true }));
  expect((await response).status()).toBe(200);
  await page.reload();
  await expect(region.getByRole('status', { name: 'Estado de revisión' })).toHaveText(decision === 'Aprobar post facto' ? 'Aprobada post facto' : 'Conformidad rechazada');
  await expect(page.getByText('Operación: TRATADO. La revisión de adendas no detiene el circuito.', { exact: true })).toBeVisible();
  await expect(region.getByText('Y2 · 42 kg', { exact: true })).toBeVisible();
}
