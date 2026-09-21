import React from 'react';
import { CalendarDays, ChevronRight, ClipboardCheck, MapPin, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { useInspections } from '../../hooks/useInspecciones';
import type { InspectionActorType } from '../../types/inspection';
import {
  INSPECTION_STATE_COLORS,
  INSPECTION_STATE_LABELS,
  inspectionDate,
  inspectionRelevantDate,
} from './inspectionPresentation';

const CLOSED_STATES = new Set(['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA']);

export function ActorInspectionsPanel({
  actorType,
  actorId,
  actorName,
}: {
  actorType: InspectionActorType;
  actorId: string;
  actorName: string;
}) {
  const location = useLocation();
  const mobile = location.pathname.startsWith('/mobile');
  const query = useInspections({ tipoActor: actorType, actorId, limit: 100 });
  const rows = query.data?.items || [];
  const open = rows.filter((row) => !CLOSED_STATES.has(row.estado)).length;
  const closed = rows.filter((row) => CLOSED_STATES.has(row.estado)).length;
  const base = `${mobile ? '/mobile' : ''}/inspecciones`;

  if (query.isLoading) return <Card className="p-8 text-center text-sm text-neutral-500">Cargando inspecciones del actor…</Card>;
  if (query.isError) return <Card className="border-error-200 bg-error-50 p-6 text-sm text-error-800">No se pudo recuperar el historial de inspecciones.</Card>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-700">Historial asociado</p>
          <h3 className="mt-1 text-lg font-extrabold text-[#10213A]">Inspecciones de {actorName}</h3>
          <p className="mt-1 text-sm text-neutral-600">Expedientes vinculados a esta entidad. La creación se realiza únicamente desde el módulo Inspecciones.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-4"><p className="text-xs text-neutral-500">Total</p><p className="mt-1 text-2xl font-extrabold text-[#10213A]">{query.data?.total || 0}</p></Card>
        <Card className="!p-4"><p className="text-xs text-neutral-500">Abiertas</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{open}</p></Card>
        <Card className="!p-4"><p className="text-xs text-neutral-500">Cerradas</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{closed}</p></Card>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ClipboardCheck className="mx-auto text-neutral-300" size={38} />
            <p className="mt-3 font-bold text-[#10213A]">Sin inspecciones asociadas</p>
            <p className="mt-1 text-sm text-neutral-500">La primera acta que se cree para este actor aparecerá acá.</p>
          </div>
        ) : rows.map((inspection) => (
          <Link
            key={inspection.id}
            to={`${base}/${inspection.id}`}
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
      </div>
    </div>
  );
}
