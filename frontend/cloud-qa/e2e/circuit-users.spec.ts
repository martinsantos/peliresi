import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertCloudDatabase } from '../safety';
import { login, prefix, readableFixedAction } from './helpers';

async function ownApi(page: Page, path: string) {
  return page.evaluate(async path => {
    const response = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + localStorage.getItem('sitrep_access_token') } });
    return { status: response.status, body: await response.json() };
  }, path);
}
async function createUser(page: Page, info: TestInfo, role = 'Generador') {
  await login(page, info); await page.goto(`${prefix(info)}/admin/usuarios`);
  await page.getByRole('button', { name: 'Nuevo Usuario', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Nuevo Usuario', exact: true });
  const email = `circuit-${randomUUID().slice(0, 8)}@night-qa.invalid`;
  await modal.getByLabel('Nombre', { exact: true }).fill('María del Valle');
  await modal.getByLabel('Apellido', { exact: true }).fill('De la Cruz');
  await modal.getByLabel('Email', { exact: true }).fill(email);
  await modal.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  await modal.getByLabel('Telefono', { exact: true }).fill('0000000000');
  await modal.getByRole('button', { name: 'Rol', exact: true }).click();
  await page.getByRole('option', { name: role, exact: true }).click();
  await modal.getByLabel('Sector/Empresa', { exact: true }).fill('QA empresa artificial');
  await readableFixedAction(modal.getByRole('button', { name: 'Crear Usuario', exact: true }), modal);
  const created = page.waitForResponse(r => r.url().endsWith('/api/admin/usuarios') && r.request().method() === 'POST');
  await modal.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
  const result = await created; expect(result.status()).toBe(201);
  const user = (await result.json()).data.usuario;
  expect(user).toMatchObject({ email, nombre: 'María del Valle', apellido: 'De la Cruz' });
  await expect(modal).not.toBeVisible(); await page.getByLabel('Buscar usuarios', { exact: true }).fill(email);
  await expect(page.getByText(email, { exact: true }).filter({ visible: true })).toHaveCount(1);
  await page.getByText(email, { exact: true }).filter({ visible: true }).click();
  return user;
}

test('user edit preserves compound names and explicitly clears optional fields', async ({ page }, info) => {
  const user = await createUser(page, info);
  await page.getByRole('dialog', { name: 'Detalle de Usuario' }).getByRole('button', { name: 'Editar', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar Usuario' });
  await edit.getByLabel('Telefono', { exact: true }).fill('0000000001');
  await page.screenshot({ path: info.outputPath('user-edit-before-save.png'), animations: 'disabled' });
  const saved = page.waitForResponse(r => r.url().endsWith(`/api/admin/usuarios/${user.id}`) && r.request().method() === 'PUT');
  await edit.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  expect((await saved).status()).toBe(200); await expect(edit).not.toBeVisible();
  const current = await ownApi(page, `/admin/usuarios/${user.id}`);
  expect(current.status).toBe(200);
  expect(current.body.data.usuario).toMatchObject({ nombre: 'María del Valle', apellido: 'De la Cruz', telefono: '0000000001' });
  await page.getByText(user.email, { exact: true }).filter({ visible: true }).click();
  await page.getByRole('dialog', { name: 'Detalle de Usuario' }).getByRole('button', { name: 'Editar', exact: true }).click();
  await edit.getByLabel('Telefono', { exact: true }).fill('');
  await expect(edit.getByLabel('Telefono', { exact: true })).toHaveValue('');
  await edit.getByLabel('Empresa / Sector', { exact: true }).fill('');
  await expect(edit.getByLabel('Telefono', { exact: true })).toHaveValue('');
  const cleared = page.waitForResponse(r => r.url().endsWith(`/api/admin/usuarios/${user.id}`) && r.request().method() === 'PUT');
  await edit.getByRole('button', { name: 'Guardar cambios', exact: true }).click(); expect((await cleared).status()).toBe(200); await expect(edit).not.toBeVisible();
  expect((await ownApi(page, `/admin/usuarios/${user.id}`)).body.data.usuario).toMatchObject({ telefono: '', empresa: '' });
  await page.screenshot({ path: info.outputPath('user-edited.png'), animations: 'disabled' });
});

test('a disabled verified user remains inactive and appears in the inactive filter', async ({ page }, info) => {
  const user = await createUser(page, info);
  const detail = page.getByRole('dialog', { name: 'Detalle de Usuario' });
  const changed = page.waitForResponse(r => r.url().endsWith(`/api/admin/usuarios/${user.id}/toggle-activo`));
  await detail.getByRole('button', { name: /Desactivar/ }).click(); expect((await changed).status()).toBe(200);
  await expect(detail).not.toBeVisible();
  await page.getByText(user.email, { exact: true }).filter({ visible: true }).click();
  await page.screenshot({ path: info.outputPath('user-disabled-detail.png'), animations: 'disabled' });
  await expect(detail.getByText('Inactivo', { exact: true })).toBeVisible();
  await expect(detail.getByText('Pendiente', { exact: true })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await page.getByRole('button', { name: 'Estado', exact: true }).click();
  await page.getByRole('option', { name: 'Inactivos', exact: true }).click();
  await expect(page.getByText(user.email, { exact: true }).filter({ visible: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('user-disabled-filter.png'), animations: 'disabled' });
});

test('validation and a failed connection preserve the edit and allow a single deliberate retry', async ({ page }, info) => {
  const user = await createUser(page, info);
  await page.getByRole('dialog', { name: 'Detalle de Usuario' }).getByRole('button', { name: 'Editar', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar Usuario' });
  const route = `**/api/admin/usuarios/${user.id}`;
  let attempts = 0;
  page.on('request', request => { if (request.url().endsWith(`/api/admin/usuarios/${user.id}`) && request.method() === 'PUT') attempts++; });
  await edit.getByLabel('Nombre', { exact: true }).fill(' ');
  await edit.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(edit.getByText('Ingresá el nombre.', { exact: true })).toBeVisible();
  expect(attempts).toBe(0);
  await edit.getByLabel('Nombre', { exact: true }).fill('María del Valle');
  await edit.getByLabel('Telefono', { exact: true }).fill('0000000002');
  await page.route(route, async interception => {
    if (interception.request().method() === 'PUT') await interception.abort('connectionfailed');
    else await interception.continue();
  });
  await edit.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(edit.getByRole('alert')).toContainText('No se pudo actualizar el usuario');
  await expect(edit.getByRole('alert')).toBeInViewport({ ratio: 1 });
  await edit.getByRole('alert').click({ trial: true });
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel('Telefono', { exact: true })).toHaveValue('0000000002');
  await expect(edit.getByLabel('Apellido', { exact: true })).toHaveValue('De la Cruz');
  expect((await ownApi(page, `/admin/usuarios/${user.id}`)).body.data.usuario.telefono).toBe('0000000000');
  expect(attempts).toBe(1);
  await page.screenshot({ path: info.outputPath('user-recoverable-network-error.png'), animations: 'disabled' });
  await page.unroute(route);
  const saved = page.waitForResponse(response => response.url().endsWith(`/api/admin/usuarios/${user.id}`) && response.request().method() === 'PUT');
  await edit.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  expect((await saved).status()).toBe(200); await expect(edit).not.toBeVisible();
  expect(attempts).toBe(2);
  expect((await ownApi(page, `/admin/usuarios/${user.id}`)).body.data.usuario).toMatchObject({ nombre: 'María del Valle', apellido: 'De la Cruz', telefono: '0000000002' });
});


for (const actor of [
  { role: 'Generador', key: 'generador', path: 'generadores' },
  { role: 'Transportista', key: 'transportista', path: 'transportistas' },
  { role: 'Operador', key: 'operador', path: 'operadores' },
]) {
  test(`${actor.key}: account lifecycle revokes access, restores it and requires explicit deletion`, async ({ page }, info) => {
    await assertCloudDatabase();
    const user = await createUser(page, info, actor.role);
    const authenticate = () => page.request.post('/api/auth/login', { data: { email: user.email, password: 'OnlyLocal-NightQA-2026!' } });
    const first = await authenticate(); expect(first.status()).toBe(200);
    const originalToken = (await first.json()).data.tokens.accessToken;
    const detail = page.getByRole('dialog', { name: 'Detalle de Usuario', exact: true });
    let toggled = page.waitForResponse(r => r.url().endsWith(`/api/admin/usuarios/${user.id}/toggle-activo`) && r.request().method() === 'PATCH');
    await detail.getByRole('button', { name: 'Desactivar', exact: true }).click(); expect((await toggled).status()).toBe(200);
    expect((await authenticate()).status()).toBe(403);
    const expired = await page.request.get('/api/auth/profile', { headers: { Authorization: 'Bearer ' + originalToken } });
    expect([401, 403]).toContain(expired.status());
    await expect(detail).not.toBeVisible();
    await page.getByText(user.email, { exact: true }).filter({ visible: true }).click();
    await expect(detail.getByText('Inactivo', { exact: true })).toBeVisible();
    toggled = page.waitForResponse(r => r.url().endsWith(`/api/admin/usuarios/${user.id}/toggle-activo`) && r.request().method() === 'PATCH');
    await detail.getByRole('button', { name: 'Activar', exact: true }).click(); expect((await toggled).status()).toBe(200);
    expect((await authenticate()).status()).toBe(200);
    await expect(detail).not.toBeVisible();
    await page.getByRole('button', { name: 'Ver como tarjetas', exact: true }).click();
    const remove = page.getByRole('button', { name: /^Eliminar a / }).filter({ visible: true });
    await expect(remove).toHaveCount(1); await remove.click();
    const confirmation = page.getByRole('dialog', { name: 'Eliminar Usuario', exact: true });
    await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect((await ownApi(page, '/admin/usuarios/' + user.id)).status).toBe(200);
    await remove.click();
    await page.screenshot({ path: info.outputPath(actor.key + '-delete-confirmation.png'), animations: 'disabled' });
    const deleted = page.waitForResponse(r => r.url().endsWith(`/api/admin/usuarios/${user.id}`) && r.request().method() === 'DELETE');
    await confirmation.getByRole('button', { name: 'Si, eliminar', exact: true }).click(); expect((await deleted).status()).toBe(200);
    await expect(confirmation).not.toBeVisible();
    await expect(page.getByText(user.email, { exact: true }).filter({ visible: true })).toHaveCount(0);
    expect((await ownApi(page, '/admin/usuarios/' + user.id)).status).toBe(404);
  });

  test(`${actor.key}: historical actor and account deletion are refused without losing their manifest`, async ({ page }, info) => {
    await assertCloudDatabase();
    const fixture = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/fixture.json', 'utf8'));
    expect(fixture.externalDelivery).toBe(false);
    await login(page, info); await page.goto(prefix(info) + '/admin/usuarios');
    const original = await ownApi(page, '/manifiestos/manifest-qa-legacy'); expect(original.status).toBe(200);
    const user = await ownApi(page, '/admin/usuarios/' + fixture.users[actor.key]); expect(user.status).toBe(200);
    await page.getByLabel('Buscar usuarios', { exact: true }).fill(user.body.data.usuario.email);
    await expect(page.getByText(user.body.data.usuario.email, { exact: true }).filter({ visible: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Ver como tarjetas', exact: true }).click();
    const fullName = [user.body.data.usuario.nombre, user.body.data.usuario.apellido].filter(Boolean).join(' ');
    const remove = page.getByRole('button', { name: 'Eliminar a ' + fullName, exact: true }).filter({ visible: true });
    await expect(remove).toHaveCount(1); await remove.click();
    const confirmation = page.getByRole('dialog', { name: 'Eliminar Usuario', exact: true });
    const denied = page.waitForResponse(r => r.url().endsWith('/api/admin/usuarios/' + fixture.users[actor.key]) && r.request().method() === 'DELETE');
    await confirmation.getByRole('button', { name: 'Si, eliminar', exact: true }).click();
    expect((await denied).status()).toBe(400);
    await expect(confirmation.getByRole('alert')).toContainText('tiene manifiestos');
    await expect(confirmation.getByRole('alert')).toBeInViewport({ ratio: 1 });
    await confirmation.getByRole('alert').click({ trial: true });
    await expect(confirmation).toBeVisible();
    await page.screenshot({ path: info.outputPath(actor.key + '-history-protected.png'), animations: 'disabled' });
    await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
    const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
    const actorDenied = await page.request.delete('/api/actores/' + actor.path + '/' + fixture.actors[actor.key], { headers: { Authorization: 'Bearer ' + token } });
    expect(actorDenied.status()).toBe(400); expect((await actorDenied.json()).message).toMatch(/manifiestos/);
    expect((await ownApi(page, '/admin/usuarios/' + fixture.users[actor.key])).body).toEqual(user.body);
    expect((await ownApi(page, '/manifiestos/manifest-qa-legacy')).body).toEqual(original.body);
  });
}

test('create validation and a duplicate account stay readable inside the form without losing entered data', async ({ page }, info) => {
  await assertCloudDatabase();
  const user = await createUser(page, info);
  await page.getByRole('dialog', { name: 'Detalle de Usuario' }).getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await page.getByRole('button', { name: 'Nuevo Usuario', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Nuevo Usuario', exact: true });
  await form.getByLabel('Nombre', { exact: true }).fill('QA dato conservado');
  await form.getByLabel('Email', { exact: true }).fill(user.email);
  await form.getByLabel('Contraseña', { exact: true }).fill('corta');
  await form.getByRole('button', { name: 'Rol', exact: true }).click();
  await page.getByRole('option', { name: 'Generador', exact: true }).click();
  let attempts = 0;
  page.on('request', request => { if (request.url().endsWith('/api/admin/usuarios') && request.method() === 'POST') attempts++; });
  await form.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('al menos 8');
  await expect(form.getByRole('alert')).toBeInViewport({ ratio: 1 });
  await form.getByRole('alert').click({ trial: true }); expect(attempts).toBe(0);
  await form.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const denied = page.waitForResponse(r => r.url().endsWith('/api/admin/usuarios') && r.request().method() === 'POST');
  await form.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
  expect((await denied).status()).toBe(400); expect(attempts).toBe(1);
  await expect(form.getByRole('alert')).toContainText('Ya existe un usuario con ese email');
  await expect(form.getByRole('alert')).toBeInViewport({ ratio: 1 });
  await form.getByRole('alert').click({ trial: true });
  await expect(form.getByLabel('Nombre', { exact: true })).toHaveValue('QA dato conservado');
  await expect(form.getByLabel('Email', { exact: true })).toHaveValue(user.email);
  await page.screenshot({ path: info.outputPath('create-error-inside-dialog.png'), animations: 'disabled' });
  expect((await ownApi(page, '/admin/usuarios/' + user.id)).body.data.usuario.nombre).toBe('María del Valle');
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo Usuario', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveCount(0);
  await expect(form.getByLabel('Email', { exact: true })).toHaveValue('');
});
