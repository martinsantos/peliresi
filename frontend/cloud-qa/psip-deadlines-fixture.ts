import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const { buildInspectionExchangeDigests } = backendRequire(path.join(root, 'backend/dist/services/inspectionExchange.service.js'));
const db = new PrismaClient();
try {
  const inspector = await db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' } });
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  assert.ok(inspector.activo && admin.activo);
  const stamp = randomUUID().slice(0, 8), prefix = `QA-PSIP-PLAZOS-${stamp}-`;
  const now = Date.now(), past = new Date(now - 3_600_000), future = new Date(now + 172_800_000), boundary = new Date(now + 300_000);
  let number = 0;
  const actors: Record<string, any> = {}, cases: Record<string, Record<string, any>> = {};
  for (const [login, type, key] of [['generador2', 'GENERADOR', 'generador'], ['transportista', 'TRANSPORTISTA', 'transportista'], ['operador', 'OPERADOR', 'operador']]) {
    const user = await db.usuario.findUniqueOrThrow({ where: { email: `${login}@night-qa.invalid` }, include: { [key]: true } });
    assert.ok(user.activo && user[key]?.activo);
    actors[type] = { login, userId: user.id, relations: { tipoActor: type, [`${key}Id`]: user[key].id } };
  }
  async function create(type: string, state: string, dates: Array<Date | null>, reference: Date | null) {
    const inspection = await db.inspeccion.create({ data: { numero: prefix + ++number, inspectorId: inspector.id, estado: state,
      plazoRespuestaAt: reference, observaciones: 'QA artificial: revisión de plazos; no notificación formal ni comunicación externa.', ...actors[type].relations } });
    let previous: string | null = null;
    const requirements = [];
    for (const [index, deadline] of dates.entries()) {
      const sequence = index + 1, createdAt = new Date(now - 10_800_000 + index * 60_000);
      const fields = { inspeccionId: inspection.id, secuencia: sequence, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO',
        asunto: `QA pedido ${sequence}: ${deadline === null ? 'sin fecha registrada' : deadline.getTime() < now ? 'constancia pendiente vencida' : 'documentación con plazo vigente'}`,
        cuerpo: 'Pedido artificial independiente para verificar plazos y respuestas vinculadas sin cambios regulatorios.',
        plazoRespuestaAt: deadline, canal: 'PORTAL_SITREP', versionExpediente: sequence + 1, autorId: admin.id, createdAt };
      const digest = buildInspectionExchangeDigests({ ...fields, adjuntos: [] }, previous);
      const entry = await db.intercambioInspeccion.create({ data: { ...fields, ...digest, hashAnterior: previous } });
      requirements.push({ id: entry.id, secuencia: entry.secuencia, deadline: deadline?.toISOString() || null, asunto: entry.asunto, hash: entry.hashCadena });
      previous = entry.hashCadena;
    }
    await db.inspeccion.update({ where: { id: inspection.id }, data: { version: dates.length + 1 } });
    return { id: inspection.id, number: inspection.numero, requirements };
  }
  for (const project of ['web-desktop', 'web-responsive', 'app']) {
    cases[project] = {};
    for (const type of Object.keys(actors)) cases[project][type] = {
      mixed: await create(type, 'NOTIFICADA', [past, future, null], future),
      inverse: await create(type, 'NOTIFICADA', [future, past], past),
      empty: await create(type, 'NOTIFICADA', [], past),
      closed: await create(type, 'CERRADA_CONFORME', [past], null),
    };
    cases[project].boundary = await create('GENERADOR', 'NOTIFICADA', [boundary], boundary);
  }
  const rule = await db.reglaAlerta.create({ data: { nombre: prefix + 'Requerimientos vencidos sin respuesta', descripcion: 'QA artificial: sólo campana, sin correos ni push.',
    evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"requerimiento_inspeccion"}', destinatarios: '["INSPECCIONADO","INSPECTOR_ASIGNADO","ADMIN"]', activa: true, creadoPorId: admin.id } });
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-deadlines-fixture.json'), JSON.stringify({ synthetic: true, production: false, prefix,
    cases, actors, inspectorId: inspector.id, adminId: admin.id, ruleId: rule.id, emailQueue: await db.emailQueue.count(), boundary: boundary.toISOString(), createdAt: new Date(now).toISOString() }, null, 2));
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'psip-fixture.json'), JSON.stringify({ manualOnlyAlias: true, prefix, actors,
    cases: Object.fromEntries(Object.entries(cases).map(([project, group]) => [project, Object.fromEntries(Object.keys(actors).map(type => [type, group[type].mixed.id]))])),
    paging: [], closed: cases.app.GENERADOR.closed.id, spontaneous: cases.app.GENERADOR.empty.id }, null, 2));
  console.log('PSIP deadlines: 39 artificial cases; existing QA accounts only, CAP closed, no providers.');
} finally { await db.$disconnect(); }
