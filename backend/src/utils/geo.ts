/** Distancia entre dos puntos GPS en km (fórmula Haversine) */
export function distanciaHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distancia mínima (km) de un punto P al segmento definido por los extremos A y B.
 * Aproximación cartesiana válida para distancias cortas (~500 km).
 */
export function distanciaPuntoSegmento(
  latP: number, lonP: number,
  latA: number, lonA: number,
  latB: number, lonB: number,
): number {
  const dx = latB - latA;
  const dy = lonB - lonA;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distanciaHaversine(latP, lonP, latA, lonA);
  const t = Math.max(0, Math.min(1, ((latP - latA) * dx + (lonP - lonA) * dy) / lenSq));
  return distanciaHaversine(latP, lonP, latA + t * dx, lonA + t * dy);
}
