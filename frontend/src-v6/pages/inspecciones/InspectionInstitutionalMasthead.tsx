import React from 'react';
import { Leaf, ShieldCheck } from 'lucide-react';
import type { InspectionState } from '../../types/inspection';
import { Badge, type BadgeColor } from '../../components/ui/BadgeV2';

const STATE_LABELS: Record<InspectionState, string> = {
  BORRADOR: 'Borrador', PLANIFICADA: 'Planificada', EN_CAMPO: 'En campo', EN_REVISION: 'En revisión',
  NOTIFICADA: 'Notificada', EN_DESCARGO: 'En descargo', REQUIERE_SUBSANACION: 'Requiere subsanación',
  CERRADA_CONFORME: 'Cerrada conforme', DERIVADA_LEGALES: 'Derivada a Legales', EN_TRAMITE_LEGAL: 'En trámite legal',
  DERIVADA_ATM: 'Derivada a ATM', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada',
};

const STATE_COLORS: Partial<Record<InspectionState, BadgeColor>> = {
  BORRADOR: 'neutral', PLANIFICADA: 'info', EN_CAMPO: 'primary', EN_REVISION: 'warning', NOTIFICADA: 'info',
  EN_DESCARGO: 'warning', REQUIERE_SUBSANACION: 'error', CERRADA_CONFORME: 'success', DERIVADA_LEGALES: 'error',
  EN_TRAMITE_LEGAL: 'warning', DERIVADA_ATM: 'warning', FINALIZADA: 'success', CANCELADA: 'neutral',
};

export function InspectionInstitutionalMasthead({
  inspectionNumber,
  actNumber,
  state,
  version,
  compact = false,
}: {
  inspectionNumber: string;
  actNumber?: string | null;
  state?: InspectionState;
  version?: number;
  compact?: boolean;
}) {
  return (
    <header className={`overflow-hidden border-b border-[#DCE7DF] bg-white ${compact ? 'rounded-xl' : 'rounded-2xl'}`}>
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo-mendoza.webp" alt="Gobierno de Mendoza" className="h-9 w-auto shrink-0 object-contain sm:h-11" />
          <span className="h-8 w-px bg-neutral-200" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1B5E3C] text-white" aria-hidden="true"><Leaf size={17} /></span>
            <div className="min-w-0">
              <p className="font-extrabold tracking-[0.12em] text-[#10213A]">SITREP</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#1B5E3C]">Trazabilidad de residuos peligrosos</p>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
          <div className="min-w-0 text-left sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Expediente de inspección</p>
            <p className="truncate font-mono text-sm font-extrabold text-[#10213A]">{inspectionNumber}</p>
            <p className="truncate text-[11px] text-neutral-500">Acta {actNumber || 'sin número'}{version != null ? ` · versión ${version}` : ''}</p>
          </div>
          {state && <Badge color={STATE_COLORS[state] || 'neutral'} dot>{STATE_LABELS[state] || state}</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[#E8EFEA] bg-[#F7FAF8] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1B5E3C] sm:px-6">
        <ShieldCheck size={14} aria-hidden="true" />
        Ministerio de Energía y Ambiente · Subsecretaría de Ambiente · DGFA
      </div>
    </header>
  );
}
