/**
 * SITREP — Rollback Demo Data
 * ============================
 * Elimina todos los datos demo (isDemoData=true) respetando foreign keys.
 *
 * Uso: npx ts-node prisma/rollback-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== SITREP Rollback Demo Data ===\n');

  // Count before
  const [manifiestos, eventos, tracking, anomalias] = await Promise.all([
    prisma.manifiesto.count({ where: { isDemoData: true } }),
    prisma.eventoManifiesto.count({ where: { isDemoData: true } }),
    prisma.trackingGPS.count({ where: { isDemoData: true } }),
    prisma.anomaliaTransporte.count({ where: { isDemoData: true } }),
  ]);

  console.log('Datos demo encontrados:');
  console.log(`  Manifiestos: ${manifiestos}`);
  console.log(`  Eventos: ${eventos}`);
  console.log(`  Tracking GPS: ${tracking}`);
  console.log(`  Anomalías: ${anomalias}`);

  if (manifiestos === 0 && eventos === 0 && tracking === 0 && anomalias === 0) {
    console.log('\nNo hay datos demo para eliminar.');
    return;
  }

  console.log('\nEliminando datos demo...\n');

  // Order matters: respect foreign keys
  // 1. TrackingGPS (references Manifiesto)
  const deletedTracking = await prisma.trackingGPS.deleteMany({ where: { isDemoData: true } });
  console.log(`  TrackingGPS eliminados: ${deletedTracking.count}`);

  // 2. AnomaliaTransporte (references Manifiesto)
  const deletedAnomalias = await prisma.anomaliaTransporte.deleteMany({ where: { isDemoData: true } });
  console.log(`  Anomalías eliminadas: ${deletedAnomalias.count}`);

  // 3. EventoManifiesto (references Manifiesto)
  const deletedEventos = await prisma.eventoManifiesto.deleteMany({ where: { isDemoData: true } });
  console.log(`  Eventos eliminados: ${deletedEventos.count}`);

  // 4. ManifiestoResiduo (via cascade, but let's be explicit)
  const demoManifiestoIds = await prisma.manifiesto.findMany({
    where: { isDemoData: true },
    select: { id: true },
  });
  const ids = demoManifiestoIds.map(m => m.id);

  if (ids.length > 0) {
    const deletedResiduos = await prisma.manifiestoResiduo.deleteMany({
      where: { manifiestoId: { in: ids } },
    });
    console.log(`  Residuos eliminados: ${deletedResiduos.count}`);

    // 5. Auditorias linked to demo manifiestos
    const deletedAuditorias = await prisma.auditoria.deleteMany({
      where: { manifiestoId: { in: ids } },
    });
    console.log(`  Auditorías eliminadas: ${deletedAuditorias.count}`);

    // 6. Notificaciones linked to demo manifiestos
    const deletedNotifs = await prisma.notificacion.deleteMany({
      where: { manifiestoId: { in: ids } },
    });
    console.log(`  Notificaciones eliminadas: ${deletedNotifs.count}`);

    // 7. AlertaGenerada linked to demo manifiestos
    const deletedAlertas = await prisma.alertaGenerada.deleteMany({
      where: { manifiestoId: { in: ids } },
    });
    console.log(`  Alertas eliminadas: ${deletedAlertas.count}`);
  }

  // 8. Manifiestos
  const deletedManifiestos = await prisma.manifiesto.deleteMany({ where: { isDemoData: true } });
  console.log(`  Manifiestos eliminados: ${deletedManifiestos.count}`);

  console.log('\nRollback completo!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
