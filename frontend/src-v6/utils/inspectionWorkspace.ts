import { companyCacheScope, type CompanyContext } from '../services/companyContext';
import { actorDetailFromPath } from './actorReadAccess';

type Context = { id?: string | number; rol?: string; actorId?: string; empresaContexto?: CompanyContext; esInspector?: boolean; training?: boolean };

export function inspectionWorkspaceOwner(user?: Context | null): string {
  return user?.id ? JSON.stringify([user.id, user.rol, user.actorId, companyCacheScope(user.empresaContexto || null), user.empresaContexto?.autorizacionId, user.empresaContexto?.revision, !!user.esInspector, !!user.training]) : '';
}

/** A cached document is reusable only under the complete authorization context.
 * Keep the user prefix for logout cleanup, but never read the old unscoped key. */
export function inspectionContextKey(userId: string | number, owner: string, inspectionId: string): string {
  return userId && owner && inspectionId ? `${userId}:context-v2:${JSON.stringify([owner, inspectionId])}` : '';
}

export function inspectionFieldDraftKey(userId: string | number, owner: string, inspectionId: string): string {
  const context = inspectionContextKey(userId, owner, inspectionId);
  return context ? `sitrep_inspection_draft_${context}` : '';
}

export const INSPECTION_FILTER_KEYS = ['search', 'estado', 'etapa', 'tipoActor', 'tipoInspeccion', 'actorId', 'page', 'vista', 'filtros', 'agendaEstado', 'agendaDesde', 'agendaHasta', 'agendaPage', 'agendaFecha', 'agendaFiltros'] as const;

export function inspectionPage(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function inspectionDateFilter(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : '';
}

type ActorReturnState = { actorReturn?: string; inspectionReturn?: string };
type ReturnContext = { path: string; owner: string; actorState?: ActorReturnState };
const unsafeNavigation = (value: string) => [...value].some(character => character === '\\' || character.charCodeAt(0) < 32);
export function inspectionReturnState(path: string, owner: string, priorState?: unknown) {
  const prior = priorState && typeof priorState === 'object' ? priorState as ActorReturnState : {};
  const actorState: ActorReturnState = {};
  for (const key of ['actorReturn', 'inspectionReturn'] as const) {
    const value = prior[key];
    if (typeof value === 'string' && value.length <= 6000 && /^\/(?!\/)/.test(value) && !unsafeNavigation(value)) actorState[key] = value;
  }
  return { inspectionWorkspaceReturn: { path, owner, ...(Object.keys(actorState).length ? { actorState } : {}) } };
}

/** History is a navigation hint, never permission. Only the same staff context
 * and known workspace roots may restore it; no arbitrary redirect destinations. */
export function inspectionReturnTarget(state: unknown, owner: string, mobile = false): { to: string; label: string; state?: ActorReturnState } {
  const fallback = { to: `${mobile ? '/mobile' : ''}/inspecciones`, label: 'Inspecciones' };
  if (!state || typeof state !== 'object') return fallback;
  const value = (state as { inspectionWorkspaceReturn?: ReturnContext }).inspectionWorkspaceReturn;
  if (!value || !owner || value.owner !== owner || typeof value.path !== 'string') return fallback;
  // A staff member may open a dossier from an actor ficha. Restore its tab,
  // page and prior origin only in the same authenticated context and surface.
  if (value.path.length <= 6000 && /^\/(?!\/)/.test(value.path) && !unsafeNavigation(value.path) && !value.path.includes('#')) {
    const [pathname] = value.path.split('?');
    const parsed = new URL(value.path, 'https://sitrep.invalid');
    if (parsed.origin === 'https://sitrep.invalid' && parsed.pathname === pathname
      && !!pathname.startsWith('/mobile/') === mobile && actorDetailFromPath(pathname)) {
      const safeState = inspectionReturnState('', '', value.actorState).inspectionWorkspaceReturn.actorState;
      return { to: value.path, label: 'Ficha del actor', ...(safeState ? { state: safeState } : {}) };
    }
  }
  const match = value.path.match(/^(\/mobile)?\/(inspecciones|centro-control|reportes|tracking)(\?[^#]*)?$/);
  if (!match || !!match[1] !== mobile) return fallback;
  const labels: Record<string, string> = { inspecciones: new URLSearchParams(match[3]).get('vista') === 'agenda' ? 'Agenda de inspecciones' : 'Inspecciones', 'centro-control': 'Centro de control', reportes: 'Reportes', tracking: 'Monitor' };
  return { to: value.path, label: labels[match[2]] };
}
