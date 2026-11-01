/** Read-only verification of the artificial documents created by the UI journeys. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const root = process.env.QA_ARTIFACTS!;
assert.ok(/^\/work\/sitrep\/\.qa-operational-ui-current\d+$/.test(root)
  || root === '/work/sitrep/.qa-toast-compact-fix-20261029'
  || root === '/work/sitrep/.qa-legacy-integrity-20261030'
  || root === '/work/sitrep/.qa-incident-retry-final-20261101', 'Unexpected QA artifacts directory');
const browser = path.join(root, 'manifest-complete');
const proofs = readdirSync(browser, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => path.join(browser, entry.name, 'complete-lifecycle.json')).filter(existsSync)
  .map(file => JSON.parse(readFileSync(file, 'utf8')));
const allCreators = process.env.QA_LIFECYCLE_ALL_CREATORS === 'true';
if (allCreators) {
  assert.deepEqual(proofs.map(proof => `${proof.surface}:${proof.creator}`).sort(),
    ['app:generador', 'app:operador', 'app:transportista',
      'web-desktop:generador', 'web-desktop:operador', 'web-desktop:transportista']);
} else assert.deepEqual(proofs.map(proof => proof.surface).sort(), ['app', 'web-desktop']);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const results: unknown[] = [];
try {
  for (const proof of proofs) {
    assert.equal(proof.originalRemainsObserved, true);
    assert.equal(proof.samePdfAcrossParties, true);
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id },
      include: { residuos: { include: { tipoResiduo: true } } } });
    assert.equal(manifest.isDemoData, true);
    assert.equal(manifest.numero, proof.numero);
    assert.deepEqual(manifest.residuos.map((row: any) => [row.tipoResiduo.codigo, row.cantidad, row.cantidadRecibida]), [['Y1', 21, 22]]);
    const original = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: proof.finding } });
    const correction = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: proof.rectification } });
    assert.equal(original.manifiestoId, manifest.id);
    assert.equal(correction.manifiestoId, manifest.id);
    assert.equal(correction.rectificaId, original.id);
    assert.equal((original.revisiones as any[]).at(-1).decision, 'OBSERVADA');
    assert.equal((correction.revisiones as any[]).at(-1).decision, 'APROBADA');
    const finalProof = proof.certificates.find((certificate: any) => certificate.tipo === 'FINAL');
    assert.ok(finalProof);
    const certificate = await db.certificadoManifiesto.findUniqueOrThrow({ where: { id: finalProof.id } });
    assert.equal(certificate.manifiestoId, manifest.id);
    assert.equal(certificate.tipo, 'FINAL');
    const document = certificate.documento as any;
    assert.equal(document.artificial, true);
    assert.deepEqual(document.cantidades.map((row: any) => [row.corriente, row.cantidad, row.unidad]), [['Y1', 22, 'kg'], ['Y12', 1, 'kg']]);
    assert.equal(document.cantidades[1].origen, 'HALLAZGO');
    assert.ok(document.cantidades[1].adendas.some((addendum: any) => addendum.id === correction.id));
    const digest = createHash('sha256').update(certificate.pdf).digest('hex');
    assert.equal(digest, certificate.pdfSha256);
    assert.equal(digest, finalProof.sha256);
    const pdf = path.join(root, 'final-' + proof.surface + (allCreators ? '-' + proof.creator : '') + '.pdf');
    writeFileSync(pdf, certificate.pdf);
    const text = execFileSync('pdftotext', ['-raw', pdf, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
    assert.match(text, /Y1\s+22\s+kg/);
    assert.match(text, /Y12\s+1\s+kg/);
    assert.match(text, /SIN VALIDEZ OFICIAL/);
    results.push({ surface: proof.surface, creator: proof.creator, manifest: proof.numero, certificate: certificate.numero, sha256: digest,
      declaration: 'Y1 21 kg', received: 'Y1 22 kg', treatedFinding: 'Y12 1 kg', original: 'OBSERVADA', rectification: 'APROBADA' });
  }
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  writeFileSync(path.join(root, 'receipts-verified.json'), JSON.stringify({ at: new Date().toISOString(), results, emailSent: 0, emailAttempts: 0 }, null, 2));
  console.log(JSON.stringify({ verified: results.length, results, emailSent: 0, emailAttempts: 0 }));
} finally { await db.$disconnect(); }
