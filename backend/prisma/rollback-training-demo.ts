import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH = process.env.DEMO_BATCH || 'DEMO-CAP-20260917';

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (url.includes('/trazabilidad_rrpp') || !url.includes('/trazabilidad_demo')) {
    throw new Error('ABORTADO: el rollback sólo puede ejecutarse sobre trazabilidad_demo.');
  }
  const manifests = await prisma.manifiesto.findMany({ where: { numero: { startsWith: BATCH } }, select: { id: true } });
  const ids = manifests.map(item => item.id);
  const deleted = await prisma.$transaction(async tx => {
    if (ids.length > 0) await tx.auditoria.deleteMany({ where: { manifiestoId: { in: ids } } });
    return tx.manifiesto.deleteMany({ where: { id: { in: ids } } });
  });
  console.log(JSON.stringify({ batch: BATCH, deletedManifests: deleted.count }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
