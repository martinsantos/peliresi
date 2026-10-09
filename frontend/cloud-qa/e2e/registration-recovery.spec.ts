import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';

const actors = [
  { type: 'generador', plural: 'generadores', label: 'Generador', cuit: '99-00000001-0', total: 7 },
  { type: 'operador', plural: 'operadores', label: 'Operador', cuit: '99-20000001-0', total: 8 },
  { type: 'transportista', plural: 'transportistas', label: 'Transporte', cuit: '99-10000001-0', total: 5 },
] as const;
async function create(page: Page, info: TestInfo, type: string) {
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: `127.11.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`, url: 'http://127.0.0.1:4177' }]);
  await page.goto(`${prefix(info)}/inscripcion/${type}`);
  const id = randomUUID();
  await page.getByLabel('Nombre completo *', { exact: true }).fill(`QA ${id}`);
  await page.getByLabel('Email *', { exact: true }).fill(`${id}@night-qa.invalid`);
  await page.getByLabel('CUIT *', { exact: true }).fill(`30-${String(Date.now()).slice(-8)}-1`);
  await page.getByLabel('Contraseña *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await page.getByLabel('Confirmar contraseña *', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/solicitudes/iniciar' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear cuenta y continuar', exact: true }).click();
  const response = await posted; expect(response.status()).toBe(201);
  await expect(page.getByTestId('registration-wizard')).toBeVisible();
  return (await response.json()).data as { solicitudId: string; tokens: { accessToken: string } };
}
async function save(page: Page, id: string) {
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === `/api/solicitudes/${id}` && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  const response = await saved; expect(response.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado en SITREP' })).toBeVisible();
  return (await response.json()).data.solicitud;
}
async function layout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  for (const button of await page.getByRole('button', { name: 'Guardar borrador', exact: true }).all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
}

for (const actor of actors) test(`${actor.type}: current-step recovery, incomplete draft and actual concurrent version protection`, async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [], sends: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => void dialog.accept());
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/enviar')) sends.push(request.url()); });
  const draft = await create(page, info, actor.type);
  await page.getByLabel('Razon Social *', { exact: true }).fill('QA texto escrito sin cambiar de paso');
  await page.getByLabel('Domicilio', { exact: true }).fill('QA domicilio recuperable 900');
  await expect(page.getByRole('status').filter({ hasText: 'este dispositivo' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Razon Social *', { exact: true })).toHaveValue('QA texto escrito sin cambiar de paso');
  await expect(page.getByLabel('Domicilio', { exact: true })).toHaveValue('QA domicilio recuperable 900');
  await page.context().setOffline(true);
  try {
    await page.getByLabel('Razon Social *', { exact: true }).fill('QA cambio offline recuperable');
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No se confirmó el guardado' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'este dispositivo' })).toBeVisible();
  } finally { await page.context().setOffline(false); }
  // Partial and empty required fields are a legitimate draft, never a send.
  await page.getByLabel('Domicilio', { exact: true }).fill('');
  const stored = await save(page, draft.solicitudId);
  expect(stored.estado).toBe('BORRADOR'); expect(JSON.parse(stored.datosActor).domicilio).toBe('');
  const authorization = { Authorization: `Bearer ${draft.tokens.accessToken}` };
  // These are genuine API requests from the session created through the UI,
  // not a response interceptor or an injected fictional browser session.
  const values = JSON.parse(stored.datosActor);
  const concurrent = await Promise.all(['QA A', 'QA B'].map(actividad => page.request.put(`/api/solicitudes/${draft.solicitudId}`, {
    headers: authorization, data: { datosActor: { ...values, actividad }, expectedUpdatedAt: stored.updatedAt },
  })));
  expect(concurrent.map(response => response.status()).sort()).toEqual([200, 409]);
  const stale = page.waitForResponse(response => new URL(response.url()).pathname === `/api/solicitudes/${draft.solicitudId}` && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); expect((await stale).status()).toBe(409);
  await page.getByRole('button', { name: 'Conciliar borrador', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recuperar mis cambios locales', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Recuperar mis cambios locales', exact: true }).click();
  await save(page, draft.solicitudId);
  await layout(page); await page.screenshot({ path: info.outputPath(`${actor.type}-draft-recovered.png`), animations: 'disabled' });
  expect(sends).toEqual([]); expect(errors).toEqual([]);
});

for (const actor of actors) test(`${actor.type}: administrative draft recovers without secrets and exact registry row opens its populated edit form`, async ({ page }, info) => {
  test.setTimeout(90000); await login(page, info);
  const creations: string[] = [], errors: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === `/api/actores/${actor.plural}`) creations.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${prefix(info)}/admin/actores/${actor.plural}/nuevo`);
  await page.getByLabel('Razon Social *', { exact: true }).fill(`QA borrador administrativo ${actor.type}`);
  await page.getByLabel('CUIT *', { exact: true }).fill('30-70876543-1');
  await page.getByLabel('Email *', { exact: true }).fill(`${actor.type}-draft@night-qa.invalid`);
  await expect(page.getByRole('region', { name: 'Borrador del alta' }).getByRole('status')).toContainText('Borrador guardado en este dispositivo');
  await page.reload();
  await page.getByRole('button', { name: 'Recuperar borrador', exact: true }).click();
  await expect(page.getByLabel('Razon Social *', { exact: true })).toHaveValue(`QA borrador administrativo ${actor.type}`);
  await expect(page.getByLabel('Email *', { exact: true })).toHaveValue(`${actor.type}-draft@night-qa.invalid`);
  await layout(page); await page.screenshot({ path: info.outputPath(`${actor.type}-admin-recovered.png`), animations: 'disabled' });
  await page.getByLabel('CUIT *', { exact: true }).fill(actor.cuit);
  await page.getByRole('button', { name: 'Buscar en padrón', exact: true }).click();
  await page.getByRole('button', { name: 'Usar ficha existente', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/actores/${actor.plural}/[^/]+/editar$`));
  await expect(page.getByLabel('Razon Social *', { exact: true })).toHaveValue(`QA ${actor.label} 1`);
  await expect(page.getByLabel('CUIT *', { exact: true })).toHaveValue(actor.cuit);
  expect(creations).toEqual([]); expect(errors).toEqual([]);
});

