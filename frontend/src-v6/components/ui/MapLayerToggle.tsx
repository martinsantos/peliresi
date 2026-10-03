import React, { useId } from 'react';
import { Check, ClipboardCheck, EyeOff, Factory, FlaskConical, Navigation, Truck } from 'lucide-react';
import { ACTOR_COLORS } from '../../utils/map-icons';

export type MapCategory = 'generador' | 'transportista' | 'operador' | 'inspeccion' | 'enTransito';
const glyphs = { generador: Factory, transportista: Truck, operador: FlaskConical, inspeccion: ClipboardCheck, enTransito: Navigation };

/** The control is also the legend: same glyph, color and shape as its map marker. */
export function MapCategorySymbol({ category }: { category: MapCategory }) {
  const Icon = glyphs[category];
  const diamond = category === 'transportista';
  return <span data-map-symbol={category} aria-hidden="true"
    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center text-white ${category === 'enTransito' ? 'rounded-full' : 'rounded'}`}
    style={{ backgroundColor: ACTOR_COLORS[category], transform: diamond ? 'rotate(45deg)' : undefined }}>
    <Icon size={14} strokeWidth={2.5} style={{ transform: diamond ? 'rotate(-45deg)' : undefined }} />
  </span>;
}

export function MapLayerToggle({ category, label, pressed, count, onToggle }: {
  category: MapCategory;
  label: string;
  pressed: boolean;
  count?: number;
  onToggle: () => void;
}) {
  const countId = useId();
  return <button type="button" aria-label={label} aria-pressed={pressed} aria-describedby={count === undefined ? undefined : countId}
    onClick={onToggle}
    className={`flex min-h-12 min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold text-neutral-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 ${pressed ? 'border-primary-400 bg-primary-50 hover:bg-primary-100 active:bg-primary-200' : 'border-neutral-300 bg-white hover:bg-neutral-100 active:bg-neutral-200'}`}>
    <MapCategorySymbol category={category} />
    <span className="min-w-0 flex-1">
      <span data-map-label className="block sm:inline">{label}</span>
      <span className="mt-0.5 flex min-h-4 items-center justify-between gap-1 sm:ml-2 sm:mt-0 sm:inline-flex">
        {count !== undefined && <span id={countId} data-map-count className="font-normal tabular-nums text-neutral-600">({count})</span>}
        <span data-map-state className="ml-auto shrink-0">{pressed ? <Check size={13} aria-hidden="true" className="text-primary-800" /> : <EyeOff size={13} aria-hidden="true" className="text-neutral-600" />}</span>
      </span>
    </span>
  </button>;
}
