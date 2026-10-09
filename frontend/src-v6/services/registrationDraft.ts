/** Local recovery only; never an authentication proof or a sent application. */
export type RegistrationDraft = { version: 1; owner: string; scope: string; savedAt: number; data: Record<string, unknown> };
const prefix = 'sitrep-registration:v1:';
const maxBytes = 256000;
const lifetime = 30 * 86400000;
const key = (owner: string, scope: string) => `${prefix}${encodeURIComponent(owner)}:${encodeURIComponent(scope)}`;
const secret = /password|contrase|token|secret|credential/i;

function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) return value.slice(0, 500).map(item => safeValue(item, depth + 1));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([field]) => !secret.test(field) && !['__proto__', 'constructor', 'prototype'].includes(field))
    .map(([field, item]) => [field, safeValue(item, depth + 1)]).filter(([, item]) => item !== undefined));
}
export function writeRegistrationDraft(owner: string, scope: string, data: Record<string, unknown>): boolean {
  if (!owner || !scope) return false;
  try {
    const stored = JSON.stringify({ version: 1, owner, scope, savedAt: Date.now(), data: safeValue(data) });
    if (new TextEncoder().encode(stored).byteLength > maxBytes) return false;
    localStorage.setItem(key(owner, scope), stored);
    return true;
  } catch { return false; }
}
export function readRegistrationDraft(owner: string, scope: string): RegistrationDraft | null {
  if (!owner || !scope) return null;
  try {
    const raw = localStorage.getItem(key(owner, scope));
    if (!raw || raw.length > maxBytes) return null;
    const value = JSON.parse(raw);
    if (value.version !== 1 || value.owner !== owner || value.scope !== scope || !Number.isFinite(value.savedAt)
      || Date.now() - value.savedAt > lifetime || value.savedAt > Date.now() + 60000
      || !value.data || typeof value.data !== 'object' || Array.isArray(value.data)) return null;
    return { ...value, data: safeValue(value.data) as Record<string, unknown> };
  } catch { return null; }
}
export function clearRegistrationDraft(owner: string, scope: string): void {
  try { localStorage.removeItem(key(owner, scope)); } catch { /* keep existing data; never clear other drafts */ }
}

export function restoreRegistrationForm<T extends object>(initial: T, saved: unknown): T {
  const restored = { ...initial };
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return restored;
  for (const field of Object.keys(initial)) {
    const value = (saved as Record<string, unknown>)[field];
    if (!secret.test(field) && typeof value === typeof (initial as Record<string, unknown>)[field]) (restored as Record<string, unknown>)[field] = value;
  }
  return restored;
}
