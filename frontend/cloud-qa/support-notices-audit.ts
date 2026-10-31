import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const variants = {
  'support-notices-20261031': { out: '/work/sitrep/.qa-support-notices-20261031', commit: '77a4295172a0c0e20e18a6a70a6b5994f1ac7409', cases: 6, tickets: 3, backend: 'support-notices' },
  'support-mail-20261031': { out: '/work/sitrep/.qa-support-mail-20261031', commit: 'a624b232bc3ca48a2f7e8582e8051170372070ed', cases: 2, tickets: 2, backend: 'support-mail' },
} as const;
const version = process.env.QA_COMPAT_BACKEND as keyof typeof variants;
const variant = variants[version];
assert.ok(variant);
const out = variant.out;
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.GITHUB_SHA, variant.commit);
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const browser = read('e2e.json');
assert.equal(browser.stats.expected, variant.cases);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.flaky, 0);
assert.equal(browser.stats.skipped, 0);
assert.deepEqual(browser.errors, []);
const started = new Date(browser.stats.startTime);
assert.ok(Number.isFinite(started.getTime()));

for (const { pid } of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const manual = readFileSync('/work/sitrep/docs/manual/help-data.js');
const response = await fetch('http://127.0.0.1:4177/manual/help-data.js');
assert.equal(response.status, 200);
assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(manual));

const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const tickets = await db.ticketSoporte.findMany({
    where: { asunto: { startsWith: 'QA circuito completo ' }, createdAt: { gte: started } },
    select: { id: true, autorId: true, responsableId: true, autor: { select: { email: true } } },
  });
  assert.equal(tickets.length, variant.tickets);
  for (const ticket of tickets) {
    assert.match(ticket.autor.email, /@night-qa\.invalid$/);
    assert.ok(ticket.responsableId);
    const notices = await db.notificacion.findMany({ where: { datos: { contains: `"ticketId":"${ticket.id}"` } },
      select: { usuarioId: true, titulo: true, mensaje: true, datos: true } });
    const parsed = notices.map((notice: { usuarioId: string; titulo: string; mensaje: string; datos: string | null }) => ({ ...notice, data: JSON.parse(notice.datos || '{}') }));
    for (const [event, title] of [['ESPERAR', 'Se solicitó una respuesta'], ['CERRAR', 'Ticket cerrado']]) {
      assert.ok(parsed.some((notice: { usuarioId: string; titulo: string; data: { evento: string } }) => notice.usuarioId === ticket.autorId && notice.titulo === title && notice.data.evento === event));
    }
    assert.ok(parsed.some((notice: { usuarioId: string; titulo: string; data: { evento: string } }) => notice.usuarioId === ticket.responsableId && notice.titulo === 'Ticket reabierto' && notice.data.evento === 'REABRIR'));
    assert.ok(parsed.every((notice: { usuarioId: string; mensaje: string; data: { interno?: boolean } }) =>
      !notice.mensaje.includes('QA diagnóstico reservado') && (notice.usuarioId !== ticket.autorId || !notice.data.interno)));
  }
  const { TRAINING_LOGINS } = backendRequire(`/work/sitrep/backend/dist-qa-${variant.backend}-20261031/lib/trainingDirectLogin.js`);
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const login = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.33.98' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(login.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const proof = { commit: process.env.GITHUB_SHA, synthetic: true, browserCases: variant.cases,
    ticketLifecycles: tickets.length, manualSha256: digest(manual), capClosed: true,
    emailAttempts: 0, emailSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'support-notices-audit.json'), JSON.stringify(proof, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
