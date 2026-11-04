import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, ClipboardCheck, MapPin } from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { useAuth } from '../../contexts/AuthContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useInspections } from '../../hooks/useInspecciones';
import { readInspectionResume } from '../../services/inspectionResume';
import { inspectionActor, INSPECTION_TYPES, inspectionTypeOf, type Inspection } from '../../types/inspection';
import { inspectionReturnState, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { INSPECTION_STATE_COLORS, INSPECTION_STATE_LABELS, inspectionDate } from '../inspecciones/inspectionPresentation';

const order = (inspection: Inspection) => inspection.estado === 'EN_CAMPO' ? 0 : 1;
const when = (inspection: Inspection) => Date.parse(inspection.fechaProgramada || inspection.iniciadaAt || inspection.createdAt) || 0;

/** Inicio del inspector: lo que tiene entre manos hoy. Reutiliza la consulta del listado; sin manifiestos. */
export function InspectorHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const prefix = location.pathname.startsWith('/mobile') ? '/mobile' : '';
  const owner = inspectionWorkspaceOwner(currentUser);
  const connectivity = useConnectivity({ pingInterval: 60_000 });
  const today = useInspections({ estados: ['EN_CAMPO', 'PLANIFICADA'], limit: 25 });
  const returnState = inspectionReturnState(`${prefix}/dashboard`, owner);
  // La jefatura ve el trabajo de todo el equipo; el inspector, sólo el suyo (la cuenta de práctica es ADMIN y el servidor le devuelve todo).
  const rows = (today.data?.items || [])
    .filter((row) => currentUser?.esJefeInspecciones || String(row.inspectorId || row.inspector?.id) === String(currentUser?.id))
    .sort((left, right) => order(left) - order(right) || when(left) - when(right));
  const inField = rows.filter((row) => row.estado === 'EN_CAMPO').length;
  const offline = Boolean(today.data?.offline);

  return <div className="mx-auto w-full max-w-6xl space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="break-words text-sm text-neutral-600">{currentUser?.sector || currentUser?.nombre || 'SITREP'}</p>
        <h2 className="text-xl font-bold text-neutral-900">Hoy</h2>
      </div>
      <Button variant="outline" leftIcon={<ClipboardCheck size={18} />} onClick={() => navigate(`${prefix}/inspecciones`)}>Inspecciones</Button>
    </header>

    {!connectivity.isOnline && <p role="status" className="rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-900">Sin conexión. Se muestran las copias guardadas en este dispositivo.</p>}

    <section aria-label="Inspecciones de hoy" className="overflow-hidden rounded-xl border border-[#E0E0DC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {today.isLoading ? <p className="p-6 text-center text-sm text-neutral-500">Cargando…</p>
        : today.isError ? <div role="alert" className="p-6 text-center"><p className="font-semibold text-error-800">No se pudieron consultar tus inspecciones</p><Button variant="outline" className="mt-3" onClick={() => void today.refetch()}>Reintentar</Button></div>
        : rows.length === 0 ? <div className="p-6 text-center"><ClipboardCheck className="mx-auto text-neutral-300" size={36} /><p className="mt-2 font-semibold text-neutral-800">{offline ? 'Sin copias de inspecciones en este dispositivo' : 'Sin inspecciones en campo ni programadas'}</p></div>
        : <>
          <p className="border-b border-neutral-100 px-4 py-2 text-xs text-neutral-600">{inField} en campo · {rows.length - inField} programadas{offline ? ' · copias de este dispositivo' : ''}</p>
          {rows.map((inspection) => {
            const actor = inspectionActor(inspection);
            const resume = currentUser?.id ? readInspectionResume(currentUser.id, inspection.id, owner) : null;
            const date = inspection.estado === 'EN_CAMPO' ? `En campo desde ${inspectionDate(inspection.iniciadaAt, true)}` : `Programada ${inspectionDate(inspection.fechaProgramada, true)}`;
            return <Link key={inspection.id} data-testid={`inspection-today-${inspection.id}`} state={returnState} to={`${prefix}/inspecciones/${inspection.id}${resume?.hash || ''}`} aria-label={`${resume ? 'Retomar' : 'Abrir'} expediente ${inspection.numero}${resume ? ` en ${resume.label}` : ''}`}
              className="flex items-center gap-3 border-b border-neutral-100 p-4 !no-underline last:border-0 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-sm font-semibold text-neutral-900">{inspection.numero}</span><Badge color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge></div>
                <p className="mt-1 truncate text-sm font-medium text-neutral-800">{actor?.razonSocial || INSPECTION_TYPES[inspectionTypeOf(inspection)].label}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500"><CalendarDays size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />{date}</p>
                {inspection.ubicacion && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500"><MapPin size={14} className="shrink-0 text-neutral-400" aria-hidden="true" /><span className="truncate">{inspection.ubicacion}</span></p>}
                {resume && <p className="mt-1 text-xs font-semibold text-primary-800">Retomá en {resume.label}</p>}
              </div>
              <ChevronRight size={20} className="shrink-0 text-neutral-400" aria-hidden="true" />
            </Link>;
          })}
        </>}
    </section>
  </div>;
}

export default InspectorHome;
