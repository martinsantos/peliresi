export const ACTIVITY_HEADER = 'X-SITREP-Activity';
const activityKey = (owner: string) => 'sitrep_activity:' + owner;
const isActorActivity = (value: string | null): value is string =>
  value !== null && ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(value);

function rememberActivity(owner: string, activity: string | null) {
  // Storage can be unavailable. The current tab can still use a validated role.
  try {
    // A tombstone prevents an older open tab from migrating a revoked choice.
    localStorage.setItem(activityKey(owner), activity || '');
  } catch { /* A storage failure must not prevent access to the account. */ }
}

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
  try {
    const key = activityKey(owner);
    const selected = sessionStorage.getItem(key);
    if (selected !== null) {
      // Migrate an open tab from the previous version without replacing a more
      // recent choice saved by another tab. Empty means the base role is pinned.
      if (isActorActivity(selected)) {
        try { if (localStorage.getItem(key) === null) rememberActivity(owner, selected); } catch { /* Session remains usable. */ }
        return selected;
      }
      return null;
    }
    let remembered: string | null = null;
    try { remembered = localStorage.getItem(key); } catch { /* Use the base role. */ }
    const activity = isActorActivity(remembered) ? remembered : null;
    // Snapshot once per tab, including the base role. Another tab changing its
    // role must never change API headers underneath an already-open form.
    sessionStorage.setItem(key, activity || '');
    return activity;
  } catch { return null; }
}
export function saveActorActivity(owner: string, activity: string) {
  if (!owner || !isActorActivity(activity)) throw new Error('Actividad inválida');
  sessionStorage.removeItem('sitrep_company:' + owner);
  sessionStorage.setItem(activityKey(owner), activity);
  rememberActivity(owner, activity);
}

export function clearActorActivity(owner: string) {
  rememberActivity(owner, null);
  sessionStorage.setItem(activityKey(owner), '');
}
