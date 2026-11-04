import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { login, prefix, readableFixedAction } from './helpers';

test('baseline: a lost opening response followed by reload can create a second inspection', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN !== 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  let first: { id: string; numero: string } | undefined;
  let firstClientId = '';
  const description = `QA apertura artificial respuesta perdida ${info.project.name}`;
  await page.route('**/api/inspecciones', async (route) => {
    if (route.request().method() !== 'POST' || first) return route.fallback();
    firstClientId = route.request().postDataJSON().clienteId;
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    first = (await response.json()).data;
    await route.abort('failed');
  });
  async function fill() {
    await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
    await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
    await page.getByLabel('Descripción inicial').fill(description);
  }
  await fill();
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  await expect.poll(() => first?.id).toBeTruthy();
  await page.reload();
  await page.unrouteAll({ behavior: 'wait' });
  await fill();
  const created = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const second = (await response.json()).data;
  expect(second.id).not.toBe(first!.id);
  expect(response.request().postDataJSON().clienteId).not.toBe(firstClientId);
  writeFileSync(info.outputPath('duplicate.json'), JSON.stringify({ synthetic: true, first: first!.id, second: second.id, distinctKeys: true }));
});

test('lost response is recovered with the same opening after reload and a later permission error', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  let first: { id: string; numero: string } | undefined;
  let original: unknown;
  const description = `QA apertura recuperable ${info.project.name}`;
  await page.route('**/api/inspecciones', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    original = route.request().postDataJSON();
    const response = await route.fetch(); expect(response.status()).toBe(201); first = (await response.json()).data;
    await route.abort('failed');
  }, { times: 1 });
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill(description);
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  await expect.poll(() => first?.id).toBeTruthy();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog).toContainText('Envío sin confirmar');
  await expect(dialog.getByLabel('Descripción inicial')).toBeDisabled();
  await page.reload();
  await expect(page.getByText('Hay una apertura que necesita confirmación.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(dialog.getByLabel('Descripción inicial')).toHaveValue(description);
  await expect(dialog.getByRole('button', { name: 'Comprobar envío', exact: true })).toBeEnabled();
  await readableFixedAction(dialog.getByRole('button', { name: 'Comprobar envío', exact: true }), dialog);
  await page.screenshot({ path: info.outputPath('pending-opening.png'), animations: 'disabled' });
  await page.route('**/api/inspecciones', async route => {
    expect(route.request().postDataJSON()).toEqual(original);
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'QA permiso temporal' }) });
  }, { times: 1 });
  await dialog.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
  await expect(dialog).toContainText('No pudimos confirmar si se creó');
  await expect(dialog.getByLabel('Descripción inicial')).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  const replay = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
  const response = await replay; expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual(original);
  expect((await response.json()).data.id).toBe(first!.id);
  await expect(page).toHaveURL(new RegExp('/inspecciones/' + first!.id));
  await page.goto(`${prefix(info)}/inspecciones`);
  await expect(page.getByText(`Apertura confirmada: ${first!.numero}.`)).toBeVisible();
  writeFileSync(info.outputPath('recovered.json'), JSON.stringify({ synthetic: true, surface: info.project.name, id: first!.id, sameRequest: true }));
});

test('unsent draft survives reload and another tab cannot overwrite it', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA texto conservado al cerrar');
  await page.getByLabel('Ubicación prevista').fill('QA lugar conservado');
  const other = await page.context().newPage();
  try {
    await other.goto(`${prefix(info)}/inspecciones`);
    await other.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
    await expect(other.getByRole('dialog')).toContainText('Otra pestaña está editando');
    await page.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
    await other.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(other.getByLabel('Descripción inicial')).toHaveValue('QA texto conservado al cerrar');
    await expect(other.getByLabel('Descripción inicial')).toBeEnabled();
    await other.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
  } finally { await other.close(); }
  await page.reload();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(page.getByLabel('Descripción inicial')).toHaveValue('QA texto conservado al cerrar');
  await expect(page.getByLabel('Ubicación prevista')).toHaveValue('QA lugar conservado');
});

test('storage failure keeps the form open and prevents sending until saved', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__qaOriginalSetItem = original;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('sitrep:inspection-opening:v1:')) throw new DOMException('QA storage full', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.getByLabel('Descripción inicial').fill('QA conservar aunque falle el almacenamiento');
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog).toContainText('No se guardó en este dispositivo');
  await expect(dialog.getByRole('button', { name: 'Crear expediente', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = (window as any).__qaOriginalSetItem; });
  await dialog.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Crear expediente', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(page.getByLabel('Descripción inicial')).toHaveValue('QA conservar aunque falle el almacenamiento');
});

