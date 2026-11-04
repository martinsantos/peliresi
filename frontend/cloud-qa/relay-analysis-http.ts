import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-relay-analysis-20261029');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:3037/api';
async function request(method: string, url: string, token?: string, body?: unknown) {
  const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as any };
}
async function waitFor(condition: () => Promise<boolean>) {
  for (let i = 0; i < 60; i++) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('El análisis del relevo no se completó durante la prueba');
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
  const manifest = await db.manifiesto.create({ data: {
    numero: `QA-RELEVO-GPS-${randomUUID().slice(0, 12)}`, generadorId: generator.generador.id,
    transportistaId: carrier.transportista.id, operadorId: operator.operador.id, creadoPorId: carrier.id,
    estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true,
    asignacionTransporte: { version: 1, transportistaId: carrier.transportista.id, vehiculo: null, chofer: null },
  }, select: { id: true, numero: true } });
  const login = await request('POST', '/auth/login', undefined, { email: 'transportista@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' });
  assert.equal(login.status, 200);
  const handoff = await request('POST', `/manifiestos/${manifest.id}/tramos`, login.body.data.tokens.accessToken,
    { id: randomUUID(), anteriorId: null, tipo: 'EXTERNO', datos: {}, motivo: 'Rotura artificial de QA' });
  assert.equal(handoff.status, 201, JSON.stringify(handoff.body));
  const endpoint = `/seguimiento-relevo/${handoff.body.data.tramo.id}/ubicacion-idempotente`;
  let lastPoint: { puntoId: string; latitud: number; longitud: number } | undefined;
  for (let i = 0; i < 10; i++) {
    const point = { puntoId: randomUUID(), latitud: i === 0 ? -33 : -33.1, longitud: -69 };
    const result = await request('POST', endpoint, handoff.body.data.acceso, point);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.idempotencia.repetido, false);
    lastPoint = point;
    if (i === 0) await new Promise(resolve => setTimeout(resolve, 100));
  }
  const retry = await request('POST', endpoint, handoff.body.data.acceso, lastPoint);
  assert.equal(retry.status, 200); assert.equal(retry.body.data.idempotencia.repetido, true);
  await waitFor(async () => await db.anomaliaTransporte.count({ where: { manifiestoId: manifest.id, tipo: 'VELOCIDAD_ANORMAL' } }) > 0);
  await waitFor(async () => await db.notificacion.count({ where: { usuarioId: admin.id, manifiestoId: manifest.id,
    titulo: 'GPS: posible velocidad elevada' } }) === 1);
  const anomaly = await db.anomaliaTransporte.findFirstOrThrow({ where: { manifiestoId: manifest.id, tipo: 'VELOCIDAD_ANORMAL' } });
  assert.match(anomaly.descripcion, /Hora de captura no disponible/);
  assert.equal(await db.trackingGPS.count({ where: { manifiestoId: manifest.id } }), 10);
  assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'INCIDENTE',
    descripcion: { startsWith: 'Anomalía GPS detectada' } } }), 0, 'El enlace no identifica a una persona usuaria');
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  const fixture = { crash: manifest };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-alert-atomic-private.json'), JSON.stringify(fixture), { mode: 0o600 });
  const proof = { synthetic: true, pointsAccepted: 10, duplicateAcceptedOnce: true, anomalyRecorded: true,
    adminInboxNotified: true, fakeIncidentAuthor: false, emailAttempts: 0, emailSent: 0, push: false };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'relay-analysis-http-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
