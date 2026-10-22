import type { Rol } from '@prisma/client';
import { designatedReviewAccount } from './manifestReviewAuthority';

/** Eligible roles for ordinary addenda. Selection follows the explicit deployment policy. */
export const ADDENDUM_AUTHORITY_ROLES: Rol[] = ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'];

type AuthorityIdentity = { id: string; rol: Rol; activo: boolean; restricted?: boolean; impersonatedBy?: unknown };

export function canReviewAsAddendumAuthority(
  user: AuthorityIdentity | undefined,
  record: { creadoPorId: string; impersonadoPorId?: unknown },
): boolean {
  return Boolean(user?.activo && !user.restricted && !user.impersonatedBy
    && ADDENDUM_AUTHORITY_ROLES.includes(user.rol)
    && designatedReviewAccount(user.id)
    && record.creadoPorId !== user.id && record.impersonadoPorId !== user.id);
}
