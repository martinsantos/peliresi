import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Camera, Check, CheckCircle2, ChevronDown, ChevronUp, CircleMinus, FileSearch, Paperclip } from 'lucide-react';
import type { InspectionComparison, InspectionComparisonResult } from '../../types/inspection';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';

const OPTIONS: Array<{ value: InspectionComparisonResult; label: string; icon: React.ReactNode; active: string }> = [
  { value: 'COINCIDE', label: 'Coincide', icon: <CheckCircle2 size={17} />, active: 'border-emerald-600 bg-emerald-50 text-emerald-800' },
  { value: 'DIFIERE', label: 'Difiere', icon: <AlertTriangle size={17} />, active: 'border-error-500 bg-error-50 text-error-800' },
  { value: 'NO_VERIFICADO', label: 'No verificado', icon: <CircleMinus size={17} />, active: 'border-slate-500 bg-slate-100 text-slate-800' },
];

export function InspectionComparisonPanel({ inspectionId, comparisons, editable, onChange, onEvidence, embedded = false }: {
  inspectionId: string;
  comparisons: InspectionComparison[];
  editable: boolean;
  embedded?: boolean;
  onChange: (id: string, patch: Partial<InspectionComparison>) => void;
  onEvidence: (file: File, comparisonId: string) => void;
}) {
  const groups = useMemo(() => Array.from(new Set(comparisons.map((row) => row.categoria))), [comparisons]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const completed = comparisons.filter((row) => row.resultado !== 'PENDIENTE').length;
  const differences = comparisons.filter((row) => row.resultado === 'DIFIERE').length;
  const activeGroup = expandedGroup && groups.includes(expandedGroup) ? expandedGroup : groups[0] || null;

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {!embedded && <div className="border-b border-neutral-200 px-4 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-[#10213A]">Declarado vs. verificado</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-600">Compare la fotografía de datos declarados al abrir el expediente con lo observado en campo.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-bold">
            {differences > 0 && <span className="rounded-full bg-error-50 px-2.5 py-1 text-error-700">{differences} {differences === 1 ? 'diferencia' : 'diferencias'}</span>}
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-primary-700">{completed}/{comparisons.length}</span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full rounded-full bg-primary-600 transition-[width] duration-200" style={{ width: `${Math.round((completed / Math.max(1, comparisons.length)) * 100)}%` }} /></div>
      </div>}

      {groups.map((group) => {
        const rows = comparisons.filter((row) => row.categoria === group);
        const groupDone = rows.filter((row) => row.resultado !== 'PENDIENTE').length;
        return (
          <div key={group} className="border-b border-neutral-200 last:border-0">
            <button type="button" aria-expanded={activeGroup === group} onClick={() => setExpandedGroup(group)} className="flex min-h-14 w-full items-center justify-between gap-3 bg-neutral-50 px-4 text-left sm:px-6">
              <span className="flex min-w-0 items-center gap-2.5"><FileSearch size={19} className="shrink-0 text-primary-700" /><span className="truncate font-bold text-[#10213A]">{group}</span><span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-200">{groupDone}/{rows.length}</span></span>
              {activeGroup === group ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
            </button>
            {activeGroup === group && rows.map((row) => (
              <article key={row.id} data-result={row.resultado} className={`border-t border-neutral-100 px-4 py-5 first:border-t-0 sm:px-6 ${row.resultado === 'DIFIERE' ? 'border-l-[3px] border-l-error-500 bg-error-50/30 pl-[13px] sm:pl-[21px]' : ''}`}>
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="min-w-0 text-sm font-extrabold text-[#10213A]">{row.etiqueta}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{row.codigo}</p>
                  </div>
                  {row.resultado === 'PENDIENTE' ? <span className="shrink-0 rounded-full bg-warning-50 px-2.5 py-1 text-[11px] font-bold text-warning-800">Pendiente de validar</span> : row.codigo.startsWith('RES-Y') ? <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-extrabold text-primary-800">Validación individual</span> : null}
                </div>
                <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] md:items-stretch">
                  <div className="rounded-xl bg-neutral-100 px-4 py-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Declarado</span>
                    <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-relaxed text-[#10213A]">{row.valorDeclarado || 'Sin dato declarado'}</p>
                  </div>
                  <div className="hidden items-center justify-center text-neutral-400 md:flex"><ArrowRight size={17} aria-hidden="true" /></div>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Verificado en campo</span>
                    <textarea aria-label={`Valor verificado: ${row.etiqueta}`} disabled={!editable} rows={Math.min(3, Math.max(1, (row.valorDeclarado || '').split('\n').length))} value={row.valorObservado || ''} onChange={(event) => onChange(row.id, { valorObservado: event.target.value })} placeholder="Escriba qué encontró en campo" className="mt-1 min-h-12 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-medium leading-relaxed text-[#10213A] outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50" />
                  </label>
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Resultado de la verificación</p>
                  <div role="group" aria-label={`Resultado: ${row.etiqueta}`} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {OPTIONS.map((option, index) => {
                      const selected = row.resultado === option.value;
                      return <button key={option.value} type="button" aria-pressed={selected} disabled={!editable} onClick={() => onChange(row.id, { resultado: option.value })} className={`relative flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:px-3 sm:text-sm ${index === OPTIONS.length - 1 ? 'col-span-2 sm:col-span-1' : ''} ${selected ? option.active : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'} disabled:cursor-default`}>
                        {option.icon}<span>{option.label}</span>{selected && <Check size={14} className="absolute right-2" aria-hidden="true" />}
                      </button>;
                    })}
                  </div>
                </div>
                {(row.resultado === 'DIFIERE' || row.observacion || row.evidencias.length > 0) && (
                  <div className="mt-3 grid gap-3 border-l-2 border-error-300 pl-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block"><span className="mb-1 block text-xs font-bold text-error-800">Hallazgo y acción requerida</span><textarea aria-label={`Hallazgo: ${row.etiqueta}`} disabled={!editable} rows={2} value={row.observacion || ''} onChange={(event) => onChange(row.id, { observacion: event.target.value })} placeholder="Explique la diferencia y qué debe corregirse" className="w-full resize-y rounded-xl border border-error-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-error-500 focus:ring-2 focus:ring-error-100 disabled:bg-neutral-50" /></label>
                    <div className="flex flex-wrap items-start gap-2">
                      {row.evidencias.filter((e) => e.tipo === 'FOTO').map((evidence) => <InspectionEvidenceImage key={evidence.id} inspectionId={inspectionId} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} className="h-16 w-20 rounded-lg object-cover" />)}
                      {editable && <button type="button" onClick={() => { setTargetId(row.id); inputRef.current?.click(); }} className="flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-neutral-400 px-3 text-xs font-bold text-neutral-700"><Camera size={17} />Foto</button>}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        );
      })}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file && targetId) onEvidence(file, targetId); event.currentTarget.value = ''; }} />
      {!editable && <div className="flex items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 sm:px-6"><Paperclip size={15} />La comparación quedó preservada al cerrar la etapa de campo.</div>}
    </section>
  );
}
