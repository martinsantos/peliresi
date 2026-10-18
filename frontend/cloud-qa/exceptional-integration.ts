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
  await call(generator, 'GET', '/' + created.id, undefined, 404);
  await call(sector, 'GET', '', undefined, 403);
  // Spec v2 §1: ADMIN may start an eventual; sector administrators still may not.
  await call(sector, 'POST', '', { ...data, id: randomUUID() }, 403);
  await call(operator, 'POST', '', { ...data, id: randomUUID(), numeroOficial: 'FALSO' }, 400);
  for (const type of ['generador', 'transportista'] as const) {
    const lookup = await call(operator, 'GET', '/participantes?tipo=' + type + '&q=QA');
    assert.ok(lookup.participantes.length <= 20);
    const registered = lookup.participantes.find((p: { padronId: string }) => p.padronId === fixture.actors[type]);
    assert.ok(registered);
    const body = { ...data, id: randomUUID(), [type]: { ...registered, nombre: 'Forged caller label' } };
    const mixed = (await call(operator, 'POST', '', body, 201)).registro;
    assert.equal(mixed.datos[type].nombre, registered.nombre);
    const owner = type === 'generador' ? generator : await login('transportista');
    // Spec v2 §3: a registered party with an active account must approve and may then record facts.
    assert.deepEqual(mixed.aprobacion.partes.map((p: { parte: string }) => p.parte), ['creador', type]);
    const ownerView = (await call(owner, 'GET', '/' + mixed.id)).registro;
    assert.equal(ownerView.puedeRegistrar, true); assert.deepEqual(ownerView.puedeAprobar, [type]);
    assert.deepEqual((await call(operator, 'GET', '/' + mixed.id)).registro.puedeAprobar, ['creador']);
    const unrelated = type === 'generador' ? await login('generador2') : await login('transportista2');
    await call(unrelated, 'GET', '/' + mixed.id, undefined, 404);
    assert.equal((await call(operator, 'POST', '', body, 201)).registro.id, mixed.id);
  }
  let current = created;
  const append = async (body: Record<string, unknown>, token = operator) => {
    const command = { id: randomUUID(), version: current.version, nota: 'QA evidencia de acción', ...body };
    current = (await call(token, 'POST', '/' + created.id + '/eventos', command)).registro;
    return command;
  };
  // New records wait for every required approval (here only the creating operator).
  assert.equal(created.aprobacion.estado, 'PENDIENTE');
  await call(operator, 'POST', '/' + created.id + '/eventos', { id: randomUUID(), tipo: 'AVANCE', etapa: 'RETIRADO', version: current.version, nota: '' }, 409);
  await call(admin, 'POST', '/' + created.id + '/eventos', { id: randomUUID(), tipo: 'APROBAR_PARTE', parte: 'creador', version: current.version, nota: '' }, 403);
  await append({ tipo: 'APROBAR_PARTE', parte: 'creador' });
  assert.equal(current.aprobacion.estado, 'APROBADO');
  await append({ tipo: 'AVANCE', etapa: 'RETIRADO' });
  const difference = await append({ tipo: 'DIFERENCIA', residuos: [{ corriente: 'Y2', cantidad: 12, unidad: 'kg' }] });
  assert.deepEqual(current.datos, created.datos); // original immutable, no duplicate total
  for (const key of ['id', 'generador', 'transportista', 'patente', 'motivo', 'residuos'] as const) assert.deepEqual(created.datos[key], data[key]);
  await call(operator, 'POST', '/' + created.id + '/eventos', { id: randomUUID(), tipo: 'RESOLVER', objetivo: created.id, decision: 'APROBADA', version: current.version, nota: 'QA intento no autorizado' }, 403);
  await call(operator, 'POST', '/' + created.id + '/eventos', { id: randomUUID(), tipo: 'AVANCE', etapa: 'RECIBIDO', decision: 'APROBADA', version: current.version, nota: 'QA conformidad falsa' }, 400);
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
  await append({ tipo: 'RESOLVER', objetivo: difference.id, decision: 'RECHAZADA' }, admin);
  assert.equal(current.etapa, 'TRATADO'); assert.equal(current.revisiones[1].estado, 'RECHAZADA');
  await call(operator, 'POST', '/' + created.id + '/eventos', { ...request, id: randomUUID() }, 409);
  // Two writers with the same version: exactly one succeeds, no lost history.
  const competing = await Promise.all([1, 2].map(async n => {
    const response = await fetch(url + '/manifiestos/baja-intensidad/' + created.id + '/eventos', {
      method: 'POST', headers: { Authorization: 'Bearer ' + operator, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: randomUUID(), version: current.version, tipo: 'SOLICITAR_REVISION', objetivo: difference.id, nota: 'QA concurrente ' + n }),
    }); return response.status;
  }));
  assert.deepEqual(competing.sort(), [200, 409]);

  // Spec v2: any party starts an eventual; registered parties approve before facts advance.
  const carrier = await login('transportista'), otherGenerator = await login('generador2');
  const operatorLookup = await call(generator, 'GET', '/participantes?tipo=operador&q=QA');
  assert.ok(Array.isArray(operatorLookup.participantes) && operatorLookup.participantes.length <= 20);
  const external = { nombre: 'QA transporte sin alta', identificacion: 'QA-EVENTUAL-EXT', domicilio: '' };
  const byGenerator = { id: randomUUID(), transportista: external, operador: { nombre: 'Forged', identificacion: 'x', domicilio: '', padronId: fixture.actors.operador },
    patente: 'QA-GEN', motivo: 'Transporte sin alta', residuos: [{ corriente: 'Y1', cantidad: 4, unidad: 'kg' }] };
  await call(generator, 'POST', '', { ...byGenerator, id: randomUUID(), generador: { ...external, padronId: 'qa-not-own' } }, 400);
  await call(generator, 'POST', '', { ...byGenerator, id: randomUUID(), transportista: { ...external, padronId: fixture.actors.transportista } }, 400);
  let eventual = (await call(generator, 'POST', '', byGenerator, 201)).registro;
  assert.equal(eventual.autorRol, 'GENERADOR'); assert.equal(eventual.operadorId, fixture.actors.operador);
  assert.equal(eventual.datos.generador.padronId, fixture.actors.generador); assert.notEqual(eventual.datos.operador.nombre, 'Forged');
  assert.deepEqual(eventual.aprobacion.partes.map((p: { parte: string }) => p.parte), ['creador', 'operador']);
  assert.deepEqual(eventual.puedeAprobar, ['creador']); assert.equal(eventual.numeroOficial, null);
  await call(outsider, 'GET', '/' + eventual.id, undefined, 404); await call(carrier, 'GET', '/' + eventual.id, undefined, 404);
  await call(otherGenerator, 'GET', '/' + eventual.id, undefined, 404);
  const step = async (token: string, body: Record<string, unknown>, status = 200) => {
    const result = await call(token, 'POST', '/' + eventual.id + '/eventos', { id: randomUUID(), version: eventual.version, nota: 'QA eventual', ...body }, status);
    if (status === 200) eventual = result.registro;
  };
  await step(generator, { tipo: 'APROBAR_PARTE', parte: 'creador' });
  await step(generator, { tipo: 'AVANCE', etapa: 'RETIRADO' }, 409);
  await step(generator, { tipo: 'APROBAR_PARTE', parte: 'operador' }, 403);
  await step(outsider, { tipo: 'APROBAR_PARTE', parte: 'operador' }, 404);
  assert.deepEqual((await call(operator, 'GET', '/' + eventual.id)).registro.puedeAprobar, ['operador']);
  await step(operator, { tipo: 'APROBAR_PARTE', parte: 'operador' });
  await step(operator, { tipo: 'APROBAR_PARTE', parte: 'operador' }, 409);
  assert.equal(eventual.aprobacion.estado, 'APROBADO');
  await step(generator, { tipo: 'AVANCE', etapa: 'RETIRADO' });
  await step(operator, { tipo: 'AVANCE', etapa: 'RECIBIDO' });
  assert.equal(eventual.etapa, 'RECIBIDO');

  // Every slot except its own external: the creator alone approves; the external operator leaves operadorId empty.
  let alone = (await call(generator, 'POST', '', { ...byGenerator, id: randomUUID(), operador: { nombre: 'QA planta sin alta', identificacion: 'QA-EXT-OPERATOR', domicilio: '' } }, 201)).registro;
  assert.equal(alone.operadorId, null); assert.deepEqual(alone.aprobacion.partes.map((p: { parte: string }) => p.parte), ['creador']);
  await call(operator, 'GET', '/' + alone.id, undefined, 404);
  alone = (await call(generator, 'POST', '/' + alone.id + '/eventos', { id: randomUUID(), version: alone.version, tipo: 'APROBAR_PARTE', parte: 'creador', nota: '' })).registro;
  alone = (await call(generator, 'POST', '/' + alone.id + '/eventos', { id: randomUUID(), version: alone.version, tipo: 'AVANCE', etapa: 'RETIRADO', nota: '' })).registro;
  assert.equal(alone.etapa, 'RETIRADO');
  const external_operator = await call(admin, 'GET', '/' + alone.id + '/conciliacion?rol=operador');
  assert.equal(external_operator.declarado.identificacion, 'QA-EXT-OPERATOR'); assert.equal(external_operator.puedeRevisar, true);
  const generatorReconciliation = await call(generator, 'GET', '/' + alone.id + '/conciliacion?rol=operador');
  assert.equal(generatorReconciliation.puedeRevisar, false);

  // A party rejection keeps the record as a precedent and blocks every fact.
  let refused = (await call(generator, 'POST', '', { ...byGenerator, id: randomUUID() }, 201)).registro;
  await call(operator, 'POST', '/' + refused.id + '/eventos', { id: randomUUID(), version: refused.version, tipo: 'RECHAZAR_PARTE', parte: 'operador', nota: '' }, 400);
  refused = (await call(operator, 'POST', '/' + refused.id + '/eventos', { id: randomUUID(), version: refused.version, tipo: 'RECHAZAR_PARTE', parte: 'operador', nota: 'La carga no corresponde' })).registro;
  assert.equal(refused.aprobacion.estado, 'RECHAZADO');
  await call(generator, 'POST', '/' + refused.id + '/eventos', { id: randomUUID(), version: refused.version, tipo: 'APROBAR_PARTE', parte: 'creador', nota: '' }, 409);
  await call(generator, 'POST', '/' + refused.id + '/eventos', { id: randomUUID(), version: refused.version, tipo: 'AVANCE', etapa: 'RETIRADO', nota: '' }, 409);
  assert.equal((await call(generator, 'GET', '/' + refused.id)).registro.etapa, 'REGISTRADO');

  // ADMIN starts one with the three slots declared; it approves alone and cannot review its own record.
  let byAdmin = (await call(admin, 'POST', '', { ...data, id: randomUUID(), operador: { nombre: 'QA planta', identificacion: '', domicilio: '' } }, 201)).registro;
  assert.equal(byAdmin.autorRol, 'ADMIN'); assert.equal(byAdmin.autorActorId, null); assert.equal(byAdmin.puedeResolver, false);
  assert.deepEqual(byAdmin.puedeAprobar, ['creador']);
  byAdmin = (await call(admin, 'POST', '/' + byAdmin.id + '/eventos', { id: randomUUID(), version: byAdmin.version, tipo: 'APROBAR_PARTE', parte: 'creador', nota: '' })).registro;
  byAdmin = (await call(admin, 'POST', '/' + byAdmin.id + '/eventos', { id: randomUUID(), version: byAdmin.version, tipo: 'AVANCE', etapa: 'RETIRADO', nota: '' })).registro;
  assert.equal(byAdmin.etapa, 'RETIRADO');

  // Spec v2 §7: a row written before this change (manifest-migration) keeps advancing without approvals.
  const legacy = (await call(operator, 'GET', '/qa-legacy-exceptional')).registro;
  assert.equal(legacy.aprobacion.estado, 'NO_REQUIERE'); assert.equal(legacy.autorRol, null); assert.equal(legacy.puedeRegistrar, true);
  const legacyNext = (await call(operator, 'POST', '/qa-legacy-exceptional/eventos', { id: randomUUID(), version: legacy.version, tipo: 'AVANCE', etapa: 'RECIBIDO', nota: '' })).registro;
  assert.equal(legacyNext.etapa, 'RECIBIDO'); assert.deepEqual(legacyNext.datos, legacy.datos);
  assert.deepEqual(await db.manifiesto.findMany({ orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } }), before);
  assert.equal(await db.usuario.count(), userCount);
  assert.equal(await db.notificacion.count(), notifications);
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'exceptional-http.json'), JSON.stringify({
    passed: true, reference: created.id, cases: ['external identity/no official number', 'idempotency and conflicting replay',
      'ownership/reviewer/sector permissions', 'mixed participants canonical identity and restricted read access',
      'facts wait for party approvals; legacy rows advance unchanged', 'independent addendum review',
      'generator/admin start eventuals; own slot from session; external operator; rejection kept and blocking',
      'post-facto observation preserves treated fact', 'concurrent version conflict', 'legacy/users/notifications unchanged'],
  }, null, 2));
} finally { await db.$disconnect(); }
