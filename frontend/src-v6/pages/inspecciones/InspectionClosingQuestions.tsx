import React from 'react';
import type { InspectionActData } from '../../types/inspection';

// The six statements the dossier approval needs, asked as one-tap questions. A detail box opens
// only when the answer calls for one. The same keys feed the act and the technical review.
type Question = { key: keyof InspectionActData; detail: keyof InspectionActData; title: string; options: Array<[string, string]>; detailFor: string[]; detailLabel: string };
const QUESTIONS: Question[] = [
  { key: 'danosEstado', detail: 'danosDetalle', title: '¿Hubo daños a personas o bienes?', options: [['NO_OBSERVADOS', 'No se observaron'], ['OBSERVADOS', 'Sí, se observaron']], detailFor: ['OBSERVADOS'], detailLabel: 'Qué daños y dónde' },
  { key: 'tercerosTestigosEstado', detail: 'tercerosTestigosDetalle', title: '¿Había terceros o testigos?', options: [['NO_IDENTIFICADOS', 'No'], ['IDENTIFICADOS', 'Sí']], detailFor: ['IDENTIFICADOS'], detailLabel: 'Quiénes y cómo participaron' },
  { key: 'libroOperacionesEstado', detail: 'libroOperacionesDetalle', title: '¿Exhibieron el Libro de Registro de Operaciones?', options: [['EXHIBIDO', 'Sí, verificado'], ['NO_EXHIBIDO', 'No lo exhibieron'], ['NO_DISPONIBLE', 'No disponible'], ['NO_APLICA', 'No aplica']], detailFor: ['EXHIBIDO', 'NO_EXHIBIDO', 'NO_DISPONIBLE'], detailLabel: 'Constancia del libro' },
  { key: 'firmaIntervinienteEstado', detail: 'firmaIntervinienteDetalle', title: '¿Firmó la persona que atendió?', options: [['FIRMADA', 'Sí, firmó'], ['NEGATIVA', 'Se negó'], ['IMPOSIBILIDAD', 'No pudo'], ['AUSENTE', 'No había nadie']], detailFor: ['NEGATIVA', 'IMPOSIBILIDAD', 'AUSENTE'], detailLabel: 'Constancia de la negativa, imposibilidad o ausencia' },
  { key: 'copiaActaEstado', detail: 'copiaActaDetalle', title: '¿Entregaste copia del acta?', options: [['ENTREGADA', 'Sí'], ['NEGATIVA_RECEPCION', 'No quisieron recibirla'], ['NO_ENTREGADA', 'No se entregó']], detailFor: ['NEGATIVA_RECEPCION', 'NO_ENTREGADA'], detailLabel: 'Constancia de la entrega' },
  { key: 'notificacionEstado', detail: 'notificacionDetalle', title: '¿Comunicaste lo actuado y los derechos?', options: [['COMUNICADA_EN_ACTA', 'Sí, en el acta'], ['CONSTANCIA_FORMAL', 'Con constancia formal'], ['NO_REALIZADA', 'No']], detailFor: ['CONSTANCIA_FORMAL', 'NO_REALIZADA'], detailLabel: 'Constancia de la comunicación' },
];
const PENDING = new Set(['', 'PENDIENTE', 'NO_VERIFICADO']);

export function InspectionClosingQuestions({ value, onChange, disabled }: { value: InspectionActData; onChange: (v: InspectionActData) => void; disabled: boolean }) {
  const update = (key: keyof InspectionActData, next: string | undefined) => onChange({ ...value, [key]: next });
  const answered = QUESTIONS.filter(q => !PENDING.has(String(value[q.key] || ''))).length;
  return <section aria-label="Constancias de la visita" className="space-y-5">
    <p className="text-sm text-neutral-600">{answered} de {QUESTIONS.length} respondidas · la aprobación las necesita.</p>
    {QUESTIONS.map(q => {
      const current = String(value[q.key] || '');
      const detailOpen = q.detailFor.includes(current) || Boolean(value[q.detail]);
      return <fieldset key={q.key} className="space-y-2">
        <legend className="text-base font-semibold text-neutral-900">{q.title}</legend>
        <div role="group" aria-label={q.title} className="flex flex-wrap gap-2">
          {q.options.map(([option, text]) => <button key={option} type="button" disabled={disabled} aria-pressed={current === option} onClick={() => update(q.key, current === option ? undefined : option)}
            className={`min-h-12 rounded-lg border px-3 text-sm font-semibold disabled:opacity-60 ${current === option ? 'border-green-800 bg-green-800 text-white' : 'border-neutral-400 bg-white text-neutral-800'}`}>{text}</button>)}
        </div>
        {detailOpen && <label className="block text-sm font-medium text-neutral-800">{q.detailLabel}<textarea rows={2} disabled={disabled} value={String(value[q.detail] || '')} onChange={e => update(q.detail, e.target.value || undefined)} className="mt-1 min-h-12 w-full rounded-lg border border-neutral-400 bg-white p-3 text-base font-normal text-neutral-900 disabled:bg-neutral-50" /></label>}
      </fieldset>;
    })}
  </section>;
}
