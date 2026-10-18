/** Real HTTP checks for own-profile edits and shared-device push ownership, only in the isolated cloud DB. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const api = 'http://127.0.0.1:3037/api';
const password = 'OnlyLocal-NightQA-2026!';
async function request(route: string, method: string, body?: unknown, token?: string, expected = 200) {
  const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(result)}`);
  return result;
}
const login = async (user: string) => (await request('/auth/login', 'POST', { email: user + '@night-qa.invalid', password })).data;
const checks: string[] = [];
try {
  const generador = await login('generador');
  const token = generador.tokens.accessToken, id = generador.user.id;
  const before = await db.usuario.findUnique({ where: { id }, select: { nombre: true, telefono: true, rol: true, email: true } });

  await request('/admin/usuarios/' + id, 'PUT', { telefono: '261-000' }, token, 403);
  const saved = await request('/auth/profile', 'PUT', { telefono: '261-555-QA' }, token);
  assert.equal(saved.data.usuario.telefono, '261-555-QA');
  const profile = await request('/auth/profile', 'GET', undefined, token);
  assert.equal(profile.data.user.telefono, '261-555-QA');
  const audit = await db.auditoria.findFirst({ where: { usuarioId: id, accion: 'UPDATE_PERFIL_PROPIO' }, orderBy: { createdAt: 'desc' } });
  assert.ok(audit, 'own profile change is audited');
  assert.equal(JSON.parse(audit.datosAntes).telefono, before.telefono);
  checks.push('non-admin saves own phone through /auth/profile (admin route still 403) with audit before/after');

  for (const forbidden of [{ rol: 'ADMIN' }, { email: 'otro@night-qa.invalid' }, { activo: false }, { esInspector: true }]) {
    const refused = await request('/auth/profile', 'PUT', forbidden, token, 400);
    assert.equal(refused.message, 'Sólo podés modificar tu nombre y tu teléfono');
  }
  const after = await db.usuario.findUnique({ where: { id }, select: { rol: true, email: true, activo: true, esInspector: true } });
  assert.equal(after.rol, before.rol); assert.equal(after.email, before.email);
  checks.push('role, email, activation and inspector flags cannot be changed through the own-profile route');
  // Restore the fixture phone (a null fixture phone becomes an empty string; no fixture asserts it).
  await request('/auth/profile', 'PUT', { telefono: before.telefono ?? '' }, token);

  const endpoint = 'https://push.night-qa.invalid/shared-device';
  const subscription = { endpoint, keys: { p256dh: 'qa-p256dh', auth: 'qa-auth' } };
  await request('/push/subscribe', 'POST', subscription, token);
  assert.equal((await db.pushSubscripcion.findUnique({ where: { endpoint } })).usuarioId, id);
  const operador = await login('operador');
  await request('/push/unsubscribe', 'POST', { endpoint }, operador.tokens.accessToken);
  assert.ok(await db.pushSubscripcion.findUnique({ where: { endpoint } }), 'another person cannot remove this device subscription');
  await request('/push/subscribe', 'POST', subscription, operador.tokens.accessToken);
  assert.equal((await db.pushSubscripcion.findUnique({ where: { endpoint } })).usuarioId, operador.user.id);
  checks.push('a shared device subscription moves to the person signed in now; others cannot remove it');
  await request('/push/unsubscribe', 'POST', { endpoint }, operador.tokens.accessToken);
  assert.equal(await db.pushSubscripcion.findUnique({ where: { endpoint } }), null);
  checks.push('logout release removes the caller own subscription');

  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'own-profile-push-http.json'), JSON.stringify({ status: 'passed', checks }, null, 2));
  console.log(checks.join('\n'));
} finally {
  await db.$disconnect();
}
