/** An unconfirmed command is not an invitation or an authorization. No token is stored here. */
export const INVITATION_PREPARATION_PREFIX = 'sitrep:invitation-preparation:v1:';
export type InvitationPreparation = { id: string; email: string; activityId: string; startedAt: number };
export function readInvitationPreparation(scope: string): InvitationPreparation | null {
  try {
    const value = JSON.parse(localStorage.getItem(INVITATION_PREPARATION_PREFIX + scope) || 'null');
    return value && typeof value.id === 'string' && value.id.length <= 100
      && typeof value.email === 'string' && value.email.length <= 320
      && typeof value.activityId === 'string' && value.activityId.length <= 100
      && Number.isFinite(value.startedAt) && value.startedAt > 0 ? value : null;
  } catch { return null; }
}
export function writeInvitationPreparation(scope: string, value: InvitationPreparation): boolean {
  try { localStorage.setItem(INVITATION_PREPARATION_PREFIX + scope, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function clearInvitationPreparation(scope: string, id: string): boolean {
  try {
    const current = readInvitationPreparation(scope);
    if (current && current.id !== id) return false;
    localStorage.removeItem(INVITATION_PREPARATION_PREFIX + scope);
    return true;
  } catch { return false; }
}
export function isUncertainInvitation(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return !status || status === 408 || status === 409 || status >= 500;
}
