import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-pdf-extent-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const [inspector, generator] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'inspector@night-qa.invalid' } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
  ]);
  assert.equal(inspector.activo, true); assert.equal(inspector.esInspector, true);
  assert.equal(generator.activo, true); assert.match(generator.generador.razonSocial, /^QA /);
  const para = (marker: string, n: number) => `${marker}INICIO ${'Constatación artificial y seguimiento documentado para comprobar el contenido completo. '.repeat(n)} ${marker}FINAL`;
  const run = randomUUID().slice(0, 8);
  const row = await db.inspeccion.create({ data: {
    numero: `QA-ACTA-EXTENSA-${run}`, numeroActa: `QA-ACTA-${run}`,
    tipoActor: 'GENERADOR', generadorId: generator.generador.id, inspectorId: inspector.id,
    estado: 'EN_REVISION', iniciadaAt: new Date('2026-10-20T12:05:00Z'),
    observaciones: para('QAOBS', 38),
    datosActa: { departamento: 'Godoy Cruz', calle: 'Calle de prueba', numeroDomicilio: '100',
      atendidoPor: 'Responsable artificial', area: 'Residuos Peligrosos', lugarAfectacion: 'Depósito',
      motivoInspeccion: para('QAMOTIVO', 7), requerimientos: para('QAREQUERIMIENTO', 8),
      infraestructura: 'SI', estadoInfraestructura: 'Requiere adecuación', plazoDescargoDias: 5,
      danosEstado: 'NO_OBSERVADOS', tercerosTestigosEstado: 'NO_IDENTIFICADOS', libroOperacionesEstado: 'EXHIBIDO',
      firmaIntervinienteEstado: 'NEGATIVA', firmaIntervinienteDetalle: 'Negativa artificial.',
      copiaActaEstado: 'PENDIENTE', domicilioLegal: 'QA Calle legal 123', notificacionEstado: 'NO_REALIZADA',
      notificacionDetalle: 'Sin comunicación externa.' },
  }, select: { id: true, numero: true } });
  await writeFile(path.join(out, 'browser-fixture.json'), JSON.stringify({ synthetic: true, inspection: row }), { mode: 0o600 });
  console.log('Expediente artificial preparado para la descarga en web y app.');
} finally { await db.$disconnect(); }
