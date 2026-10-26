import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const ticketId = 'cmvkz01tq001s726ea975colf';
try {
  const ticket = await db.ticketSoporte.findUniqueOrThrow({ where: { id: ticketId }, include: { autor: true } });
  assert.equal(ticket.asunto, 'QA burbuja contextual app'); assert.ok(ticket.autor.email.endsWith('@night-qa.invalid')); assert.equal(ticket.responsableId, null);
  if (process.env.QA_SUPPORT_VERIFY === 'true') {
    const prior = JSON.parse(readFileSync(process.env.QA_ARTIFACTS! + '/support-command-http.json', 'utf8'));
    const messages = await db.mensajeSoporte.findMany({ where: { ticketId }, include: { adjuntos: true } });
    assert.equal(messages.length, prior.before.messages + 3);
    assert.equal(await db.eventoSoporte.count({ where: { ticketId } }), prior.before.events + 3);
    for (const surface of ['app', 'web']) {
      const match = messages.filter((m: any) => m.cuerpo.startsWith('QA UX 20261025 · ' + surface + ' ·'));
      assert.equal(match.length, 1); assert.equal(match[0].interno, true);
      assert.equal(match[0].adjuntos.length, surface === 'app' ? 1 : 0);
    }
    assert.equal(await db.notificacion.count(), prior.before.notices);
    assert.equal(await db.manifiesto.count(), prior.before.manifests);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    const proof = { at: new Date().toISOString(), messages: messages.length, added: 3, webUnique: true, appUnique: true, emails: 0, noticesUnchanged: true, manifestsUnchanged: true };
    writeFileSync(process.env.QA_ARTIFACTS! + '/support-command-verify.json', JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
  } else {
  const before = { manifests: await db.manifiesto.count(), messages: await db.mensajeSoporte.count({ where: { ticketId } }), events: await db.eventoSoporte.count({ where: { ticketId } }), notices: await db.notificacion.count() };
  const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.ok(login.ok); const token = (await login.json()).data.tokens.accessToken;
  const key = randomUUID(), body = 'QA UX recuperación de soporte · archivo artificial y reintento idéntico · ' + key;
  const image = readFileSync('/work/sitrep/docs/manual/screenshots/mobile/support-audience-20261025.jpg');
  const send = async (clientKey: string, text: string, version = ticket.version) => {
    const form = new FormData(); form.set('accion', 'NOTA'); form.set('version', String(version)); form.set('cuerpo', text); form.append('files', new Blob([image], { type: 'image/jpeg' }), 'qa-support.jpg');
    const res = await fetch('http://127.0.0.1:3037/api/soporte/' + ticketId + '/acciones', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Idempotency-Key': clientKey }, body: form });
    return { status: res.status, json: await res.json() };
  };
  const first = await send(key, body); assert.equal(first.status, 200); assert.equal(first.json.data.replay, false);
  // Client deliberately ignores the first receipt, then repeats its original bytes/key.
  const replay = await send(key, body); assert.equal(replay.status, 200); assert.equal(replay.json.data.replay, true);
  const conflict = await send(key, body + ' distinto'); assert.equal(conflict.status, 409); assert.equal(conflict.json.code, undefined);
  const stale = await send(randomUUID(), body + ' nueva acción desactualizada'); assert.equal(stale.status, 409); assert.equal(stale.json.code, 'SUPPORT_ACTION_NOT_APPLIED');
  const after = { manifests: await db.manifiesto.count(), messages: await db.mensajeSoporte.count({ where: { ticketId } }), events: await db.eventoSoporte.count({ where: { ticketId } }), notices: await db.notificacion.count() };
  assert.equal(after.manifests, before.manifests); assert.equal(after.messages, before.messages + 1); assert.equal(after.events, before.events + 1); assert.equal(after.notices, before.notices);
  const entry = await db.mensajeSoporte.findFirstOrThrow({ where: { ticketId, cuerpo: body }, include: { adjuntos: true } }); assert.equal(entry.interno, true); assert.equal(entry.adjuntos.length, 1); assert.equal(entry.adjuntos[0].bytes, image.length);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0); assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  const result = { at: new Date().toISOString(), ticketId, key, before, after, replay: true, hashConflictRetained: true, staleExplicitlyRejected: true, emails: 0, push: false };
  writeFileSync(process.env.QA_ARTIFACTS! + '/support-command-http.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  }
} finally { await db.$disconnect(); }
