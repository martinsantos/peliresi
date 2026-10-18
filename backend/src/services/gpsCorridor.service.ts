import { distanciaPuntoSegmento } from '../utils/geo';

interface Coordinate {
  latitud: number;
  longitud: number;
}

interface CorridorEndpoints {
  origin: Coordinate;
  destination: Coordinate;
}

export interface GeographicCorridorAssessment {
  distancesKm: number[];
  maximumDistanceKm: number;
  minimumDistanceKm: number;
}

/**
 * Detects a sustained departure from the geometric origin/destination corridor.
 * This intentionally does not claim a road-route deviation: no authorised route
 * geometry exists in SITREP yet.
 */
export function assessGeographicCorridor(
  points: Coordinate[],
  corridor: CorridorEndpoints,
  thresholdKm = 50,
  minimumConsecutiveSamples = 3,
): GeographicCorridorAssessment | null {
  if (points.length < minimumConsecutiveSamples) return null;
  const recent = points.slice(0, minimumConsecutiveSamples);
  const distancesKm = recent.map((point) => distanciaPuntoSegmento(
    point.latitud,
    point.longitud,
    corridor.origin.latitud,
    corridor.origin.longitud,
    corridor.destination.latitud,
    corridor.destination.longitud,
  ));
  if (!distancesKm.every((distance) => distance > thresholdKm)) return null;
  return {
    distancesKm,
    maximumDistanceKm: Math.max(...distancesKm),
    minimumDistanceKm: Math.min(...distancesKm),
  };
}
