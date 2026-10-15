import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
const base = 'http://127.0.0.1:3037/api';
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
async function call(token: string, route: string, method = 'GET', body?: unknown, status = 200, activity?: string) {
  const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
    ...(activity ? { 'X-SITREP-Activity': activity } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data.data;
}
async function login(role: string) {
  const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: role + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200); return (await response.json()).data.tokens.accessToken as string;
}
try {
  const oldManifests = await db.manifiesto.findMany({ orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } });
  const template = await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.generador } });
  const admin = await login('admin');
  for (const [index, surface] of ['web-desktop', 'web-responsive', 'app', 'apk', 'http'].entries()) {
    const name = 'multirol-pending-' + surface;
    const user = await db.usuario.create({ data: { email: name + '@night-qa.invalid', password: template.password,
      nombre: 'QA Multirol pendiente ' + surface, rol: 'GENERADOR', activo: false, emailVerified: true,
      motivoInactividad: 'PENDIENTE_APROBACION', cuit: '30-0000020' + index + '-0' } });
    const first = await db.solicitudInscripcion.create({ data: { usuarioId: user.id, tipoActor: 'GENERADOR', datosActor: JSON.stringify({ razonSocial: user.nombre, cuit: user.cuit }) } });
    if (surface !== 'http') continue;
    const token = await login(name);
    const second = (await call(token, '/solicitudes/actividad-adicional', 'POST', { tipoActor: 'OPERADOR' }, 201)).solicitud;
    await call(token, '/auth/profile', 'GET', undefined, 403, 'OPERADOR');
    assert.equal(await db.usuario.count({ where: { cuit: user.cuit } }), 1);
    for (const application of [second, first]) {
      await db.solicitudInscripcion.update({ where: { id: application.id }, data: { estado: 'EN_REVISION' } });
      await call(admin, '/solicitudes/' + application.id + '/aprobar', 'POST', {});
    }
    const account = await db.usuario.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(account.rol, 'OPERADOR'); // first approval wins the base, second adds its activity
    const fresh = await login(name);
    assert.deepEqual((await call(fresh, '/auth/profile')).user.actividades, ['GENERADOR', 'OPERADOR']);
  }
  // Each UI surface gets its own synthetic account and drafts; no exercise consumes another's records.
  for (const [index, surface] of ['web-desktop', 'web-responsive', 'app', 'apk', 'http'].entries()) {
    const name = 'multirol-' + surface;
    const user = await db.usuario.create({ data: { email: name + '@night-qa.invalid', password: template.password,
      nombre: 'QA Multirol ' + surface, rol: 'GENERADOR', activo: true, emailVerified: true, cuit: '30-0000010' + index + '-0' } });
    await db.generador.create({ data: { usuarioId: user.id, razonSocial: user.nombre, cuit: user.cuit,
      domicilio: 'QA sin domicilio real', telefono: '', email: user.email, numeroInscripcion: 'QA', categoria: 'QA' } });
    const token = await login(name);
    await call(token, '/auth/profile', 'GET', undefined, 403, 'OPERADOR');
    await call(token, '/auth/profile', 'GET', undefined, 403, 'ADMIN');
    await call(token, '/solicitudes/actividad-adicional', 'POST', { tipoActor: 'ADMIN' }, 400);
    await call(token, '/solicitudes/actividad-adicional', 'POST', { tipoActor: 'GENERADOR' }, 409);
    const pending = await Promise.all([1, 2].map(() => call(token, '/solicitudes/actividad-adicional', 'POST', { tipoActor: 'OPERADOR' }, 201)));
    const application = pending[0].solicitud;
    assert.equal(pending[1].solicitud.id, application.id);
    assert.equal(await db.solicitudInscripcion.count({ where: { usuarioId: user.id, tipoActor: 'OPERADOR' } }), 1);
    assert.equal((await call(token, '/auth/profile')).user.rol, 'GENERADOR');
    await call(token, '/auth/profile', 'GET', undefined, 403, 'OPERADOR');
    // Fixture supplies a reviewed dossier, never changes production or bypasses an API authorization.
    await db.solicitudInscripcion.update({ where: { id: application.id }, data: { estado: 'EN_REVISION' } });
    await call(admin, '/solicitudes/' + application.id + '/aprobar', 'POST', {});
    const account = await db.usuario.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(account.rol, 'GENERADOR'); assert.equal(account.activo, true);
    assert.deepEqual((await call(token, '/auth/profile')).user.actividades, ['GENERADOR', 'OPERADOR']);
    assert.equal((await call(token, '/auth/profile', 'GET', undefined, 200, 'OPERADOR')).user.rol, 'OPERADOR');
    assert.equal((await call(token, '/auth/profile')).user.rol, 'GENERADOR', 'request context must not mutate other sessions');
    if (surface !== 'http') continue;
    const rejected = (await call(token, '/solicitudes/actividad-adicional', 'POST', { tipoActor: 'TRANSPORTISTA' }, 201)).solicitud;
    await db.solicitudInscripcion.update({ where: { id: rejected.id }, data: { estado: 'EN_REVISION' } });
    await call(admin, '/solicitudes/' + rejected.id + '/rechazar', 'POST', { motivoRechazo: 'QA rechazo sin quitar actividad vigente' });
    await call(token, '/auth/profile', 'GET', undefined, 403, 'TRANSPORTISTA');
    assert.equal((await call(token, '/auth/profile')).user.rol, 'GENERADOR');
    const record = (await call(token, '/manifiestos/baja-intensidad', 'POST', {
      id: randomUUID(), generador: {}, transportista: { padronId: fixture.actors.transportista },
      motivo: 'QA datos incompletos no impiden registrar', residuos: [{ corriente: 'Y1', cantidad: 5, unidad: 'kg' }],
    }, 201, 'OPERADOR')).registro;
    assert.equal(record.datos.generador.nombre, ''); assert.equal(record.datos.patente, '');
    const ownReview = { id: randomUUID(), version: 0, tipo: 'RESOLVER', objetivo: record.id, nota: 'QA autoaprobación prohibida', decision: 'APROBADA' };
    await call(token, '/manifiestos/baja-intensidad/' + record.id + '/eventos', 'POST', ownReview, 403, 'OPERADOR');
    const requested = (await call(token, '/manifiestos/baja-intensidad/' + record.id + '/eventos', 'POST', {
      id: randomUUID(), version: 0, tipo: 'SOLICITAR_REVISION', objetivo: record.id, nota: 'QA contraparte vinculada',
    }, 200, 'OPERADOR')).registro;
    const carrier = await login('transportista'), unrelated = await login('transportista2');
    await call(unrelated, '/manifiestos/baja-intensidad/' + record.id, 'GET', undefined, 404);
    const command = { ...ownReview, id: randomUUID(), version: requested.version, nota: 'QA aprobación de contraparte' };
    const reviewed = (await call(carrier, '/manifiestos/baja-intensidad/' + record.id + '/eventos', 'POST', command)).registro;
    assert.equal(reviewed.revisiones[0].estado, 'APROBADA'); assert.equal(reviewed.etapa, 'REGISTRADO');
    assert.deepEqual(reviewed.datos, record.datos);
    assert.equal((await call(carrier, '/manifiestos/baja-intensidad/' + record.id + '/eventos', 'POST', command)).registro.version, reviewed.version);
    await db.usuario.update({ where: { id: user.id }, data: { activo: false, motivoInactividad: 'SUSPENDIDA' } });
    await call(token, '/auth/profile', 'GET', undefined, 401, 'OPERADOR');
  }
  assert.deepEqual(await db.manifiesto.findMany({ orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } }), oldManifests);
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'party-multirole-http.json'), JSON.stringify({ passed: true, cases: [
    'additional activity idempotent/concurrent without creating duplicate identity', 'pending and privileged roles denied',
    'approval preserves base activity; per-request role never alters other sessions', 'rejection preserves existing grant',
    'suspension revokes every activity', 'empty external identities accepted, canonical registered participant preserved',
    'linked counterpart approval, outsiders/self-review denied, replay idempotent', 'all pre-existing synthetic manifests byte-identical',
  ] }, null, 2));
} finally { await db.$disconnect(); }
