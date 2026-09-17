import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH = process.env.DEMO_BATCH || 'DEMO-CAP-20260917-P';

async function main() {
  const rows = await prisma.manifiesto.findMany({
    where: { numero: { startsWith: BATCH } },
    include: { residuos: true, eventos: true, tracking: true, generador: true, transportista: true, operador: true },
  });
  const expected: Record<string, number> = { BORRADOR: 3, APROBADO: 4, EN_TRANSITO: 4, ENTREGADO: 4, RECIBIDO: 5, EN_TRATAMIENTO: 5, TRATADO: 8, RECHAZADO: 2, CANCELADO: 1 };
  const counts = rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.estado]: (acc[row.estado] || 0) + 1 }), {});
  const checks = {
    exactCount: rows.length === 36,
    exactDistribution: Object.entries(expected).every(([state, count]) => counts[state] === count),
    uniqueNumbers: new Set(rows.map(row => row.numero)).size === rows.length,
    demoMarked: rows.every(row => row.isDemoData && row.eventos.every(event => event.isDemoData) && row.tracking.every(point => point.isDemoData)),
    positiveQuantities: rows.every(row => row.residuos.length > 0 && row.residuos.every(item => item.cantidad > 0)),
    completeRelations: rows.every(row => row.generador && row.transportista && row.operador),
    alfaAsGenerator: rows.filter(row => row.generador.usuarioId === 'cmm2mmo8t004a5b5qvz0vwiln').length === 24,
    alfaAsTransporter: rows.filter(row => row.transportista?.usuarioId === 'cmm2mmo8t004a5b5qvz0vwiln').length === 18,
    alfaAsOperator: rows.filter(row => row.operador?.usuarioId === 'cmm2mmo8t004a5b5qvz0vwiln').length === 24,
    noManifestNotifications: (await prisma.notificacion.count({ where: { manifiestoId: { in: rows.map(row => row.id) } } })) === 0,
    noQueuedEmailsForBatch: (await prisma.emailQueue.count({ where: { OR: [{ subject: { contains: BATCH } }, { html: { contains: BATCH } }] } })) === 0,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ batch: BATCH, counts, checks, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
