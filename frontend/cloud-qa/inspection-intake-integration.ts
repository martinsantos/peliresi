import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'inspection_intake_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const f = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/intake-fixture.json', 'utf8'));
const tokens: Record<string, string> = {}, checks: string[] = [];
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function request(method: string, path: string, user = 'admin', body?: unknown) {
  const response = await fetch('http://127.0.0.1:3037/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(tokens[user] ? { Authorization: 'Bearer ' + tokens[user] } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text(); let result; try { result = JSON.parse(text); } catch { result = { text }; }
  return { status: response.status, body: result };
}
const waste = (corriente: string, cantidad: number, unidad = 'kg') => ({ corriente, cantidad, unidad });
const report = (rows = [waste('Y1', 12), waste('Y21', 3)]) => ({ id: randomUUID(), motivo: 'Informe artificial de hallazgo al recibir la carga', residuos: rows });
const queue = (where = {}) => db.antecedenteFiscalizacion.findMany({ where, orderBy: { createdAt: 'asc' } });
try {
  // Every attempt adds its own cases; interrupted attempts are never reset.
  const attempt = randomUUID().slice(0, 8);
  for (const name of Object.keys(f.http)) {
    const source = await db.manifiesto.findUniqueOrThrow({ where: { id: f.http[name].id }, include: { residuos: true } });
    f.http[name] = await db.manifiesto.create({ data: { numero: `QA-INTAKE-API-${attempt}-${name}`, generadorId: source.generadorId, transportistaId: source.transportistaId,
      operadorId: source.operadorId, creadoPorId: source.creadoPorId, estado: source.estado, modalidad: source.modalidad, isDemoData: true,
      ...(source.fechaRetiro ? { fechaRetiro: source.fechaRetiro } : {}), residuos: { create: source.residuos.map((row: any) => ({ tipoResiduoId: row.tipoResiduoId, cantidad: row.cantidad, unidad: row.unidad, estado: row.estado })) } } });
  }
  for (const user of ['admin', 'admin-generador', 'admin-operador', 'admin-transporte', 'inspector', ...Object.keys(f.users)]) {
    const result = await request('POST', '/auth/login', user, { email: user + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' });
    assert.equal(result.status, 200, user + ': ' + JSON.stringify(result.body)); tokens[user] = result.body.data.tokens.accessToken;
  }
  for (const name of ['admin', 'generador', 'transporte', 'operador']) assert.equal((await request('POST', '/auth/login', '', { email: name + '@capacitacion.invalid', password: 'NoCAP' })).status, 403);
  checks.push('real API logins, CAP aliases stay closed');
  const original = await db.manifiesto.findUniqueOrThrow({ where: { id: f.http.finding.id }, include: { residuos: true, eventos: true } });
  const input = report(), endpoint = `/manifiestos/${original.id}/adendas`;
  for (const user of ['foreign-operator', 'generator', 'admin']) assert.ok([403, 404].includes((await request('POST', endpoint, user, input)).status));
  assert.equal((await request('POST', endpoint, 'operator', { ...input, informeHallazgo: { autorId: 'forged' } })).status, 400);
  const saved = await request('POST', endpoint, 'operator', input); assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const finding = saved.body.data.adenda.informeHallazgo;
  assert.equal(finding.autorId, f.users.operator.id); assert.equal(finding.estadoAlRegistrar, 'RECIBIDO');
  assert.deepEqual(finding.diferencias.map((row: any) => row.tipo), ['CANTIDAD_DIFERENTE', 'Y_OMITIDA']);
  assert.deepEqual(finding.alcanceOperador.corrientesNoRegistradas, ['Y21']);
  const intakes = await queue({ origenId: input.id }); assert.equal(intakes.length, 2);
  assert.deepEqual(intakes.map((row: any) => row.tipoActor).sort(), ['GENERADOR', 'OPERADOR']);
  assert.equal((await request('POST', endpoint, 'operator', input)).status, 201);
  assert.equal((await request('POST', endpoint, 'operator', { ...input, motivo: 'Changed payload' })).status, 409);
  assert.equal((await queue({ origenId: input.id })).length, 2);
  assert.equal(hash(await db.manifiesto.findUniqueOrThrow({ where: { id: original.id }, include: { residuos: true, eventos: true } })), hash(original));
  checks.push('destination operator finding, quantity and omitted Y, immutable original, replay/forgery/permission guards');
  const authorityNotices = await db.notificacion.findMany({ where: { datos: { contains: intakes[0].id } } });
  assert.deepEqual(authorityNotices.map((n: any) => n.usuarioId).sort(), [f.initialUsers.admin, f.initialUsers['admin-generador']].sort());
  assert.equal(await db.notificacion.count({ where: { datos: { contains: input.id }, titulo: 'Nueva adenda en tu manifiesto' } }), 2);
  checks.push('exact sector authority and party internal recipients, no duplicate on replay');
  const reportHash = hash(await queue({ origenId: input.id }));
  for (const decision of ['OBSERVADA', 'RECHAZADA', 'APROBADA']) {
    const current = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: input.id } });
    const review = await request('POST', endpoint + '/' + input.id + '/revisiones', 'generator', { id: randomUUID(), version: current.version, nota: 'Contraparte revisa la evidencia artificial', decision });
    assert.equal(review.status, 200, JSON.stringify(review.body));
  }
  assert.equal(hash(await queue({ origenId: input.id })), reportHash);
  checks.push('pending/observed/rejected/approved adenda keeps the same independent intake evidence');
  const quantity = report([waste('Y1', 11)]); assert.equal((await request('POST', `/manifiestos/${f.http.quantity.id}/adendas`, 'operator', quantity)).status, 201);
  assert.deepEqual((await queue({ origenId: quantity.id })).map((r: any) => r.tipoActor), ['GENERADOR']);
  const clean = report([waste('Y1', 10)]); assert.equal((await request('POST', `/manifiestos/${f.http.clean.id}/adendas`, 'operator', clean)).status, 201); assert.equal((await queue({ origenId: clean.id })).length, 0);
  const driver = report([waste('Y1', 14)]); assert.equal((await request('POST', `/manifiestos/${f.http.driver.id}/adendas`, 'carrier', driver)).status, 201);
  assert.equal((await db.adendaManifiesto.findUniqueOrThrow({ where: { id: driver.id } })).informeHallazgo, null); assert.equal((await queue({ origenId: driver.id })).length, 0);
  await db.operador.update({ where: { id: f.actors.operator.id }, data: { corrientesY: null } });
  const unknown = report([waste('Y1', 10)]); const result = await request('POST', `/manifiestos/${f.http.unknown.id}/adendas`, 'operator', unknown); assert.equal(result.status, 201);
  assert.equal(result.body.data.adenda.informeHallazgo.alcanceOperador.estado, 'SIN_DATOS_VERIFICABLES');
  assert.deepEqual((await queue({ origenId: unknown.id }))[0].motivos, ['ALCANCE_SIN_VERIFICAR']);
  await db.operador.update({ where: { id: f.actors.operator.id }, data: { corrientesY: 'Y1 / Y2' } });
  checks.push('quantity alone is separate, clean report has no false case, driver is not operator, missing scope is unknown not unauthorized');
  const simultaneous = report(); const parallel = await Promise.all([1, 2, 3].map(() => request('POST', `/manifiestos/${f.http.concurrent.id}/adendas`, 'operator', simultaneous)));
  assert.deepEqual(parallel.map(r => r.status), [201, 201, 201]); assert.equal((await queue({ origenId: simultaneous.id })).length, 2);
  checks.push('concurrent identical report creates one adenda and one intake per target role');
  const eventual = { id: randomUUID(), operador: { padronId: f.actors.operator.id }, motivo: 'QA eventual con identidad incompleta', residuos: [waste('Y1', 1)] };
  const mixed = await Promise.all([1, 2].map(() => request('POST', '/manifiestos/baja-intensidad', 'generator', eventual)));
  assert.deepEqual(mixed.map(r => r.status), [201, 201], JSON.stringify(mixed));
  const external = await queue({ origenId: eventual.id }); assert.equal(external.length, 1); assert.equal(external[0].tipoActor, 'TRANSPORTISTA'); assert.equal(external[0].actorId, null); assert.equal(external[0].evidencia.participante.nombre, '');
  const secondEventual = await request('POST', '/manifiestos/baja-intensidad', 'generator', { ...eventual, id: randomUUID(), operador: {} }); assert.equal(secondEventual.status, 201);
  assert.equal((await queue({ origenId: secondEventual.body.data.registro.id })).length, 2);
  checks.push('eventual by any authorized creator captures every external slot, no fictitious ID or merge of unnamed participants');
  const handoffInput = { id: randomUUID(), anteriorId: null, tipo: 'EXTERNO', datos: {}, motivo: 'Rotura artificial sin datos del reemplazo' };
  const handoff = await request('POST', `/manifiestos/${f.http.driver.id}/tramos`, 'carrier', handoffInput); assert.equal(handoff.status, 201, JSON.stringify(handoff.body));
  assert.equal((await request('POST', `/manifiestos/${f.http.driver.id}/tramos`, 'carrier', handoffInput)).status, 201);
  const handoffQueue = await queue({ origenId: handoffInput.id }); assert.equal(handoffQueue.length, 1); assert.equal(handoffQueue[0].actorId, null); assert.deepEqual(handoffQueue[0].evidencia.participante, {});
  assert.equal(JSON.stringify(handoffQueue).includes(handoff.body.data.acceso), false); assert.equal('accesoVersion' in handoffQueue[0].evidencia, false);
  const gps = await fetch(`http://127.0.0.1:3037/api/seguimiento-relevo/${handoffInput.id}/ubicacion`, { method: 'POST', headers: { Authorization: 'Bearer ' + handoff.body.data.acceso, 'Content-Type': 'application/json' }, body: JSON.stringify({ latitud: -32.89, longitud: -68.84 }) }); assert.equal(gps.status, 200);
  checks.push('external handoff creates one intake while limited GPS and original assignment still work; no access tokens in evidence');
  const listing = await request('GET', '/inspecciones/antecedentes?estado=PENDIENTE'); assert.equal(listing.status, 200);
  for (const user of ['operator', 'carrier', 'generator', 'foreign-operator']) assert.equal((await request('GET', '/inspecciones/antecedentes', user)).status, 403);
  const sector = await request('GET', '/inspecciones/antecedentes', 'admin-operador'); assert.equal(sector.status, 200); assert.ok(sector.body.data.items.every((r: any) => r.tipoActor === 'OPERADOR'));
  assert.deepEqual((await request('GET', '/inspecciones/antecedentes', 'inspector')).body.data.items, []);
  checks.push('queue scoped by sector and assigned inspector, never exposed to ordinary parties');
  const generatorCase = intakes.find((r: any) => r.tipoActor === 'GENERADOR');
  const decision = { id: randomUUID(), version: 0, accion: 'EN_EVALUACION', motivo: 'Revisar pesaje y declaración conservada' };
  const decideUrl = `/inspecciones/antecedentes/${generatorCase.id}/decisiones`;
  assert.equal((await request('POST', decideUrl, 'admin-operador', decision)).status, 404);
  assert.equal((await request('POST', decideUrl, 'inspector', decision)).status, 403);
  const decisions = await Promise.all([1, 2].map(n => request('POST', decideUrl, 'admin-generador', { ...decision, id: randomUUID(), motivo: 'Evaluación concurrente ' + n })));
  assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
  const winner = decisions.find(r => r.status === 200)!.body.data;
  const winningEvent = winner.eventos[0]; const { autorId: _author, fecha: _date, ...repeat } = winningEvent;
  assert.equal((await request('POST', decideUrl, 'admin-generador', repeat)).status, 200);
  const refused = await request('POST', '/inspecciones', 'admin', { clienteId: randomUUID(), antecedenteId: generatorCase.id, tipoActor: 'GENERADOR', actorId: f.actors['foreign-generator'].id }); assert.equal(refused.status, 409);
  const opening = { clienteId: randomUUID(), antecedenteId: generatorCase.id, tipoActor: 'GENERADOR', actorId: f.actors.generator.id, inspectorId: f.initialUsers.inspector };
  const opened = await request('POST', '/inspecciones', 'admin', opening); assert.equal(opened.status, 201, JSON.stringify(opened.body));
  assert.equal((await request('POST', '/inspecciones', 'admin', opening)).body.data.id, opened.body.data.id);
  const linked = await db.antecedenteFiscalizacion.findUniqueOrThrow({ where: { id: generatorCase.id } }); assert.equal(linked.estado, 'VINCULADA'); assert.equal(linked.inspeccionId, opened.body.data.id);
  assert.equal(linked.huellaEvidencia, generatorCase.huellaEvidencia);
  assert.equal((await request('GET', '/inspecciones/antecedentes', 'inspector')).body.data.items.filter((row: any) => row.id === generatorCase.id).length, 1);
  assert.equal((await request('GET', '/inspecciones/antecedentes', 'inspector2')).body.data.items.length, 0);
  const assigned = opened.body.data.eventos.find((e: any) => e.tipo === 'ANTECEDENTE_VINCULADO'); assert.equal(assigned.visibleActor, false);
  assert.equal((await request('POST', '/inspecciones', 'admin', { ...opening, clienteId: randomUUID() })).status, 409);
  checks.push('concurrent evaluation one winner, replay safe, wrong actor rejected, atomic case opening, assigned inspector only, no duplicate inspection');
  const unknownCase = handoffQueue[0];
  const spontaneous = await request('POST', '/inspecciones', 'admin', { clienteId: randomUUID(), antecedenteId: unknownCase.id, tipoInspeccion: 'ESPONTANEA' }); assert.equal(spontaneous.status, 201, JSON.stringify(spontaneous.body)); assert.equal(spontaneous.body.data.tipoActor, null);
  assert.equal(spontaneous.body.data.generadorId, null); assert.equal(spontaneous.body.data.transportistaId, null);
  checks.push('unknown external becomes a traceable spontaneous case without assigning an invented actor');
  const toDiscard = (await queue({ origenId: quantity.id }))[0];
  const discard = { id: randomUUID(), version: 0, accion: 'DESCARTADA', motivo: 'Diferencia de balanza documentada en QA' };
  assert.equal((await request('POST', `/inspecciones/antecedentes/${toDiscard.id}/decisiones`, 'admin', discard)).status, 200);
  const retained = await db.antecedenteFiscalizacion.findUniqueOrThrow({ where: { id: toDiscard.id } }); assert.equal(retained.huellaEvidencia, toDiscard.huellaEvidencia); assert.equal(retained.eventos.length, 1);
  assert.equal(await db.emailQueue.count(), 0);
  assert.equal((await request('GET', '/inspecciones/antecedentes?estado=forged')).status, 400);
  writeFileSync(process.env.QA_ARTIFACTS + '/integration.json', JSON.stringify({ passed: checks.length, checks, production: false, capClosed: true, emailQueue: 0 }, null, 2));
  console.log('Inspection intake API: ' + checks.length + ' groups PASS.');
} finally { await db.$disconnect(); }
