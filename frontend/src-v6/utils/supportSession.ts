import { getAccessToken } from '../services/api';

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
