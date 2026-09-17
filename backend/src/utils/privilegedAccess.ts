import { config } from '../config/config';

export const ADMIN_ROLES = new Set([
  'ADMIN',
  'ADMIN_GENERADOR',
  'ADMIN_TRANSPORTISTA',
  'ADMIN_OPERADOR',
]);

type AccessUser = { email?: string | null; rol?: string | null };

function normalizeEmail(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

function configuredEmails(name: 'PRIVILEGED_ACCESS_EMAILS' | 'IMPERSONATION_EMAILS'): string[] {
  const value = (config as unknown as Record<string, unknown>)[name];
  return Array.isArray(value) ? value.map((email) => normalizeEmail(String(email))) : [];
}

function matchesAllowlist(email: string | null | undefined, list: string[]): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return list.length === 0 && config.NODE_ENV !== 'production';

  // Fail closed in production. For local/test runs with no configured list,
  // preserve the historical role-only behavior so existing unit tests and
  // development fixtures remain usable without production addresses.
  if (list.length === 0 && config.NODE_ENV !== 'production') return true;
  return list.includes(normalized);
}

export function isPrivilegedAccessUser(user?: AccessUser | null): boolean {
  return ADMIN_ROLES.has(String(user?.rol || '')) && matchesAllowlist(
    user?.email,
    configuredEmails('PRIVILEGED_ACCESS_EMAILS'),
  );
}

export function isPrivilegedEmail(email?: string | null): boolean {
  return matchesAllowlist(email, configuredEmails('PRIVILEGED_ACCESS_EMAILS'));
}

export function canImpersonateUser(user?: AccessUser | null): boolean {
  if (!ADMIN_ROLES.has(String(user?.rol || ''))) return false;
  const list = configuredEmails('IMPERSONATION_EMAILS');
  // Keep existing local/unit fixtures usable without weakening production:
  // when no list is configured outside production, only scalar ADMIN is
  // treated as the legacy impersonator.
  if (list.length === 0 && config.NODE_ENV !== 'production') return user?.rol === 'ADMIN';
  return matchesAllowlist(user?.email, list);
}
