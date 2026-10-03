import React, { useId } from 'react';
import { Check, MapPin } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import type { InspectionLocationSuggestion } from './inspectionLocations';

// The creation/update API accepts 300 characters; official addresses remain intact.
const LOCATION_LIMIT = 300;

export function InspectionLocationField({ label, value, onChange, options, disabled = false, className, placeholder = 'Dirección o referencia del lugar' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: InspectionLocationSuggestion[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const hintId = useId();
  return <div className={`min-w-0 ${className || ''}`}>
    <Input label={label} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} placeholder={placeholder} maxLength={LOCATION_LIMIT}
      errorMessage={!disabled && value.length > LOCATION_LIMIT ? 'Usá una referencia de hasta 300 caracteres. La dirección declarada se conserva completa.' : undefined} />
    {!disabled && options.length > 0 && <div role="group" aria-label="Direcciones declaradas" className="mt-3 border-l-2 border-neutral-300 pl-2">
      <p className="mb-1 text-xs font-medium text-neutral-600">Direcciones declaradas · elegí el lugar de visita</p>
      {options.map((option, index) => <button key={option.value} type="button" aria-label={`Usar ${option.label.toLocaleLowerCase('es-AR')}: ${option.value}`}
        disabled={option.value.length > LOCATION_LIMIT} aria-describedby={option.value.length > LOCATION_LIMIT ? `${hintId}-${index}` : undefined}
        aria-pressed={value === option.value} onClick={() => onChange(option.value)}
        className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors disabled:cursor-default disabled:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 ${value === option.value ? 'bg-primary-50 hover:bg-primary-100 active:bg-primary-200' : 'hover:bg-neutral-100 active:bg-neutral-200'}`}>
        <MapPin size={16} aria-hidden="true" className="shrink-0 text-neutral-600" />
        <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-neutral-600">{option.label}</span><span className="block break-words text-sm font-medium text-neutral-900">{option.value}</span>
          {option.value.length > LOCATION_LIMIT && <span id={`${hintId}-${index}`} className="mt-1 block text-xs text-neutral-700">Supera 300 caracteres. Escribí una referencia breve en el campo.</span>}
        </span>
        {value === option.value && <Check size={16} aria-hidden="true" className="shrink-0 text-primary-800" />}
      </button>)}
    </div>}
  </div>;
}
