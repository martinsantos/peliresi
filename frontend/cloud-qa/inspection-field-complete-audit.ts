import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-opening-20261031';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-opening');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const run = process.env.QA_OPENING_RUN || '';
assert.match(run, /^(field|legal)-v\d+$/);
const expectedOutcome = run.startsWith('legal-') ? 'DERIVADA_LEGALES' : 'CERRADA_CONFORME';
const expectedDecision = expectedOutcome === 'DERIVADA_LEGALES' ? 'DERIVACION_LEGALES' : 'CIERRE_CONFORME';
const report = JSON.parse(readFileSync(path.join(out, `browser-${run}.json`), 'utf8'));
assert.equal(report.stats.expected, 2);
assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0);
const browser = path.join(out, 'browser-' + run);
const proofs = readdirSync(browser, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => path.join(browser, entry.name, 'inspection-full-proof.json')).filter(existsSync)
  .map(file => JSON.parse(readFileSync(file, 'utf8')));
assert.deepEqual(proofs.map(proof => proof.surface).sort(), ['app', 'web-desktop']);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const actor = await db.usuario.findUniqueOrThrow({ where: { email: 'generador2@night-qa.invalid' }, include: { generador: true } });
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' }, select: { id: true } });
  assert.ok(actor.generador && actor.generador.razonSocial.startsWith('QA '));
  for (const proof of proofs) {
    assert.equal(proof.synthetic, true); assert.equal(proof.production, false);
    assert.equal(proof.outcome, expectedOutcome); assert.equal(proof.openedFromNotice, true);
    const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: proof.inspectionId },
      include: { eventos: true, intercambios: { orderBy: { secuencia: 'asc' } } } });
    assert.equal(inspection.generadorId, actor.generador.id); assert.equal(inspection.inspectorId, inspector.id);
    assert.equal(inspection.estado, expectedOutcome);
    assert.equal(inspection.eventos.filter((event: any) => event.tipo === 'CREADA').length, 1);
    assert.deepEqual(inspection.intercambios.map((entry: any) => entry.tipo), ['REQUERIMIENTO', 'DESCARGO', expectedDecision]);
    assert.deepEqual(inspection.intercambios.map((entry: any) => entry.secuencia), [1, 2, 3]);
    assert.equal(inspection.intercambios[0].id, proof.requirementId);
    assert.equal(inspection.intercambios[1].respondeAId, proof.requirementId);
    assert.equal(inspection.intercambios[1].autorId, actor.id);
    for (const entry of inspection.intercambios) {
      const notices = (await db.notificacion.findMany({ where: { datos: { contains: entry.id } }, select: { usuarioId: true, datos: true } }))
        .filter((notice: any) => { try { return JSON.parse(notice.datos || '{}').intercambioId === entry.id; } catch { return false; } });
      assert.equal(new Set(notices.map((notice: any) => notice.usuarioId)).size, notices.length);
      assert.equal(notices.some((notice: any) => notice.usuarioId === entry.autorId), false);
      if (entry.parte === 'AUTORIDAD') assert.equal(notices.filter((notice: any) => notice.usuarioId === actor.id).length, 1);
      else assert.ok(notices.some((notice: any) => notice.usuarioId === inspector.id));
    }
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(path.join(out, `audit-${run}.json`), JSON.stringify({ synthetic: true, production: false,
    cases: proofs.length, outcome: expectedOutcome, openingToDecision: true, noticesVerified: true, emailAttempts: 0, emailSent: 0, pushEnabled: false }), { flag: 'wx', mode: 0o600 });
  console.log('Dos inspecciones artificiales completas con requerimiento, respuesta, decisión y avisos verificados.');
} finally { await db.$disconnect(); }