test('a confirmed opening survives failure to save its receipt locally', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill(`QA comprobante local ${info.project.name}`);
  let savedId = '';
  await page.route('**/api/inspecciones', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(201); savedId = (await response.json()).data.id;
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.startsWith('sitrep:inspection-opening:v1:')) throw new DOMException('QA storage full', 'QuotaExceededError'); return original.call(this, key, value); };
    });
    await route.fulfill({ response });
  }, { times: 1 });
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog).toContainText('Apertura confirmada');
  await expect(dialog).toContainText('No se guardó en este dispositivo');
  await expect(dialog.getByRole('button', { name: 'Crear otra inspección', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  const replay = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
  const response = await replay; expect(response.status()).toBe(201);
  expect((await response.json()).data.id).toBe(savedId);
  await expect(page).toHaveURL(new RegExp('/inspecciones/' + savedId));
  writeFileSync(info.outputPath('receipt-recovered.json'), JSON.stringify({ synthetic: true, surface: info.project.name, id: savedId }));
});

test('a 404 after creation stays uncertain and cannot be discarded as a rejection', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill(`QA respuesta 404 posterior ${info.project.name}`);
  let createdId = '';
  await page.route('**/api/inspecciones', async route => {
    const upstream = await route.fetch(); expect(upstream.status()).toBe(201); createdId = (await upstream.json()).data.id;
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'QA lectura posterior fallida' }) });
  }, { times: 1 });
  const first = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  expect((await first).status()).toBe(404);
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog).toContainText('Envío sin confirmar');
  await expect(dialog).toContainText('No pudimos confirmar si se creó');
  await expect(dialog.getByRole('button', { name: 'Corregir datos', exact: true })).toHaveCount(0);
  const replay = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
  const response = await replay; expect(response.status()).toBe(201);
  expect((await response.json()).data.id).toBe(createdId);
});

test('a failed list refresh does not turn a confirmed opening into a rejection', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill(`QA recarga fallida ${info.project.name}`);
  let failedRefreshes = 0;
  await page.route('**/api/inspecciones?*', route => { failedRefreshes++; return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  const opening = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const response = await opening; expect(response.status()).toBe(201);
  const created = (await response.json()).data;
  await expect(page).toHaveURL(new RegExp('/inspecciones/' + created.id));
  await expect.poll(() => failedRefreshes).toBeGreaterThan(0);
});

test('an explicit first rejection permits correction and a new opening', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA descripción a corregir');
  let rejectedKey = '';
  await page.route('**/api/inspecciones', async route => {
    rejectedKey = route.request().postDataJSON().clienteId;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'QA datos rechazados' }) });
  }, { times: 1 });
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog).toContainText('La apertura no se registró');
  await dialog.getByRole('button', { name: 'Corregir datos', exact: true }).click();
  await page.getByLabel('Descripción inicial').fill('QA descripción corregida');
  const submitted = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  const response = await submitted;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON().clienteId).not.toBe(rejectedKey);
  expect(response.request().postDataJSON().observaciones).toBe('QA descripción corregida');
});

test('a session change before the click cannot dispatch the old account opening', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA cambio previo de sesión');
  let sent = 0;
  page.on('request', request => { if (request.url().endsWith('/api/inspecciones') && request.method() === 'POST') sent++; });
  await page.evaluate(() => {
    window.addEventListener('click', () => localStorage.removeItem('sitrep_access_token'), { once: true, capture: true });
  });
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  await page.waitForTimeout(300);
  expect(sent).toBe(0);
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => {
    if (!key.startsWith('sitrep:inspection-opening:v1:')) return false;
    try { return Boolean(JSON.parse(localStorage.getItem(key) || '{}').command); } catch { return true; }
  }))).toBe(false);
  await expect(page.getByLabel('Descripción inicial')).toHaveValue('QA cambio previo de sesión');
});

