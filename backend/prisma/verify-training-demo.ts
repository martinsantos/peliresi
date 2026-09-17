import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH = process.env.DEMO_BATCH || 'DEMO-CAP-20260917';

async function main() {
  const rows = await prisma.manifiesto.findMany({
    where: { numero: { startsWith: BATCH } },
    include: { residuos: true, eventos: true, tracking: true, generador: true, transportista: true, operador: true },
  });
  const expected: Record<string, number> = { BORRADOR: 3, APROBADO: 4, EN_TRANSITO: 4, ENTREGADO: 4, RECIBIDO: 5, EN_TRATAMIENTO: 5, TRATADO: 8, RECHAZADO: 2, CANCELADO: 1 };
  const actual = rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.estado]: (acc[row.estado] || 0) + 1 }), {});
  const now = Date.now();
  const checks: Record<string, boolean> = {
    exactCount: rows.length === 36,
    exactDistribution: Object.entries(expected).every(([state, count]) => actual[state] === count),
    uniqueNumbers: new Set(rows.map(row => row.numero)).size === rows.length,
    allMarkedDemo: rows.every(row => row.isDemoData && row.observaciones?.includes('DATOS SINTÉTICOS')),
    inLast30Days: rows.every(row => row.createdAt.getTime() <= now && row.createdAt.getTime() >= now - 31 * 86_400_000),
    actorsPresent: rows.every(row => row.generador && row.transportista && row.operador),
    positiveQuantities: rows.every(row => row.residuos.length > 0 && row.residuos.every(item => item.cantidad > 0)),
    demoEventsOnly: rows.every(row => row.eventos.length > 0 && row.eventos.every(event => event.isDemoData)),
    demoTrackingOnly: rows.every(row => row.tracking.every(point => point.isDemoData)),
    signedStatesConsistent: rows.every(row => ['BORRADOR','CANCELADO'].includes(row.estado) || Boolean(row.fechaFirma)),
    transitStatesConsistent: rows.every(row => !['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO'].includes(row.estado) || Boolean(row.fechaRetiro)),
    deliveredStatesConsistent: rows.every(row => !['ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO'].includes(row.estado) || Boolean(row.fechaEntrega)),
    receivedStatesConsistent: rows.every(row => !['RECIBIDO','EN_TRATAMIENTO','TRATADO'].includes(row.estado) || Boolean(row.fechaRecepcion)),
    treatedStatesConsistent: rows.every(row => row.estado !== 'TRATADO' || Boolean(row.fechaCierre)),
  };
  const [emailQueue, notifications, pushSubscriptions, demoUsers] = await Promise.all([
    prisma.emailQueue.count(), prisma.notificacion.count(), prisma.pushSubscripcion.count(),
    prisma.usuario.count({ where: { email: { endsWith: '@sitrep.invalid' }, activo: true } }),
  ]);
  checks.noEmailQueue = emailQueue === 0;
  checks.noNotifications = notifications === 0;
  checks.noPushSubscriptions = pushSubscriptions === 0;
  checks.trainingUsersPresent = demoUsers === 10;
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ batch: BATCH, counts: actual, safeguards: { emailQueue, notifications, pushSubscriptions }, checks, failed }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
