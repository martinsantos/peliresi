import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_RUN, 'legacy-integrity-baseline-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const [generator, carrier, operator] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
  ]);
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  const prefix = `QA-LEGACY-${randomUUID().slice(0, 8).toUpperCase()}`, cases: Record<string, { id: string; numero: string }> = {};
  for (const [kind, estado, modalidad] of [
    ['missing', 'PENDIENTE_APROBACION', 'FIJO'], ['invalid', 'PENDIENTE_APROBACION', 'FIJO'],
    ['mismatch', 'APROBADO', 'FIJO'], ['origin', 'APROBADO', 'IN_SITU'],
    ['valid', 'APROBADO', 'FIJO'], ['ordinary', 'PENDIENTE_APROBACION', 'FIJO'],
  ]) {
    const manifest = await db.manifiesto.create({ data: { numero: `${prefix}-${kind.toUpperCase()}`,
      generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
      creadoPorId: generator.id, estado, modalidad, isDemoData: true }, select: { id: true, numero: true } });
    cases[kind] = manifest;
    if (kind === 'missing') continue;
    const proposal = { version: 2, generadorId: generator.generador.id, transportistaId: carrier.transportista.id,
      operadorId: ['mismatch', 'origin'].includes(kind) ? 'QA-ACTOR-INCONSISTENTE' : operator.operador.id,
      creadoPorId: generator.id, autorRol: 'GENERADOR', modalidad };
    await db.eventoManifiesto.create({ data: { manifiestoId: manifest.id, usuarioId: generator.id, tipo: 'PROPUESTA_PARTES_V1',
      descripcion: kind === 'invalid' ? '{' : JSON.stringify(proposal) } });
    if (['mismatch', 'origin', 'valid'].includes(kind)) {
      for (const [tipo, usuarioId, rol, actorId] of [
        ['FIRMA', generator.id, 'GENERADOR', generator.generador.id], ['APROBACION_TRANSPORTISTA', carrier.id, 'TRANSPORTISTA', carrier.transportista.id],
        ['APROBACION_OPERADOR', operator.id, 'OPERADOR', operator.operador.id],
      ]) await db.eventoManifiesto.create({ data: { manifiestoId: manifest.id, usuarioId, tipo, descripcion: JSON.stringify({ version: 1, rol, actorId, decision: 'APROBADA' }) } });
      await db.eventoManifiesto.create({ data: { manifiestoId: manifest.id, usuarioId: generator.id, tipo: 'INICIO_COORDINACION', descripcion: 'QA: evento artificial' } });
    }
  }
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'legacy-integrity-fixture.json'), JSON.stringify({ synthetic: true, production: false, externalDelivery: false, capClosed: true, prefix, cases }, null, 2), { mode: 0o600 });
  console.log('Seis manifiestos artificiales preparados para reproducir y verificar el caso histórico.');
} finally { await db.$disconnect(); }
