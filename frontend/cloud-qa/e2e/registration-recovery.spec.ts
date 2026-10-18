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
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByLabel('Razon Social *', { exact: true })).toBeFocused();
  await page.getByLabel('Razon Social *', { exact: true }).fill('QA texto escrito sin cambiar de paso');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByLabel('Domicilio', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Domicilio', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Recuperar sesión', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Conciliar borrador', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`${actor.type}-field-validation.png`), animations: 'disabled' });
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
  if (actor.type !== 'transportista') {
    await page.getByLabel('Domicilio', { exact: true }).fill('QA domicilio reutilizable 900');
    await page.getByRole('button', { name: new RegExp(`^Paso 3 de ${actor.total}: Domicilios$`) }).click();
    await page.getByRole('button', { name: 'Usar domicilio declarado', exact: true }).click();
    await page.getByRole('button', { name: 'Copiar domicilio legal', exact: true }).click();
    const legal = page.getByRole('region', { name: 'Domicilio legal', exact: true });
    const real = page.getByRole('region', { name: 'Domicilio real', exact: true });
    await real.getByLabel('Calle', { exact: true }).fill('QA planta diferente 901');
    await expect(legal.getByLabel('Calle', { exact: true })).toHaveValue('QA domicilio reutilizable 900');
    await page.getByLabel('Coordenadas Geograficas', { exact: true }).fill('91, -68');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByLabel('Coordenadas Geograficas', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Coordenadas Geograficas', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Coordenadas Geograficas', { exact: true }).fill('0, -68');
    await save(page, draft.solicitudId); await page.reload();
    await expect(real.getByLabel('Calle', { exact: true })).toHaveValue('QA planta diferente 901');
    await expect(legal.getByLabel('Calle', { exact: true })).toHaveValue('QA domicilio reutilizable 900');
    await layout(page); await page.screenshot({ path: info.outputPath(`${actor.type}-address-reused.png`), animations: 'disabled' });
  }
  expect(sends).toEqual([]); expect(errors).toEqual([]);
});

for (const actor of actors) test(`${actor.type}: administrative draft recovers without secrets and exact registry row opens its populated edit form`, async ({ page }, info) => {
  test.setTimeout(90000); await login(page, info);
  const creations: string[] = [], errors: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === `/api/actores/${actor.plural}`) creations.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${prefix(info)}/admin/actores/${actor.plural}/nuevo`);
  await page.getByRole('button', { name: actor.type === 'transportista' ? 'Siguiente' : 'Continuar', exact: true }).click();
  await expect(page.getByLabel('Razon Social *', { exact: true })).toBeFocused();
  await page.getByLabel('Razon Social *', { exact: true }).fill(`QA borrador administrativo ${actor.type}`);
  await page.getByLabel('CUIT *', { exact: true }).fill('30-70876543-1');
  await page.getByLabel('Email *', { exact: true }).fill(`${actor.type}-draft@night-qa.invalid`);
  await expect(page.getByRole('region', { name: 'Borrador del alta' }).getByRole('status')).toContainText('Borrador guardado en este dispositivo');
  await page.reload();
  await page.getByRole('button', { name: 'Recuperar borrador', exact: true }).click();
  await expect(page.getByLabel('Razon Social *', { exact: true })).toHaveValue(`QA borrador administrativo ${actor.type}`);
  await expect(page.getByLabel('Email *', { exact: true })).toHaveValue(`${actor.type}-draft@night-qa.invalid`);
  if (info.project.name !== 'web-desktop') {
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    const field = (await page.getByLabel('Razon Social *', { exact: true }).boundingBox())!;
    expect(field.height).toBeGreaterThanOrEqual(44);
    expect(field.y + field.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.72);
    const information = page.getByRole('button', { name: 'Información del borrador', exact: true });
    await expect(information).toHaveAttribute('aria-expanded', 'false');
    const target = (await information.boundingBox())!; expect(target.height).toBeGreaterThanOrEqual(44); expect(target.width).toBeGreaterThanOrEqual(44);
    console.log(JSON.stringify({ mobileRegistrationFold: actor.type, surface: info.project.name, fieldBottom: field.y + field.height, viewportHeight: page.viewportSize()!.height, maximum: page.viewportSize()!.height * 0.72 }));
  }
  await layout(page); await page.screenshot({ path: info.outputPath(`${actor.type}-admin-recovered.png`), animations: 'disabled' });
  await page.getByLabel('CUIT *', { exact: true }).fill(actor.cuit);
  await page.getByRole('button', { name: 'Buscar en padrón', exact: true }).click();
  await page.getByRole('button', { name: 'Usar ficha existente', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/actores/${actor.plural}/[^/]+/editar$`));
  await expect(page.getByLabel('Razon Social *', { exact: true })).toHaveValue(`QA ${actor.label} 1`);
  await expect(page.getByLabel('CUIT *', { exact: true })).toHaveValue(actor.cuit);
  if (actor.type !== 'transportista') {
    if (info.project.name === 'web-desktop') await page.getByRole('button', { name: /^(?:\d+\. )?Domicilios$/ }).click();
    else await page.getByRole('combobox', { name: 'Paso del registro', exact: true }).selectOption({ label: '2. Domicilios' });
    await expect(page.getByLabel('Coordenadas Geograficas', { exact: true })).toBeVisible();
    const coordinates = page.getByLabel('Coordenadas Geograficas', { exact: true }), original = await coordinates.inputValue();
    await coordinates.fill('not-a-number, -68');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(coordinates).toHaveAttribute('aria-invalid', 'true');
    await expect(coordinates).toBeFocused();
    await expect(coordinates).toHaveValue('not-a-number, -68');
    await coordinates.fill(original);
    await layout(page); await page.screenshot({ path: info.outputPath(`${actor.type}-verified-location.png`), animations: 'disabled' });
  }
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
