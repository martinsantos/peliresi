/** Accept only same-origin router destinations. */
export function safeLocalRedirect(from: unknown, fallback = '/dashboard'): string {
  return typeof from === 'string'
    && from.startsWith('/')
    && !from.startsWith('//')
    ? from
    : fallback;
}

const INSPECTED_PARTY_ROLES = new Set(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']);

export function postLoginDestination(from: unknown, role?: string): string {
  const localPath = safeLocalRedirect(from);
  return role && INSPECTED_PARTY_ROLES.has(role)
    ? localPath.replace(/^\/inspecciones\//, '/mis-inspecciones/')
    : localPath;
}
