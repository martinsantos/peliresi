import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026102943';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const fixture = JSON.parse(readFileSync(path.join(out, 'state-notice-company-private.json'), 'utf8'));
assert.match(fixture.member, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
 const [activity, member, carrier, operator] = await Promise.all([
  db.empresaActividad.findUniqueOrThrow({ where: { id: fixture.activity } }),
  db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
  db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } } }),
  db.operador.findFirstOrThrow({ where: { usuario: { email: 'operador@night-qa.invalid' } }, include: { usuario: true } }),
 ]);
 const generator = await db.generador.findUniqueOrThrow({ where: { id: activity.actorId } });
 assert.match(generator.razonSocial, /^QA /); assert.match(carrier.razonSocial, /^QA /); assert.match(operator.razonSocial, /^QA /);
 const manifest = await db.manifiesto.create({ data: { numero: `QA-STATE-RACE-${randomUUID().slice(0, 8)}`,
  generadorId: generator.id, transportistaId: carrier.id, operadorId: operator.id, creadoPorId: generator.usuarioId,
  estado: 'ENTREGADO', modalidad: 'FIJO', isDemoData: true,
  contextoEmpresa: { empresaId: fixture.company, establecimientoId: fixture.site } } });
 const base = 'http://127.0.0.1:3037/api';
 const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
  Cookie: 'sitrep_qa_client=127.13.25.1' }, body: JSON.stringify({ email: operator.usuario.email, password: 'OnlyLocal-NightQA-2026!' }) });
 const auth = await login.json() as any; assert.equal(login.status, 200);
 const send = () => fetch(`${base}/manifiestos/${manifest.id}/confirmar-recepcion`, { method: 'POST',
  headers: { Authorization: 'Bearer ' + auth.data.tokens.accessToken, 'Content-Type': 'application/json' }, body: '{}' });
 const replies = await Promise.all([send(), send()]);
 assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 400]);
 await new Promise(resolve => setTimeout(resolve, 500));
 assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id } })).estado, 'RECIBIDO');
 assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'RECEPCION' } }), 1);
 const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, usuarioId: member.id, tipo: 'MANIFIESTO_RECIBIDO' } });
 assert.equal(notices.length, 1); assert.equal(JSON.parse(notices[0].datos).estado, 'RECIBIDO');
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, concurrentRequests: 2, statuses: [200, 400], receptionEvents: 1,
  representativeNotices: 1, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 writeFileSync(path.join(out, 'state-notice-race-proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
