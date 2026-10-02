import { expect, type Page, type TestInfo } from '@playwright/test';

export const prefix = (info: TestInfo) => info.project.name === 'app' ? '/app' : '';

/** Real synthetic-account login; no auth storage or business API interception. */
export async function login(page: Page, info: TestInfo, user = 'admin', options: { showWelcome?: boolean } = {}) {
  // Metadata consumed only by the loopback QA reverse proxy. Login still goes
  // through the real form and real backend; this cookie carries no credentials.
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.11.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`, url: 'http://127.0.0.1:4177' }]);
  if (!options.showWelcome) await page.addInitScript(() => {
    // Only presentation preferences. Authentication still uses the actual form.
    for (const role of ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'AUDITOR',
      'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR', 'INSPECTOR']) localStorage.setItem(`sitrep_onboarding_${role}`, 'true');
  });
  await page.goto(`${prefix(info)}/login`);
  await page.getByLabel('Correo electrónico o CUIT').fill(`${user}@night-qa.invalid`);
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const response = page.waitForResponse(res => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page.getByRole('banner')).toBeVisible();
  const skipWelcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  if (!options.showWelcome && await skipWelcome.isVisible()) await skipWelcome.click();
}

export async function createSpontaneousInspection(page: Page, info: TestInfo) {
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA hallazgo sintético de resiliencia');
  await page.getByLabel('Ubicación prevista').fill('QA lugar sintético sin actor');
  const response = page.waitForResponse(res => res.url().endsWith('/api/inspecciones') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const inspection = (await saved.json()).data;
  await page.getByRole('navigation', { name: 'Secciones del expediente' }).getByRole('link', { name: 'Registro', exact: true }).click();
  await expect(page.locator('#inspection-observations')).toBeVisible();
  return inspection as { id: string; numero: string; items: Array<{ id: string; etiqueta: string }> };
}
