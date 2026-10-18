import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

// Actual compiled subscriber and PostgreSQL, not an HTTP or mocked-controller test.
// No timer is registered and no production/provider configuration is available.
await assertCloudDatabase();
const db = backendRequire('./dist/lib/prisma.js').default;
const { alertaSubscriber } = backendRequire('./dist/subscribers/alerta.subscriber.js');
const checks: string[] = [];
let failure: string | undefined;
try {
  const vehicles = await db.vehiculo.findMany({ where: { id: { in: ['night-qa-vehicle-1', 'night-qa-vehicle-2'] } }, orderBy: { id: 'asc' } });
  assert.equal(vehicles.length, 2);
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  const rule = await db.reglaAlerta.create({ data: {
    nombre: 'QA identidad vencimiento SQL', evento: 'VENCIMIENTO',
    condicion: JSON.stringify({ entidadId: { in: vehicles.map((v: { id: string }) => v.id) } }),
    destinatarios: '["ADMIN"]', creadoPorId: admin.id,
  } });
  const deadline = new Date(Date.now() + 3 * 86400000);
  const event = (vehicle: { id: string; patente: string }, vencimiento = deadline) => ({
    type: 'VENCIMIENTO_PROXIMO', entidad: 'VEHICULO', entidadId: vehicle.id,
    nombre: vehicle.patente, vencimiento, diasRestantes: 3,
  });
  for (const vehicle of vehicles) await alertaSubscriber(event(vehicle));
  const cases = await db.alertaGenerada.findMany({ where: { reglaId: rule.id } });
  assert.equal(cases.length, 2);
  assert.deepEqual(cases.map((c: { datos: string }) => JSON.parse(c.datos).entidadId).sort(), vehicles.map((v: { id: string }) => v.id).sort());
  const notices = await db.notificacion.findMany({ where: { titulo: rule.nombre } });
  assert.equal(notices.length, 2); assert.ok(notices.every((n: { usuarioId: string }) => n.usuarioId === admin.id));
  checks.push('two subjects with null manifest retain separate cases and configured admin notices');
  await alertaSubscriber(event(vehicles[0]));
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id } }), 2);
  assert.equal(await db.notificacion.count({ where: { titulo: rule.nombre } }), 2);
  await alertaSubscriber(event(vehicles[0], new Date(deadline.getTime() + 86400000)));
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id } }), 3);
  assert.equal(await db.notificacion.count({ where: { titulo: rule.nombre } }), 3);
  checks.push('same subject/date deduplicated; changed date retained by PostgreSQL string filters');
  await db.reglaAlerta.update({ where: { id: rule.id }, data: { activa: false } });
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  // Let disabled-channel callbacks begin before draining the shared Prisma client.
  await new Promise(resolve => setImmediate(resolve));
  await db.$disconnect();
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'expiry-identity.json'), JSON.stringify({
    commit: process.env.GITHUB_SHA, passed: checks.length, failed: failure ? 1 : 0, checks, failure,
    database: 'sitrep_night_qa_20260926', port: 55440, compiledSubscriber: true, externalProvidersDisabled: true,
  }, null, 2));
}