test('a session change after dispatch keeps the request bound to the original account', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA cambio de sesión durante el envío');
  let sent = 0;
  const originalToken = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
  expect(originalToken).toBeTruthy();
  let matchedOriginal = false;
  page.on('request', request => {
    if (request.url().endsWith('/api/inspecciones') && request.method() === 'POST') {
      sent++;
      if (sent === 1) matchedOriginal = request.headers().authorization === `Bearer ${originalToken}`;
    }
  });
  await page.evaluate(() => {
    (window as any).__qaOpeningToken = localStorage.getItem('sitrep_access_token');
    window.addEventListener('click', () => localStorage.removeItem('sitrep_access_token'), { once: true });
  });
  const firstResponse = page.waitForResponse(result => result.url().endsWith('/api/inspecciones') && result.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => {
    if (!key.startsWith('sitrep:inspection-opening:v1:')) return false;
    try { const draft = JSON.parse(localStorage.getItem(key) || '{}'); return draft.command?.status === 'pending' && draft.command.attempts === 1; } catch { return false; }
  }))).toBe(true);
  const first = await firstResponse;
  expect(first.status()).toBe(201);
  const originalId = (await first.json()).data.id;
  expect(sent).toBe(1);
  expect(matchedOriginal).toBe(true);
  await page.evaluate(() => localStorage.setItem('sitrep_access_token', (window as any).__qaOpeningToken));
  await page.reload();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  const response = page.waitForResponse(result => result.url().endsWith('/api/inspecciones') && result.request().method() === 'POST');
  await page.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
  const replay = await response;
  expect(replay.status()).toBe(201);
  expect((await replay.json()).data.id).toBe(originalId);
  expect(sent).toBe(2);
});

test('reconnection never sends the opening without a new user action', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA desconexión y reintento explícito');
  let sent = 0;
  page.on('request', request => { if (request.url().endsWith('/api/inspecciones') && request.method() === 'POST') sent++; });
  await page.context().setOffline(true);
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog).toContainText('no se enviará automáticamente');
  await expect(dialog.getByRole('button', { name: 'Crear expediente', exact: true })).toBeDisabled();
  await page.context().setOffline(false);
  await expect(dialog.getByRole('button', { name: 'Crear expediente', exact: true })).toBeEnabled();
  expect(sent).toBe(0);
  const response = page.waitForResponse(result => result.url().endsWith('/api/inspecciones') && result.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  expect((await response).status()).toBe(201);
  expect(sent).toBe(1);
});

test('the saved opening stays with its account after a real sign-out', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  async function signOut() {
    if (info.project.name === 'app') {
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
      await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).click();
    } else {
      await page.getByRole('button', { name: /^Mi Cuenta/ }).click();
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    }
    await expect(page).toHaveURL(new RegExp(`${prefix(info)}/login$`));
  }
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA borrador privado del inspector');
  await page.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
  await signOut();
  await login(page, info, 'admin');
  await page.goto(`${prefix(info)}/inspecciones`);
  await expect(page.getByText('Hay una apertura guardada en este dispositivo.')).toHaveCount(0);
  await signOut();
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(page.getByLabel('Descripción inicial')).toHaveValue('QA borrador privado del inspector');
});

test('a failed actor catalogue is explained and the selection can be retried', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  let failed = 0;
  const block = async (route: import('@playwright/test').Route) => { failed++; await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); };
  await page.route('**/api/catalogos/generadores*', block);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog.getByText('No pudimos consultar los actores. Reintentá para elegir uno.')).toBeVisible({ timeout: 25_000 });
  expect(failed).toBeGreaterThan(0);
  await expect(dialog.getByRole('button', { name: 'Crear expediente', exact: true })).toBeDisabled();
  await page.unroute('**/api/catalogos/generadores*', block);
  await dialog.getByRole('button', { name: 'Reintentar actores', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Actor inspeccionado', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  await expect(dialog.getByText('Seleccioná el actor inspeccionado o indicá que aún no está identificado.')).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Actor inspeccionado', exact: true })).toBeFocused();
});

test('the draft survives closing and reopening the browser profile', async ({ playwright }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  const profile = info.outputPath('synthetic-browser-profile');
  const options = { headless: true, baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' as const,
    viewport: info.project.name === 'app' ? { width: 320, height: 800 } : { width: 1365, height: 900 } };
  let context = await playwright.chromium.launchPersistentContext(profile, options);
  try {
    const page = context.pages()[0] || await context.newPage();
    await login(page, info, 'inspector');
    await page.goto(`${prefix(info)}/inspecciones`);
    await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
    await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
    await page.getByLabel('Descripción inicial').fill('QA texto después de cerrar el navegador');
    await context.close();
    context = await playwright.chromium.launchPersistentContext(profile, options);
    const restored = context.pages()[0] || await context.newPage();
    await restored.goto(`${prefix(info)}/inspecciones`);
    await restored.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
    await expect(restored.getByLabel('Descripción inicial')).toHaveValue('QA texto después de cerrar el navegador');
  } finally { await context.close(); }
});

