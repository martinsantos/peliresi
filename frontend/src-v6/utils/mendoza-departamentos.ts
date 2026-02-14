/**
 * SITREP v6 - Departamentos de Mendoza
 * Coordenadas centro de cada departamento + funciones de asignación por cercanía.
 */

export interface Departamento {
  nombre: string;
  centro: [number, number]; // [lat, lng]
}

export const DEPARTAMENTOS_MENDOZA: Departamento[] = [
  { nombre: 'Capital', centro: [-32.8908, -68.8272] },
  { nombre: 'Godoy Cruz', centro: [-32.9320, -68.8430] },
  { nombre: 'Guaymallén', centro: [-32.8960, -68.8160] },
  { nombre: 'Las Heras', centro: [-32.8450, -68.8180] },
  { nombre: 'Maipú', centro: [-32.9430, -68.7550] },
  { nombre: 'Luján de Cuyo', centro: [-33.0400, -68.8800] },
  { nombre: 'San Rafael', centro: [-34.6175, -67.4867] },
  { nombre: 'San Martín', centro: [-33.3020, -68.4710] },
  { nombre: 'Junín', centro: [-33.1380, -68.4930] },
  { nombre: 'Rivadavia', centro: [-33.1900, -68.4630] },
  { nombre: 'Lavalle', centro: [-32.7230, -68.5940] },
  { nombre: 'Tunuyán', centro: [-33.5700, -69.0170] },
  { nombre: 'Tupungato', centro: [-33.3700, -69.1500] },
  { nombre: 'San Carlos', centro: [-33.7700, -69.0500] },
  { nombre: 'Santa Rosa', centro: [-33.2450, -67.9500] },
  { nombre: 'La Paz', centro: [-33.4700, -67.5500] },
  { nombre: 'Malargüe', centro: [-35.4750, -69.5850] },
  { nombre: 'General Alvear', centro: [-34.9750, -67.6900] },
];

/** Asigna departamento más cercano por distancia euclidiana */
export function getDepartamento(lat: number, lng: number): string {
  let best = DEPARTAMENTOS_MENDOZA[0].nombre;
  let bestDist = Infinity;
  for (const dep of DEPARTAMENTOS_MENDOZA) {
    const dLat = dep.centro[0] - lat;
    const dLng = dep.centro[1] - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      best = dep.nombre;
    }
  }
  return best;
}

/** Agrupa items con lat/lng por departamento más cercano */
export function agruparPorDepartamento<T extends { latitud: number; longitud: number }>(
  items: T[],
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const dep = getDepartamento(item.latitud, item.longitud);
    if (!result[dep]) result[dep] = [];
    result[dep].push(item);
  }
  return result;
}
