/** Approximate field geometry drawn by the inspector. Distances and areas are
 * orientative (spherical earth, local projection); they never certify a boundary
 * nor decide compliance with an environmental restriction by themselves.
 * Mirrored in backend/src/domain/inspectionMapGeometry.ts (the act PDF uses that copy). */
export type MapPoint = { latitud: number; longitud: number };
export type MapReference = MapPoint & { id: string; tipo: MapReferenceType; etiqueta?: string };
export const MAP_REFERENCE_TYPES = ['VIVIENDA', 'ESTABLECIMIENTO_SENSIBLE', 'CURSO_AGUA', 'ACTIVIDAD_VECINA', 'AMPLIACION', 'OTRO'] as const;
export type MapReferenceType = typeof MAP_REFERENCE_TYPES[number];
export const MAP_REFERENCE_LABELS: Record<MapReferenceType, string> = {
  VIVIENDA: 'Vivienda', ESTABLECIMIENTO_SENSIBLE: 'Escuela, salud u otro uso sensible', CURSO_AGUA: 'Curso o cuerpo de agua',
  ACTIVIDAD_VECINA: 'Actividad vecina', AMPLIACION: 'Sector ampliado o no declarado', OTRO: 'Otra referencia',
};
/** Geometry farther than this from the inspected point is rejected as a likely mistap. */
export const MAP_MAX_DISTANCE_M = 10000;
const R = 6371008.8, rad = (deg: number) => deg * Math.PI / 180;

export function distanceMeters(a: MapPoint, b: MapPoint): number {
  const dLat = rad(b.latitud - a.latitud), dLon = rad(b.longitud - a.longitud);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function perimeterMeters(points: MapPoint[]): number {
  return points.length < 2 ? 0 : points.reduce((sum, p, i) => sum + distanceMeters(p, points[(i + 1) % points.length]), 0);
}
export function areaSquareMeters(points: MapPoint[]): number {
  if (points.length < 3) return 0;
  const lat0 = rad(points.reduce((s, p) => s + p.latitud, 0) / points.length);
  const xy = points.map(p => [R * rad(p.longitud) * Math.cos(lat0), R * rad(p.latitud)]);
  return Math.abs(xy.reduce((s, [x, y], i) => { const [nx, ny] = xy[(i + 1) % xy.length]; return s + x * ny - nx * y; }, 0)) / 2;
}
const meters = (value: number) => value >= 1000 ? `${(value / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} km` : `${Math.round(value).toLocaleString('es-AR')} m`;
const area = (value: number) => value >= 10000 ? `${(value / 10000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha` : `${Math.round(value).toLocaleString('es-AR')} m²`;
export const referenceName = (r: Pick<MapReference, 'tipo' | 'etiqueta'>) => r.etiqueta?.trim() || MAP_REFERENCE_LABELS[r.tipo];

/** Plain-language lines for the act; numbering matches the saved map image. */
export function inspectionMapSummary(location: MapPoint & { perimetro?: MapPoint[]; referencias?: MapReference[] }): string[] {
  const lines: string[] = [];
  if (location.perimetro && location.perimetro.length >= 3) lines.push(`Sector observado, trazado aproximado por el inspector: ${location.perimetro.length} vértices · superficie ≈ ${area(areaSquareMeters(location.perimetro))} · perímetro ≈ ${meters(perimeterMeters(location.perimetro))}. No delimita el predio inscripto.`);
  if (location.referencias?.length) {
    lines.push('Referencias del entorno (distancia aproximada en línea recta desde el punto inspeccionado):');
    location.referencias.forEach((r, i) => lines.push(`${i + 1}. ${MAP_REFERENCE_LABELS[r.tipo]}${r.etiqueta?.trim() ? ` — ${r.etiqueta.trim()}` : ''} · ${meters(distanceMeters(location, r))}`));
  }
  return lines;
}
