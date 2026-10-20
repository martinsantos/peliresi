import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
for (const key of externalKeys) assert.equal(process.env[key], '');
const { PrismaClient } = backendRequire('@prisma/client');
const { ejecutarCatalogo, simularCatalogo } = backendRequire(path.join(root, 'backend/dist/jobs/alertCatalogue.job.js'));
const db = new PrismaClient(), out = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(readFileSync(path.join(out, 'psip-deadlines-fixture.json'), 'utf8'));
const phase = process.argv[2]; assert.ok(['before', 'after'].includes(phase));
try {
  const records = Object.values(fixture.cases).flatMap((group: any) => Object.values(group).flatMap((item: any) => item.id ? [item] : Object.values(item))) as any[];
  assert.equal(records.length, 39);
  const ids = new Set(records.map(record => record.id));
  const condition = '{"tipo":"requerimiento_inspeccion"}';
  const now = phase === 'before' ? new Date(Date.parse(fixture.createdAt) + 1000) : new Date();
  const counts = () => Promise.all([db.alertaGenerada.count(), db.notificacion.count(), db.emailQueue.count()]);
  const before = await counts();
  const simulation = await simularCatalogo(condition, now);
  assert.deepEqual(await counts(), before, 'Simulation is read-only');
  await ejecutarCatalogo(now);
  const all = await db.alertaGenerada.findMany({ where: { reglaId: fixture.ruleId } });
  const scoped = all.filter((record: any) => ids.has(JSON.parse(record.datos).inspeccionId));
  const currentUsers = await db.usuario.findMany({ where: { activo: true, rol: 'ADMIN' }, select: { id: true } });
  let notices = 0, resolved = 0, pending = 0, sourcesPreserved = 0;
  for (const record of records) {
    const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: record.id }, include: { intercambios: true } });
    assert.ok(inspection.numero.startsWith(fixture.prefix));
    for (const original of record.requirements) {
      const entry = inspection.intercambios.find((entry: any) => entry.id === original.id);
      assert.equal(entry.hashCadena, original.hash);
      assert.equal(entry.plazoRespuestaAt?.toISOString() || null, original.deadline);
      sourcesPreserved++;
    }
  }
  for (const item of scoped) {
    const facts = JSON.parse(item.datos), entry = await db.intercambioInspeccion.findUniqueOrThrow({ where: { id: facts.entidadId }, include: { respuestas: true, inspeccion: true } });
    assert.equal(facts.vencimiento, entry.plazoRespuestaAt.toISOString());
    const owner = fixture.actors[entry.inspeccion.tipoActor].userId;
    const expected = [...new Set([owner, fixture.inspectorId, ...currentUsers.map((user: any) => user.id)])].sort();
    const delivered = await db.notificacion.findMany({ where: { datos: { contains: `"casoId":"${item.id}"` } } });
    assert.deepEqual(delivered.map((notice: any) => notice.usuarioId).sort(), expected, 'Exact linked actor, assigned inspector and active global administrators');
    for (const notice of delivered) {
      const data = JSON.parse(notice.datos);
      assert.equal(data.destino, notice.usuarioId === owner ? 'participacion' : 'inspeccion');
      assert.equal(data.tipo, 'requerimiento_inspeccion');
    }
    notices += delivered.length;
    const answered = entry.respuestas.some((reply: any) => reply.parte === 'INSPECCIONADO' && ['RESPUESTA', 'DESCARGO', 'SUBSANACION'].includes(reply.tipo));
    if (phase === 'after' && answered) {
      assert.equal(item.estado, 'RESUELTA');
      assert.equal(entry.inspeccion.estado, 'EN_DESCARGO', 'Resolving absence does not accept compliance or close the inspection');
      assert.match(item.notas, /No certifica subsanación/);
      resolved++;
    } else { assert.equal(item.estado, 'PENDIENTE'); pending++; }
  }
  if (phase === 'before') { assert.equal(scoped.length, 18); assert.equal(pending, 18); }
  else { assert.equal(resolved, 9); assert.ok(pending >= 9 && pending <= 12); }
  const snapshot = scoped.map((item: any) => ({ id: item.id, createdAt: item.createdAt.toISOString(), datos: item.datos, estado: item.estado }));
  const noticeState = await db.notificacion.findMany({ where: { OR: scoped.map((item: any) => ({ datos: { contains: `"casoId":"${item.id}"` } })) }, select: { id: true, leida: true } });
  await ejecutarCatalogo(new Date(now.getTime() + 1));
  const repeated = (await db.alertaGenerada.findMany({ where: { reglaId: fixture.ruleId } })).filter((item: any) => ids.has(JSON.parse(item.datos).inspeccionId));
  assert.deepEqual(repeated.map((item: any) => ({ id: item.id, createdAt: item.createdAt.toISOString(), datos: item.datos, estado: item.estado })).sort((a: any, b: any) => a.id.localeCompare(b.id)), snapshot.sort((a: any, b: any) => a.id.localeCompare(b.id)), 'No repeated cases or altered original evidence');
  const repeatedNotices = await db.notificacion.findMany({ where: { OR: scoped.map((item: any) => ({ datos: { contains: `"casoId":"${item.id}"` } })) }, select: { id: true, leida: true } });
  assert.deepEqual(repeatedNotices.sort((a: any, b: any) => a.id.localeCompare(b.id)), noticeState.sort((a: any, b: any) => a.id.localeCompare(b.id)), 'No duplicate reminders or reset of read status');
  assert.equal(await db.emailQueue.count(), fixture.emailQueue, 'No email queued');
  if (phase === 'after') await db.reglaAlerta.update({ where: { id: fixture.ruleId }, data: { activa: false } });
  writeFileSync(path.join(out, `deadline-catalogue-${phase}.json`), JSON.stringify({ phase, cases: scoped.length, notices, resolved, pending,
    sourceEntriesPreserved: sourcesPreserved, simulationReadOnly: true, duplicateCases: 0, duplicateNotices: 0, readStatusPreserved: true,
    emailQueueUnchanged: true, capClosed: true, providersEmpty: true, ownQaRuleDeactivated: phase === 'after', production: false }, null, 2));
  console.log(`PSIP catalogue ${phase}: exact recipients, no duplicates, original sources preserved, no email.`);
} finally { await db.$disconnect(); }
