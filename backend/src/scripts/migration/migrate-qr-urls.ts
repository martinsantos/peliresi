/**
 * migrate-qr-urls.ts
 * 
 * Script de migración para actualizar todos los códigos QR de manifiestos existentes
 * para que apunten a la URL pública de verificación (/verify/:id) en lugar de
 * la URL interna del sistema (/manifiestos/:id).
 * 
 * Esto permite que los QRs escaneados abran una vista responsive en móvil.
 * 
 * USO:
 *   npx ts-node src/scripts/migration/migrate-qr-urls.ts
 * 
 *   O con --dry-run para ver qué haría sin hacer cambios:
 *   npx ts-node src/scripts/migration/migrate-qr-urls.ts --dry-run
 */

import prisma from '../../lib/prisma';
import QRCode from 'qrcode';
import { config } from '../../config/config';

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateQRUrls() {
  console.log('='.repeat(60));
  console.log('🔄 MIGRACIÓN DE URLs DE QR A VERIFICACIÓN PÚBLICA');
  console.log('='.repeat(60));
  console.log(`Modo: ${DRY_RUN ? '🔍 DRY-RUN (sin cambios)' : '⚡ EJECUCIÓN REAL'}`);
  console.log('');

  try {
    // Obtener todos los manifiestos con qrCode
    const manifiestos = await prisma.manifiesto.findMany({
      where: {
        qrCode: { not: null }
      },
      select: {
        id: true,
        numero: true,
        qrCode: true,
        estado: true
      }
    });

    console.log(`📋 Encontrados ${manifiestos.length} manifiestos con código QR`);
    console.log('');

    const baseUrl = config.CORS_ORIGIN.split(',')[0].trim();
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const manifiesto of manifiestos) {
      try {
        // Generar nueva URL pública
        const newVerificationUrl = `${baseUrl}/verify/${manifiesto.id}`;
        
        // Generar nuevo QR code con la URL pública
        const newQRCode = await QRCode.toDataURL(newVerificationUrl);

        if (DRY_RUN) {
          console.log(`  📝 [DRY-RUN] ${manifiesto.numero}: generaría QR → ${newVerificationUrl}`);
          updated++;
        } else {
          // Actualizar en la base de datos
          await prisma.manifiesto.update({
            where: { id: manifiesto.id },
            data: { qrCode: newQRCode }
          });
          
          console.log(`  ✅ ${manifiesto.numero}: QR actualizado → /verify/${manifiesto.id}`);
          updated++;
        }
      } catch (err: any) {
        console.error(`  ❌ ${manifiesto.numero}: Error - ${err.message}`);
        errors++;
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`  Total procesados: ${manifiestos.length}`);
    console.log(`  ✅ Actualizados:  ${updated}`);
    console.log(`  ⏭️  Omitidos:      ${skipped}`);
    console.log(`  ❌ Errores:       ${errors}`);
    console.log('');
    
    if (DRY_RUN) {
      console.log('💡 Para aplicar los cambios, ejecutar sin --dry-run');
    } else {
      console.log('✅ Migración completada. Todos los QRs ahora apuntan a /verify/:id');
    }

  } catch (error) {
    console.error('❌ Error fatal en migración:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
migrateQRUrls().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
