export const ACTIVITY_HEADER = 'X-SITREP-Activity';
export function activityOwner(token: string | null): string | null {
  try {
    const payload = token?.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    if (!payload) return null;
    const data = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof data.id === 'string' && !data.restricted && !data.impersonatedBy ? data.id : null;
  } catch { return null; }
}
export function readActorActivity(token: string | null): string | null {
  if (import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED !== 'true') return null;
  const owner = activityOwner(token);
  if (!owner) return null;
  try { return sessionStorage.getItem('sitrep_activity:' + owner); } catch { return null; }
}
export function saveActorActivity(owner: string, activity: string) {
  sessionStorage.removeItem('sitrep_company:' + owner);
  sessionStorage.setItem('sitrep_activity:' + owner, activity);
}
