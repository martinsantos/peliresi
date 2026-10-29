import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.MANIFEST_TRANSPORT_HANDOFF_ENABLED, 'true');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const ruleIds: string[] = [];
const base = 'http://127.0.0.1:3037/api';
const run = randomUUID().replaceAll('-', '').slice(0, 12);
async function request(method: string, url: string, token?: string, body?: unknown) {
  const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as any };
}
async function login(email: string) {
  const response = await request('POST', '/auth/login', undefined, { email, password: 'OnlyLocal-NightQA-2026!' });
  assert.equal(response.status, 200, `Synthetic login: ${email}`);
  return response.body.data.tokens.accessToken as string;
}
async function waitFor(condition: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('No llegó el aviso interno dentro del tiempo de prueba');
}
try {
  const [generator, carrier, operator, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  for (const user of [generator, carrier, operator, admin]) assert.equal(user.activo, true);
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  const createTrip = (name: string, hours: number) => db.manifiesto.create({ data: {
    numero: `QA-DURATION-${run}-${name}`, generadorId: generator.generador.id, transportistaId: carrier.transportista.id,
    operadorId: operator.operador.id, creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO',
    fechaRetiro: new Date(Date.now() - hours * 3_600_000), isDemoData: true,
    asignacionTransporte: { version: 1, transportistaId: carrier.transportista.id, vehiculo: null, chofer: null },
  } });
  const early = await createTrip('EARLY', 23), original = await createTrip('ORIGINAL', 25), relay = await createTrip('RELAY', 25);
  const adminToken = await login('admin@night-qa.invalid'), carrierToken = await login('transportista@night-qa.invalid');
  const invalid = await request('POST', '/alertas/reglas', adminToken, { nombre: `QA sin umbral ${run}`,
    evento: 'TIEMPO_EXCESIVO', condicion: '{}', destinatarios: '["ADMIN"]', activa: true });
  if (invalid.status === 201 && invalid.body.data?.id) ruleIds.push(invalid.body.data.id);
  assert.equal(invalid.status, 400); assert.match(invalid.body.message, /umbral/i);
  const configured = await request('POST', '/alertas/reglas', adminToken, { nombre: `QA duración ${run}`,
    evento: 'TIEMPO_EXCESIVO', condicion: JSON.stringify({ all: [{ horasTransito: { gte: 24 } }, { numero: { contains: run } }] }),
    destinatarios: '["ADMIN","TRANSPORTISTA"]', activa: true });
  assert.equal(configured.status, 201, JSON.stringify(configured.body));
  const rule = configured.body.data;
  ruleIds.push(rule.id);
  // Emulate an old active rule only in the synthetic database; it must not fire.
  const legacy = await db.reglaAlerta.create({ data: { nombre: `QA anterior ${run}`, evento: 'TIEMPO_EXCESIVO',
    condicion: JSON.stringify({ numero: { contains: run } }), destinatarios: '["ADMIN"]', activa: true, creadoPorId: admin.id } });
  ruleIds.push(legacy.id);
  const listed = await request('GET', '/alertas/reglas', adminToken);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.find((r: any) => r.id === legacy.id).requiereUmbralTransito, true);
  assert.equal(listed.body.data.find((r: any) => r.id === rule.id).requiereUmbralTransito, false);
  const gps = (id: string) => request('POST', `/manifiestos/${id}/ubicacion-idempotente`, carrierToken,
    { puntoId: randomUUID(), latitud: -33, longitud: -69 });
  assert.equal((await gps(early.id)).status, 200);
  const responses = await Promise.all(Array.from({ length: 8 }, () => gps(original.id)));
  assert.ok(responses.every(result => result.status === 200), JSON.stringify(responses));
  const handoff = await request('POST', `/manifiestos/${relay.id}/tramos`, carrierToken,
    { id: randomUUID(), anteriorId: null, tipo: 'EXTERNO', datos: {}, motivo: 'Rotura artificial de QA' });
  assert.equal(handoff.status, 201, JSON.stringify(handoff.body));
  const replacementGps = await request('POST', `/seguimiento-relevo/${handoff.body.data.tramo.id}/ubicacion`,
    handoff.body.data.acceso, { latitud: -33, longitud: -69 });
  assert.equal(replacementGps.status, 200, JSON.stringify(replacementGps.body));
  await waitFor(async () => await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: { in: [original.id, relay.id] } } }) === 2);
  await waitFor(async () => await db.notificacion.count({ where: { usuarioId: carrier.id, manifiestoId: relay.id, titulo: rule.nombre } }) === 1);
  // Allow all concurrent subscribers to settle before checking deduplication.
  await new Promise(resolve => setTimeout(resolve, 800));
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: early.id } }), 0);
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: original.id } }), 1);
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: relay.id } }), 1);
  const relayNotice = await db.notificacion.findFirstOrThrow({ where: { usuarioId: carrier.id, manifiestoId: relay.id, titulo: rule.nombre } });
  assert.match(relayNotice.mensaje, new RegExp(`manifiesto ${relay.numero} llevaba aproximadamente 25`));
  assert.match(relayNotice.mensaje, /umbral configurado por Ambiente/);
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: legacy.id } }), 0);
  assert.equal(await db.notificacion.count({ where: { manifiestoId: { in: [early.id, original.id, relay.id] }, titulo: '⏰ Tiempo de Tránsito Excesivo' } }), 0);
  assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: { in: [early.id, original.id, relay.id] }, descripcion: { contains: 'Tiempo de tránsito excesivo' } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  const proof = { synthetic: true, thresholdHours: 24, beforeThreshold: 0, afterThreshold: 1,
    concurrentGpsRequests: responses.length, relayThresholdAlerts: 1, relayCarrierNotified: true,
    legacyUnboundedAlerts: 0, automaticDefaultAlerts: 0, emailAttempts: 0, emailSent: 0, push: false, capClosed: true };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'transit-duration-http-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally {
  if (ruleIds.length) await db.reglaAlerta.updateMany({ where: { id: { in: ruleIds } }, data: { activa: false } });
  await db.$disconnect();
}
