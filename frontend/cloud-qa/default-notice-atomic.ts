import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { matchesAlertCondition } = backendRequire('./dist/services/alertRuleCondition.service.js');
const run = randomUUID().slice(0, 8), baseline = process.env.QA_DEFAULT_ATOMIC_BASELINE === 'true';
let victimId = '';
try {
 const [generator, carrier, operator, admin, waste] = await Promise.all([
  db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  db.tipoResiduo.findFirstOrThrow({ where: { codigo: 'Y1' } }),
 ]);
 for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
 const admins = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true, email: true } });
 assert.ok(admins.length && admins.every((user: any) => user.email.endsWith('@night-qa.invalid')));
 const victim = await db.usuario.create({ data: { email: `qa-default-notice-${run}@night-qa.invalid`, password: admin.password,
  nombre: 'QA destinatario transitorio', rol: 'ADMIN', activo: true, emailVerified: true, notifEmail: false } }); victimId = victim.id;
 const manifest = await db.manifiesto.create({ data: { numero: `QA-DEFAULT-ATOMIC-${run}`,
  generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
  creadoPorId: carrier.id, estado: 'RECIBIDO', modalidad: 'FIJO', isDemoData: true,
  residuos: { create: [{ tipoResiduoId: waste.id, cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] } }, include: { residuos: true } });
 const rules = await db.reglaAlerta.findMany({ where: { evento: 'DIFERENCIA_PESO', activa: true } });
 const observation = { manifiestoId: manifest.id, pesoDeclarado: 10, pesoReal: 12, delta: '20.00%', deltaPorcentaje: 20, userId: operator.id };
 assert.ok(rules.every((rule: any) => !matchesAlertCondition(rule.condicion, observation)));
 const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'operador@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
 const auth = await login.json() as any; assert.equal(login.status, 200);
 const request = () => fetch(`http://127.0.0.1:3037/api/manifiestos/${manifest.id}/pesaje`, { method: 'POST',
  headers: { Authorization: 'Bearer ' + auth.data.tokens.accessToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({ residuos: [{ id: manifest.residuos[0].id, cantidadRecibida: 12 }] }) });
 let pending: Promise<Response> | undefined;
 await db.$transaction(async (tx: any) => {
  await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${victim.id} FOR UPDATE`;
  pending = request(); pending.catch(() => {});
  let blocked = false;
  for (let attempt = 0; attempt < 100; attempt++) {
   const [row] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%notificaciones%' AND query ILIKE '%INSERT%'`;
   if (Number(row.count) > 0) { blocked = true; break; }
   await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(blocked, true, 'El destinatario artificial debe bloquear la inserción del aviso');
  await tx.usuario.delete({ where: { id: victim.id } });
 }, { timeout: 15000, maxWait: 10000 });
 victimId = '';
 const response = await pending!;
 const current = await db.manifiestoResiduo.findUniqueOrThrow({ where: { id: manifest.residuos[0].id } });
 const state = { status: response.status, received: current.cantidadRecibida,
  events: await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id } }),
  notices: await db.notificacion.count({ where: { manifiestoId: manifest.id, titulo: '⚖️ Diferencia de Peso Detectada' } }) };
 if (baseline) { assert.equal(state.status, 200); assert.equal(state.received, 12); assert.ok(state.events >= 2); assert.ok(state.notices >= 1); }
 else {
  assert.equal(state.status, 500); assert.equal(state.received, null); assert.equal(state.events, 0); assert.equal(state.notices, 0);
  const retry = await request(); assert.equal(retry.status, 200);
  assert.equal((await db.manifiestoResiduo.findUniqueOrThrow({ where: { id: manifest.residuos[0].id } })).cantidadRecibida, 12);
  assert.equal(await db.notificacion.count({ where: { manifiestoId: manifest.id, titulo: '⚖️ Diferencia de Peso Detectada', usuarioId: generator.id } }), 1);
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, baseline, afterFailure: state, retrySucceeded: !baseline, emailAttempts: 0, emailSent: 0 };
 await writeFile(path.join(process.env.QA_ARTIFACTS!, baseline ? 'default-atomic-baseline.json' : 'default-atomic-fixed.json'), JSON.stringify(proof, null, 2));
 console.log(JSON.stringify(proof));
} finally {
 if (victimId) await db.usuario.deleteMany({ where: { id: victimId, email: `qa-default-notice-${run}@night-qa.invalid` } });
 await db.$disconnect();
}
