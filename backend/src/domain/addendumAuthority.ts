import type { Rol } from '@prisma/client';

/** Eligible roles for ordinary addenda only. Account designation remains explicit. */
export const ADDENDUM_AUTHORITY_ROLES: Rol[] = ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'];

type AuthorityIdentity = { id: string; rol: Rol; activo: boolean; restricted?: boolean; impersonatedBy?: unknown };

export function canReviewAsAddendumAuthority(
  user: AuthorityIdentity | undefined,
  record: { creadoPorId: string; impersonadoPorId?: unknown },
): boolean {
  return Boolean(user?.activo && !user.restricted && !user.impersonatedBy
    && ADDENDUM_AUTHORITY_ROLES.includes(user.rol)
    && (process.env.MANIFEST_EXCEPTIONAL_REVIEWERS || '').split(',').filter(Boolean).includes(user.id)
    && record.creadoPorId !== user.id && record.impersonadoPorId !== user.id);
}
