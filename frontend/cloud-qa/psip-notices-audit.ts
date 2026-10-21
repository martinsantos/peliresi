import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
for (const key of externalKeys) assert.equal(process.env[key], '');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient(), out = process.env.QA_ARTIFACTS!;
const baselinePath = path.join(out, 'notices-delivery-baseline.json');
try {
  if (process.argv[2] === 'baseline') {
    writeFileSync(baselinePath, JSON.stringify({ emailQueue: await db.emailQueue.count(), at: new Date().toISOString() }));
    console.log('Synthetic delivery baseline saved; CAP closed, SMTP/VAPID empty.');
  } else {
    const fixture = JSON.parse(readFileSync(path.join(out, 'psip-fixture.json'), 'utf8'));
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    assert.equal(await db.emailQueue.count(), baseline.emailQueue, 'No mail enqueued during the exercise');
    const cases = Object.values(fixture.cases).flatMap(group => Object.values(group as Record<string, string>));
    const users = await db.usuario.findMany({ include: { generador: true, transportista: true, operador: true } });
    let exchangeCount = 0, noticeCount = 0;
    const records = [];
    for (const id of cases) {
      const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id }, include: { intercambios: { orderBy: { secuencia: 'asc' } } } });
      assert.ok(inspection.numero.startsWith(fixture.prefix), 'Only cases from this synthetic fixture');
      assert.equal(inspection.intercambios.length, 9);
      for (const exchange of inspection.intercambios) {
        const participant = exchange.parte === 'AUTORIDAD';
        const relation = inspection.tipoActor === 'GENERADOR' ? 'generador' : inspection.tipoActor === 'TRANSPORTISTA' ? 'transportista' : 'operador';
        const actorId = inspection[relation + 'Id'];
        const expected = users.filter(user => user.activo && user.id !== exchange.autorId && (participant
          ? user.rol === inspection.tipoActor && user[relation]?.id === actorId
          : user.rol === 'ADMIN' || user.rol === 'ADMIN_' + inspection.tipoActor || user.esInspector && user.id === inspection.inspectorId))
          .map(user => user.id).sort();
        assert.ok(expected.length > 0);
        const notices = await db.notificacion.findMany({ where: { datos: { contains: `"intercambioId":"${exchange.id}"` } } });
        assert.deepEqual(notices.map(notice => notice.usuarioId).sort(), expected, 'Exact recipients, no inactive, other sector, other actor or duplicate author');
        for (const notice of notices) {
          const data = JSON.parse(notice.datos!);
          assert.equal(data.correoVersion, 1); assert.equal(data.destino, participant ? 'participacion' : 'inspeccion');
          assert.equal(data.inspeccionId, id); assert.equal(data.evento, exchange.tipo);
        }
        exchangeCount++; noticeCount += notices.length;
      }
      records.push({ id, estado: inspection.estado, exchanges: inspection.intercambios.length });
    }
    // Real PostgreSQL rollback: no orphan notice can survive a failed business transaction.
    const { createInspectionExchangeNotices } = backendRequire(path.join(root, 'backend/dist/services/inspectionExchangeNotice.service.js'));
    const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: cases[0] } });
    const authority = users.find(user => user.activo && user.rol === 'ADMIN')!;
    const countBefore = await db.notificacion.count();
    await assert.rejects(db.$transaction(async tx => {
      await createInspectionExchangeNotices(tx, inspection, { id: 'qa-deliberate-rollback', secuencia: 999, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', autorId: authority.id });
      assert.equal(await tx.notificacion.count(), countBefore + 1);
      throw new Error('QA_ROLLBACK_EXPECTED');
    }), /QA_ROLLBACK_EXPECTED/);
    assert.equal(await db.notificacion.count(), countBefore);
    // A disabled linked actor does not receive an authority notice. Changes are rolled back.
    const ownerId = users.find(user => user.generador?.id === inspection.generadorId)!.id;
    await assert.rejects(db.$transaction(async tx => {
      await tx.usuario.update({ where: { id: ownerId }, data: { activo: false } });
      await createInspectionExchangeNotices(tx, inspection, { id: 'qa-disabled-rollback', secuencia: 999, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', autorId: authority.id });
      assert.equal(await tx.notificacion.count(), countBefore);
      throw new Error('QA_DISABLED_ROLLBACK_EXPECTED');
    }), /QA_DISABLED_ROLLBACK_EXPECTED/);
    assert.equal(await db.notificacion.count(), countBefore);
    assert.equal(await db.emailQueue.count(), baseline.emailQueue);
    writeFileSync(path.join(out, 'notices-delivery-audit.json'), JSON.stringify({ synthetic: true, production: false, cases: records,
      exchangeCount, noticeCount, recipientsExact: true, atomicRollback: true, inactiveExcluded: true, emailsEnqueued: 0,
      capClosed: true, smtpEmpty: true, vapidEmpty: true, pushEnabled: false }, null, 2));
    console.log(`${exchangeCount} exchanges / ${noticeCount} internal notices verified; exact recipients, rollback, no mail queue changes.`);
  }
} finally { await db.$disconnect(); }
