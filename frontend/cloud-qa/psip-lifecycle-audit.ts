import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!;
assert.ok(['/work/sitrep/.qa-operational-ui-current2026103060',
  '/work/sitrep/.qa-operational-ui-current2026103070'].includes(out));
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const fixture = JSON.parse(readFileSync(path.join(out, 'psip-lifecycle-fixture.json'), 'utf8'));
const report = JSON.parse(readFileSync(path.join(out, 'psip-lifecycle-current.json'), 'utf8'));
assert.equal(report.stats.expected, 6); assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0);
const browser = path.join(out, 'psip-lifecycle-current');
const proofs = readdirSync(browser, { withFileTypes: true }).filter(e => e.isDirectory())
  .map(e => path.join(browser, e.name, 'psip-lifecycle-proof.json')).filter(existsSync).map(f => JSON.parse(readFileSync(f, 'utf8')));
assert.equal(proofs.length, 6);
assert.deepEqual(proofs.map(p => `${p.surface}:${p.type}`).sort(),
  ['app:GENERADOR','app:OPERADOR','app:TRANSPORTISTA','web-desktop:GENERADOR','web-desktop:OPERADOR','web-desktop:TRANSPORTISTA']);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const checks: Array<Record<string, unknown>> = [];
try {
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' }, select: { id: true } });
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' }, select: { id: true } });
  for (const proof of proofs) {
    assert.equal(proof.id, fixture.cases[proof.surface][proof.type]);
    const row = await db.inspeccion.findUniqueOrThrow({ where: { id: proof.id }, include: { intercambios: { orderBy: { secuencia: 'asc' }, include: { adjuntos: true } } } });
    assert.match(row.numero, /^QA-PSIP-LIFECYCLE-/); assert.equal(row.numero, proof.caseNumber);
    assert.equal(row.estado, 'CERRADA_CONFORME'); assert.equal(row.plazoRespuestaAt, null);
    assert.deepEqual(row.intercambios.map((e: any) => e.tipo), ['REQUERIMIENTO','DESCARGO','REQUERIMIENTO','SUBSANACION','CIERRE_CONFORME']);
    assert.deepEqual(row.intercambios.map((e: any) => e.secuencia), [1,2,3,4,5]);
    assert.equal(row.intercambios[1].respondeAId, row.intercambios[0].id);
    assert.equal(row.intercambios[2].respondeAId, row.intercambios[1].id);
    assert.equal(row.intercambios[3].respondeAId, row.intercambios[2].id);
    assert.equal(row.intercambios[3].adjuntos.length, 1);
    const attachment = row.intercambios[3].adjuntos[0];
    assert.equal(attachment.nombreOriginal, 'constancia-qa-psip.pdf');
    const expected = createHash('sha256').update('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n').digest('hex');
    assert.equal(attachment.sha256, expected);
    const uploadRoot = path.resolve(process.env.UPLOADS_DIR!), filename = path.resolve(uploadRoot, attachment.storageKey);
    assert.ok(filename.startsWith(uploadRoot + path.sep));
    assert.equal(createHash('sha256').update(readFileSync(filename)).digest('hex'), expected);
    for (const entry of row.intercambios) {
      const notices = (await db.notificacion.findMany({ where: { datos: { contains: entry.id } }, select: { usuarioId: true, datos: true } }))
        .filter((n: any) => { try { return JSON.parse(n.datos || '{}').intercambioId === entry.id; } catch { return false; } });
      assert.equal(notices.some((n: any) => n.usuarioId === entry.autorId), false);
      if (entry.parte === 'AUTORIDAD') assert.equal(notices.filter((n: any) => n.usuarioId === fixture.actors[proof.type].userId).length, 1);
      else { assert.equal(notices.filter((n: any) => n.usuarioId === admin.id).length, 1); assert.equal(notices.filter((n: any) => n.usuarioId === inspector.id).length, 1); }
    }
    checks.push({ surface: proof.surface, role: proof.type, exchanges: 5, attachmentVerified: true, noticesVerified: true, unrelatedActorDenied: true });
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(path.join(out, 'psip-lifecycle-audit.json'), JSON.stringify({ checks, synthetic: true, production: false, emailAttempts: 0, emailSent: 0, pushEnabled: false }, null, 2), { mode: 0o600 });
  console.log('Se verificaron seis ciclos PSIP artificiales con sus avisos y adjuntos.');
} finally { await db.$disconnect(); }
