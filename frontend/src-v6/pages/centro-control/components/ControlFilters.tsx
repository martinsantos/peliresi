/**
 * CentroControl — Sticky Filters Bar
 * Date presets, LIVE badge, layer toggles, date range pickers
 */
import React from 'react';
import {
  RefreshCw,
  Calendar,
  Layers,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DATE_PRESETS } from '../../../utils/date-presets';

export interface LayerState {
  generadores: boolean;
  transportistas: boolean;
  operadores: boolean;
  transito: boolean;
}

interface ControlFiltersProps {
  countdown: number;
  datePreset: number;
  fechaDesde: string;
  fechaHasta: string;
  layers: LayerState;
  onManualRefresh: () => void;
  onDatePreset: (days: number) => void;
  onFechaDesde: (val: string) => void;
  onFechaHasta: (val: string) => void;
  onToggleLayer: (layer: keyof LayerState) => void;
}

export const ControlFilters: React.FC<ControlFiltersProps> = ({
  countdown,
  datePreset,
  fechaDesde,
  fechaHasta,
  layers,
  onManualRefresh,
  onDatePreset,
  onFechaDesde,
  onFechaHasta,
  onToggleLayer,
}) => {
  return (
    <div className="sticky top-0 z-20 bg-[#FAFAF8] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-2">
      {/* Row 1: Date presets + LIVE badge + layers + period */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-2xl border border-neutral-100 shadow-sm">
        {/* LIVE badge + refresh */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-xs font-semibold text-red-600">LIVE</span>
        </span>
        <span className="text-xs text-neutral-400 tabular-nums w-6 text-right">{countdown}s</span>
        <button onClick={onManualRefresh} className="p-1 hover:bg-neutral-100 rounded transition-colors text-neutral-400" title="Actualizar ahora">
          <RefreshCw size={13} />
        </button>

        <div className="h-5 w-px bg-neutral-200 hidden sm:block" />

        {/* Date presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar size={16} className="text-neutral-400" />
          {DATE_PRESETS.filter(p => p.days > 0).map(p => (
            <button
              key={p.days}
              onClick={() => onDatePreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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

        <div className="h-5 w-px bg-neutral-200 hidden sm:block" />

        {/* Layer toggles */}
        <div className="flex items-center gap-1.5">
          <Layers size={16} className="text-neutral-400" />
          {([
            { key: 'generadores' as const, label: 'Generadores', color: 'bg-purple-500' },
            { key: 'transportistas' as const, label: 'Transportistas', color: 'bg-orange-500' },
            { key: 'operadores' as const, label: 'Operadores', color: 'bg-blue-500' },
            { key: 'transito' as const, label: 'En Tránsito', color: 'bg-red-500' },
          ]).map(l => (
            <button
              key={l.key}
              onClick={() => onToggleLayer(l.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                layers[l.key]
                  ? 'bg-white border-neutral-200 text-neutral-700 shadow-sm'
                  : 'bg-neutral-50 border-transparent text-neutral-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${layers[l.key] ? l.color : 'bg-neutral-300'}`} />
              <span className="hidden sm:inline">{l.label}</span>
              {layers[l.key] ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          ))}
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
