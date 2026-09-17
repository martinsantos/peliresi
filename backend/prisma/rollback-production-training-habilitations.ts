/** Removes only the two certified synthetic TEF authorizations. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH = 'DEMO-CAP-20260917-P';
const YEAR = 2026;
const RESOLUTION_MARKER = `${BATCH} · HABILITACIÓN SINTÉTICA`;
const CONFIRM = process.env.ALLOW_PRODUCTION_TRAINING_HABILITATIONS_ROLLBACK;

async function main() {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl.includes('/trazabilidad_rrpp')) {
    throw new Error('ABORTADO: la conexión no apunta a trazabilidad_rrpp.');
  }
  if (CONFIRM !== 'YES_REMOVE_DEMO_HABILITATIONS') {
    throw new Error('ABORTADO: falta la confirmación exacta del rollback.');
  }

  const rows = await prisma.pagoTEF.findMany({
    where: { anio: YEAR, resolucion: RESOLUTION_MARKER },
    include: {
      generador: { include: { usuario: { select: { esDemo: true } } } },
      operador: { include: { usuario: { select: { esDemo: true } } } },
    },
  });
  if (rows.length !== 2) {
    throw new Error(`ABORTADO: se esperaban exactamente 2 registros demo y se encontraron ${rows.length}.`);
  }
  const safe = rows.every(row =>
    row.habilitado === true &&
    (row.generador?.usuario.esDemo || row.operador?.usuario.esDemo) &&
    row.gedoResolucion === `${BATCH}-TEF-${YEAR}`,
  );
  if (!safe) throw new Error('ABORTADO: un registro no conserva todas las marcas demo.');

  const ids = rows.map(row => row.id);
  await prisma.$transaction(async tx => {
    await tx.auditoria.deleteMany({
      where: { accion: 'HABILITACION_TEF_DEMO', datosDespues: { contains: BATCH } },
    });
    const result = await tx.pagoTEF.deleteMany({ where: { id: { in: ids } } });
    if (result.count !== 2) throw new Error(`Rollback incompleto: se eliminaron ${result.count} de 2.`);
  });

  console.log(JSON.stringify({
    batch: BATCH,
    removedAuthorizations: 2,
    realActorsChanged: false,
    credentialsChanged: false,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
