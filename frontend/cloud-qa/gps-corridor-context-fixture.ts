import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const historicalText = 'Tres posiciones consecutivas se mantuvieron fuera del corredor geográfico estimado. No se compara una ruta vial autorizada.';
try {
  const [generator, carrier, operator, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  for (const user of [generator, carrier, operator, admin]) assert.equal(user.activo, true);
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  for (const actor of [generator.generador, operator.operador]) {
    assert.ok(Number.isFinite(actor.latitud) && Number.isFinite(actor.longitud));
    assert.ok(actor.latitud < -32 && actor.longitud < -68);
  }
  const run = randomUUID().slice(0, 8), receiverName = `qa-gps-corridor-${run}`;
  const receiver = await db.usuario.create({ data: { email: `${receiverName}@night-qa.invalid`, password: admin.password,
    nombre: 'QA receptor corredor', rol: 'ADMIN', activo: true, emailVerified: true, notifEmail: false } });
  const cases: Record<string, unknown> = {};
  for (const [index, surface] of ['web-desktop', 'app'].entries()) {
    const manifest = await db.manifiesto.create({ data: { numero: `QA-CORRIDOR-${run}-${index}`,
      generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
      creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(Date.now() - 3600_000), isDemoData: true },
      select: { id: true, numero: true } });
    const historicalTitle = `QA corredor anterior ${run}-${index}`;
    const data = { evento: 'ANOMALIA_GPS', tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO', descripcion: historicalText, numero: manifest.numero };
    const historical = await db.notificacion.create({ data: { usuarioId: receiver.id, tipo: 'ALERTA_SISTEMA', titulo: historicalTitle,
      mensaje: historicalText, datos: JSON.stringify(data), manifiestoId: manifest.id, prioridad: 'ALTA' }, select: { id: true } });
    const previousRule = await db.reglaAlerta.create({ data: { nombre: `QA caso previo ${run}-${index}`, evento: 'ANOMALIA_GPS', activa: false,
      creadoPorId: admin.id, condicion: '{}', destinatarios: '["ADMIN"]' }, select: { id: true } });
    await db.alertaGenerada.create({ data: { reglaId: previousRule.id, manifiestoId: manifest.id, datos: JSON.stringify(data), estado: 'PENDIENTE' } });
    const liveRule = `QA corredor vigente ${run}-${index}`;
    await db.reglaAlerta.create({ data: { nombre: liveRule, evento: 'ANOMALIA_GPS', activa: true, creadoPorId: admin.id,
      condicion: JSON.stringify({ all: [{ manifiestoId: manifest.id }, { tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO' }] }), destinatarios: '["GENERADOR"]' } });
    cases[surface] = { ...manifest, historicalTitle, historicalId: historical.id, previousRule: `QA caso previo ${run}-${index}`, liveRule };
  }
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-corridor-context-fixture.json'), JSON.stringify({
    synthetic: true, receiverName, receiverId: receiver.id, generatorId: generator.id, historicalText, cases,
  }, null, 2), { mode: 0o600 });
  console.log('Casos artificiales de corredor preparados.');
} finally { await db.$disconnect(); }
