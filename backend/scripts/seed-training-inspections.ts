/** Idempotent, clearly marked inspection fixtures for the isolated CAP actors. */
export {};
const { PrismaClient } = require('@prisma/client');
const { CHECKLIST_BY_ACTOR } = require('../dist/controllers/inspeccion.controller');
const { buildDeclaredInspectionSnapshot } = require('../dist/services/inspectionDeclaredSnapshot.service');

const prisma = new PrismaClient();
const runLabel = process.env.TRAINING_RUN_LABEL;
if (!/^20\d{6}$/.test(runLabel || '')) throw new Error('TRAINING_RUN_LABEL must be eight digits.');
if (process.env.DISABLE_EMAILS !== 'true') throw new Error('Email sending must be disabled.');

const fixtures = [
  { type: 'GENERADOR', key: 'generador', email: 'capacitacion.generador@rptrazar.mendoza.gov.ar' },
  { type: 'TRANSPORTISTA', key: 'transportista', email: 'capacitacion.transportista@rptrazar.mendoza.gov.ar' },
  { type: 'OPERADOR', key: 'operador', email: 'capacitacion.operador@rptrazar.mendoza.gov.ar' },
];

async function main() {
  const admin = await prisma.usuario.findUnique({ where: { email: 'admin@dgfa.mendoza.gov.ar' } });
  if (!admin?.activo || admin.rol !== 'ADMIN') throw new Error('Active training supervisor unavailable.');

  for (const fixture of fixtures) {
    const number = `DEMO-INS-${fixture.type.slice(0, 3)}-${runLabel}`;
    const actor = await prisma[fixture.key].findFirst({ where: { usuario: { email: fixture.email } } });
    if (!actor || !actor.razonSocial.startsWith('CAPACITACION RP -')) {
      throw new Error(`Synthetic ${fixture.type} actor unavailable; no inspection created.`);
    }
    const existing = await prisma.inspeccion.findFirst({ where: { numeroActa: number } });
    if (existing) {
      const actorId = existing[`${fixture.key}Id`];
      if (actorId !== actor.id || existing.inspectorId !== admin.id) {
        throw new Error(`Existing ${number} does not match the training actor and supervisor.`);
      }
      console.log(`${number}: already present`);
      continue;
    }

    const created = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(836271)::text AS "lock"`;
      const year = new Date().getFullYear();
      const count = await tx.inspeccion.count({ where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } } });
      const snapshot = await buildDeclaredInspectionSnapshot(tx, fixture.type, actor.id);
      const inspection = await tx.inspeccion.create({
        data: {
          numero: `I-${year}-${String(count + 1).padStart(6, '0')}`,
          numeroActa: number,
          tipoActor: fixture.type,
          [`${fixture.key}Id`]: actor.id,
          inspectorId: admin.id,
          estado: 'BORRADOR',
          ubicacion: 'Mendoza · circuito de capacitación — no es una inspección real',
          observaciones: '[DEMO] Expediente sintético exclusivo para capacitación. No constituye acta real.',
          declaradoSnapshot: snapshot,
          items: { create: CHECKLIST_BY_ACTOR[fixture.type].map((item: any) => ({ ...item, obligatorio: item.obligatorio ?? true })) },
          comparaciones: { create: snapshot.fields.map((row: any) => ({ ...row })) },
        },
      });
      await tx.eventoInspeccion.create({
        data: {
          inspeccionId: inspection.id,
          usuarioId: admin.id,
          tipo: 'CREADA',
          titulo: 'Inspección sintética creada para capacitación',
          detalle: 'DEMO — no corresponde a una inspección real',
        },
      });
      return inspection;
    });
    console.log(`${number}: ${created.id}`);
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