test('web and app recover the same draft within one browser profile and context', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('ESPONTANEA');
  await page.getByLabel('Descripción inicial').fill('QA recuperación compartida web y app');
  await page.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
  await page.goto(`${info.project.name === 'app' ? '' : '/app'}/inspecciones`);
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(page.getByLabel('Descripción inicial')).toHaveValue('QA recuperación compartida web y app');
});

test('opening actions remain readable and reachable at five viewport widths', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  await login(page, info, 'inspector');
  await page.goto(`${prefix(info)}/inspecciones`);
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog.getByRole('combobox', { name: 'Tipo de inspección', exact: true })).toBeEnabled();
  for (const width of [320, 393, 768, 1365, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
    await expect.poll(() => dialog.getByRole('button', { name: 'Crear expediente', exact: true }).evaluate(element => {
      const rect = element.getBoundingClientRect(), viewport = window.visualViewport;
      return rect.left >= (viewport?.offsetLeft || 0) - 1 && rect.right <= (viewport ? viewport.offsetLeft + viewport.width : innerWidth) + 1
        && rect.top >= (viewport?.offsetTop || 0) - 1 && rect.bottom <= (viewport ? viewport.offsetTop + viewport.height : innerHeight) + 1;
    })).toBe(true);
    await readableFixedAction(dialog.getByRole('button', { name: 'Volver', exact: true }), dialog);
    await readableFixedAction(dialog.getByRole('button', { name: 'Crear expediente', exact: true }), dialog);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect.poll(() => dialog.getByRole('button', { name: 'Crear expediente', exact: true }).evaluate(element => {
    const rect = element.getBoundingClientRect(); return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1;
  })).toBe(true);
  await readableFixedAction(dialog.getByRole('button', { name: 'Crear expediente', exact: true }), dialog);
  await readableFixedAction(dialog.getByRole('button', { name: 'Volver', exact: true }), dialog);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('an opening from a PSIP antecedent survives a lost response without another link', async ({ page }, info) => {
  test.skip(process.env.QA_OPENING_RUN === 'before');
  const suffix = process.env.QA_INTAKE_RUN || '';
  expect(suffix).toMatch(/^[a-z0-9-]*$/);
  const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, `intake-fixture${suffix ? '-' + suffix : ''}.json`), 'utf8'));
  expect(fixture.synthetic).toBe(true);
  const source = fixture.cases[info.project.name];
  await login(page, info, 'admin');
  await page.goto(`${prefix(info)}/inspecciones?vista=antecedentes`);
  const queue = page.getByRole('region', { name: 'Antecedentes para inspección', exact: true });
  await queue.getByLabel('Buscar antecedente').fill(source.referencia);
  await queue.getByRole('button', { name: new RegExp(source.referencia) }).click();
  await queue.getByRole('button', { name: 'Abrir inspección', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección' });
  await expect(dialog).toContainText(source.referencia);
  await dialog.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(dialog).toContainText(source.referencia);
  await dialog.getByLabel('Inspector asignado').selectOption(fixture.inspectorId);
  let first: { id: string } | undefined;
  let original: any;
  await page.route('**/api/inspecciones', async route => {
    original = route.request().postDataJSON();
    expect(original.antecedenteId).toBe(source.id); expect(original.actorId).toBe(source.actorId);
    const response = await route.fetch(); expect(response.status()).toBe(201); first = (await response.json()).data;
    await route.abort('failed');
  }, { times: 1 });
  await dialog.getByRole('button', { name: 'Crear expediente', exact: true }).click();
  await expect.poll(() => first?.id).toBeTruthy();
  await expect(dialog).toContainText('Envío sin confirmar');
  await page.reload();
  await page.getByRole('button', { name: 'Continuar apertura', exact: true }).click();
  await expect(dialog).toContainText(source.referencia);
  const replay = page.waitForResponse(response => response.url().endsWith('/api/inspecciones') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Comprobar envío', exact: true }).click();
  const response = await replay; expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual(original);
  expect((await response.json()).data.id).toBe(first!.id);
  writeFileSync(info.outputPath('intake-recovered.json'), JSON.stringify({ synthetic: true, surface: info.project.name, inspectionId: first!.id, sourceId: source.id }));
});
