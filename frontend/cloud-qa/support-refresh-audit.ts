import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-support-refresh-20261031';
const commit = 'd121a481d5aae6e5990be8aebea7f80cdf2f990a';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'support-refresh-20261031');
assert.equal(process.env.GITHUB_SHA, commit);
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const backend = read('backend-reuse.json');
assert.equal(backend.fromCommit, 'a624b232bc3ca48a2f7e8582e8051170372070ed');
assert.equal(backend.toCommit, commit); assert.deepEqual(backend.changedBackendFiles, []);
assert.match(read('runtime-proof.json').backend, /backend\/dist-qa-support-mail-20261031\/index\.js$/);
for (const stage of ['before', 'after']) {
  const source = read(`source-${stage}.json`);
  assert.equal(source.commit, commit); assert.equal(source.files, 911);
  assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
}
const browser = read('e2e.json');
assert.equal(browser.stats.expected, 6); assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.flaky, 0); assert.equal(browser.stats.skipped, 0); assert.deepEqual(browser.errors, []);
for (const { pid } of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const manual = readFileSync('/work/sitrep/docs/manual/help-data.js');
const response = await fetch('http://127.0.0.1:4177/manual/help-data.js');
assert.equal(response.status, 200); assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(manual));
const dirs = readdirSync(path.join(out, 'e2e'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => path.join(out, 'e2e', entry.name));
const proofs = (name: string) => dirs.map(dir => path.join(dir, name)).filter(existsSync).map(file => JSON.parse(readFileSync(file, 'utf8')));
const refresh = proofs('proof.json'), multirole = proofs('multirole-proof.json');
assert.equal(refresh.length, 3); assert.equal(multirole.length, 3);
for (const group of [refresh, multirole]) assert.deepEqual(group.map(item => item.surface).sort(), ['app', 'web-desktop', 'web-responsive']);
assert.ok(refresh.every(item => item.actions === 2 && item.rejectedReads >= 2 && item.confirmedAfterReopen && item.noDuplicate));
assert.ok(multirole.every(item => item.separated && item.replySent === false && item.first !== item.second));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  for (const proof of refresh) {
    const ticket = await db.ticketSoporte.findUniqueOrThrow({ where: { id: proof.ticketId }, select: { estado: true, autor: { select: { email: true } } } });
    assert.equal(ticket.autor.email, 'admin@night-qa.invalid'); assert.equal(ticket.estado, 'CERRADO');
    for (const accion of ['TOMAR', 'CERRAR']) assert.equal(await db.eventoSoporte.count({ where: { ticketId: proof.ticketId, accion } }), 1);
  }
  for (const proof of multirole) {
    const ticket = await db.ticketSoporte.findUniqueOrThrow({ where: { id: proof.ticketId }, select: { estado: true, autor: { select: { email: true } } } });
    assert.equal(ticket.autor.email, 'draft-multirole-20261024@night-qa.invalid');
    assert.equal(ticket.estado, 'ABIERTO');
    assert.equal(await db.eventoSoporte.count({ where: { ticketId: proof.ticketId, accion: 'RESPONDER' } }), 0);
  }
  const { TRAINING_LOGINS } = backendRequire('/work/sitrep/backend/dist-qa-support-mail-20261031/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const login = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.33.99' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(login.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const proof = { commit, synthetic: true, refreshCases: refresh.length, multiroleCases: multirole.length,
    manualSha256: digest(manual), capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'support-refresh-audit.json'), JSON.stringify(proof, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
