/** Local recovery only; the server remains the authority for every invitation. */
export const PREPARED_INVITATION_PREFIX = 'sitrep:prepared-invitation:v1:';
export type PreparedCompanyInvitation = { id: string; path: string; expiresAt: number };
const valid = (value: unknown): value is PreparedCompanyInvitation => {
  if (!value || typeof value !== 'object') return false;
  const item = value as PreparedCompanyInvitation;
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 100
    && typeof item.path === 'string' && /^\/empresa-invitacion\/[a-f0-9]{64}$/.test(item.path)
    && Number.isFinite(item.expiresAt) && item.expiresAt > Date.now();
};
export function readPreparedInvitations(scope: string): PreparedCompanyInvitation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREPARED_INVITATION_PREFIX + scope) || '[]');
    return Array.isArray(value) ? value.filter(valid).slice(-10) : [];
  } catch { return []; }
}
export function writePreparedInvitations(scope: string, items: PreparedCompanyInvitation[]): boolean {
  try {
    const key = PREPARED_INVITATION_PREFIX + scope, current = items.filter(valid).slice(-10);
    if (current.length) localStorage.setItem(key, JSON.stringify(current));
    else localStorage.removeItem(key);
    return true;
  } catch { return false; }
}
export function clearPreparedInvitations(): void {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(PREPARED_INVITATION_PREFIX));
    keys.forEach(key => localStorage.removeItem(key));
  } catch { /* A disabled store must never prevent signing out. */ }
}
