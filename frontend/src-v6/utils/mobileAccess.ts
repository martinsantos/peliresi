import type { User, UserRole } from '../contexts/AuthContext';

const ALL_ADMIN_ROLES: UserRole[] = [
  'ADMIN',
  'ADMIN_GENERADOR',
  'ADMIN_TRANSPORTISTA',
  'ADMIN_OPERADOR',
];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const hasRole = (user: User, roles: UserRole[]) => roles.includes(user.rol);

/**
 * Mirrors the role boundaries declared by the web router for the standalone PWA.
 * Backend authorization remains authoritative; this prevents inaccessible admin
 * screens from being rendered and issuing doomed/forbidden API requests.
 */
export function canAccessMobilePath(user: User, path: string): boolean {
  if (path === '/mis-inspecciones' || path.startsWith('/mis-inspecciones/')) {
    return hasRole(user, ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']);
  }

  if (path === '/inspecciones' || path.startsWith('/inspecciones/')) {
    return user.esInspector === true || hasRole(user, ALL_ADMIN_ROLES);
  }

  if (startsWithAny(path, ['/admin/usuarios', '/admin/actores'])) {
    if (path === '/admin/actores') return user.rol === 'ADMIN';

    if (path.startsWith('/admin/actores/transportistas')) {
      const detailMatch = path.match(/^\/admin\/actores\/transportistas\/([^/]+)$/);
      const isDetail = Boolean(detailMatch && detailMatch[1] !== 'nuevo');
      return isDetail
        ? hasRole(user, ['ADMIN', 'ADMIN_TRANSPORTISTA', 'TRANSPORTISTA'])
        : hasRole(user, ['ADMIN', 'ADMIN_TRANSPORTISTA']);
    }

    if (path.startsWith('/admin/actores/generadores')) {
      return hasRole(user, ['ADMIN', 'ADMIN_GENERADOR']);
    }

    if (path.startsWith('/admin/actores/operadores')) {
      return hasRole(user, ['ADMIN', 'ADMIN_OPERADOR']);
    }

    return user.rol === 'ADMIN';
  }

  if (path.startsWith('/admin/vehiculos')) {
    return hasRole(user, ['ADMIN', 'ADMIN_TRANSPORTISTA', 'TRANSPORTISTA']);
  }

  if (path.startsWith('/admin/residuos')) {
    return hasRole(user, ['ADMIN', 'ADMIN_GENERADOR']);
  }

  if (path.startsWith('/admin/tratamientos') || path.startsWith('/admin/renovaciones')) {
    return hasRole(user, ['ADMIN', 'ADMIN_OPERADOR']);
  }

  if (path.startsWith('/admin/solicitudes')) {
    return hasRole(user, ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR']);
  }

  if (startsWithAny(path, ['/admin/blockchain', '/admin/carga-masiva', '/admin/auditoria'])) {
    return hasRole(user, ALL_ADMIN_ROLES);
  }

  if (path.startsWith('/admin/')) return user.rol === 'ADMIN';

  return true;
}
