export const IMPERSONATION_STORAGE_KEY = 'sitrep_impersonation';

function surfacePrefix(pathname: string): string {
  if (pathname === '/app' || pathname.startsWith('/app/')) return '/app';
  if (pathname === '/mobile' || pathname.startsWith('/mobile/')) return '/mobile';
  return '';
}

export function impersonationDestination(pathname: string, destination: '/dashboard' | '/switch-user'): string {
  return `${surfacePrefix(pathname)}${destination}`;
}

export function currentAppLocation(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function safeAdminReturnPath(value: unknown, currentPathname: string): string {
  const fallback = impersonationDestination(currentPathname, '/switch-user');
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const parsed = new URL(value, 'https://sitrep.local');
    if (parsed.origin !== 'https://sitrep.local') return fallback;
    if (surfacePrefix(parsed.pathname) !== surfacePrefix(currentPathname)) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
