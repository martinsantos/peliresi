/**
 * Fix: Asignar coordenadas a operadores sin lat/lng
 * ==================================================
 * Usa domicilioReal.departamento del enrichment → coordenadas centro departamento.
 * Para operadores IN SITU con domicilioReal fuera de Mendoza, usa domicilioLegal.departamento.
 * Cada operador recibe jitter ±0.01° (~1km) para evitar superposición.
 *
 * Ejecutar: npx tsx prisma/fix-operadores-coords.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Coordenadas centro de departamentos de Mendoza ──
const DEPARTAMENTOS: Record<string, [number, number]> = {
  'ciudad':           [-32.8895, -68.8458],
  'ciudad de mendoza':[-32.8895, -68.8458],
  'mendoza':          [-32.8895, -68.8458],
  'godoy cruz':       [-32.9214, -68.8496],
  'guaymallen':       [-32.8965, -68.8075],
  'guaymallern':      [-32.8965, -68.8075], // typo in CSV
  'las heras':        [-32.8490, -68.8210],
  'lujan de cuyo':    [-33.0368, -68.8792],
  'luján de cuyo':    [-33.0368, -68.8792],
  'lujan de cuyo.':   [-33.0368, -68.8792],
  'maipu':            [-32.9437, -68.7543],
  'maipú':            [-32.9437, -68.7543],
  'san rafael':       [-34.6175, -68.3353],
  'malargue':         [-35.4755, -69.5853],
  'malargüe':         [-35.4755, -69.5853],
  'malargue.':        [-35.4755, -69.5853],
  'rivadavia':        [-33.1921, -68.4641],
  'junin':            [-33.1354, -68.4922],
  'junín':            [-33.1354, -68.4922],
  'san carlos':       [-33.7717, -69.0398],
  'tupungato':        [-33.3700, -69.1458],
  'san martin':       [-33.0812, -68.4711],
  'san martín':       [-33.0812, -68.4711],
  'lavalle':          [-32.7236, -68.5928],
  'santa rosa':       [-33.2426, -67.8417],
  'la paz':           [-33.4632, -67.5508],
  'general alvear':   [-34.9762, -67.6889],
};

// Departamentos que NO son de Mendoza (domicilioReal fuera de provincia)
const NO_MENDOZA = new Set([
  'caba', 'buenos aires', 'neuquen', 'san luis', 'santa fe',
  'cordoba', 'provincia de buenos aires', 'santa maria, cordoba',
  'ciudad de buenos aires',
]);

// ── Enrichment: CUIT → departamentos ──
// Extracted from operadores-enrichment.ts for the script
const OPERADOR_DEPS: Record<string, { domReal: string; domLegal: string }> = {
  '30-71123596-1': { domReal: 'Lujan de Cuyo', domLegal: 'Godoy Cruz' },
  '30-65316669-5': { domReal: 'Maipu', domLegal: 'Maipu' },
  '30-68350853-1': { domReal: 'Buenos Aires', domLegal: 'Maipu' },
  '30-70395365-0': { domReal: 'CABA', domLegal: 'Ciudad' },
  '33-70805056-9': { domReal: 'San Luis', domLegal: 'Guaymallén' },
  '30-70446353-3': { domReal: 'CABA', domLegal: 'Ciudad' },
  '30-71611995-1': { domReal: 'Lujan de Cuyo', domLegal: 'Lujan de Cuyo' },
  '30-70985859-5': { domReal: 'Neuquen', domLegal: 'Lujan de Cuyo' },
  '30-50111112-7': { domReal: 'Las Heras', domLegal: 'Ciudad de Mendoza' },
  '33-71196520-9': { domReal: '', domLegal: 'Malargue' },
  '30-68485575-8': { domReal: '', domLegal: 'Maipú' },
  '30-71427257-4': { domReal: 'Lujan de Cuyo.', domLegal: 'Ciudad de Mendoza' },
  '30-70337051-5': { domReal: 'LUJAN DE CUYO', domLegal: 'Maipú' },
  '30-71034059-1': { domReal: 'Malargue.', domLegal: 'Lujan de Cuyo' },
  '30-71137143-3': { domReal: 'Malargue', domLegal: 'Las Heras' },
  '30-54668997-9': { domReal: 'Maipú y Malargüe', domLegal: 'Ciudad de Mendoza' },
  '30-71243204-3': { domReal: 'Malargüe', domLegal: 'Ciudad de Mendoza' },
  '30-70503777-5': { domReal: 'Tupungato', domLegal: 'Lujan de Cuyo' },
  '30-67822401-0': { domReal: 'Malargüe', domLegal: 'Ciudad de Mendoza' },
  '30-71147333-1': { domReal: 'Guaymallern', domLegal: 'Guaymallern' },
  '30-70822853-9': { domReal: '', domLegal: 'Godoy Cruz' },
  '30-70971362-7': { domReal: '', domLegal: 'Guaymallen' },
  '30-71422823-0': { domReal: '', domLegal: 'Ciudad' },
  '30-71488764-1': { domReal: '', domLegal: 'Lujan de Cuyo' },
  '30-71144900-7': { domReal: '', domLegal: 'Lujan de Cuyo' },
  '20-24882046-3': { domReal: '', domLegal: 'Las Heras' },
  '30-70803437-8': { domReal: 'Ciudad de Buenos Aires', domLegal: 'Lujan de Cuyo' },
  '30-68225261-4': { domReal: 'Santa Maria, Cordoba', domLegal: 'Godoy Cruz' },
  '30-70781092-7': { domReal: 'Neuquen', domLegal: 'Lujan de Cuyo' },
  '30-71458792-3': { domReal: 'Ciudad de Buenos Aires', domLegal: 'Mendoza' },
  '30-67817276-2': { domReal: 'Provincia de Buenos Aires', domLegal: 'Godoy Cruz' },
  '33-71154607-9': { domReal: 'Rivadavia', domLegal: 'Rivadavia' },
  '30-70779684-3': { domReal: 'Ciudad', domLegal: 'Ciudad' },
  '30-71677412-7': { domReal: 'Lujan de Cuyo', domLegal: 'Lujan de Cuyo' },
  '30-69319923-5': { domReal: 'CABA', domLegal: 'San Rafael' },
  '30-71250073-1': { domReal: 'Luján de Cuyo', domLegal: 'Lujan de Cuyo' },
  '30-71620690-0': { domReal: 'Luján de Cuyo', domLegal: 'CABA' },
  '30-70748677-1': { domReal: 'Lujan de Cuyo', domLegal: 'Lujan de Cuyo' },
  '30-71681604-0': { domReal: 'Maipú', domLegal: 'Maipú' },
  '30-71809158-2': { domReal: 'Neuquen', domLegal: 'Ciudad' },
  '30-71730334-9': { domReal: 'Junín', domLegal: 'Junín' },
  '30-71037284-1': { domReal: 'Las Heras', domLegal: 'Las Heras' },
  '30-70899703-6': { domReal: 'San Carlos', domLegal: 'San Carlos' },
  '30-62231778-4': { domReal: 'Santa Fe', domLegal: 'Lujan de Cuyo' },
  '30-63857243-1': { domReal: 'Neuquen', domLegal: 'Guaymallén' },
};

function resolveDepartamento(cuit: string): string | null {
  const deps = OPERADOR_DEPS[cuit];
  if (!deps) return null;

  // Try domicilioReal first
  if (deps.domReal) {
    const norm = deps.domReal.toLowerCase().trim();
    if (!NO_MENDOZA.has(norm)) {
      // Check if it's a valid Mendoza departamento
      if (DEPARTAMENTOS[norm]) return norm;
      // Try first part (e.g. "Maipú y Malargüe" → "maipú")
      const first = norm.split(/\s+y\s+/)[0].trim();
      if (DEPARTAMENTOS[first]) return first;
    }
  }

  // Fall back to domicilioLegal
  if (deps.domLegal) {
    const norm = deps.domLegal.toLowerCase().trim();
    if (DEPARTAMENTOS[norm]) return norm;
  }

  return null;
}

function jitter(): number {
  return (Math.random() - 0.5) * 0.02; // ±0.01° ≈ ±1km
}

async function main() {
  console.log('=== FIX: Asignar coordenadas a operadores sin lat/lng ===\n');

  // Find operadores without coordinates
  const sinCoords = await prisma.operador.findMany({
    where: {
      OR: [
        { latitud: null },
        { longitud: null },
      ],
    },
    select: { id: true, cuit: true, razonSocial: true, latitud: true, longitud: true },
  });

  console.log(`Operadores sin coordenadas: ${sinCoords.length}\n`);

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const op of sinCoords) {
    const dep = resolveDepartamento(op.cuit);
    if (!dep) {
      console.log(`  SKIP ${op.razonSocial} (${op.cuit}): departamento no resuelto`);
      skipped++;
      continue;
    }

    const coords = DEPARTAMENTOS[dep];
    if (!coords) {
      console.log(`  SKIP ${op.razonSocial} (${op.cuit}): departamento "${dep}" sin coords`);
      skipped++;
      continue;
    }

    const lat = coords[0] + jitter();
    const lng = coords[1] + jitter();

    try {
      await prisma.operador.update({
        where: { id: op.id },
        data: { latitud: lat, longitud: lng },
      });
      console.log(`  ✓ ${op.razonSocial} (${op.cuit}) → ${dep}: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
      updated++;
    } catch (err: any) {
      errors.push(`${op.razonSocial}: ${err.message}`);
      console.error(`  ✗ ${op.razonSocial}: ${err.message}`);
    }
  }

  // Verification
  console.log('\n=== RESUMEN ===');
  console.log(`Actualizados: ${updated}`);
  console.log(`Saltados: ${skipped}`);
  console.log(`Errores: ${errors.length}`);

  const totalConCoords = await prisma.operador.count({
    where: { latitud: { not: null }, longitud: { not: null } },
  });
  const totalOperadores = await prisma.operador.count();
  console.log(`\nVerificación: ${totalConCoords}/${totalOperadores} operadores con coordenadas`);

  if (errors.length > 0) {
    console.log('\nErrores:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

main()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
