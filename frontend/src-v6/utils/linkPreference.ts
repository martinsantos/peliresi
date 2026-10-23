import { safeLocalRedirect, postLoginDestination } from './authRedirect';
export type LinkPreference = 'AUTO' | 'WEB' | 'APP';
export function canonicalLink(value: unknown): string | null {
  const safe = safeLocalRedirect(value, '');
  if (!safe) return null;
  const target = safe.replace(/^\/(?:app|mobile)(?=\/|\?|#|$)/, '') || '/';
  // No nested resolver, login loop, or non-app destination.
  const pathname = target.split(/[?#]/)[0];
  if (pathname === '/abrir' || !target.startsWith('/') || target.startsWith('//')) return null;
  return target;
}
export function linkSurface(preference: LinkPreference, mobile: boolean, standalone: boolean): 'WEB' | 'APP' {
  return preference === 'WEB' || preference === 'APP' ? preference : mobile || standalone ? 'APP' : 'WEB';
}
export function linkDestination(target: string, preference: LinkPreference, mobile: boolean, standalone: boolean, role?: string, inspector = false): string {
  const canonical = canonicalLink(target) || '/notificaciones';
  const path = postLoginDestination(canonical, role, inspector);
  return (linkSurface(preference, mobile, standalone) === 'APP' ? '/app' : '') + path;
}
export function publicLink(target: string): boolean {
  return /^\/(login|registro|recuperar|reset-password|verificar-email|reclamar)(?:[?#]|$)/.test(target)
    || /^\/(empresa-invitacion|inscripcion|manifiestos\/verificar|verificar\/inspecciones)\//.test(target);
}
