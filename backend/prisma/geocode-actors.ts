/**
 * SITREP — Geocodificación de Actores
 * ====================================
 * Asigna lat/lng a generadores, transportistas y operadores.
 * Estrategia: Nominatim con fallback a centroide departamental + jitter.
 *
 * Uso: npx ts-node prisma/geocode-actors.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Centroides departamentales de Mendoza ──
const CENTROIDES: Record<string, { lat: number; lng: number }> = {
  'capital':        { lat: -32.8908, lng: -68.8272 },
  'godoy cruz':     { lat: -32.9214, lng: -68.8358 },
  'guaymallen':     { lat: -32.8981, lng: -68.7931 },
  'guaymallén':     { lat: -32.8981, lng: -68.7931 },
  'las heras':      { lat: -32.8528, lng: -68.8113 },
  'lujan de cuyo':  { lat: -33.0333, lng: -68.8833 },
  'luján de cuyo':  { lat: -33.0333, lng: -68.8833 },
  'maipu':          { lat: -32.9833, lng: -68.7500 },
  'maipú':          { lat: -32.9833, lng: -68.7500 },
  'san rafael':     { lat: -34.6167, lng: -68.3333 },
  'general alvear': { lat: -34.9667, lng: -67.7000 },
  'malargue':       { lat: -35.4667, lng: -69.5833 },
  'malargüe':       { lat: -35.4667, lng: -69.5833 },
  'san martin':     { lat: -33.3000, lng: -68.4667 },
  'san martín':     { lat: -33.3000, lng: -68.4667 },
  'rivadavia':      { lat: -33.1833, lng: -68.4667 },
  'junin':          { lat: -33.1333, lng: -68.4833 },
  'junín':          { lat: -33.1333, lng: -68.4833 },
  'santa rosa':     { lat: -33.2500, lng: -68.1500 },
  'la paz':         { lat: -33.4667, lng: -67.5500 },
  'lavalle':        { lat: -32.7167, lng: -68.5833 },
  'tunuyan':        { lat: -33.5667, lng: -69.0167 },
  'tunuyán':        { lat: -33.5667, lng: -69.0167 },
  'tupungato':      { lat: -33.3667, lng: -69.1500 },
  'san carlos':     { lat: -33.7667, lng: -69.0500 },
  'mendoza':        { lat: -32.8908, lng: -68.8272 },
};

function jitter(val: number, range = 0.01): number {
  return val + (Math.random() - 0.5) * 2 * range;
}

function findDepartamentoCentroid(domicilio: string): { lat: number; lng: number } | null {
  const lower = domicilio.toLowerCase();
  for (const [dept, coords] of Object.entries(CENTROIDES)) {
    if (lower.includes(dept)) {
      return { lat: jitter(coords.lat), lng: jitter(coords.lng) };
    }
  }
  // Default: Mendoza Capital with larger jitter
  return { lat: jitter(-32.8908, 0.03), lng: jitter(-68.8272, 0.03) };
}

async function nominatimGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const query = `${address}, Mendoza, Argentina`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SITREP-Geocoder/1.0 (admin@dgfa.mendoza.gov.ar)' },
    });
    const data: any = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // Silently fall through to departamento fallback
  }
  return null;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeActor(
  domicilio: string,
  useNominatim: boolean
): Promise<{ lat: number; lng: number }> {
  if (useNominatim) {
    const result = await nominatimGeocode(domicilio);
    if (result) return result;
    await sleep(1100); // Rate limit: 1 req/sec
  }
  return findDepartamentoCentroid(domicilio) || { lat: jitter(-32.8908, 0.03), lng: jitter(-68.8272, 0.03) };
}

async function main() {
  console.log('=== SITREP Geocodificación de Actores ===\n');

  // Use Nominatim for first 50 actors, then fallback only (to avoid rate limit issues)
  const USE_NOMINATIM = process.argv.includes('--nominatim');
  const NOMINATIM_LIMIT = 50;
  let nominatimCount = 0;

  // ── Generadores ──
  const generadores = await prisma.generador.findMany({
    where: { latitud: null },
    select: { id: true, domicilio: true, razonSocial: true },
  });
  console.log(`Generadores sin coordenadas: ${generadores.length}`);

  for (let i = 0; i < generadores.length; i++) {
    const g = generadores[i];
    const useNom = USE_NOMINATIM && nominatimCount < NOMINATIM_LIMIT;
    const coords = await geocodeActor(g.domicilio, useNom);
    if (useNom) nominatimCount++;

    await prisma.generador.update({
      where: { id: g.id },
      data: { latitud: coords.lat, longitud: coords.lng },
    });

    if ((i + 1) % 100 === 0) console.log(`  Generadores: ${i + 1}/${generadores.length}`);
  }
  console.log(`  Generadores geocodificados: ${generadores.length}\n`);

  // ── Transportistas ──
  const transportistas = await prisma.transportista.findMany({
    where: { latitud: null },
    select: { id: true, domicilio: true, razonSocial: true },
  });
  console.log(`Transportistas sin coordenadas: ${transportistas.length}`);

  for (const t of transportistas) {
    const useNom = USE_NOMINATIM && nominatimCount < NOMINATIM_LIMIT;
    const coords = await geocodeActor(t.domicilio, useNom);
    if (useNom) nominatimCount++;

    await prisma.transportista.update({
      where: { id: t.id },
      data: { latitud: coords.lat, longitud: coords.lng },
    });
  }
  console.log(`  Transportistas geocodificados: ${transportistas.length}\n`);

  // ── Operadores ──
  const operadores = await prisma.operador.findMany({
    where: { latitud: null },
    select: { id: true, domicilio: true, razonSocial: true },
  });
  console.log(`Operadores sin coordenadas: ${operadores.length}`);

  for (const o of operadores) {
    const useNom = USE_NOMINATIM && nominatimCount < NOMINATIM_LIMIT;
    const coords = await geocodeActor(o.domicilio, useNom);
    if (useNom) nominatimCount++;

    await prisma.operador.update({
      where: { id: o.id },
      data: { latitud: coords.lat, longitud: coords.lng },
    });
  }
  console.log(`  Operadores geocodificados: ${operadores.length}\n`);

  // ── Summary ──
  const [gCount, tCount, oCount] = await Promise.all([
    prisma.generador.count({ where: { latitud: { not: null } } }),
    prisma.transportista.count({ where: { latitud: { not: null } } }),
    prisma.operador.count({ where: { latitud: { not: null } } }),
  ]);
  console.log('=== Resumen ===');
  console.log(`Generadores con coordenadas: ${gCount}`);
  console.log(`Transportistas con coordenadas: ${tCount}`);
  console.log(`Operadores con coordenadas: ${oCount}`);
  console.log('\nGeocoding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
