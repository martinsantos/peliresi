/**
 * CentroControl — Sticky Filters Bar
 * Date presets, LIVE badge and date range pickers. Map controls live by the map.
 */
import React from 'react';
import {
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { DATE_PRESETS } from '../../../utils/date-presets';

export interface LayerState {
  generadores: boolean;
  transportistas: boolean;
  operadores: boolean;
  transito: boolean;
  inspecciones?: boolean;
}

interface ControlFiltersProps {
  countdown: number;
  datePreset: number;
  fechaDesde: string;
  fechaHasta: string;
  onManualRefresh: () => void;
  onDatePreset: (days: number) => void;
  onFechaDesde: (val: string) => void;
  onFechaHasta: (val: string) => void;
}

export const ControlFilters: React.FC<ControlFiltersProps> = ({
  countdown,
  datePreset,
  fechaDesde,
  fechaHasta,
  onManualRefresh,
  onDatePreset,
  onFechaDesde,
  onFechaHasta,
}) => {
  return (
    <div className="relative lg:sticky lg:top-0 z-20 bg-[#FAFAF8] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-2">
      {/* Date presets + LIVE badge + period */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-2xl border border-neutral-100 shadow-sm">
        {/* LIVE badge + refresh */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-xs font-semibold text-red-700">LIVE</span>
        </span>
        <span className="text-xs text-neutral-400 tabular-nums w-6 text-right">{countdown}s</span>
        <button type="button" onClick={onManualRefresh} className="min-h-11 min-w-11 flex items-center justify-center hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 rounded transition-colors text-neutral-600" title="Actualizar ahora">
          <RefreshCw size={18} />
        </button>

        <div className="h-5 w-px bg-neutral-200 hidden sm:block" />

        {/* Date presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar size={16} className="text-neutral-400" />
          {DATE_PRESETS.filter(p => p.days > 0).map(p => (
            <button
              type="button"
              key={p.days}
              aria-pressed={datePreset === p.days}
              onClick={() => onDatePreset(p.days)}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 ${
                datePreset === p.days
                  ? 'bg-primary-50 text-primary-700 border border-primary-200'
                  : 'text-neutral-500 hover:bg-neutral-50 border border-transparent'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="hidden sm:flex items-center gap-1.5 ml-2 text-xs text-neutral-400">
            <input
              type="date"
              value={fechaDesde}
              onChange={e => onFechaDesde(e.target.value)}
              className="px-2 py-1 rounded border border-neutral-200 text-neutral-600 text-xs"
            />
            <span>—</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => onFechaHasta(e.target.value)}
              className="px-2 py-1 rounded border border-neutral-200 text-neutral-600 text-xs"
            />
          </div>
        </div>

        {/* Active period indicator */}
        <div className="ml-auto">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border text-amber-700 bg-amber-50 border-amber-200">
            <Calendar size={11} />
            {fechaDesde} — {fechaHasta}
          </span>
        </div>
      </div>
    </div>
  );
};
