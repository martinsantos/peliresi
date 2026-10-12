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
  const action = page.getByRole('link').first();
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
test('all templates and operational variants fit with institutional brand and readable actions', async ({ page }, info) => {
  test.setTimeout(120_000);
  expect(fixture.templates).toHaveLength(58);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const item of fixture.templates) {
    await page.setContent(item.html);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toHaveCSS('font-family', 'Arial, Helvetica, sans-serif');
    await expect(page.locator('h1').locator('..')).toHaveCSS('font-family', 'Arial, Helvetica, sans-serif');
    const logo = page.getByRole('img', { name: 'Gobierno de Mendoza' });
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const masthead = page.locator('[data-mail-masthead]');
    const brand = page.locator('[data-mail-brand]');
    await expect(brand.locator('img')).toHaveAttribute('src', /\/mail-sitrep-rotonda\.png$/);
    await expect(masthead).toContainText('Fiscalización Ambiental');
    await expect(brand.locator('[data-mail-wordmark]')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(brand.locator('[data-mail-wordmark]')).toHaveCSS('font-size', '24px');
    await expect.poll(() => brand.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const governmentBox = (await logo.boundingBox())!;
    const markBox = (await brand.locator('img').boundingBox())!;
    const titleBox = (await page.locator('h1').boundingBox())!;
    const governmentCell = (await masthead.boundingBox())!;
    const brandCell = (await brand.boundingBox())!;
    expect(Math.abs(governmentCell.y - brandCell.y), item.id + ' shared header row').toBeLessThanOrEqual(1);
    expect(governmentBox.x + governmentBox.width, item.id + ' government left').toBeLessThan(markBox.x);
    expect(Math.abs(governmentCell.height - brandCell.height), item.id + ' balanced cells').toBeLessThanOrEqual(1);
    expect(titleBox.y, item.id + ' content below both identities').toBeGreaterThan(governmentCell.y + governmentCell.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), item.id).toBe(true);
    for (const link of await page.getByRole('link').all()) {
      expect(await link.evaluate(element => element.getBoundingClientRect().height), item.id).toBeGreaterThanOrEqual(44);
      await expect(link).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(link).toHaveCSS('background-color', 'rgb(27, 94, 60)');
    }
    await page.screenshot({ path: info.outputPath('template-' + item.id + '.png'), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('all templates retain identity and actions when email images are blocked', async ({ page }, info) => {
  test.setTimeout(120_000);
  expect(fixture.templates).toHaveLength(58);
  for (const item of fixture.templates) {
    // Reproduce the received Gmail DOM: image elements remain, but src is stripped.
    // This is graceful degradation, not a claim that Gmail delivery is repaired.
    const blocked = item.html.replace(/(<img\b[^>]*?)\s+src="[^"]*"/gi, '$1');
    await page.setContent(blocked);
    await expect(page.locator('[data-mail-institution]')).toHaveText('Gobierno de Mendoza');
    await expect(page.locator('[data-mail-institution]')).toBeVisible();
    await expect(page.locator('[data-mail-wordmark]')).toHaveText('SITREP');
    await expect(page.locator('h1')).toBeVisible();
    for (const image of await page.locator('img').all()) {
      expect(await image.getAttribute('src')).toBeNull();
      expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(0);
    }
    for (const link of await page.getByRole('link').all()) {
      await expect(link).toBeVisible();
      await link.click({ trial: true });
      expect(new URL((await link.getAttribute('href'))!).origin).toBe('http://127.0.0.1:4177');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), item.id).toBe(true);
    if (item.id === 'inspection-assigned' || item.id === 'verify') {
      await page.screenshot({ path: info.outputPath('blocked-images-' + item.id + '.png'), fullPage: true });
    }
  }
});

test('public email verification preserves a local draft through real login and recovers the owned application', async ({ page }, info) => {
  const item = fixture.verifications[info.project.name][0];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(prefix(info) + '/login');
  await page.evaluate(item => {
    localStorage.setItem('qa-unrelated-draft', 'Do not remove');
    localStorage.setItem(`sitrep-registration:v1:${encodeURIComponent(item.userId)}:${encodeURIComponent('public:GENERADOR:' + item.draftId)}`, JSON.stringify({
      version: 1, owner: item.userId, scope: 'public:GENERADOR:' + item.draftId, savedAt: Date.now(),
      data: { form: { razonSocial: 'QA edición local sin perder', domicilio: 'QA domicilio conservado', telefono: '02615550101' }, step: 1, serverRevision: item.revision },
    }));
  }, item);
  const verified = page.waitForResponse(response => response.url().includes('/api/auth/verify-email?'));
  await page.goto(prefix(info) + '/verificar-email?token=' + item.token);
  expect((await verified).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Email verificado' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('verification-before-login.png'), animations: 'disabled' });
  await page.getByRole('link', { name: 'Continuar en SITREP' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.reload(); // Browser history must preserve the protected destination.
  await page.getByLabel('Correo electrónico o CUIT').fill(item.email);
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4177' + prefix(info) + '/inscripcion/generador');
  const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await expect(page.getByPlaceholder('Empresa S.A.')).toHaveValue('QA edición local sin perder');
  await page.getByPlaceholder('Empresa S.A.').click({ trial: true });
  expect(await page.evaluate(() => localStorage.getItem('qa-unrelated-draft'))).toBe('Do not remove');
  await page.screenshot({ path: info.outputPath('verification-draft-recovered.png'), animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('verifying another email does not replace a signed-in account or delete its draft', async ({ page }, info) => {
  const item = fixture.verifications[info.project.name][1];
  await page.goto(prefix(info) + '/manifiestos');
  await signInAtDestination(page, 'generador');
  await expect(page).toHaveURL(/\/manifiestos$/);
  const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  const before = await page.evaluate(() => { localStorage.setItem('qa-existing-draft', 'Keep current form'); return localStorage.getItem('sitrep_access_token'); });
  await page.goto(prefix(info) + '/verificar-email?token=' + item.token);
  await expect(page.getByRole('heading', { name: 'Email verificado' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('otra cuenta');
  await expect(page.getByRole('link', { name: 'Volver a mi sesión' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a mi sesión' }).click({ trial: true });
  expect(await page.evaluate(() => localStorage.getItem('sitrep_access_token'))).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('qa-existing-draft'))).toBe('Keep current form');
  const profile = await page.request.get('/api/auth/profile', { headers: { Authorization: 'Bearer ' + before } });
  expect(profile.status()).toBe(200);
  expect((await profile.json()).data.user.email).toBe('generador@night-qa.invalid');
  await page.screenshot({ path: info.outputPath('verification-another-account.png'), animations: 'disabled' });
});

test('email opened in a clean browser recovers only the server-saved application after login', async ({ page }, info) => {
  const item = fixture.verifications[info.project.name][2];
  await page.goto(prefix(info) + '/verificar-email?token=' + item.token);
  await expect(page.getByRole('heading', { name: 'Email verificado' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('sitrep-registration:')))).toBe(false);
  await page.getByRole('link', { name: 'Continuar en SITREP' }).click();
  await page.getByLabel('Correo electrónico o CUIT').fill(item.email);
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4177' + prefix(info) + '/inscripcion/generador');
  const welcome = page.getByRole('button', { name: 'Saltar introducción', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await expect(page.getByPlaceholder('Empresa S.A.')).toHaveValue('QA borrador guardado en SITREP');
  await page.getByPlaceholder('Empresa S.A.').click({ trial: true });
  await page.screenshot({ path: info.outputPath('verification-server-draft.png'), animations: 'disabled' });
});
