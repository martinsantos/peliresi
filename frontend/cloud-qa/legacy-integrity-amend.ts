import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_RUN, 'legacy-integrity-20261030');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const file = path.join(process.env.QA_ARTIFACTS!, 'legacy-integrity-fixture.json');
const fixture = JSON.parse(readFileSync(file, 'utf8'));
assert.equal(fixture.synthetic, true); assert.equal(fixture.production, false); assert.equal(fixture.cases.badEvidence, undefined);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const valid = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.cases.valid.id }, include: { eventos: true } });
  assert.equal(valid.isDemoData, true); assert.equal(valid.numero, fixture.cases.valid.numero); assert.match(valid.numero, /^QA-LEGACY-/);
  const decisions = [
    ['FIRMA', 'GENERADOR', valid.generadorId], ['APROBACION_TRANSPORTISTA', 'TRANSPORTISTA', valid.transportistaId], ['APROBACION_OPERADOR', 'OPERADOR', valid.operadorId],
  ] as const;
  const before = valid.eventos.filter((event: any) => decisions.some(([type]) => type === event.tipo)).map((event: any) => ({ tipo: event.tipo, descripcion: event.descripcion }));
  assert.equal(before.length, 3);
  const added = await db.$transaction(async (tx: any) => {
    for (const [tipo, rol, actorId] of decisions) {
      const result = await tx.eventoManifiesto.updateMany({ where: { manifiestoId: valid.id, tipo }, data: { descripcion: JSON.stringify({ version: 1, rol, actorId, decision: 'APROBADA' }) } });
      assert.equal(result.count, 1);
    }
    const newManifest = await tx.manifiesto.create({ data: { numero: `${fixture.prefix}-BAD-EVIDENCE`, generadorId: valid.generadorId,
      transportistaId: valid.transportistaId, operadorId: valid.operadorId, creadoPorId: valid.creadoPorId,
      estado: 'APROBADO', modalidad: 'FIJO', isDemoData: true }, select: { id: true, numero: true } });
    const marker = valid.eventos.find((event: any) => event.tipo === 'PROPUESTA_PARTES_V1');
    assert.ok(marker);
    await tx.eventoManifiesto.create({ data: { manifiestoId: newManifest.id, usuarioId: valid.creadoPorId, tipo: marker.tipo, descripcion: marker.descripcion } });
    for (const [tipo, rol, actorId] of decisions) {
      const source = valid.eventos.find((event: any) => event.tipo === tipo); assert.ok(source);
      await tx.eventoManifiesto.create({ data: { manifiestoId: newManifest.id, usuarioId: source.usuarioId, tipo,
        descripcion: JSON.stringify({ version: 1, rol, actorId: rol === 'TRANSPORTISTA' ? 'QA-ACTOR-AJENO' : actorId, decision: 'APROBADA' }) } });
    }
    await tx.eventoManifiesto.create({ data: { manifiestoId: newManifest.id, usuarioId: valid.creadoPorId, tipo: 'INICIO_COORDINACION', descripcion: 'QA: evento artificial' } });
    return newManifest;
  });
  fixture.cases.badEvidence = added;
  writeFileSync(file, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'legacy-fixture-amend.json'), JSON.stringify({ synthetic: true, production: false, validDescriptionsBefore: before, validNowUsesCanonicalEvidence: true, addedBadEvidence: added.id }, null, 2));
  console.log('Se documentó la normalización de eventos artificiales y se agregó un caso con aprobación de actor equivocado.');
} finally { await db.$disconnect(); }
