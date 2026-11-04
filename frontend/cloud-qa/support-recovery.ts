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
  if (process.env.QA_SUPPORT_RECOVERY_VERIFY === 'true') {
    const prior = JSON.parse(readFileSync(process.env.QA_ARTIFACTS! + '/support-recovery-http.json', 'utf8'));
    const messages = await db.mensajeSoporte.findMany({ where: { ticketId }, include: { adjuntos: true } });
    assert.equal(messages.length, prior.before.messages + 2 + (prior.race === 'application won' ? 1 : 0));
    for (const body of ['QA UX97 · adjunto inválido · recuperar texto sin publicar ni duplicar.', 'QA UX97 · web · adjunto corregido conserva el texto y no duplica.']) {
      const matches = messages.filter((m: any) => m.cuerpo === body); assert.equal(matches.length, 1); assert.equal(matches[0].interno, true); assert.equal(matches[0].adjuntos.length, 0);
    }
    assert.equal(await db.notificacion.count(), prior.before.notices); assert.equal(await db.manifiesto.count(), prior.before.manifests);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0); assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    const proof = { at: new Date().toISOString(), messages: messages.length, appUnique: true, webUnique: true, correctedAttachmentsRemoved: true, noticesUnchanged: true, manifestsUnchanged: true, emails: 0 };
    writeFileSync(process.env.QA_ARTIFACTS! + '/support-recovery-verify.json', JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
  } else {
  const before = { manifests: await db.manifiesto.count(), notices: await db.notificacion.count(), messages: await db.mensajeSoporte.count({ where: { ticketId } }) };
  const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.ok(login.ok); const token = (await login.json()).data.tokens.accessToken;
  const base = 'http://127.0.0.1:3037/api/soporte/' + ticketId;
  const image = readFileSync('/work/sitrep/docs/manual/screenshots/mobile/support-audience-20261025.jpg');
  const send = async (key: string, invalid = false, count = 1) => {
    const current = await db.ticketSoporte.findUniqueOrThrow({ where: { id: ticketId } });
    const form = new FormData(); form.set('accion', 'NOTA'); form.set('version', String(current.version)); form.set('cuerpo', 'QA UX97 · recuperación de archivos · ' + key);
    for (let i = 0; i < count; i++) form.append('files', new Blob([invalid ? 'QA invalid PDF' : image], { type: invalid ? 'application/pdf' : 'image/jpeg' }), 'qa.' + (invalid ? 'pdf' : 'jpg'));
    const res = await fetch(base + '/acciones', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Idempotency-Key': key }, body: form });
    return { status: res.status, body: await res.json() };
  };
  const recover = async (key: string) => {
    const res = await fetch(base + '/acciones/recuperar', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Idempotency-Key': key, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 200); return (await res.json()).data;
  };
  const outcomes: any[] = [];
  for (const mode of ['signature', 'multer']) {
    const key = randomUUID(), invalid = await send(key, mode === 'signature', mode === 'multer' ? 4 : 1);
    assert.equal(invalid.status, 400); assert.equal(invalid.body.code, undefined);
    assert.equal((await recover(key)).status, 'rejected'); assert.equal((await recover(key)).status, 'rejected');
    // Delayed valid bytes cannot resurrect the withdrawn command.
    const delayed = await send(key); assert.equal(delayed.status, 409); assert.equal(delayed.body.code, 'SUPPORT_ACTION_NOT_APPLIED');
    assert.equal(await db.eventoSoporte.count({ where: { ticketId, clienteId: key } }), 1);
    assert.equal(await db.mensajeSoporte.count({ where: { ticketId, cuerpo: { contains: key } } }), 0);
    outcomes.push({ mode, rejected: true, withdrawn: true, delayedBlocked: true });
  }
  // Existing application must win even if the caller lost its acknowledgement.
  const prior = await db.eventoSoporte.findFirstOrThrow({ where: { ticketId, accion: 'NOTA' }, orderBy: { createdAt: 'desc' } });
  const receipt = await recover(prior.clienteId); assert.equal(receipt.status, 'confirmed'); assert.equal(receipt.version, prior.version);
  // Actual concurrent HTTP attempts serialize on the same ticket row.
  const raceKey = randomUUID(); const [attempt, resolution] = await Promise.all([send(raceKey), recover(raceKey)]);
  const entries = await db.eventoSoporte.findMany({ where: { ticketId, clienteId: raceKey } }); assert.equal(entries.length, 1);
  const applied = entries[0].accion === 'NOTA';
  assert.equal(resolution.status, applied ? 'confirmed' : 'rejected'); assert.equal(attempt.status, applied ? 200 : 409);
  assert.equal(await db.mensajeSoporte.count({ where: { ticketId, cuerpo: { contains: raceKey } } }), applied ? 1 : 0);
  const detail = await fetch(base, { headers: { Authorization: 'Bearer ' + token } }); const projection = (await detail.json()).data;
  assert.ok(projection.eventos.every((event: any) => event.accion !== 'ENVIO_RETIRADO'));
  assert.equal(await db.manifiesto.count(), before.manifests); assert.equal(await db.notificacion.count(), before.notices);
  assert.equal(await db.mensajeSoporte.count({ where: { ticketId } }), before.messages + (applied ? 1 : 0));
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0); assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  const result = { at: new Date().toISOString(), ticketId, before, outcomes, existingConfirmed: true, race: applied ? 'application won' : 'withdrawal won', technicalReceiptsHidden: true, noticesUnchanged: true, manifestsUnchanged: true, emails: 0 };
  writeFileSync(process.env.QA_ARTIFACTS! + '/support-recovery-http.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  }
} finally { await db.$disconnect(); }
