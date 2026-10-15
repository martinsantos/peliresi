import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
const output = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(output, 'fixture.json'), 'utf8'));
const base = 'http://127.0.0.1:3037/api';
const tokens = new Map<string, string>();
async function token(role: string) {
  if (!tokens.has(role)) {
    const res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: role + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(res.status, 200); tokens.set(role, (await res.json()).data.tokens.accessToken);
  }
  return tokens.get(role)!;
}
async function call(id: string, role: string, method = 'GET', suffix = '', body?: unknown, status = 200) {
  const res = await fetch(`${base}/manifiestos/${id}/adendas${suffix}`, { method,
    headers: { Authorization: 'Bearer ' + await token(role), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await res.json(); assert.equal(res.status, status, JSON.stringify(json)); return json.data;
}
try {
  const historical = await db.manifiesto.findMany({ orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } });
  const create = (estado: string) => db.manifiesto.create({ data: { numero: 'QA-ADENDA-' + randomUUID(), estado, fechaFirma: new Date(),
    generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador,
    creadoPorId: fixture.users.admin, isDemoData: true, residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] } }, include: { residuos: true, eventos: true } });
  const manifest = await create('APROBADO'), other = await create('APROBADO'), draft = await create('BORRADOR');
  const input = { id: randomUUID(), motivo: 'Carga completa observada', residuos: [{ corriente: 'Y2', cantidad: 12, unidad: 'kg' }] };
  for (const role of ['generador2', 'transportista2', 'operador2']) await call(manifest.id, role, 'GET', '', undefined, 404);
  await call(manifest.id, 'generador', 'POST', '', input, 403);
  await call(manifest.id, 'admin', 'POST', '', input, 403);
  await call(draft.id, 'transportista', 'POST', '', input, 409);
  await call(manifest.id, 'transportista', 'POST', '', { ...input, numero: 'FAKE' }, 400);
  const adenda = (await call(manifest.id, 'transportista', 'POST', '', input, 201)).adenda;
  assert.equal(adenda.declaracion.numero, manifest.numero); assert.equal(adenda.declaracion.residuos[0].cantidad, 10);
  assert.equal(adenda.estadoRevision, 'PENDIENTE');
  assert.deepEqual((await call(manifest.id, 'transportista', 'POST', '', input, 201)).adenda, adenda);
  await call(manifest.id, 'transportista', 'POST', '', { ...input, motivo: 'Conflicting replay' }, 409);
  await call(other.id, 'transportista', 'POST', '', input, 409);
  const concurrent = { ...input, id: randomUUID() };
  const twice = await Promise.all([1, 2].map(() => call(manifest.id, 'operador', 'POST', '', concurrent, 201)));
  assert.equal(twice[0].adenda.id, twice[1].adenda.id);
  const review = { id: randomUUID(), version: 0, decision: 'APROBADA', nota: 'QA evidencia revisada' };
  await call(manifest.id, 'transportista', 'POST', `/${adenda.id}/revisiones`, review, 403);
  await call(manifest.id, 'generador', 'POST', `/${adenda.id}/revisiones`, review, 403);
  await call(manifest.id, 'jefe-operadores', 'POST', `/${adenda.id}/revisiones`, review, 403);
  await call(other.id, 'admin', 'POST', `/${adenda.id}/revisiones`, review, 404);
  const approved = (await call(manifest.id, 'admin', 'POST', `/${adenda.id}/revisiones`, review)).adenda;
  assert.equal(approved.estadoRevision, 'APROBADA');
  assert.deepEqual((await call(manifest.id, 'admin', 'POST', `/${adenda.id}/revisiones`, review)).adenda, approved);
  await call(manifest.id, 'admin', 'POST', `/${adenda.id}/revisiones`, { ...review, nota: 'Changed replay' }, 409);
  const statuses = await Promise.all([1, 2].map(async n => {
    const res = await fetch(`${base}/manifiestos/${manifest.id}/adendas/${adenda.id}/revisiones`, { method: 'POST', headers: { Authorization: 'Bearer ' + await token('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: randomUUID(), version: 1, decision: 'OBSERVADA', nota: 'Concurrent reviewer ' + n }) }); return res.status;
  }));
  assert.deepEqual(statuses.sort(), [200, 409]);
  const rectification = (await call(manifest.id, 'operador', 'POST', '', { ...input, id: randomUUID(), rectificaId: adenda.id, motivo: 'Rectificación aditiva' }, 201)).adenda;
  assert.equal(rectification.rectificaId, adenda.id); assert.equal(rectification.estadoRevision, 'PENDIENTE');
  await call(other.id, 'operador', 'POST', '', { ...input, id: randomUUID(), rectificaId: adenda.id }, 400);
  const list = await call(manifest.id, 'generador'); assert.equal(list.total, 3); assert.equal(list.puedeRegistrar, false);
  assert.ok(list.adendas.every((a: { puedeResolver: boolean }) => !a.puedeResolver));
  for (const m of [manifest, other, draft]) assert.deepEqual(await db.manifiesto.findUniqueOrThrow({ where: { id: m.id }, include: { residuos: true, eventos: true } }), m);
  const originalIds = historical.map((m: { id: string }) => m.id);
  assert.deepEqual(await db.manifiesto.findMany({ where: { id: { in: originalIds } }, orderBy: { id: 'asc' }, include: { residuos: true, eventos: true } }), historical);
  await writeFile(path.join(output, 'addenda-http.json'), JSON.stringify({ passed: true, cases: [
    'assigned carrier/operator only; outsiders denied', 'draft rejected; forged original rejected', 'idempotent creation/replay/concurrent creation',
    'canonical declaration and official number preserved', 'reviewer permissions and independent resolution', 'optimistic concurrency and replay',
    'rectification appends and cannot cross manifests', 'generator read only', 'existing manifests/residues/signatures/events unchanged',
  ] }, null, 2));
} finally { await db.$disconnect(); }
