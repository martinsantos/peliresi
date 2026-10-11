import React from 'react';
import { Factory, FlaskConical } from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import { inputCls, labelCls, selectCls } from '../shared';
import { ZONAS } from '../../../../utils/calculoTEF';

interface StepActividadProps {
  form: Record<string, string>;
  up: (field: string, value: string) => void;
  isOperador: boolean;
}

const fields = [
  { key: 'tefPersonal', label: 'Personal en planta', step: '1', inputMode: 'numeric' as const },
  { key: 'tefPotencia', label: 'Potencia instalada (HP)', step: 'any', inputMode: 'decimal' as const },
  { key: 'tefSuperficie', label: 'Superficie cubierta (m²)', step: 'any', inputMode: 'decimal' as const },
];

/** Applicants declare operational facts; fiscal evaluation belongs to DGFA. */
export function StepActividad({ form, up, isOperador }: StepActividadProps) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={isOperador ? FlaskConical : Factory} title="Datos de la actividad" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {fields.map(field => (
          <div key={field.key} className="min-w-0">
            <label className={labelCls} htmlFor={`registration-${field.key}`}>{field.label}</label>
            <input id={`registration-${field.key}`} type="number" min="0" step={field.step} inputMode={field.inputMode} className={inputCls()} value={form[field.key] || ''} onChange={event => up(field.key, event.target.value)} />
          </div>
        ))}
        <div className="min-w-0">
          <label className={labelCls} htmlFor="registration-tefZona">Zona del establecimiento</label>
          <select id="registration-tefZona" className={selectCls()} value={form.tefZona || ''} onChange={event => up('tefZona', event.target.value)}>
            <option value="">Seleccionar zona…</option>
            {form.tefZona && !ZONAS.some(zona => zona.id === form.tefZona) && <option value={form.tefZona}>{form.tefZona} · dato anterior</option>}
            {ZONAS.map(zona => <option key={zona.id} value={zona.id}>{zona.label}</option>)}
          </select>
        </div>
        {isOperador && <div className="min-w-0">
          <label className={labelCls} htmlFor="registration-tefCapacidad">Capacidad de tratamiento (t/mes) · opcional</label>
          <input id="registration-tefCapacidad" type="number" min="0" step="any" inputMode="decimal" className={inputCls()} value={form.tefCapacidad || ''} onChange={event => up('tefCapacidad', event.target.value)} />
        </div>}
      </div>
    </div>
  );
}
