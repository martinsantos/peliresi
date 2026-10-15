import { expect, type Page } from '@playwright/test';
export async function multiRoleJourney(page: Page, prefix: string, hideKeyboard = async () => {}) {
  const origin = 'http://127.0.0.1:4177';
  await page.goto(origin + prefix + '/mi-perfil');
  await expect(page.getByRole('button', { name: 'Generador · En uso', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Usar Operador', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Operador · En uso', exact: true })).toBeDisabled();
  await expect(page).toHaveURL(origin + prefix + '/mi-perfil');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Operador · En uso', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Solicitar Transportista', exact: true }).click();
  await expect(page).toHaveURL(/\/inscripcion\/transportista$/);
  // The unified wizard resumes the server-owned draft, not the account/password step.
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No se pudo recuperar', { exact: false })).toHaveCount(0);
  await page.goto(origin + prefix + '/mi-perfil');
  await expect(page.getByRole('button', { name: 'Operador · En uso', exact: true })).toBeDisabled();
  await page.goto(origin + prefix + '/manifiestos/baja-intensidad');
  await page.getByRole('button', { name: 'Registrar operación', exact: true }).click();
  await expect(page.getByText('Faltan datos de contacto o identificación.', { exact: false }).first()).toBeVisible();
  for (const actor of ['Generador', 'Transportista']) {
    await expect(page.getByLabel(actor + ' · Nombre o razón social', { exact: true })).not.toHaveAttribute('required');
  }
  await page.getByLabel('Corriente', { exact: true }).fill('Y1');
  await page.getByLabel('Cantidad', { exact: true }).fill('7');
  await page.getByLabel('Motivo del registro excepcional', { exact: true }).fill('QA registrar sin identificación disponible');
  await hideKeyboard();
  const response = page.waitForResponse(r => r.url().endsWith('/api/manifiestos/baja-intensidad') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar operación', exact: true }).click();
  const result = await response; expect(result.status()).toBe(201);
  const entry = (await result.json()).data.registro;
  expect(entry.datos.generador.nombre).toBe(''); expect(entry.datos.transportista.identificacion).toBe('');
  expect(entry.numeroOficial).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Generador por identificar', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Estado operativo' })).toHaveText('Operación: Registrado');
  await expect(page.getByRole('button', { name: 'Aprobar post facto', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}
