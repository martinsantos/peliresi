import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Camera, Check, CheckCircle2, ChevronDown, ChevronUp, CircleMinus, FileSearch, Paperclip } from 'lucide-react';
import type { InspectionComparison, InspectionComparisonResult } from '../../types/inspection';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';
import { INSPECTION_PHOTO_ACCEPT } from '../../services/inspectionOfflineEvidence';

const OPTIONS: Array<{ value: InspectionComparisonResult; label: string; icon: React.ReactNode; active: string }> = [
  { value: 'COINCIDE', label: 'Coincide', icon: <CheckCircle2 size={17} />, active: 'border-emerald-600 bg-emerald-50 text-emerald-800' },
  { value: 'DIFIERE', label: 'Difiere', icon: <AlertTriangle size={17} />, active: 'border-error-500 bg-error-50 text-error-800' },
  { value: 'NO_VERIFICADO', label: 'No verificado', icon: <CircleMinus size={17} />, active: 'border-slate-500 bg-slate-100 text-slate-800' },
];

export function InspectionComparisonPanel({ inspectionId, comparisons, editable, onChange, onEvidence, embedded = false, onSave, saving = false, saveStatus, saveDisabled = false }: {
  inspectionId: string;
  comparisons: InspectionComparison[];
  editable: boolean;
  embedded?: boolean;
  onChange: (id: string, patch: Partial<InspectionComparison>) => void;
  onEvidence: (file: File, comparisonId: string) => void;
  onSave?: () => Promise<boolean>;
  saving?: boolean;
  saveStatus?: { tone: 'neutral' | 'warning' | 'success' | 'error'; message: string };
  saveDisabled?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const groups = useMemo(() => Array.from(new Set(comparisons.map((row) => row.categoria))), [comparisons]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const completed = comparisons.filter((row) => row.resultado !== 'PENDIENTE').length;
  const differences = comparisons.filter((row) => row.resultado === 'DIFIERE').length;
  let linkedCode = '';
  try { linkedCode = decodeURIComponent(location.hash.slice('#declaracion/'.length)); } catch { /* malformed anchors use the first category */ }
  const linkedRow = location.hash.startsWith('#declaracion/') ? comparisons.find((row) => row.codigo === linkedCode) : undefined;
  const linkedRowId = linkedRow?.id;
  const activeGroup = linkedRow?.categoria || (expandedGroup && groups.includes(expandedGroup) ? expandedGroup : groups[0] || null);
  const pending = comparisons.filter((row) => row.resultado === 'PENDIENTE');
  const openComparison = (row?: InspectionComparison) => {
    if (!row) return;
    setExpandedGroup(row.categoria);
    navigate({ pathname: location.pathname, search: location.search, hash: '#declaracion/' + encodeURIComponent(row.codigo) }, { replace: true });
    requestAnimationFrame(() => document.getElementById('comparison-' + row.id)?.scrollIntoView?.({ block: 'start', behavior: 'instant' }));
  };
  useEffect(() => {
    if (!linkedRowId) return;
    const frame = requestAnimationFrame(() => document.getElementById('comparison-' + linkedRowId)?.scrollIntoView?.({ block: 'start', behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [linkedRowId, location.hash]);
  const resultLabel = (row: InspectionComparison) => row.resultado === 'PENDIENTE' ? 'Pendiente de validar' : 'Revisado · ' + (row.resultado === 'NO_APLICA' ? 'No aplica' : OPTIONS.find((option) => option.value === row.resultado)?.label || row.resultado);

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

      <div className="border-b border-neutral-200 p-4 sm:px-6">
        <label className="block text-sm font-semibold text-neutral-700">Ir a un dato declarado
          <select aria-label="Ir a un dato declarado" value={linkedRow?.id || ''} onChange={(event) => openComparison(comparisons.find((row) => row.id === event.target.value))} className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-normal">
            <option value="" disabled>Elegir entre {comparisons.length} datos</option>
            {groups.map((group) => <optgroup key={group} label={group}>{comparisons.filter((row) => row.categoria === group).map((row) => <option key={row.id} value={row.id}>{row.codigo} · {resultLabel(row)} · {row.etiqueta}</option>)}</optgroup>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-neutral-600">{completed}/{comparisons.length} revisados · {pending.length} pendientes</p>
      </div>
      {groups.map((group) => {
        const rows = comparisons.filter((row) => row.categoria === group);
        const groupDone = rows.filter((row) => row.resultado !== 'PENDIENTE').length;
        return (
          <div key={group} className="border-b border-neutral-200 last:border-0">
            <button type="button" aria-expanded={activeGroup === group} onClick={() => openComparison(rows[0])} className="flex min-h-14 w-full items-center justify-between gap-3 bg-neutral-50 px-4 py-3 text-left sm:px-6">
              <span className="flex min-w-0 flex-wrap items-center gap-2.5"><FileSearch size={19} className="shrink-0 text-primary-700" /><span className="font-bold text-[#10213A]">{group}</span><span className="text-xs font-semibold text-neutral-600">{groupDone}/{rows.length} revisados · {rows.length - groupDone} pendientes</span></span>
              {activeGroup === group ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
            </button>
            {activeGroup === group && rows.map((row) => (
              <article key={row.id} id={'comparison-' + row.id} data-inspection-anchor={'declaracion/' + row.codigo} data-result={row.resultado} className={`scroll-mt-24 border-t border-neutral-100 px-4 py-5 first:border-t-0 sm:px-6 ${row.resultado === 'DIFIERE' ? 'border-l-[3px] border-l-error-500 bg-error-50/30 pl-[13px] sm:pl-[21px]' : ''}`}>
                <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="min-w-0 text-sm font-extrabold text-[#10213A]">{row.etiqueta}</p>
                    <p className="mt-1 text-xs font-medium text-neutral-600">Dato {comparisons.indexOf(row) + 1} de {comparisons.length} · {row.codigo}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.resultado === 'PENDIENTE' ? 'bg-warning-50 text-warning-800' : row.resultado === 'DIFIERE' ? 'bg-error-50 text-error-800' : 'bg-neutral-100 text-neutral-700'}`}>{resultLabel(row)}</span>
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
                <div className="mt-4 space-y-3 border-t border-neutral-200 pt-3">
                  {editable && onSave && <div>
                    <button type="button" disabled={saving || saveDisabled} onClick={() => void onSave()} className="min-h-11 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                    <p role="status" className={`mt-2 text-xs leading-relaxed ${saveStatus?.tone === 'error' ? 'text-error-800' : saveStatus?.tone === 'success' ? 'text-primary-800' : 'text-neutral-700'}`}>{saveStatus?.message || 'Guarda el borrador completo, incluidos este dato y su comentario.'}</p>
                  </div>}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href="#declaracion" onClick={(event) => { event.preventDefault(); document.getElementById('declaracion')?.scrollIntoView({ block: 'start' }); }} className="rounded-md px-2 py-3 text-xs font-semibold text-neutral-600 !no-underline hover:bg-neutral-100">Volver al índice de datos</a>
                    <button type="button" disabled={!pending.length} onClick={() => openComparison(pending.find((entry) => entry.id !== row.id) || pending[0])} className="min-h-11 rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-bold text-primary-800 disabled:bg-neutral-50 disabled:text-neutral-500">{pending.length ? 'Siguiente dato pendiente' : 'Datos revisados'}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        );
      })}
      <input ref={inputRef} type="file" accept={INSPECTION_PHOTO_ACCEPT} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file && targetId) onEvidence(file, targetId); event.currentTarget.value = ''; }} />
      {!editable && <div className="flex items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 sm:px-6"><Paperclip size={15} />Comparación en modo consulta. La edición depende de la etapa, los permisos y la disponibilidad del borrador.</div>}
    </section>
  );
}
