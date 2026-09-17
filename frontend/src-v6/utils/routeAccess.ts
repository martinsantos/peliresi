import type { UserRole } from '../contexts/AuthContext';

/** UI navigation policy only. Resource ownership must still be checked by the API. */
export function canVisitRoute(role: UserRole, pathname: string): boolean {
  const path = pathname.replace(/^\/(app|mobile)(?=\/|$)/, '').replace(/\/+$/, '') || '/';
  if (role === 'ADMIN') return true;
  if (path === '/manifiestos/nuevo' || /^\/manifiestos\/[^/]+\/editar$/.test(path)) {
    return role === 'GENERADOR' || role === 'ADMIN_GENERADOR';
  }
  if (path === '/switch-user') return false;
  if (!path.startsWith('/admin/')) return true;

  if (path === '/admin/auditoria') return role === 'AUDITOR';
  const sectorAdmins: UserRole[] = ['ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'];
  if (/^\/admin\/(solicitudes|blockchain|carga-masiva)(\/|$)/.test(path)) return sectorAdmins.includes(role);
  if (path === '/admin/vehiculos') return role === 'ADMIN_TRANSPORTISTA' || role === 'TRANSPORTISTA';
  if (path === '/admin/residuos') return role === 'ADMIN_GENERADOR';
  if (path === '/admin/tratamientos' || path === '/admin/renovaciones') return role === 'ADMIN_OPERADOR';
  const actor = path.match(/^\/admin\/(?:actores\/)?(generadores|operadores|transportistas)(?:\/(.*))?$/);
  if (actor) {
    const sector: Record<string, UserRole> = { generadores: 'ADMIN_GENERADOR', operadores: 'ADMIN_OPERADOR', transportistas: 'ADMIN_TRANSPORTISTA' };
    if (role === sector[actor[1]]) return true;
    // Own transport profile is readable; list/create/edit remain administrative.
    return role === 'TRANSPORTISTA' && actor[1] === 'transportistas' && !!actor[2] && !actor[2].includes('/') && actor[2] !== 'nuevo';
  }
  return false;
}
