import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { prefix } from '../e2e/helpers';
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'mail-fixture.json'), 'utf8'));
test.beforeEach(async ({ page }) => {
  expect(fixture.database).toBe('sitrep_night_qa_20260926');
  expect(fixture.externalDelivery).toBe(false);
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.11.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`, url: 'http://127.0.0.1:4177' }]);
  await page.addInitScript(() => {
    for (const role of ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'INSPECTOR']) localStorage.setItem(`sitrep_onboarding_${role}`, 'true');
  });
});
async function signInAtDestination(page: Page, user: string) {
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Correo electrónico o CUIT').fill(`${user}@night-qa.invalid`);
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const response = page.waitForResponse(res => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await response).status()).toBe(200);
}
for (const item of fixture.mails) test(`mail destination survives login: ${item.id}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent(item.html);
  const action = page.getByRole('link', { name: 'Ver en SITREP', exact: true });
  const href = await action.getAttribute('href');
  expect(new URL(href!).origin).toBe('http://127.0.0.1:4177');
  // Email actions are canonical web URLs. App proves the equivalent /app route,
  // not automatic Android app-link association or an installed email client.
  if (info.project.name === 'app') await page.goto('/app' + new URL(href!).pathname);
  else await action.click();
  await signInAtDestination(page, item.user);
  await expect(page).toHaveURL('http://127.0.0.1:4177' + prefix(info) + item.expected);
  await expect(page.getByText(item.visible, { exact: true }).first()).toBeVisible();
  if (item.id.startsWith('certificate-')) {
    const certificates = page.getByRole('region', { name: 'Certificados ambientales oficiales', exact: true });
    await expect(certificates).toBeVisible();
    await expect(certificates.getByRole('heading', { name: 'Certificado ambiental anual', exact: true })).toBeVisible();
    await expect(certificates.getByText('Cargar certificado oficial', { exact: true })).toHaveCount(0);
  }
  const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  // Hit-testing proves the destination is usable, not just rendered behind a modal.
  await page.getByText(item.visible, { exact: true }).first().click({ trial: true });
  if (item.id === 'support-owner') {
    await expect(page.getByText('QA respuesta pública: revisamos el acceso.', { exact: true })).toBeVisible();
    await expect(page.getByText('QA NOTA INTERNA NO EXPONER', { exact: true })).toHaveCount(0);
  }
  if (item.id.startsWith('application-pending')) {
    await expect(page.getByRole('heading', { name: 'Mi solicitud', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /^(Manifiestos|Reportes|Avisos)$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Notificaciones/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Mi solicitud', exact: true })).toBeInViewport({ ratio: 1 });
    await page.reload();
    await expect(page.getByText(item.visible, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mi solicitud', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /^(Manifiestos|Reportes|Avisos)$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Notificaciones/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Mi solicitud', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeInViewport({ ratio: 1 });
    if (item.id.endsWith('-rejected')) {
      await expect(page.getByPlaceholder('Escribe un mensaje...')).toHaveCount(0);
      await expect(page.getByText(/Enviada pendiente/)).toHaveCount(0);
    }
  }
  await expect(page).toHaveTitle(/SITREP/);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath(item.id + '.png'), animations: 'disabled' });
  expect(errors).toEqual([]);
});
test('forwarded support link does not reveal another actor ticket', async ({ page }, info) => {
  await page.goto(prefix(info) + '/soporte/' + fixture.ticketId);
  const denied = page.waitForResponse(res => res.url().endsWith('/api/soporte/' + fixture.ticketId));
  // The support lifecycle deliberately grants *2 users staff rights. Use the
  // ordinary, ungranted applicant fixture so this remains a genuine denial.
  await signInAtDestination(page, 'sin-actor');
  expect([403, 404]).toContain((await denied).status());
  await expect(page.getByText('QA respuesta de soporte por correo', { exact: true })).toHaveCount(0);
  const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await expect(page.getByRole('button', { name: 'Reintentar ticket', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('denied-ticket.png'), animations: 'disabled' });
});
test('all nineteen templates fit the viewport with readable actions', async ({ page }, info) => {
  expect(fixture.templates).toHaveLength(19);
  for (const item of fixture.templates) {
    await page.setContent(item.html);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), item.id).toBe(true);
    for (const link of await page.getByRole('link').all()) {
      expect(await link.evaluate(element => element.getBoundingClientRect().height), item.id).toBeGreaterThanOrEqual(44);
      await expect(link).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(link).toHaveCSS('background-color', 'rgb(27, 94, 60)');
    }
    await page.screenshot({ path: info.outputPath('template-' + item.id + '.png'), fullPage: true });
  }
});
