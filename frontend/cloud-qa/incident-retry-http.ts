import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-incident-retry-final-20261101';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'incident-retry-final');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const fixture = JSON.parse(readFileSync(path.join(out, 'incident-fixture.json'), 'utf8'));
assert.equal(fixture.synthetic, true); assert.match(fixture.cases.race.numero, /^QA-INCIDENT-FINAL-/);
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
const request = async (method: string, route: string, token?: string, body?: unknown, ip = '127.11.220.1') => {
  const response = await fetch('http://127.0.0.1:4177/api' + route, { method, headers: { 'Content-Type': 'application/json',
    Cookie: `sitrep_qa_client=${ip}`, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
};
try {
  const cases = fixture.cases.race, current = await db.manifiesto.findUniqueOrThrow({ where: { id: cases.id },
    include: { generador: true, transportista: true, operador: true } });
  assert.equal(current.numero, cases.numero); assert.equal(current.isDemoData, true); assert.equal(current.estado, 'EN_TRANSITO');
  for (const actor of [current.generador, current.transportista, current.operador]) assert.match(actor.razonSocial, /^QA /);
  const tokens: Record<string, string> = {};
  for (const [i, role] of ['transportista', 'transportista2', 'operador', 'admin'].entries()) {
    const response = await request('POST', '/auth/login', undefined,
      { email: `${role}@night-qa.invalid`, password: 'OnlyLocal-NightQA-2026!' }, `127.11.220.${10 + i}`);
    assert.equal(response.status, 200); tokens[role] = response.data.data.tokens.accessToken;
  }
  const referencia = randomUUID(), body = { referencia, tipo: 'averia', descripcion: 'QA concurrencia de incidente', latitud: -32, longitud: -68 };
  const route = `/manifiestos/${cases.id}/incidente-idempotente`;
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => request('POST', route, tokens.transportista, body, `127.11.221.${10 + i}`)));
  assert.ok(results.every(item => item.status === 200));
  assert.equal(results.filter(item => item.data.data.idempotencia.repetido === false).length, 1);
  assert.equal(new Set(results.map(item => item.data.data.evento.id)).size, 1);
  assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: cases.id, tipo: 'INCIDENTE' } }), 1);
  assert.equal(await db.auditoria.count({ where: { manifiestoId: cases.id, accion: 'REGISTRAR_INCIDENTE_V1' } }), 1);
  assert.equal(await db.notificacion.count({ where: { manifiestoId: cases.id, tipo: 'INCIDENTE_REPORTADO', usuarioId: fixture.users.operator } }), 1);
  assert.equal((await request('POST', route, tokens.transportista, { ...body, descripcion: 'QA dato diferente' })).status, 409);
  assert.equal((await request('POST', route, tokens.admin, body)).status, 409);
  assert.equal((await request('POST', route, tokens.transportista2, body)).status, 404);
  assert.equal((await request('POST', route, tokens.operador, body)).status, 403);
  const distinct = await request('POST', route, tokens.transportista, { ...body, referencia: randomUUID() });
  assert.equal(distinct.status, 200); assert.equal(distinct.data.data.idempotencia.repetido, false);
  assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: cases.id, tipo: 'INCIDENTE' } }), 2);
  assert.equal(await db.notificacion.count({ where: { manifiestoId: cases.id, tipo: 'INCIDENTE_REPORTADO', usuarioId: fixture.users.operator } }), 2);
  const update = await db.manifiesto.updateMany({ where: { id: cases.id, numero: cases.numero, isDemoData: true, estado: 'EN_TRANSITO' }, data: { estado: 'ENTREGADO' } });
  assert.equal(update.count, 1);
  const later = await request('POST', route, tokens.transportista, body);
  assert.equal(later.status, 200); assert.equal(later.data.data.idempotencia.repetido, true);
  assert.equal((await request('POST', route, tokens.transportista, { ...body, referencia: randomUUID() })).status, 400);
  assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: cases.id, tipo: 'INCIDENTE' } }), 2);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { synthetic: true, production: false, simultaneousRequests: results.length, created: 1,
    distinctIncidentsAfterSecondReference: 2, operatorNotices: 2, conflictingPayload: 409, otherAccount: 409,
    unrelatedCarrier: 404, operatorDenied: 403, lateRetryAcknowledged: true, newAfterDeliveryRejected: true, emailAttempts: 0, emailSent: 0 };
  writeFileSync(path.join(out, 'incident-http-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
