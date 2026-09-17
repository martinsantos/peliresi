import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH = 'DEMO-CAP-20260917-P';
const YEAR = 2026;
const RESOLUTION_MARKER = `${BATCH} · HABILITACIÓN SINTÉTICA`;

async function main() {
  const rows = await prisma.pagoTEF.findMany({
    where: { anio: YEAR, resolucion: RESOLUTION_MARKER },
    include: {
      generador: { include: { usuario: { select: { esDemo: true } } } },
      operador: { include: { usuario: { select: { esDemo: true } } } },
    },
  });

  const batch = await prisma.manifiesto.findMany({
    where: { numero: { startsWith: BATCH }, isDemoData: true },
    select: { generadorId: true, operadorId: true },
  });
  const generatorIds = new Set(batch.map(row => row.generadorId));
  const operatorIds = new Set(batch.flatMap(row => row.operadorId ? [row.operadorId] : []));
  const earliestCreatedAt = rows.reduce<Date | null>(
    (earliest, row) => !earliest || row.createdAt < earliest ? row.createdAt : earliest,
    null,
  );

  const checks = {
    exactCount: rows.length === 2,
    exactActorTypes: rows.filter(row => row.generadorId).length === 1 && rows.filter(row => row.operadorId).length === 1,
    allEnabled: rows.every(row => row.habilitado === true),
    allPaid: rows.every(row => row.fechaPago !== null && row.notificado),
    allDemoUsers: rows.every(row => row.generador?.usuario.esDemo || row.operador?.usuario.esDemo),
    allActorsActive: rows.every(row => row.generador?.activo || row.operador?.activo),
    allUsedByBatch: rows.every(row =>
      (row.generadorId && generatorIds.has(row.generadorId)) ||
      (row.operadorId && operatorIds.has(row.operadorId))),
    noNewTaggedEmails: (await prisma.emailQueue.count({
      where: {
        createdAt: earliestCreatedAt ? { gte: earliestCreatedAt } : undefined,
        OR: [{ subject: { contains: BATCH } }, { html: { contains: BATCH } }],
      },
    })) === 0,
    noNewTaggedNotifications: (await prisma.notificacion.count({
      where: {
        createdAt: earliestCreatedAt ? { gte: earliestCreatedAt } : undefined,
        OR: [{ titulo: { contains: BATCH } }, { mensaje: { contains: BATCH } }, { datos: { contains: BATCH } }],
      },
    })) === 0,
  };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({
    batch: BATCH,
    year: YEAR,
    records: rows.map(row => ({
      id: row.id,
      actorType: row.generadorId ? 'GENERADOR' : 'OPERADOR',
      actor: row.generador?.razonSocial || row.operador?.razonSocial,
      habilitado: row.habilitado,
      syntheticResolution: row.resolucion,
    })),
    checks,
    failed,
  }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
