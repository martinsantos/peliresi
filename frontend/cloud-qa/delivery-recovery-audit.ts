import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(path.join(out, 'delivery-recovery-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient(), results = [];
const { manifestCompanyRecipients } = backendRequire('./dist/services/manifestCompanyRecipients.service.js');
try {
  for (const proc of JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'))) {
    const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean)
      .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
    assertCloudEnvironment(env); assert.equal(env.TRAINING_DATABASE_URL, '');
    if (process.env.SITREP_QA_RUN === 'delivery-notice-atomic-20261029') assert.equal(new URL(env.DATABASE_URL).searchParams.get('connection_limit'), '4');
    assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
    assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
    assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
    for (const key of externalKeys) assert.equal(env[key], '');
  }
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.95' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const parties = await Promise.all(['generador', 'transportista', 'operador', 'admin'].map(name => db.usuario.findUniqueOrThrow({
    where: { email: `${name}@night-qa.invalid` }, select: { id: true },
  })));
  const administrators = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
  for (const [surface, cases] of Object.entries(fixture.cases) as Array<[string, any]>) {
    for (const kind of ['individual', 'offline', 'detail', 'fleet-a', 'fleet-b', 'concurrent', 'tabs']) {
      const item = cases[kind];
      const actorId = ['detail', 'tabs'].includes(kind) ? parties[3].id : parties[1].id;
      const representatives = kind === 'fleet-b' ? [] : await manifestCompanyRecipients(db, item.id);
      const expectedRecipients = kind === 'fleet-b' ? [] : Array.from(new Set([
        ...parties.slice(0, 3).map(user => user.id).filter(id => id !== actorId),
        ...administrators.map(user => user.id),
        ...representatives.map((person: any) => person.usuarioId).filter((id: string) => id !== actorId),
      ])).sort();
      const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, estado: true, isDemoData: true } });
      assert.equal(manifest.numero, item.numero); assert.equal(manifest.isDemoData, true);
      assert.equal(manifest.estado, kind === 'fleet-b' ? 'EN_TRANSITO' : 'ENTREGADO');
      const deliveries = await db.eventoManifiesto.count({ where: { manifiestoId: item.id, tipo: 'ENTREGA' } });
      const receipts = await db.auditoria.count({ where: { manifiestoId: item.id, accion: 'CONFIRMAR_ENTREGA_V1' } });
      assert.equal(deliveries, kind === 'fleet-b' ? 0 : 1); assert.equal(receipts, deliveries);
      let notices: Array<{usuarioId:string}> = [];
      for (let attempt = 0; attempt < 30; attempt++) {
        notices = await db.notificacion.findMany({ where: { manifiestoId: item.id, tipo: 'MANIFIESTO_ENTREGADO' }, select: { usuarioId: true } });
        if (notices.length >= expectedRecipients.length) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.deepEqual(notices.map(notice => notice.usuarioId).sort(), expectedRecipients);
      results.push({ surface, kind, state: manifest.estado, deliveries, receipts, notices: notices.length });
    }
  }
  const report = { synthetic: true, production: false, capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, results };
  writeFileSync(path.join(out, 'delivery-recovery-audit.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
