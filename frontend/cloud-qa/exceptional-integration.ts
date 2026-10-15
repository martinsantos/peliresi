import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const url = 'http://127.0.0.1:3037/api';
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
async function login(role: string) {
  const response = await fetch(url + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: role + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200);
  const data = await response.json(); return data.data.tokens.accessToken as string;
}
async function call(token: string, method: string, suffix = '', body?: unknown, status = 200) {
  const response = await fetch(url + '/manifiestos/baja-intensidad' + suffix, {
    method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result)); return result.data;
}
try {
  const operator = await login('operador'), outsider = await login('operador2'), admin = await login('admin');
  const generator = await login('generador'), sector = await login('jefe-operadores');
  const before = await db.manifiesto.findMany({ orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } });
  const userCount = await db.usuario.count(), notifications = await db.notificacion.count();
  const actor = { nombre: 'QA sin alta', identificacion: 'Identidad declarada QA, no validada', domicilio: 'Sólo nube 123' };
  const data = { id: randomUUID(), generador: actor, transportista: actor, patente: 'QA-EXT', motivo: 'Actividad sin alta SITREP',
    residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] };
  const created = (await call(operator, 'POST', '', data, 201)).registro;
  assert.equal(created.numeroOficial, null); assert.equal(created.etapa, 'REGISTRADO');
  assert.equal(created.operadorId, fixture.actors.operador);
  assert.equal((await call(operator, 'POST', '', data, 201)).registro.id, created.id);
  await call(operator, 'POST', '', { ...data, motivo: 'Otro contenido' }, 409);
  await call(outsider, 'GET', '/' + created.id, undefined, 404);
  assert.equal((await call(outsider, 'GET')).total, 0);
  await call(generator, 'GET', '', undefined, 403);
  await call(sector, 'GET', '', undefined, 403);
  await call(admin, 'POST', '', { ...data, id: randomUUID() }, 403);
  await call(operator, 'POST', '', { ...data, id: randomUUID(), numeroOficial: 'FALSO' }, 400);
  let current = created;
  const append = async (body: Record<string, unknown>, token = operator) => {
    const command = { id: randomUUID(), version: current.version, nota: 'QA evidencia de acción', ...body };
    current = (await call(token, 'POST', '/' + created.id + '/eventos', command)).registro;
    return command;
  };
  await append({ tipo: 'AVANCE', etapa: 'RETIRADO' });
  const difference = await append({ tipo: 'DIFERENCIA', residuos: [{ corriente: 'Y2', cantidad: 12, unidad: 'kg' }] });
  assert.deepEqual(current.datos, data); // original immutable, no duplicate total
  await call(operator, 'POST', '/' + created.id + '/eventos', { ...difference, id: randomUUID(), tipo: 'RESOLVER', objetivo: created.id, decision: 'APROBADA', version: current.version }, 403);
  await append({ tipo: 'AVANCE', etapa: 'RECIBIDO' });
  await append({ tipo: 'AVANCE', etapa: 'TRATADO' });
  assert.ok(current.revisiones.every((r: { estado: string }) => r.estado === 'PENDIENTE'));
  const request = await append({ tipo: 'SOLICITAR_REVISION', objetivo: created.id });
  const version = current.version;
  assert.equal((await call(operator, 'POST', '/' + created.id + '/eventos', request)).registro.version, version);
  await append({ tipo: 'RESOLVER', objetivo: created.id, decision: 'APROBADA' }, admin);
  assert.equal(current.revisiones[0].estado, 'APROBADA');
  assert.equal(current.revisiones[1].estado, 'PENDIENTE');
  await append({ tipo: 'SOLICITAR_REVISION', objetivo: difference.id });
  await append({ tipo: 'RESOLVER', objetivo: difference.id, decision: 'OBSERVADA' }, admin);
  assert.equal(current.etapa, 'TRATADO'); assert.equal(current.revisiones[1].estado, 'OBSERVADA');
  await call(operator, 'POST', '/' + created.id + '/eventos', { ...request, id: randomUUID() }, 409);
  // Two writers with the same version: exactly one succeeds, no lost history.
  const competing = await Promise.all([1, 2].map(async n => {
    const response = await fetch(url + '/manifiestos/baja-intensidad/' + created.id + '/eventos', {
      method: 'POST', headers: { Authorization: 'Bearer ' + operator, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: randomUUID(), version: current.version, tipo: 'SOLICITAR_REVISION', objetivo: difference.id, nota: 'QA concurrente ' + n }),
    }); return response.status;
  }));
  assert.deepEqual(competing.sort(), [200, 409]);
  assert.deepEqual(await db.manifiesto.findMany({ orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } }), before);
  assert.equal(await db.usuario.count(), userCount);
  assert.equal(await db.notificacion.count(), notifications);
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'exceptional-http.json'), JSON.stringify({
    passed: true, reference: created.id, cases: ['external identity/no official number', 'idempotency and conflicting replay',
      'ownership/reviewer/sector permissions', 'continue without approval', 'independent addendum review',
      'post-facto observation preserves treated fact', 'concurrent version conflict', 'legacy/users/notifications unchanged'],
  }, null, 2));
} finally { await db.$disconnect(); }
