import type { User } from '../contexts/AuthContext';

export type ActorReadType = 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
type Reader = Pick<User, 'rol' | 'esInspector' | 'actorId'> | null | undefined;
const ADMIN_ROLES = new Set(['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']);
const TYPES: Record<string, ActorReadType> = {
  generadores: 'GENERADOR', transportistas: 'TRANSPORTISTA', operadores: 'OPERADOR',
};
const unsafePath = (value: string) => [...value].some(character => character === '\\' || character.charCodeAt(0) < 32);

/** Consultation only. This rule never grants creation, editing or moderation. */
export function canReadActorDetail(user: Reader, type: ActorReadType, id?: string): boolean {
  if (!user || !id?.trim()) return false;
  if (ADMIN_ROLES.has(user.rol) || user.esInspector === true) return true;
  return user.rol === type && Boolean(user.actorId) && user.actorId === id;
}

/** Match only actual detail screens, never a list or administrative action. */
export function actorDetailFromPath(pathname: string): { type: ActorReadType; id: string } | null {
  const match = pathname.match(/^\/(?:mobile\/)?(?:(?:admin\/)?actores\/(generadores|transportistas|operadores)|admin\/(generadores|operadores))\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[3]);
    if (!id.trim() || id === 'nuevo' || id.includes('/') || unsafePath(id)) return null;
    return { type: TYPES[match[1] || match[2]], id };
  } catch { return null; }
}

/** Inspection staff history is narrower than actor consultation. */
export function canReadActorInspectionHistory(user: Reader, type: ActorReadType): boolean {
  if (!user) return false;
  if (user.rol === 'ADMIN') return true;
  if (ADMIN_ROLES.has(user.rol)) return user.rol === `ADMIN_${type}`;
  return user.esInspector === true;
}

export function actorInspectionAccess(user: Reader, type: ActorReadType, id?: string): 'staff' | 'participation' | null {
  if (!canReadActorDetail(user, type, id)) return null;
  if (canReadActorInspectionHistory(user, type)) return 'staff';
  return user?.rol === type && user.actorId === id ? 'participation' : null;
}

/** Keep React Router's basename; reject external or malformed history state. */
export function actorReturnPath(state: unknown, fallback: string): string {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return fallback;
  const origin = state as { actorReturn?: unknown; inspectionReturn?: unknown };
  const target = origin.actorReturn ?? origin.inspectionReturn;
  return typeof target === 'string' && /^\/(?!\/)/.test(target) && !unsafePath(target) ? target : fallback;
}
