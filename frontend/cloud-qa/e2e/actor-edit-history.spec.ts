import { randomUUID, randomInt } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { login, prefix } from './helpers';
import { assertCloudDatabase } from '../safety';

for (const actor of [
  { key: 'generador', path: 'generadores', last: 6, lastLabel: 'Adjuntos' },
  { key: 'operador', path: 'operadores', last: 7, lastLabel: 'Adjuntos' },
  { key: 'transportista', path: 'transportistas', last: 5, lastLabel: 'Confirmar' },
]) test(`${actor.key}: edit address from the ficha and read its actual before/after history`, async ({ page }, info) => {
  await assertCloudDatabase();
  let authorization = '';
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) authorization = request.headers().authorization || authorization; });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, info);
  await expect.poll(() => authorization).toMatch(/^Bearer /);
  const unique = randomUUID();
  const oldAddress = 'QA Calle anterior 100';
  const newAddress = 'QA Calle corregida 200';
  const created = await page.request.post(`/api/actores/${actor.path}`, { headers: { Authorization: authorization }, data: {
    razonSocial: `QA Dirección ${unique}`, cuit: `30-${randomInt(10000000, 99999999)}-1`, email: `${unique}@night-qa.invalid`,
    password: 'OnlyLocal-NightQA-2026!', nombre: 'QA padrón', domicilio: oldAddress, telefono: '000', categoria: 'FIJO',
    numeroInscripcion: 'QA-G', numeroHabilitacion: 'QA-H', domicilioLegalCalle: oldAddress, domicilioLegalLocalidad: 'Capital', domicilioLegalDepto: 'Capital',
  } });
  expect(created.status()).toBe(201); const record = (await created.json()).data[actor.key];
  await page.goto(`${prefix(info)}/admin/actores/${actor.path}/${record.id}`);
  await page.getByRole('button', { name: 'Editar datos del padrón', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${record.id}/editar$`));
  const step = async (number: number, label: string) => {
    if (info.project.name === 'web-desktop') await page.getByRole('button', { name: `${number}. ${label}`, exact: true }).click();
    else await page.getByRole('combobox', { name: 'Paso del registro' }).selectOption(String(number));
  };
  if (actor.key === 'transportista') await page.getByLabel('Domicilio', { exact: true }).fill(newAddress);
  else { await step(2, 'Domicilios'); await page.getByLabel('Calle / Ruta', { exact: true }).first().fill(newAddress); }
  await step(actor.last, actor.lastLabel);
  const changed = page.waitForResponse(response => new URL(response.url()).pathname === `/api/actores/${actor.path}/${record.id}` && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Guardar Cambios', exact: true }).click();
  const response = await changed; expect(response.status()).toBe(200);
  expect((await response.json()).data[actor.key].domicilio).toContain(newAddress);
  await page.goto(`${prefix(info)}/admin/actores/${actor.path}/${record.id}`);
  await expect(page.getByText(newAddress, { exact: false }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Trazabilidad', exact: true }).click();
  const history = page.locator('details').filter({ has: page.getByText('Cambios de datos del padrón', { exact: true }) });
  await history.locator('summary').click();
  await history.getByRole('button').filter({ hasText: 'Modificado' }).first().click();
  await expect(history.getByText(oldAddress, { exact: true }).first()).toBeVisible();
  await expect(history.getByText(newAddress, { exact: false }).first()).toBeVisible();
  await expect(history.getByText('QA admin', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(`${actor.key}-address-history.png`), animations: 'disabled' });
  expect(errors).toEqual([]);
});
