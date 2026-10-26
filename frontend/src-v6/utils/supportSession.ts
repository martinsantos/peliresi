import { getAccessToken } from '../services/api';
import { readActorActivity } from '../services/actorActivity';
import { readCompanyContext } from '../services/companyContext';

/** Snapshot the same context that the API interceptor uses; token refresh alone is safe. */
export function supportRequestContext(): string {
  try {
    const token = getAccessToken();
    const part = token?.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    if (!part) return '';
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    if (!claims.id) return '';
    return JSON.stringify([claims.id, claims.rol, claims.impersonatedBy, !!claims.restricted, readActorActivity(token), readCompanyContext(token)]);
  } catch { return ''; }
}

export class SupportSessionChangedError extends Error {
  constructor() {
    super('La sesión cambió. Reabrí Soporte desde tu cuenta actual antes de enviar o descargar.');
    this.name = 'SupportSessionChangedError';
  }
}

/** Client intent guard only, NOT JWT authentication or a permission grant.
 * The server still verifies the signature, account and support permissions.
 * A same-owner token renewal is safe; a new account must not inherit an old
 * component's asynchronous attachment preparation or acknowledgement. */
export function supportSessionMatches(owner: string, administratorId?: string): boolean {
  try {
    const token = getAccessToken();
    const parts = token?.split('.');
    if (!owner || !parts || parts.length !== 3 || !parts[1]) return false;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return Boolean(claims && typeof claims === 'object' && !Array.isArray(claims)
      && 'id' in claims && claims.id === owner
      && (!administratorId || ('impersonatedBy' in claims && claims.impersonatedBy === administratorId)));
  } catch { return false; }
}

export function assertSupportSession(owner: string, administratorId?: string): void {
  if (!supportSessionMatches(owner, administratorId)) throw new SupportSessionChangedError();
}
