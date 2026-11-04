import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const path = process.env.QA_ARTIFACTS + '/creation-retry-fixed.json', base = 'http://127.0.0.1:4177/api';
assert.ok(!existsSync(path), 'Integration already recorded; inspect the artifact instead of creating more records.');
const selection = { orderBy: { id: 'asc' }, include: { residuos: { orderBy: { id: 'asc' } }, eventos: { orderBy: { id: 'asc' } } } };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const before = await db.manifiesto.findMany(selection);
const previousHash = hash(before), result: any = { baseCount: before.length, created: [], checks: [], complete: false };
const save = () => writeFileSync(path, JSON.stringify(result, null, 2));
try {
  const roles = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'];
  const users = await Promise.all(['generador', 'transportista', 'operador'].map(email => db.usuario.findUniqueOrThrow({
    where: { email: email + '@night-qa.invalid' }, include: { generador: true, transportista: true, operador: true },
  })));
  const actors = [users[0].generador, users[1].transportista, users[2].operador];
  actors.forEach(actor => assert.match(actor.razonSocial, /^QA /));
  const waste = await db.tipoResiduo.findFirstOrThrow({ where: { codigo: 'Y1' } });
  save();
  for (const [index, user] of users.entries()) {
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.25.' + (81 + index) },
      body: JSON.stringify({ email: user.email, password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(login.status, 200);
    const auth = await login.json(); assert.notEqual(auth.data.user.training, true);
    const headers = { Authorization: 'Bearer ' + auth.data.tokens.accessToken, 'Content-Type': 'application/json' };
    const body = { idempotencyKey: randomUUID(), generadorId: actors[0].id, transportistaId: actors[1].id, operadorId: actors[2].id,
      modalidad: 'FIJO', fechaEstimadaRetiro: '2099-12-26', observaciones: 'QA UX 20261025 · reintento protegido ' + roles[index] + ' · datos artificiales',
      residuos: [{ tipoResiduoId: waste.id, cantidad: 1, unidad: 'kg' }] };
    const post = async (payload: unknown) => {
      const response = await fetch(base + '/manifiestos', { method: 'POST', headers, body: JSON.stringify(payload) });
      return { status: response.status, body: await response.json() };
    };
    // Two simultaneous deliveries of one intent; a process-local guard would not suffice.
    const concurrent = await Promise.all([post(body), post(body)]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 201], JSON.stringify(concurrent));
    const id = concurrent[0].body.data.manifiesto.id;
    assert.equal(id, concurrent[1].body.data.manifiesto.id);
    assert.deepEqual(concurrent.map(r => r.body.data.replayed).sort(), [false, true]);
    result.created.push({ role: roles[index], id, numero: concurrent[0].body.data.manifiesto.numero }); save();
    await db.manifiesto.update({ where: { id }, data: { isDemoData: true } });
    const snapshot = async () => ({
      events: await db.eventoManifiesto.findMany({ where: { manifiestoId: id }, orderBy: { id: 'asc' } }),
      notices: await db.notificacion.findMany({ where: { manifiestoId: id }, orderBy: { id: 'asc' } }),
      receipts: await db.auditoria.findMany({ where: { manifiestoId: id, accion: 'CREAR_MANIFIESTO' }, orderBy: { id: 'asc' } }),
    });
    const committed = await snapshot();
    assert.equal(committed.notices.length, 3);
    assert.deepEqual(committed.notices.map((n: any) => n.usuarioId).sort(), users.map(u => u.id).sort());
    assert.equal(committed.receipts.length, 1);
    assert.equal(committed.events.filter((e: any) => e.tipo === 'CREACION').length, 1);
    const retry = await post(body);
    assert.equal(retry.status, 200); assert.equal(retry.body.data.manifiesto.id, id); assert.equal(retry.body.data.replayed, true);
    const changed = await post({ ...body, residuos: [{ ...body.residuos[0], cantidad: 2 }] });
    assert.equal(changed.status, 409);
    assert.deepEqual(await snapshot(), committed);
    result.checks.push({ role: roles[index], concurrentStatuses: [200, 201], subsequentRetry: 200, changedPayload: 409, noticeRecipients: 3, receipts: 1, sideEffectsUnchanged: true }); save();
  }
  assert.equal(await db.manifiesto.count(), before.length + 3);
  assert.equal(hash(await db.manifiesto.findMany({ ...selection, where: { id: { in: before.map((m: any) => m.id) } } })), previousHash);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  result.previousRecordsUnchanged = true; result.emailsSent = 0; result.emailAttempts = 0; result.complete = true; save();
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
