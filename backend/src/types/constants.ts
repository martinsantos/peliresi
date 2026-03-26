/**
 * Centralized role and estado constants for the SITREP backend.
 *
 * These mirror the Prisma enums (Rol, EstadoManifiesto) but are available
 * as plain JS objects for runtime comparisons, array checks, and
 * role-based logic without importing generated Prisma types everywhere.
 *
 * NOTE: String literals in route files have NOT been replaced yet --
 * this file exists so future refactors can import from a single source.
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  GENERADOR: 'GENERADOR',
  TRANSPORTISTA: 'TRANSPORTISTA',
  OPERADOR: 'OPERADOR',
  ADMIN_GENERADOR: 'ADMIN_GENERADOR',
  ADMIN_TRANSPORTISTA: 'ADMIN_TRANSPORTISTA',
  ADMIN_OPERADOR: 'ADMIN_OPERADOR',
} as const;

export type RolValue = (typeof ROLES)[keyof typeof ROLES];

export const ESTADOS = {
  BORRADOR: 'BORRADOR',
  APROBADO: 'APROBADO',
  EN_TRANSITO: 'EN_TRANSITO',
  ENTREGADO: 'ENTREGADO',
  RECIBIDO: 'RECIBIDO',
  EN_TRATAMIENTO: 'EN_TRATAMIENTO',
  TRATADO: 'TRATADO',
  RECHAZADO: 'RECHAZADO',
  CANCELADO: 'CANCELADO',
} as const;

export type EstadoValue = (typeof ESTADOS)[keyof typeof ESTADOS];

/** All admin-flavored roles, for use in hasRole() / role checks. */
export const ALL_ADMIN_ROLES: readonly RolValue[] = [
  ROLES.ADMIN,
  ROLES.ADMIN_GENERADOR,
  ROLES.ADMIN_TRANSPORTISTA,
  ROLES.ADMIN_OPERADOR,
] as const;
