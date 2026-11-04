/** Reuse six previously audited artificial cases without relabeling their run. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const previous = '/work/sitrep/.qa-operational-ui-current2026110101';
const out = '/work/sitrep/.qa-operational-ui-current2026110102';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'scheduled-cut-regression-62516a08');
assert.equal(process.env.GITHUB_SHA, '62516a08a3fe189d7d5612520d678162674f1b32');
assert.equal(process.env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const audit = JSON.parse(readFileSync(path.join(previous, 'scheduled-cut-lifecycle-audit-candidate-mail-v3.json'), 'utf8'));
assert.equal(audit.productCommit, process.env.GITHUB_SHA);
assert.equal(audit.synthetic, true); assert.equal(audit.production, false);
assert.equal(audit.inSituBrowserCases, 6); assert.equal(audit.preferredLinksOpenedByEachParty, true);
const source = path.join(previous, 'proposal-e2e-candidate-mail-v3');
const destination = path.join(out, 'proposal-e2e-candidate-mail-v3');
assert.equal(existsSync(destination), false);
const entries = readdirSync(source, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => ({ name: entry.name, file: path.join(source, entry.name, 'proof.json') }))
  .filter(entry => existsSync(entry.file));
assert.equal(entries.length, 6);
const proofs = entries.map(entry => ({ ...entry, proof: JSON.parse(readFileSync(entry.file, 'utf8')) }));
assert.deepEqual(proofs.map(({ proof }) => `${proof.surface}:${proof.creator}`).sort(),
  ['app:generador', 'app:operador', 'app:transportista', 'web-desktop:generador', 'web-desktop:operador', 'web-desktop:transportista']);

const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  for (const { proof } of proofs) {
    assert.equal(proof.approvals, 3); assert.equal(proof.noTripOrGps, true); assert.deepEqual(proof.errors, []);
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id },
      select: { numero: true, isDemoData: true, modalidad: true, estado: true, transportistaId: true, fechaRetiro: true } });
    assert.equal(manifest.numero, proof.numero); assert.equal(manifest.isDemoData, true);
    assert.equal(manifest.modalidad, 'IN_SITU'); assert.equal(manifest.estado, 'RECIBIDO');
    assert.ok(manifest.transportistaId); assert.equal(manifest.fechaRetiro, null);
    for (const tipo of ['FIRMA', 'APROBACION_TRANSPORTISTA', 'APROBACION_OPERADOR'])
      assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: proof.id, tipo } }), 1);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: proof.id } }), 0);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: proof.id } }), 0);
  }
  mkdirSync(destination, { mode: 0o700 });
  const copied: Array<{ case: string; sha256: string }> = [];
  for (const { name, file } of proofs) {
    const dir = path.join(destination, name);
    mkdirSync(dir, { mode: 0o700 });
    copyFileSync(file, path.join(dir, 'proof.json'), constants.COPYFILE_EXCL);
    copied.push({ case: name, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
  }
  writeFileSync(path.join(out, 'prior-insitu-proofs.json'), JSON.stringify({ synthetic: true, production: false,
    source: previous, attempt: 'candidate-mail-v3', productCommit: audit.productCommit, copied }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Se verificaron y referenciaron seis casos artificiales previos del mismo candidato.');
} finally { await db.$disconnect(); }
