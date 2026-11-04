import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.MANIFEST_TRANSPORT_HANDOFF_ENABLED, 'true');
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-receipt-private.json'), 'utf8'));
assert.match(fixture.handoffCase.numero, /^QA-GPS-RECEIPT-.*-HANDOFF$/);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const request = async (method: string, route: string, token?: string, body?: unknown) => {
  const response = await fetch('http://127.0.0.1:4177/api' + route, { method,
    headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.82.23', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
};
try {
  const [origin, replacement] = await Promise.all(['transportista', 'transportista2'].map(name =>
    db.usuario.findUniqueOrThrow({ where: { email: `${name}@night-qa.invalid` }, include: { transportista: true } })));
  for (const actor of [origin, replacement]) { assert.equal(actor.activo, true); assert.match(actor.transportista.razonSocial, /^QA /); }
  assert.equal(origin.id, fixture.owner);
  const tokens: string[] = [];
  for (const user of [origin, replacement]) {
    const login = await request('POST', '/auth/login', undefined, { email: user.email, password: 'OnlyLocal-NightQA-2026!' });
    assert.equal(login.status, 200); tokens.push(login.body.data.tokens.accessToken);
  }
  const id = fixture.handoffCase.id, point = { puntoId: randomUUID(), latitud: -33.123, longitud: -68.123 };
  const initial = await request('POST', `/manifiestos/${id}/ubicacion-idempotente`, tokens[0], point);
  assert.equal(initial.status, 200); assert.equal(initial.body.data.idempotencia.repetido, false);
  const handoff = await request('POST', `/manifiestos/${id}/tramos`, tokens[0], { id: randomUUID(), anteriorId: null,
    tipo: 'REGISTRADO', transportistaId: replacement.transportista.id, datos: {}, motivo: 'Relevo artificial de prueba' });
  assert.equal(handoff.status, 201);
  const repeat = await request('POST', `/manifiestos/${id}/ubicacion-idempotente`, tokens[0], point);
  assert.equal(repeat.status, 200); assert.equal(repeat.body.data.idempotencia.repetido, true);
  assert.equal((await request('POST', `/manifiestos/${id}/ubicacion-idempotente`, tokens[0], { ...point, latitud: -33.2 })).status, 409);
  assert.equal((await request('POST', `/manifiestos/${id}/ubicacion-idempotente`, tokens[0], { ...point, puntoId: randomUUID() })).status, 409);
  const receipt = await request('GET', `/manifiestos/${id}/ubicaciones/${point.puntoId}/confirmacion`, tokens[0]);
  assert.equal(receipt.status, 200); assert.equal(receipt.body.data.idempotencia.confirmado, true);
  assert.equal((await request('GET', `/manifiestos/${id}/ubicaciones/${point.puntoId}/confirmacion`, tokens[1])).status, 404);
  assert.equal(await db.trackingGPS.count({ where: { manifiestoId: id } }), 1);
  const result = { synthetic: true, exactRetry: 200, changedRetry: 409, newPoint: 409, receipt: 200, otherAccount: 404, points: 1 };
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-receipt-handoff-http.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
