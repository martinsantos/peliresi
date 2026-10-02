import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

// These are UI actions against the isolated backend, not intercepted uploads.
// The second PDF has an intentionally prohibited MIME; only that real 400 is expected.
for (const actor of [
  { path: 'generadores', key: 'generador', regulatory: 5, last: 6, second: 'Factura de Luz' },
  { path: 'operadores', key: 'operador', regulatory: 6, last: 7, second: 'Plan de Contingencia' },
]) test(`${actor.key}: partial real upload stays recoverable without another registration`, async ({ page }, info) => {
  const errors: string[] = [];
  const apiErrors: Array<{ path: string; status: number }> = [];
  const created: string[] = [];
  let authorization: string | undefined;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.includes('/api/') && response.status() >= 400) apiErrors.push({ path: url.pathname, status: response.status() });
  });
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === `/api/actores/${actor.path}`) {
      created.push(request.url());
      authorization = request.headers().authorization;
    }
  });
  await login(page, info);
  await page.goto(`${prefix(info)}/admin/actores/${actor.path}/nuevo`);
  const unique = randomUUID();
  await page.getByLabel('Razon Social *', { exact: true }).fill(`QA adjuntos ${unique}`);
  await page.getByLabel('CUIT *', { exact: true }).fill(`30-${String(Date.now()).slice(-8)}-1`);
  await page.getByLabel('Email *', { exact: true }).fill(`${unique}@night-qa.invalid`);
  const step = page.getByRole('combobox', { name: 'Paso del registro' });
  if (info.project.name === 'web-desktop') await page.getByRole('button', { name: `${actor.regulatory}. Regulatorio`, exact: true }).click();
  else await step.selectOption(String(actor.regulatory));
  await page.getByLabel('Password Inicial *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  if (info.project.name === 'web-desktop') await page.getByRole('button', { name: `${actor.last}. Adjuntos`, exact: true }).click();
  else await step.selectOption(String(actor.last));
  await page.getByLabel('Adjuntar Memoria Tecnica', { exact: true }).setInputFiles({ name: 'QA-valid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nQA synthetic upload') });
  await page.getByLabel(`Adjuntar ${actor.second}`, { exact: true }).setInputFiles({ name: 'QA-retry.pdf', mimeType: 'text/plain', buffer: Buffer.from('QA invalid MIME to reproduce partial failure') });
  const response = page.waitForResponse(res => new URL(res.url()).pathname === `/api/actores/${actor.path}` && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar Registro', exact: true }).click();
  const registration = await response;
  expect(registration.status()).toBe(201);
  const saved = (await registration.json()).data[actor.key];
  expect(saved.id).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Reintentar adjuntos', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(new RegExp(`/admin/actores/${actor.path}/nuevo$`));
  await expect(page.getByRole('alert', { name: 'Adjuntos pendientes' })).toContainText('guardado');
  await expect(page.getByText('QA-valid.pdf', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(`${actor.key}-partial.png`), animations: 'disabled' });
  await page.getByRole('button', { name: `Quitar ${actor.second}`, exact: true }).click();
  await page.getByLabel(`Adjuntar ${actor.second}`, { exact: true }).setInputFiles({ name: 'QA-recovered.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nQA recovered upload') });
  await page.getByRole('button', { name: 'Reintentar adjuntos', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/actores/${actor.path}$`));
  expect(created).toHaveLength(1);
  expect(apiErrors).toEqual([{ path: `/api/actores/${actor.path}/${saved.id}/documentos`, status: 400 }]);
  expect(errors).toEqual([]);
  // Read back persisted documents with the credential observed on the actual UI
  // request, not a synthetic session. Operator detail has no document tab.
  expect(authorization).toMatch(/^Bearer /);
  const documents = await page.request.get(`/api/actores/${actor.path}/${saved.id}/documentos`, { headers: { Authorization: authorization! } });
  expect(documents.status()).toBe(200);
  expect((await documents.json()).data.documentos.map((doc: { nombre: string }) => doc.nombre).sort())
    .toEqual(['QA-recovered.pdf', 'QA-valid.pdf']);
  if (actor.key === 'generador') {
    await page.goto(`${prefix(info)}/admin/actores/${actor.path}/${saved.id}`);
    await page.getByRole('tab', { name: 'DDJJ y Documentos', exact: true }).click();
    await expect(page.getByText('QA-valid.pdf', { exact: true })).toBeVisible();
    await expect(page.getByText('QA-recovered.pdf', { exact: true })).toBeVisible();
    await expect(page.getByText('QA-retry.pdf', { exact: true })).toHaveCount(0);
  }
  await info.attach('real-upload-recovery', { body: JSON.stringify({ actorId: saved.id, registrations: created.length, expectedFailure: apiErrors }), contentType: 'application/json' });
});

test('long actor tabs reveal End/Home selection without scrolling the document', async ({ page }, info) => {
  await login(page, info);
  await page.goto(`${prefix(info)}/admin/actores/generadores`);
  await page.locator('main input[placeholder^="Buscar"]').first().fill('QA Generador 1');
  await page.locator('main').getByText('QA Generador 1', { exact: true }).filter({ visible: true }).first().click();
  const list = page.getByRole('tablist').first();
  const first = list.getByRole('tab', { name: 'Info General', exact: true });
  const last = list.getByRole('tab', { name: 'Trazabilidad', exact: true });
  const y = await page.evaluate(() => window.scrollY);
  await first.focus();
  await page.keyboard.press('End');
  await expect(last).toBeFocused();
  await expect(last).toHaveAttribute('aria-selected', 'true');
  const bounds = (await list.boundingBox())!;
  const selected = (await last.boundingBox())!;
  expect(selected.x).toBeGreaterThanOrEqual(bounds.x - 1);
  expect(selected.x + selected.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('tabs-end-selected.png'), animations: 'disabled' });
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  expect(await list.evaluate(element => element.scrollLeft)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
});
