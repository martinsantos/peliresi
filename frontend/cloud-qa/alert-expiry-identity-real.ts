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
const { dispararReglasAlerta } = backendRequire('./dist/subscribers/alerta.subscriber.js');
const { matchesAlertCondition } = backendRequire('./dist/services/alertRuleCondition.service.js');
const baseline = process.env.QA_EXPIRY_BASELINE === 'true', prefix = 'QA-EXPIRY-' + randomUUID().slice(0, 8);
let ruleId = '';
try {
 const admins = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true, email: true } });
 assert.ok(admins.length && admins.every((user: any) => user.email.endsWith('@night-qa.invalid')));
 const admin = admins[0], date = new Date('2099-10-10T12:00:00.000Z');
 const event = (entidadId: string, vencimiento = date, entidad = 'VEHICULO') => ({ entidad, entidadId,
  nombre: prefix, vencimiento, diasRestantes: 6 });
 const cases = [event(prefix + '-AB'), event(prefix + '-%')];
 const existing = await db.reglaAlerta.findMany({ where: { activa: true, evento: 'VENCIMIENTO' } });
 assert.ok(existing.every((rule: any) => cases.every(data => !matchesAlertCondition(rule.condicion, data))), 'Otra regla coincide con el evento artificial');
 const rule = await db.reglaAlerta.create({ data: { nombre: prefix, evento: 'VENCIMIENTO', activa: true,
  condicion: JSON.stringify({ nombre: { contains: prefix } }), destinatarios: '["ADMIN"]', creadoPorId: admin.id } });
 ruleId = rule.id;
 for (const data of cases) await dispararReglasAlerta('VENCIMIENTO', undefined, data);
 const firstCount = await db.alertaGenerada.count({ where: { reglaId: rule.id } });
 assert.equal(firstCount, baseline ? 1 : 2);
 if (!baseline) {
  await dispararReglasAlerta('VENCIMIENTO', undefined, cases[1]);
  await dispararReglasAlerta('VENCIMIENTO', undefined, event(prefix + '-%', new Date('2099-10-11T12:00:00.000Z')));
  await dispararReglasAlerta('VENCIMIENTO', undefined, event(prefix + '-%', date, 'CHOFER'));
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id } }), 4);
 }
 const output = { synthetic: true, baseline, distinctSubjects: firstCount, expectedSubjects: 2,
  differentDateAndTypePreserved: !baseline, emailAttempts: await db.emailQueue.count({ where: { intentos: { gt: 0 } } }),
  emailSent: await db.emailQueue.count({ where: { sentAt: { not: null } } }) };
 assert.equal(output.emailAttempts, 0); assert.equal(output.emailSent, 0);
 await writeFile(path.join(process.env.QA_ARTIFACTS!, baseline ? 'expiry-baseline.json' : 'expiry-fixed.json'), JSON.stringify(output, null, 2));
 console.log(JSON.stringify(output));
} finally {
 if (ruleId) await db.reglaAlerta.updateMany({ where: { id: ruleId }, data: { activa: false } });
 await db.$disconnect();
}
