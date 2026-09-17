/**
 * Removes only the explicitly identified production training batch.
 * Inert unless database, batch and confirmation token match the certification.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CERTIFIED_BATCH = 'DEMO-CAP-20260917-P';
const BATCH = process.env.DEMO_BATCH || CERTIFIED_BATCH;
const CONFIRM = process.env.ALLOW_PRODUCTION_TRAINING_ROLLBACK;

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('/trazabilidad_rrpp')) {
    throw new Error('ABORTADO: la conexión no apunta a trazabilidad_rrpp.');
  }
  if (BATCH !== CERTIFIED_BATCH || CONFIRM !== 'YES_REMOVE_CERTIFIED_DEMO_BATCH') {
    throw new Error('ABORTADO: lote o confirmación de rollback inválidos.');
  }

  const rows = await prisma.manifiesto.findMany({
    where: { numero: { startsWith: BATCH } },
    select: { id: true, numero: true, isDemoData: true, observaciones: true },
  });
  if (rows.length !== 36) {
    throw new Error(`ABORTADO: se esperaban exactamente 36 manifiestos y se encontraron ${rows.length}.`);
  }
  const safe = rows.every(row =>
    row.isDemoData &&
    row.numero.startsWith(BATCH) &&
    row.observaciones?.includes('DATOS SINTÉTICOS · CAPACITACIÓN'),
  );
  if (!safe) throw new Error('ABORTADO: al menos un registro no conserva todas las marcas de seguridad.');

  const ids = rows.map(row => row.id);
  await prisma.$transaction(async tx => {
    await tx.notificacion.deleteMany({ where: { manifiestoId: { in: ids } } });
    await tx.alertaGenerada.deleteMany({ where: { manifiestoId: { in: ids } } });
    await tx.anomaliaTransporte.deleteMany({ where: { manifiestoId: { in: ids } } });
    await tx.auditoria.deleteMany({ where: { manifiestoId: { in: ids } } });
    const result = await tx.manifiesto.deleteMany({ where: { id: { in: ids }, isDemoData: true } });
    if (result.count !== 36) throw new Error(`Rollback incompleto: se eliminaron ${result.count} de 36.`);
  }, { timeout: 120_000 });

  console.log(JSON.stringify({ batch: BATCH, removedManifests: 36, usersOrCredentialsChanged: false }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
