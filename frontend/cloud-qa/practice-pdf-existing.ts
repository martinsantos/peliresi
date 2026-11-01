/** Read previously created synthetic cases; prove the missing label and the correction without altering issued PDFs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-practice-pdf-20261101';
const old = '/work/sitrep/.qa-operational-ui-current2026110105';
const stage = process.env.QA_PDF_STAGE;
assert.equal(process.env.QA_ARTIFACTS, out);
assert.ok(stage === 'before' || stage === 'after');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
const running = stage === 'before' ? old : out;
const expectedBackend = stage === 'before' ? 'closure-540ecfff' : 'practice-pdf-cb4edebc';
for (const item of JSON.parse(readFileSync(path.join(running, 'processes.json'), 'utf8'))) {
  const env = Object.fromEntries(readFileSync(`/proc/${item.pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assert.equal(env.QA_COMPAT_BACKEND, expectedBackend);
  assert.equal(env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
}
const proofs = readdirSync(path.join(old, 'manifest-complete'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(old, 'manifest-complete', entry.name, 'proof.json'))
  .filter(existsSync).map(file => JSON.parse(readFileSync(file, 'utf8')))
  .filter(proof => proof.creator === 'operador');
assert.deepEqual(proofs.map(proof => proof.surface).sort(), ['app', 'web-desktop']);
const credentials = JSON.parse(readFileSync(path.join(old, 'handoff-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const notice = 'DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL';
const result: Array<Record<string, unknown>> = [];
try {
  for (const [index, proof] of proofs.entries()) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id },
      include: { generador: { include: { usuario: true } }, transportista: { include: { usuario: true } }, operador: { include: { usuario: true } } } });
    assert.equal(manifest.isDemoData, true); assert.equal(manifest.numero, proof.numero);
    assert.equal(manifest.estado, 'TRATADO');
    for (const actor of [manifest.generador, manifest.transportista, manifest.operador]) {
      assert.ok(actor); assert.match(actor.razonSocial, /^QA /); assert.match(actor.usuario.email, /@night-qa\.invalid$/);
    }
    const login = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.70.${index + (stage === 'before' ? 1 : 11)}` },
      body: JSON.stringify({ email: 'generador@night-qa.invalid', password: credentials.password }) });
    assert.equal(login.status, 200);
    const token = (await login.json()).data.tokens.accessToken;
    const getPdf = async (route: string) => {
      const response = await fetch('http://127.0.0.1:4177/api' + route, { headers: { Authorization: 'Bearer ' + token } });
      assert.equal(response.status, 200); assert.match(response.headers.get('content-type') || '', /application\/pdf/);
      return Buffer.from(await response.arrayBuffer());
    };
    const bytes = await getPdf('/pdf/manifiesto/' + proof.id);
    const file = path.join(out, `${stage}-manifiesto-${proof.surface}.pdf`);
    writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
    const pages = execFileSync('pdftotext', ['-raw', file, '-'], { encoding: 'utf8' }).split('\f').filter(page => page.trim());
    assert.ok(pages.length > 0);
    if (stage === 'before') assert.ok(pages.some(page => !page.includes(notice)));
    else for (const page of pages) assert.ok(page.includes(notice));
    const certificate = await db.certificadoManifiesto.findFirstOrThrow({ where: { manifiestoId: proof.id, tipo: 'FINAL' },
      select: { id: true, pdfSha256: true } });
    const existing = await getPdf(`/manifiestos/${proof.id}/certificados/${certificate.id}/archivo`);
    assert.equal(hash(existing), certificate.pdfSha256);
    result.push({ surface: proof.surface, id: proof.id, numero: proof.numero,
      manifestPages: pages.length, manifestSha256: hash(bytes), priorCertificateSha256: hash(existing) });
  }
  result.sort((a, b) => String(a.surface).localeCompare(String(b.surface)));
  if (stage === 'after') {
    const before = JSON.parse(readFileSync(path.join(out, 'existing-before.json'), 'utf8'));
    for (const [i, item] of result.entries()) {
      assert.equal(item.id, before.results[i].id);
      assert.equal(item.priorCertificateSha256, before.results[i].priorCertificateSha256);
    }
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(path.join(out, `existing-${stage}.json`), JSON.stringify({ synthetic: true, stage, results: result }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`${stage}: ${result.length} synthetic manifest PDFs inspected; issued certificate hashes preserved.`);
} finally { await db.$disconnect(); }
