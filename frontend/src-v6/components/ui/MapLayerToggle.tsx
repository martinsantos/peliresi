import React, { useId } from 'react';
import { Check, ClipboardCheck, EyeOff, Factory, FlaskConical, Navigation, Truck } from 'lucide-react';
import { ACTOR_COLORS } from '../../utils/actor-identity';

export type MapCategory = 'generador' | 'transportista' | 'operador' | 'inspeccion' | 'enTransito';
const glyphs = { generador: Factory, transportista: Truck, operador: FlaskConical, inspeccion: ClipboardCheck, enTransito: Navigation };

/** The control is also the legend: same glyph, color and shape as its map marker. */
export function MapCategorySymbol({ category, size = 'control' }: { category: MapCategory; size?: 'control' | 'hero' }) {
  const Icon = glyphs[category];
  const diamond = category === 'transportista';
  const hero = size === 'hero';
  // Reserve the diamond's full rotated footprint; only the background rotates.
  // All glyphs share the same grid center and remain independent of text baselines.
  return <span data-map-symbol={category} aria-hidden="true" className={`isolate inline-grid shrink-0 place-items-center ${hero ? 'h-14 w-14' : 'h-9 w-9'}`}>
    <span data-map-symbol-background
      className={`col-start-1 row-start-1 ${hero ? 'h-10 w-10' : 'h-6 w-6'} ${category === 'enTransito' ? 'rounded-full' : 'rounded'}`}
      style={{ backgroundColor: ACTOR_COLORS[category], transform: diamond ? 'rotate(45deg)' : undefined }} />
    <Icon size={hero ? 24 : 14} strokeWidth={2.5} className="relative z-[1] col-start-1 row-start-1 block shrink-0 text-white" />
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
    className={`flex min-h-12 min-w-0 items-center gap-1 rounded-lg border px-1 py-2 text-left text-xs font-semibold text-neutral-800 transition-colors sm:gap-2 sm:px-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 ${pressed ? 'border-primary-400 bg-primary-50 hover:bg-primary-100 active:bg-primary-200' : 'border-neutral-300 bg-white hover:bg-neutral-100 active:bg-neutral-200'}`}>
    <MapCategorySymbol category={category} />
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <span data-map-label className="whitespace-nowrap">{label}</span>
      {count !== undefined && <span id={countId} data-map-count className="shrink-0 font-normal tabular-nums text-neutral-600">({count})</span>}
    </span>
    <span data-map-state className="inline-flex shrink-0 items-center justify-center">{pressed ? <Check size={13} aria-hidden="true" className="block text-primary-800" /> : <EyeOff size={13} aria-hidden="true" className="block text-neutral-600" />}</span>
  </button>;
}
