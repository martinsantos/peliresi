import type { User } from '../contexts/AuthContext';

export const OFFLINE_SESSION_KEY = 'sitrep_offline_session_v1';
export const MAX_OFFLINE_SESSION_MS = 8 * 60 * 60 * 1000;

interface OfflineSession {
  version: 1;
  token: string;
  user: User;
  validatedAt: number;
  expiresAt: number;
}

/** A server response (including 401/403/5xx) is never an offline authorization. */
export function isOfflineNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const failure = error as { isAxiosError?: boolean; code?: string; response?: unknown };
  return failure.isAxiosError === true && !failure.response
    && ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(failure.code || '');
}

function tokenIdentity(token: string): { id: string; expiresAt: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts.every(Boolean)) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    if (typeof claims.id !== 'string' || !claims.id || !Number.isFinite(claims.exp) || claims.restricted) return null;
    return { id: claims.id, expiresAt: claims.exp * 1000 };
  } catch {
    return null;
  }
}

function validUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const user = value as User;
  return (typeof user.id === 'string' || typeof user.id === 'number')
    && ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'AUDITOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'].includes(user.rol)
    && ['nombre', 'email', 'sector', 'avatar', 'telefono', 'ubicacion'].every(key => typeof (user as unknown as Record<string, unknown>)[key] === 'string')
    && Array.isArray(user.permisos) && user.permisos.every(permission => typeof permission === 'string')
    && (user.esInspector === undefined || typeof user.esInspector === 'boolean')
    && (user.actorId === undefined || typeof user.actorId === 'string');
}

export function clearOfflineSession(): void {
  try {
    localStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch { /* Disabled storage must not prevent logout. */ }
}

/** Call only after this exact token's profile has been confirmed by the API.
 * Decoding the JWT only narrows the cache lifetime/identity; it does not verify
 * its signature or authorize any server operation. No refresh token is cached.
 */
export function saveOfflineSession(user: User, token: string, now = Date.now()): void {
  const identity = tokenIdentity(token);
  if (!identity || identity.id !== String(user.id) || identity.expiresAt <= now || !validUser(user)) {
    clearOfflineSession();
    return;
  }
  try {
    localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify({
      version: 1, token, user, validatedAt: now,
      expiresAt: Math.min(identity.expiresAt, now + MAX_OFFLINE_SESSION_MS),
    } satisfies OfflineSession));
  } catch {
    clearOfflineSession();
  }
}

export function readOfflineSession(token: string, now = Date.now()): OfflineSession | null {
  try {
    const stored = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!stored) return null;
    const cached = JSON.parse(stored) as OfflineSession;
    const identity = tokenIdentity(token);
    if (cached.version === 1 && cached.token === token && validUser(cached.user)
      && identity?.id === String(cached.user.id)
      && Number.isFinite(cached.validatedAt) && Number.isFinite(cached.expiresAt)
      && cached.validatedAt <= now && now < cached.expiresAt
      && cached.expiresAt <= identity.expiresAt
      && cached.expiresAt <= cached.validatedAt + MAX_OFFLINE_SESSION_MS) {
      return cached;
    }
  } catch { /* Corrupt or inaccessible snapshots fail closed. */ }
  clearOfflineSession();
  return null;
}
