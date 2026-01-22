/**
 * Script de Geocodificación de Generadores
 *
 * Asigna coordenadas (latitud/longitud) a generadores existentes
 * basándose en su departamento, con una pequeña variación aleatoria
 * para evitar que todos los marcadores se superpongan.
 *
 * Uso:
 *   npx tsx scripts/migration/geocode-generadores.ts [opciones]
 *
 * Opciones:
 *   --dry-run       Simular sin escribir en DB
 *   --force         Sobrescribir coordenadas existentes
 *   --batch-size    Tamaño del lote (default: 100)
 *
 * Ejemplo:
 *   npx tsx scripts/migration/geocode-generadores.ts --dry-run
 *   npx tsx scripts/migration/geocode-generadores.ts --force
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuración
const CONFIG = {
  DRY_RUN: false,
  FORCE: false,
  BATCH_SIZE: 100,
  // Variación aleatoria en grados (aproximadamente 0.02 = 2km)
  VARIATION: 0.02
};

// Coordenadas centrales de los departamentos de Mendoza
const DEPARTAMENTOS_COORDS: Record<string, { lat: number; lng: number }> = {
  // Gran Mendoza
  'CAPITAL': { lat: -32.8900, lng: -68.8400 },
  'CIUDAD': { lat: -32.8900, lng: -68.8400 },
  'MENDOZA': { lat: -32.8900, lng: -68.8400 },
  'GODOY CRUZ': { lat: -32.9200, lng: -68.8500 },
  'GUAYMALLEN': { lat: -32.8800, lng: -68.7900 },
  'GUAYMALLÉN': { lat: -32.8800, lng: -68.7900 },
  'LAS HERAS': { lat: -32.8400, lng: -68.8500 },
  'MAIPU': { lat: -32.9700, lng: -68.7800 },
  'MAIPÚ': { lat: -32.9700, lng: -68.7800 },
  'LUJAN DE CUYO': { lat: -33.0200, lng: -68.8400 },
  'LUJÁN DE CUYO': { lat: -33.0200, lng: -68.8400 },

  // Valle de Uco
  'SAN CARLOS': { lat: -33.7700, lng: -69.0500 },
  'TUNUYAN': { lat: -33.5700, lng: -69.0200 },
  'TUNUYÁN': { lat: -33.5700, lng: -69.0200 },
  'TUPUNGATO': { lat: -33.3600, lng: -69.1500 },

  // Este
  'JUNIN': { lat: -33.1400, lng: -68.4800 },
  'JUNÍN': { lat: -33.1400, lng: -68.4800 },
  'RIVADAVIA': { lat: -33.1900, lng: -68.4600 },
  'SAN MARTIN': { lat: -33.0800, lng: -68.4700 },
  'SAN MARTÍN': { lat: -33.0800, lng: -68.4700 },
  'SANTA ROSA': { lat: -33.2500, lng: -68.1500 },
  'LA PAZ': { lat: -33.4600, lng: -67.5500 },

  // Sur
  'SAN RAFAEL': { lat: -34.6200, lng: -68.3400 },
  'GENERAL ALVEAR': { lat: -34.9700, lng: -67.7000 },
  'MALARGUE': { lat: -35.4700, lng: -69.5800 },
  'MALARGÜE': { lat: -35.4700, lng: -69.5800 },

  // Norte
  'LAVALLE': { lat: -32.7200, lng: -68.5900 },

  // Fallback para otros/desconocidos (centro de Mendoza)
  'DEFAULT': { lat: -32.8900, lng: -68.8400 }
};

// Normalizar nombre de departamento para búsqueda
function normalizeDepartamento(depto: string | null): string {
  if (!depto) return 'DEFAULT';

  // Convertir a mayúsculas y eliminar espacios extra
  let normalized = depto.toUpperCase().trim();

  // Eliminar acentos
  normalized = normalized
    .replace(/Á/g, 'A')
    .replace(/É/g, 'E')
    .replace(/Í/g, 'I')
    .replace(/Ó/g, 'O')
    .replace(/Ú/g, 'U')
    .replace(/Ü/g, 'U');

  // Manejar variaciones comunes
  if (normalized.includes('GUAYMALLEN')) return 'GUAYMALLEN';
  if (normalized.includes('GODOY')) return 'GODOY CRUZ';
  if (normalized.includes('MAIPU')) return 'MAIPU';
  if (normalized.includes('LUJAN')) return 'LUJAN DE CUYO';
  if (normalized.includes('CAPITAL') || normalized === 'MENDOZA' || normalized === 'CIUDAD') return 'CAPITAL';
  if (normalized.includes('HERAS')) return 'LAS HERAS';
  if (normalized.includes('TUNUYAN')) return 'TUNUYAN';
  if (normalized.includes('TUPUNGATO')) return 'TUPUNGATO';
  if (normalized.includes('SAN CARLOS')) return 'SAN CARLOS';
  if (normalized.includes('JUNIN')) return 'JUNIN';
  if (normalized.includes('RIVADAVIA')) return 'RIVADAVIA';
  if (normalized.includes('SAN MARTIN') || normalized.includes('GRAL. SAN MARTIN')) return 'SAN MARTIN';
  if (normalized.includes('SANTA ROSA')) return 'SANTA ROSA';
  if (normalized.includes('LA PAZ')) return 'LA PAZ';
  if (normalized.includes('SAN RAFAEL')) return 'SAN RAFAEL';
  if (normalized.includes('ALVEAR')) return 'GENERAL ALVEAR';
  if (normalized.includes('MALARGUE')) return 'MALARGUE';
  if (normalized.includes('LAVALLE')) return 'LAVALLE';

  return normalized;
}

// Obtener coordenadas para un departamento con variación aleatoria
function getCoordinatesForDepartamento(depto: string | null): { lat: number; lng: number } {
  const normalized = normalizeDepartamento(depto);
  const coords = DEPARTAMENTOS_COORDS[normalized] || DEPARTAMENTOS_COORDS['DEFAULT'];

  // Añadir variación aleatoria para que no se superpongan los marcadores
  const latVariation = (Math.random() - 0.5) * CONFIG.VARIATION;
  const lngVariation = (Math.random() - 0.5) * CONFIG.VARIATION;

  return {
    lat: coords.lat + latVariation,
    lng: coords.lng + lngVariation
  };
}

// Función principal
async function geocodeGeneradores(): Promise<void> {
  console.log('🗺️  Script de Geocodificación de Generadores');
  console.log('='.repeat(50));
  console.log(`📋 Modo: ${CONFIG.DRY_RUN ? 'SIMULACIÓN (dry-run)' : 'PRODUCCIÓN'}`);
  console.log(`🔄 Sobrescribir existentes: ${CONFIG.FORCE ? 'SÍ' : 'NO'}`);
  console.log(`📦 Tamaño de lote: ${CONFIG.BATCH_SIZE}`);
  console.log('');

  try {
    // Construir filtro
    const where: any = {};
    if (!CONFIG.FORCE) {
      // Solo actualizar los que no tienen coordenadas
      where.OR = [
        { latitud: null },
        { longitud: null }
      ];
    }

    // Contar generadores a procesar
    const total = await prisma.generador.count({ where });
    console.log(`📊 Generadores a procesar: ${total}`);

    if (total === 0) {
      console.log('✅ Todos los generadores ya tienen coordenadas.');
      return;
    }

    // Procesar en lotes
    let processed = 0;
    let updated = 0;
    let errors = 0;
    let offset = 0;

    while (offset < total) {
      const generadores = await prisma.generador.findMany({
        where,
        select: {
          id: true,
          razonSocial: true,
          domicilioLegalDepartamento: true,
          latitud: true,
          longitud: true
        },
        skip: offset,
        take: CONFIG.BATCH_SIZE
      });

      if (generadores.length === 0) break;

      console.log(`\n📦 Procesando lote ${Math.floor(offset / CONFIG.BATCH_SIZE) + 1} (${generadores.length} registros)...`);

      for (const gen of generadores) {
        try {
          const coords = getCoordinatesForDepartamento(gen.domicilioLegalDepartamento);

          if (CONFIG.DRY_RUN) {
            console.log(`  [DRY-RUN] ${gen.razonSocial.substring(0, 40)} → (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) [${gen.domicilioLegalDepartamento || 'Sin depto'}]`);
          } else {
            await prisma.generador.update({
              where: { id: gen.id },
              data: {
                latitud: coords.lat,
                longitud: coords.lng
              }
            });
          }

          updated++;
        } catch (err: any) {
          console.error(`  ❌ Error procesando ${gen.id}: ${err.message}`);
          errors++;
        }

        processed++;
      }

      const progress = ((processed / total) * 100).toFixed(1);
      console.log(`  📊 Progreso: ${processed}/${total} (${progress}%)`);

      offset += CONFIG.BATCH_SIZE;
    }

    // Resumen final
    console.log('\n' + '='.repeat(50));
    console.log('🏁 GEOCODIFICACIÓN COMPLETADA');
    console.log('='.repeat(50));
    console.log(`📊 Total procesados: ${processed}`);
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`❌ Errores: ${errors}`);

    if (CONFIG.DRY_RUN) {
      console.log('\n⚠️  Este fue un dry-run. Ejecute sin --dry-run para aplicar los cambios.');
    }

    // Verificar resultado
    if (!CONFIG.DRY_RUN) {
      const conCoordenadas = await prisma.generador.count({
        where: {
          latitud: { not: null },
          longitud: { not: null }
        }
      });
      const sinCoordenadas = await prisma.generador.count({
        where: {
          OR: [
            { latitud: null },
            { longitud: null }
          ]
        }
      });
      console.log(`\n📊 Estado final:`);
      console.log(`   Con coordenadas: ${conCoordenadas}`);
      console.log(`   Sin coordenadas: ${sinCoordenadas}`);
    }

  } catch (error: any) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parsear argumentos
function parseArgs(): void {
  const args = process.argv.slice(2);

  for (const arg of args) {
    switch (arg) {
      case '--dry-run':
        CONFIG.DRY_RUN = true;
        break;
      case '--force':
        CONFIG.FORCE = true;
        break;
      case '--help':
        console.log(`
Uso: npx tsx scripts/migration/geocode-generadores.ts [opciones]

Opciones:
  --dry-run       Simular sin escribir en DB
  --force         Sobrescribir coordenadas existentes
  --help          Mostrar esta ayuda

Ejemplos:
  npx tsx scripts/migration/geocode-generadores.ts --dry-run
  npx tsx scripts/migration/geocode-generadores.ts
  npx tsx scripts/migration/geocode-generadores.ts --force
        `);
        process.exit(0);
    }
  }
}

// Ejecutar
parseArgs();
geocodeGeneradores();
