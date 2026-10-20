import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root, externalKeys } from './safety.ts';
await assertCloudDatabase();
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
for (const key of externalKeys) assert.equal(process.env[key], '');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { buildInspectionExchangeDigests } = backendRequire(path.join(root, 'backend/dist/services/inspectionExchange.service.js'));
try {
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' } });
  const prefix = 'QA-PSIP-LEGAL-' + randomUUID().slice(0, 8) + '-', actors: Record<string, any> = {}, cases: Record<string, any> = {};
  let number = 0;
  for (const [login, type, key] of [['generador2', 'GENERADOR', 'generador'], ['transportista', 'TRANSPORTISTA', 'transportista'], ['operador', 'OPERADOR', 'operador']]) {
    const user = await db.usuario.findUniqueOrThrow({ where: { email: login + '@night-qa.invalid' }, include: { [key]: true } });
    assert.ok(user.activo && user[key]?.activo);
    actors[type] = { login, userId: user.id, relations: { tipoActor: type, [key + 'Id']: user[key].id } };
  }
  const create = async (type: string, estado: string) => {
    const inspection = await db.inspeccion.create({ data: { numero: prefix + ++number, inspectorId: inspector.id, estado,
      plazoRespuestaAt: new Date(Date.now() - 86_400_000), observaciones: 'Inspección artificial para revisar el seguimiento, sin comunicación externa.', ...actors[type].relations } });
    const fields = { inspeccionId: inspection.id, secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO',
      asunto: 'Pedido artificial para evaluación administrativa', cuerpo: 'Acompañar la constancia artificial requerida. No es un expediente ni pago real.',
      plazoRespuestaAt: new Date(Date.now() - 86_400_000), canal: 'PORTAL_SITREP', versionExpediente: 2, autorId: admin.id, createdAt: new Date() };
    const digest = buildInspectionExchangeDigests({ ...fields, adjuntos: [] }, null);
    const entry = await db.intercambioInspeccion.create({ data: { ...fields, ...digest } });
    await db.inspeccion.update({ where: { id: inspection.id }, data: { version: 2 } });
    return { id: inspection.id, number: inspection.numero, requestId: entry.id, requestHash: entry.hashCadena };
  };
  for (const project of ['web-desktop', 'web-responsive', 'app']) {
    cases[project] = {};
    for (const type of Object.keys(actors)) cases[project][type] = await create(type, 'NOTIFICADA');
    cases[project].legacyAtm = await create('GENERADOR', 'DERIVADA_ATM');
    cases[project].privateFinal = await create('GENERADOR', 'FINALIZADA');
    await db.eventoInspeccion.create({ data: { inspeccionId: cases[project].privateFinal.id, usuarioId: admin.id,
      tipo: 'CAMBIO_ESTADO', titulo: 'FINALIZADA', detalle: 'PRIVATE-QA-LEGAL-NOTE', estadoHasta: 'FINALIZADA', visibleActor: false } });
  }
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-legal-fixture.json'), JSON.stringify({ prefix, cases, actors,
    emailQueue: await db.emailQueue.count(), synthetic: true, production: false }, null, 2));
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-fixture.json'), JSON.stringify({ prefix, actors, cases: Object.fromEntries(Object.entries(cases).map(([project, group]) =>
    [project, Object.fromEntries(Object.keys(actors).map(type => [type, group[type].id]))])), paging: [], closed: cases.app.privateFinal.id, spontaneous: cases.app.legacyAtm.id }, null, 2));
  console.log('Fifteen artificial PSIP cases; existing QA accounts, no CAP reactivation.');
} finally { await db.$disconnect(); }
