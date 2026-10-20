import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'inspection_intake_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const f = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/intake-fixture.json', 'utf8'));
const tokens: Record<string, string> = {};
async function request(user: string, path: string, body: unknown) {
  const response = await fetch('http://127.0.0.1:3037/api' + path, { method: 'POST', headers: { Authorization: 'Bearer ' + tokens[user], 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const before = await db.operador.findUniqueOrThrow({ where: { id: f.actors.operator.id } });
try {
  for (const user of ['operator', 'admin']) {
    const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) }); assert.equal(login.status, 200); tokens[user] = (await login.json()).data.tokens.accessToken;
  }
  const source = await db.manifiesto.findUniqueOrThrow({ where: { id: f.http.finding.id }, include: { residuos: true } });
  const trip = () => db.manifiesto.create({ data: { numero: 'QA-SCOPE-' + randomUUID(), estado: 'RECIBIDO', generadorId: source.generadorId, transportistaId: source.transportistaId,
    operadorId: source.operadorId, creadoPorId: source.creadoPorId, isDemoData: true, residuos: { create: source.residuos.map((row: any) => ({ tipoResiduoId: row.tipoResiduoId, cantidad: row.cantidad, unidad: row.unidad, estado: row.estado })) } } });
  const manifest = await trip(), endpoint = `/manifiestos/${manifest.id}/adendas`;
  await db.operador.update({ where: { id: before.id }, data: { corrientesY: 'Y1 / Y21' } });
  const omitted = { id: randomUUID(), motivo: 'QA Y omitida que sí consta en la ficha del operador', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }, { corriente: 'Y21', cantidad: 2, unidad: 'kg' }] };
  const finding = await request('operator', endpoint, omitted); assert.equal(finding.status, 201);
  const originalReport = finding.body.data.adenda.informeHallazgo;
  assert.deepEqual(originalReport.alcanceOperador.corrientesNoRegistradas, []);
  const omissionQueue = await db.antecedenteFiscalizacion.findMany({ where: { origenId: omitted.id } }); assert.deepEqual(omissionQueue.map((row: any) => row.tipoActor), ['GENERADOR']);
  await db.operador.update({ where: { id: before.id }, data: { corrientesY: 'Y2' } });
  const outside = { id: randomUUID(), motivo: 'QA carga coincide pero no consta en la ficha del operador', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] };
  const out = await request('operator', `/manifiestos/${(await trip()).id}/adendas`, outside); assert.equal(out.status, 201); assert.deepEqual(out.body.data.adenda.informeHallazgo.diferencias, []);
  const outsideQueue = await db.antecedenteFiscalizacion.findMany({ where: { origenId: outside.id } }); assert.deepEqual(outsideQueue.map((row: any) => row.tipoActor), ['OPERADOR']);
  assert.deepEqual(outsideQueue[0].motivos, ['Y_NO_CONSTA_EN_FICHA_OPERADOR']);
  await db.operador.update({ where: { id: before.id }, data: { corrientesY: 'QA ficha sin códigos reconocibles' } });
  const unknown = await request('operator', `/manifiestos/${(await trip()).id}/adendas`, { ...outside, id: randomUUID(), motivo: 'QA ficha no interpretable' }); assert.equal(unknown.status, 201);
  const unknownQueue = await db.antecedenteFiscalizacion.findMany({ where: { origenId: unknown.body.data.adenda.id } }); assert.deepEqual(unknownQueue[0].motivos, ['ALCANCE_SIN_VERIFICAR']);
  const snapshot = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: omitted.id } }); assert.deepEqual(snapshot.informeHallazgo, originalReport);
  const rectification = await request('operator', endpoint, { ...omitted, id: randomUUID(), rectificaId: omitted.id, motivo: 'QA rectificación conserva el hallazgo anterior', residuos: [{ corriente: 'Y1', cantidad: 11, unidad: 'kg' }] }); assert.equal(rectification.status, 201); assert.equal(rectification.body.data.adenda.rectificaId, omitted.id);
  assert.deepEqual((await db.adendaManifiesto.findUniqueOrThrow({ where: { id: omitted.id } })).informeHallazgo, originalReport);
  const inspection = await db.inspeccion.findFirstOrThrow({ where: { generadorId: f.actors.generator.id }, orderBy: { createdAt: 'asc' } });
  const linked = await request('admin', `/inspecciones/antecedentes/${omissionQueue[0].id}/decisiones`, { id: randomUUID(), version: 0, accion: 'VINCULADA', inspeccionId: inspection.id, motivo: 'QA vincular otro antecedente del mismo generador' }); assert.equal(linked.status, 200, JSON.stringify(linked.body));
  assert.equal(linked.body.data.inspeccionId, inspection.id); assert.equal(await db.antecedenteFiscalizacion.count({ where: { inspeccionId: inspection.id } }) >= 2, true);
  writeFileSync(process.env.QA_ARTIFACTS + '/coverage.json', JSON.stringify({ passed: 4, checks: ['omitted Y already in operator registry does not create a false operator case', 'declared Y outside operator registry creates operator focus even with matching amounts', 'unparseable registry is unknown and snapshots do not follow later registry edits', 'rectification preserves old report and multiple related intakes can link to one existing inspection'], production: false }, null, 2));
  console.log('Scope and existing-case coverage: 4 groups PASS.');
} finally { await db.operador.update({ where: { id: before.id }, data: { corrientesY: before.corrientesY } }); await db.$disconnect(); }