for (const actor of actors) test(`${actor.type}: verified owner reuses registry instead of creating a duplicate registration`, async ({ page }, info) => {
  test.setTimeout(90000);
  const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
  expect(fixture.database).toBe('sitrep_night_qa_20260926'); expect(fixture.externalDelivery).toBe(false);
  await login(page, info, actor.type);
  const mutations: string[] = [], errors: string[] = [];
  page.on('request', request => { if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && /\/api\/(actores|solicitudes|renovaciones)/.test(request.url())) mutations.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${prefix(info)}/inscripcion/${actor.type}`);
  const registry = page.getByRole('region', { name: 'Datos de tu padrón', exact: true });
  await expect(registry).toContainText(`QA ${actor.label} 1`); await expect(registry).toContainText(actor.cuit);
  await expect(page.getByRole('button', { name: 'Crear cuenta y continuar', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`${actor.type}-verified-registry.png`), animations: 'disabled' });
  if (actor.type === 'transportista') {
    await registry.getByRole('button', { name: 'Revisar mi ficha y documentación', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/mi-perfil$'));
  } else {
    await registry.getByRole('button', { name: 'Revisar mis datos precargados', exact: true }).click();
    await expect(page.getByLabel('Razon Social', { exact: true })).toHaveValue(`QA ${actor.label} 1`);
    const expectedAddress = actor.type === 'generador' ? 'QA Registro 100' : 'QA SIN DOMICILIO REAL';
    await expect(page.getByLabel('Domicilio', { exact: true })).toHaveValue(expectedAddress);
  }
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
});
