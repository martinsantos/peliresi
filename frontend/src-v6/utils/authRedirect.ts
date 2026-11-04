/** Accept only same-origin router destinations. */
export function safeLocalRedirect(from: unknown, fallback = '/dashboard'): string {
  return typeof from === 'string'
    && from.startsWith('/')
    && !from.startsWith('//')
    && !/[\\\s]/.test(from)
    && !Array.from(from).some(character => character.charCodeAt(0) < 32)
    && !/%(?:2f|5c|0[ad])/i.test(from.split(/[?#]/)[0])
    ? from
    : fallback;
}

const INSPECTED_PARTY_ROLES = new Set(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']);

export function postLoginDestination(from: unknown, role?: string, isInspector = false): string {
  const localPath = safeLocalRedirect(from);
  if (!role || isInspector || !INSPECTED_PARTY_ROLES.has(role)) return localPath;
  if (/^\/(?:mobile\/)?(?:inspecciones|mis-inspecciones)\/?(?:[?#]|$)/.test(localPath)) {
    return localPath.startsWith('/mobile/') ? '/mobile/dashboard' : '/dashboard';
  }
  return localPath.replace(/^(\/(?:mobile\/)?)(?:inspecciones|mis-inspecciones)\//, '$1requerimientos/');
}
