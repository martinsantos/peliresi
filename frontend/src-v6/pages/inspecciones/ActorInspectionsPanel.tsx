import React, { useCallback, useEffect } from 'react';
import { CalendarDays, ChevronRight, ClipboardCheck, MapPin, UserRound } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { useInspections } from '../../hooks/useInspecciones';
import { useAuth } from '../../contexts/AuthContext';
import { actorInspectionAccess } from '../../utils/actorReadAccess';
import { inspectionPage, inspectionReturnState, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import type { InspectionActorType } from '../../types/inspection';
import {
  INSPECTION_STATE_COLORS,
  INSPECTION_STATE_LABELS,
  inspectionDate,
  inspectionRelevantDate,
} from './inspectionPresentation';

const PAGE_SIZE = 20;
const CLOSED_STATES = ['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'] as const;

type Props = { actorType: InspectionActorType; actorId: string; actorName: string };

export function ActorInspectionsPanel(props: Props) {
  const { currentUser } = useAuth();
  const access = actorInspectionAccess(currentUser, props.actorType, props.actorId);
  if (access === 'staff') return <StaffActorInspectionsPanel {...props} />;
  return null;
}

function StaffActorInspectionsPanel({
  actorType,
  actorId,
  actorName,
}: Props) {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = inspectionPage(params.get('inspeccionesPagina'));
  const mobile = location.pathname.startsWith('/mobile');
  const query = useInspections({ tipoActor: actorType, actorId, page, limit: PAGE_SIZE });
  const rows = query.data?.items || [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);
  const byState = query.data?.summary?.byState;
  const closed = byState && CLOSED_STATES.reduce((sum, state) => sum + (byState[state] ?? 0), 0);
  const open = closed === undefined ? undefined : total - closed;
  const base = `${mobile ? '/mobile' : ''}/inspecciones`;
  const updatePage = useCallback((nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('inspeccionesPagina');
    else next.set('inspeccionesPagina', String(nextPage));
    setParams(next, { replace: true, state: location.state });
  }, [params, setParams, location.state]);

  useEffect(() => {
    // An expediente can disappear or become inaccessible while the user is
    // away. Return to an existing page instead of showing a false empty state.
    if (query.data && page > totalPages) updatePage(totalPages);
  }, [page, query.data, totalPages, updatePage]);

  if (query.isLoading) return <Card className="p-8 text-center text-sm text-neutral-500">Cargando inspecciones del actor…</Card>;
  if (query.isError) return <Card role="alert" className="border-error-200 bg-error-50 p-6 text-sm text-error-800"><p>No se pudo recuperar el historial de inspecciones.</p><Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>Reintentar</Button></Card>;
  if (page > totalPages) return <Card className="p-8 text-center text-sm text-neutral-500">Actualizando página…</Card>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-700">Historial asociado</p>
          <h3 className="mt-1 text-lg font-extrabold text-[#10213A]">Inspecciones de {actorName}</h3>
          <p className="mt-1 text-sm text-neutral-600">Expedientes vinculados a esta entidad. La creación se realiza únicamente desde el módulo Inspecciones.</p>
        </div>
      </div>

      {query.data?.offline && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Sin conexión: sólo se muestran las copias guardadas en este dispositivo. El historial puede estar incompleto.</p>}
      <div className={`grid gap-3 ${byState ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <Card className="!p-4"><p className="text-xs text-neutral-500">{query.data?.offline ? 'Copias disponibles' : 'Total'}</p><p className="mt-1 text-2xl font-extrabold text-[#10213A]">{total}</p></Card>
        {byState && <><Card className="!p-4"><p className="text-xs text-neutral-500">Abiertas</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{open}</p></Card>
        <Card className="!p-4"><p className="text-xs text-neutral-500">Cerradas</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{closed}</p></Card></>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ClipboardCheck className="mx-auto text-neutral-300" size={38} />
            <p className="mt-3 font-bold text-[#10213A]">{query.data?.offline ? 'No hay copias guardadas para este actor' : 'Sin inspecciones asociadas'}</p>
            <p className="mt-1 text-sm text-neutral-500">{query.data?.offline ? 'Conectate para consultar el historial completo.' : 'La primera acta que se cree para este actor aparecerá acá.'}</p>
          </div>
        ) : rows.map((inspection) => (
          <Link
            key={inspection.id}
            to={`${base}/${inspection.id}`}
            state={inspectionReturnState(location.pathname + location.search, inspectionWorkspaceOwner(currentUser), location.state)}
            className="grid w-full gap-3 border-b border-neutral-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-primary-50/40 sm:grid-cols-[1.05fr_1fr_1fr_auto] sm:items-center sm:px-5"
            aria-label={`Abrir expediente ${inspection.numero}`}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-extrabold text-[#10213A]">{inspection.numero}</p>
                <Badge color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge>
              </div>
              <p className="mt-1 text-xs text-neutral-500">Acta {inspection.numeroActa || 'sin numerar'}</p>
            </div>
            <div className="flex items-start gap-2 text-sm text-neutral-700">
              <CalendarDays className="mt-0.5 shrink-0 text-neutral-400" size={16} />
              <div><p className="font-semibold">{inspectionDate(inspectionRelevantDate(inspection))}</p><p className="text-xs text-neutral-500">{inspection.fechaProgramada ? 'Fecha programada' : inspection.iniciadaAt ? 'Inicio en campo' : 'Fecha de creación'}</p></div>
            </div>
            <div className="space-y-1 text-sm text-neutral-700">
              <p className="flex items-center gap-2"><UserRound size={15} className="text-neutral-400" />{inspection.inspector.nombre} {inspection.inspector.apellido || ''}</p>
              {inspection.ubicacion && <p className="flex items-center gap-2 truncate text-xs text-neutral-500"><MapPin size={14} className="shrink-0" />{inspection.ubicacion}</p>}
            </div>
            <ChevronRight className="hidden text-neutral-400 sm:block" size={19} />
          </Link>
        ))}
        {totalPages > 1 && <nav aria-label="Páginas del historial de inspecciones" className="flex items-center justify-between gap-1 border-t border-neutral-200 p-3">
          <Button variant="outline" size="sm" className="!px-2" disabled={page <= 1} onClick={() => updatePage(page - 1)}>Anterior</Button>
          <span className="whitespace-nowrap text-xs text-neutral-700 sm:text-sm" aria-live="polite">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" className="!px-2" disabled={page >= totalPages} onClick={() => updatePage(page + 1)}>Siguiente</Button>
        </nav>}
      </div>
    </div>
  );
}
