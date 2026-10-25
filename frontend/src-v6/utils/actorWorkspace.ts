import type { User } from '../contexts/AuthContext';
import { canAccessMobilePath } from './mobileAccess';
import { canUseCompanySection } from '../services/companyContext';

const actors = {
  generadores: { label: 'generador', plural: 'Generadores', role: 'GENERADOR' },
  transportistas: { label: 'transportista', plural: 'Transportistas', role: 'TRANSPORTISTA' },
  operadores: { label: 'operador', plural: 'Operadores', role: 'OPERADOR' },
} as const;

/** Shared route vocabulary for the shell, return links and contextual help. */
export function actorWorkspaceRoute(pathname: string) {
  const path = pathname.split(/[?#]/)[0];
  const match = /^\/(?:(app|mobile)\/)?(?:(?:admin\/)?actores\/(generadores|transportistas|operadores)|admin\/(generadores|operadores))(?:\/([^/]+))?(?:\/(editar|renovar))?\/?$/.exec(path);
  if (!match) return null;
  const kind = (match[2] || match[3]) as keyof typeof actors;
  const prefix = match[1] ? '/' + match[1] : '';
  let id: string | undefined;
  try { id = match[4] && decodeURIComponent(match[4]); } catch { return null; }
  if (id && (!id.trim() || /[\\/\u0000-\u001f]/.test(id) || id === '.' || id === '..')) return null;
  const stage = !id ? 'list' : id === 'nuevo' ? 'create' : match[5] === 'editar' ? 'edit' : match[5] === 'renovar' ? 'renew' : 'detail';
  if ((!id || id === 'nuevo') && match[5]) return null;
  return { ...actors[kind], kind, prefix, id: id === 'nuevo' ? undefined : id, stage, listPath: `${prefix}/admin/actores/${kind}` };
}

function localTarget(value: unknown, prefix: string) {
  if (typeof value !== 'string' || value.length > 6000 || !/^\/(?!\/)/.test(value) || /[\\\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://sitrep.invalid');
    const rawPath = value.split(/[?#]/)[0];
    const decoded = decodeURIComponent(rawPath);
    if (url.origin !== 'https://sitrep.invalid' || url.pathname !== rawPath || /[\\\u0000-\u001f]/.test(decoded) || decoded.split('/').some(s => s === '.' || s === '..')) return null;
    const surface = /^\/(app|mobile)(?=\/|$)/.exec(url.pathname)?.[0] || '';
    if (surface !== prefix) return null;
    return { path: url.pathname.slice(prefix.length), target: url.pathname + url.search + url.hash };
  } catch { return null; }
}

/** Only actual, authorized entry points may become a ficha's return destination. */
export function actorWorkspaceNavigation(pathname: string, user: User | null | undefined, state?: unknown) {
  const route = actorWorkspaceRoute(pathname);
  if (!route) return null;
  const canManage = user?.rol === 'ADMIN' || user?.rol === `ADMIN_${route.role}`;
  const fallback = canManage ? route.listPath : route.prefix + (user?.esInspector ? '/actores' : user?.rol === route.role ? '/mi-perfil' : '/dashboard');
  const history = state && typeof state === 'object' && !Array.isArray(state) ? state as { actorReturn?: unknown; inspectionReturn?: unknown; actorDetailReturn?: unknown } : {};
  const candidate = localTarget(history.actorReturn ?? history.inspectionReturn, route.prefix);
  const entry = candidate && /^\/(?:dashboard|mi-perfil|(?:admin\/)?actores(?:\/(?:generadores|transportistas|operadores))?|manifiestos\/[^/]+(?:\/adendas)?|inspecciones\/[^/]+)\/?$/.test(candidate.path)
    && !/\/(?:nuevo|editar|renovar)\/?$/.test(candidate.path)
    && user && canAccessMobilePath(user, candidate.path) && canUseCompanySection(user.empresaContexto, candidate.path)
    ? candidate.target : fallback;
  const origin = route.stage === 'list' ? route.listPath : route.stage === 'create'
    ? (candidate?.path === route.listPath.slice(route.prefix.length) ? entry : route.listPath) : entry;
  let backPath = origin;
  if (route.stage === 'edit' || route.stage === 'renew') {
    const detail = localTarget(history.actorDetailReturn, route.prefix);
    const detailRoute = detail && actorWorkspaceRoute(detail.target);
    backPath = detailRoute?.stage === 'detail' && detailRoute.kind === route.kind && detailRoute.id === route.id
      ? detail!.target : `${route.listPath}/${encodeURIComponent(route.id!)}`;
  }
  const originPath = origin.slice(route.prefix.length).split(/[?#]/)[0];
  const sectionPath = /^\/manifiestos\//.test(originPath) ? '/manifiestos'
    : /^\/inspecciones\//.test(originPath) ? '/inspecciones' : originPath;
  const originRoute = actorWorkspaceRoute(originPath);
  const backLabel = route.stage === 'edit' || route.stage === 'renew' ? 'Volver a la ficha'
    : /^\/manifiestos\//.test(originPath) ? 'Volver al manifiesto'
    : /^\/inspecciones\//.test(originPath) ? 'Volver a la inspección'
    : originPath === '/mi-perfil' ? 'Volver a mi perfil'
    : originRoute?.stage === 'list' ? `Volver a ${originRoute.plural}`
    : /\/actores$/.test(originPath) ? 'Volver a Actores' : 'Volver a Inicio';
  const title = route.stage === 'list' ? route.plural : route.stage === 'detail' ? `Ficha del ${route.label}`
    : `${route.stage === 'create' ? 'Nuevo' : route.stage === 'renew' ? 'Renovar' : 'Editar'} ${route.label}`;
  return { title, sectionPath, backPath, backLabel, origin, returnState: { actorReturn: origin } };
}
