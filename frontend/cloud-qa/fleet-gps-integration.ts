import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(process.env.TRANSPORT_MULTI_GPS_ENABLED, 'true');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient(), directory = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(directory, 'handoff-private.json'), 'utf8'));
const request = async (method: string, route: string, token?: string, body?: unknown) => {
  const response = await fetch('http://127.0.0.1:3037/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
};
try {
  // The fixture may only name the pre-existing artificial participants of this
  // isolated preview. Never create or modify any real account or actor.
  const allowed: Record<string, string> = { origin: 'transportista', foreign: 'transportista2',
    generator: 'generador', operator: 'operador', admin: 'admin' };
  const participants: Record<string, any> = {};
  for (const [role, login] of Object.entries(allowed)) {
    const entry = fixture.users[role];
    assert.equal(entry.email, login + '@night-qa.invalid');
    const user = await db.usuario.findUniqueOrThrow({ where: { id: entry.id },
      include: { generador: true, transportista: true, operador: true } });
    assert.equal(user.email, entry.email); assert.equal(user.activo, true); participants[role] = user;
  }
  for (const role of ['origin', 'foreign']) {
    assert.equal(participants[role].transportista.id, fixture.carriers[role].id);
    assert.match(participants[role].transportista.razonSocial, /^QA /);
  }
  assert.equal(participants.generator.generador.id, fixture.browsers.web.generadorId);
  assert.equal(participants.operator.operador.id, fixture.browsers.web.operadorId);
  assert.match(participants.generator.generador.razonSocial, /^QA /);
  assert.match(participants.operator.operador.razonSocial, /^QA /);
  const tokens: Record<string, string> = {};
  for (const role of ['origin', 'foreign', 'generator', 'operator', 'admin']) {
    const login = await request('POST', '/auth/login', undefined, { email: fixture.users[role].email, password: fixture.password });
    assert.equal(login.status, 200); tokens[role] = login.body.data.tokens.accessToken;
  }
  const cases: Record<string, unknown> = {}, checks: string[] = [];
  const run = randomUUID().slice(0, 8);
  for (const project of ['web', 'app']) {
    const prefix = `QA-FLEET-${run}-${project.toUpperCase()}`;
    const create = (suffix: string, carrier = 'origin') => db.manifiesto.create({ data: {
      numero: prefix + '-' + suffix, generadorId: fixture.browsers.web.generadorId, operadorId: fixture.browsers.web.operadorId,
      transportistaId: fixture.carriers[carrier].id, creadoPorId: fixture.users[carrier].id, estado: 'EN_TRANSITO', modalidad: 'FIJO',
      fechaRetiro: new Date(), isDemoData: true, asignacionTransporte: { version: 1, transportistaId: fixture.carriers[carrier].id, vehiculo: null, chofer: null },
    } });
    const a = await create('A'), b = await create('B'), incoming = await create('C', 'foreign');
    const handoff = await request('POST', `/manifiestos/${incoming.id}/tramos`, tokens.foreign, { id: randomUUID(), anteriorId: null, tipo: 'REGISTRADO', transportistaId: fixture.carriers.origin.id, datos: {}, motivo: 'Relevo sintético para verificar GPS simultáneo' });
    assert.equal(handoff.status, 201, JSON.stringify(handoff.body));
    const list = await request('GET', '/manifiestos/cargas-en-curso?search=' + encodeURIComponent(prefix), tokens.origin);
    assert.equal(list.status, 200); assert.equal(list.body.data.total, 3);
    assert.deepEqual(list.body.data.targets.map((t: any) => t.numero).sort(), [a.numero, b.numero, incoming.numero].sort());
    const replacement = list.body.data.targets.find((t: any) => t.numero === incoming.numero);
    assert.equal(replacement.id, handoff.body.data.tramo.id); assert.equal(replacement.puedeEntregar, false);
    assert.equal(JSON.stringify(replacement).includes(incoming.id), false);
    assert.equal((await request('GET', '/manifiestos/cargas-en-curso?search=' + encodeURIComponent(prefix), tokens.foreign)).body.data.total, 0);
    assert.equal((await request('POST', `/manifiestos/${a.id}/ubicacion`, tokens.foreign, { latitud: -33, longitud: -69 })).status, 404);
    cases[project] = { prefix, a, b, incoming: { ...incoming, tramoId: handoff.body.data.tramo.id } };
    checks.push(project + ':only-own-original-and-assigned-limited-loads', project + ':handed-off-origin-excluded', project + ':unrelated-gps-denied');
  }
  for (const role of ['generator', 'operator', 'admin']) assert.equal((await request('GET', '/manifiestos/cargas-en-curso', tokens[role])).status, 403);
  assert.equal((await request('GET', '/manifiestos/cargas-en-curso?search=a&search=b', tokens.origin)).status, 400);
  checks.push('non-carrier-roles-denied', 'invalid-query-shape-denied');
  await writeFile(path.join(directory, 'fleet-private.json'), JSON.stringify({ ...fixture, cases }), { mode: 0o600 });
  await writeFile(path.join(directory, 'fleet-http.json'), JSON.stringify({ passed: true, checks, production: false, externalDelivery: false }, null, 2));
  console.log(`PASS: ${checks.length} fleet HTTP groups; synthetic preview only`);
} finally { await db.$disconnect(); }
