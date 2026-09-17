/**
 * Build a redirect that keeps the current application surface.
 *
 * The web UI is mounted at `/`, while the PWA uses the same router under
 * `/app`.  Keeping this decision in one pure helper prevents an impersonation
 * started in the PWA from unexpectedly landing in the desktop UI.
 */
export const IMPERSONATION_STORAGE_KEY = 'sitrep_impersonation';

export function isPwaPath(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/');
}

/**
 * Route guards run before ImpersonationProvider can restore its React state.
 * Read and validate the persisted marker synchronously so a newly mounted PWA
 * cannot redirect an impersonated user to the forced-password screen first.
 */
export function hasStoredImpersonationSession(
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): boolean {
  if (!storage) return false;
  try {
    const saved = storage.getItem(IMPERSONATION_STORAGE_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return typeof parsed?.adminToken === 'string'
      && typeof parsed?.adminRefreshToken === 'string'
      && !!parsed?.adminUser;
  } catch {
    return false;
  }
}

export function getImpersonationRedirectPath(
  pathname: string,
  destination: '/dashboard' | '/admin/usuarios',
): string {
  return `${isPwaPath(pathname) ? '/app' : ''}${destination}`;
}

export function currentAppLocation(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

/**
 * Only same-origin application paths may be restored after impersonation.
 * Legacy sessions without a saved path return to the admin users screen on
 * the surface where impersonation is currently running.
 */
export function safeImpersonationReturnPath(value: unknown, currentPathname: string): string {
  const fallback = getImpersonationRedirectPath(currentPathname, '/admin/usuarios');
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;

  try {
    const parsed = new URL(value, 'https://sitrep.local');
    if (parsed.origin !== 'https://sitrep.local') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
