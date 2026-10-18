import { DEPARTAMENTOS_MENDOZA, getDepartamento } from './mendoza-departamentos';

export interface ActorLocation {
  position: [number, number] | null;
  department: string | null;
  source: 'registered' | 'geocoded' | 'department-reference' | 'unknown';
  label: string;
}

export function validCoordinates(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2
    && typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 90
    && typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 180;
}

/** Presentation provenance, not a legal department assignment or live GPS fix. */
export function resolveActorLocation(
  actor: { latitud?: number | null; longitud?: number | null; domicilio?: string },
  geocoded?: unknown,
): ActorLocation {
  const registered = [actor.latitud, actor.longitud];
  if (validCoordinates(registered)) {
    return { position: registered, department: getDepartamento(...registered), source: 'registered', label: 'Coordenadas registradas · departamento aproximado' };
  }
  if (validCoordinates(geocoded)) {
    return { position: geocoded, department: getDepartamento(...geocoded), source: 'geocoded', label: 'Domicilio geocodificado · ubicación aproximada' };
  }
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const address = ' ' + normalize(actor.domicilio ?? '') + ' ';
  const department = DEPARTAMENTOS_MENDOZA.find(item => address.includes(' ' + normalize(item.nombre) + ' '));
  if (department) {
    return { position: [...department.centro], department: department.nombre, source: 'department-reference', label: 'Referencia departamental aproximada · no es la ubicación del establecimiento' };
  }
  return { position: null, department: null, source: 'unknown', label: 'Sin ubicación verificada' };
}
