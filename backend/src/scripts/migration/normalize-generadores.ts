/**
 * Script de migración para normalizar datos de generadores
 * Sistema de Trazabilidad de Residuos Peligrosos
 *
 * USO:
 *   npx ts-node src/scripts/migration/normalize-generadores.ts --dry-run
 *   npx ts-node src/scripts/migration/normalize-generadores.ts
 */

import { PrismaClient } from '@prisma/client';
import { normalizeRubro, normalizarDepartamento } from '../../utils/normalization';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function normalizeGeneradores() {
  console.log('='.repeat(60));
  console.log('NORMALIZACIÓN DE DATOS DE GENERADORES');
  console.log('='.repeat(60));
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (sin cambios)' : 'EJECUCIÓN REAL'}`);
  console.log('');

  const generadores = await prisma.generador.findMany({
    select: {
      id: true,
      razonSocial: true,
      rubro: true,
      domicilioLegalDepartamento: true,
      domicilioRealDepartamento: true,
    }
  });

  console.log(`Encontrados ${generadores.length} generadores\n`);

  let rubroChanges = 0;
  let deptoLegalChanges = 0;
  let deptoRealChanges = 0;

  const rubroStats: Record<string, { original: string[], canonical: string }> = {};
  const deptoStats: Record<string, { original: string[], canonical: string }> = {};

  for (const gen of generadores) {
    const updates: Record<string, string> = {};

    // Normalizar rubro
    if (gen.rubro) {
      const rubroNorm = normalizeRubro(gen.rubro);
      if (rubroNorm !== gen.rubro && rubroNorm !== 'SIN ESPECIFICAR') {
        updates.rubro = rubroNorm;
        rubroChanges++;

        // Estadísticas de rubros
        if (!rubroStats[rubroNorm]) {
          rubroStats[rubroNorm] = { original: [], canonical: rubroNorm };
        }
        if (!rubroStats[rubroNorm].original.includes(gen.rubro)) {
          rubroStats[rubroNorm].original.push(gen.rubro);
        }

        if (DRY_RUN) {
          console.log(`[RUBRO] "${gen.rubro}" → "${rubroNorm}"`);
          console.log(`        Generador: ${gen.razonSocial}`);
        }
      }
    }

    // Normalizar departamento legal
    if (gen.domicilioLegalDepartamento) {
      const deptoNorm = normalizarDepartamento(gen.domicilioLegalDepartamento);
      if (deptoNorm && deptoNorm !== gen.domicilioLegalDepartamento) {
        updates.domicilioLegalDepartamento = deptoNorm;
        deptoLegalChanges++;

        // Estadísticas de departamentos
        if (!deptoStats[deptoNorm]) {
          deptoStats[deptoNorm] = { original: [], canonical: deptoNorm };
        }
        if (!deptoStats[deptoNorm].original.includes(gen.domicilioLegalDepartamento)) {
          deptoStats[deptoNorm].original.push(gen.domicilioLegalDepartamento);
        }

        if (DRY_RUN) {
          console.log(`[DEPTO LEGAL] "${gen.domicilioLegalDepartamento}" → "${deptoNorm}"`);
          console.log(`              Generador: ${gen.razonSocial}`);
        }
      }
    }

    // Normalizar departamento real
    if (gen.domicilioRealDepartamento) {
      const deptoNorm = normalizarDepartamento(gen.domicilioRealDepartamento);
      if (deptoNorm && deptoNorm !== gen.domicilioRealDepartamento) {
        updates.domicilioRealDepartamento = deptoNorm;
        deptoRealChanges++;

        if (DRY_RUN) {
          console.log(`[DEPTO REAL] "${gen.domicilioRealDepartamento}" → "${deptoNorm}"`);
          console.log(`             Generador: ${gen.razonSocial}`);
        }
      }
    }

    // Aplicar cambios si no es dry-run
    if (!DRY_RUN && Object.keys(updates).length > 0) {
      await prisma.generador.update({
        where: { id: gen.id },
        data: updates
      });
      process.stdout.write('.');
    }
  }

  if (!DRY_RUN && (rubroChanges > 0 || deptoLegalChanges > 0 || deptoRealChanges > 0)) {
    console.log(''); // Nueva línea después de los puntos de progreso
  }

  // Mostrar resumen de estadísticas
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE NORMALIZACIONES');
  console.log('='.repeat(60));

  if (Object.keys(rubroStats).length > 0) {
    console.log('\n📋 RUBROS NORMALIZADOS:');
    for (const [canonical, stats] of Object.entries(rubroStats)) {
      console.log(`\n  ✓ ${canonical}`);
      stats.original.forEach(orig => {
        console.log(`    ← "${orig}"`);
      });
    }
  }

  if (Object.keys(deptoStats).length > 0) {
    console.log('\n📍 DEPARTAMENTOS NORMALIZADOS:');
    for (const [canonical, stats] of Object.entries(deptoStats)) {
      console.log(`\n  ✓ ${canonical}`);
      stats.original.forEach(orig => {
        console.log(`    ← "${orig}"`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('TOTALES');
  console.log('='.repeat(60));
  console.log(`Rubros a normalizar: ${rubroChanges}`);
  console.log(`Departamentos legales a normalizar: ${deptoLegalChanges}`);
  console.log(`Departamentos reales a normalizar: ${deptoRealChanges}`);
  console.log(`Total de cambios: ${rubroChanges + deptoLegalChanges + deptoRealChanges}`);

  if (DRY_RUN) {
    console.log('\n⚠️  Ejecutar sin --dry-run para aplicar cambios');
  } else {
    console.log('\n✅ Cambios aplicados exitosamente');
  }
}

normalizeGeneradores()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Error durante la migración:', e);
    prisma.$disconnect();
    process.exit(1);
  });
