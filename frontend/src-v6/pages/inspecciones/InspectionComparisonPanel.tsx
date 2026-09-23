import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, ChevronDown, ChevronUp, CircleMinus, FileSearch, Paperclip, Search } from 'lucide-react';
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
  const orderedComparisons = useMemo(() => groups.flatMap((group) => comparisons.filter((row) => row.categoria === group)), [comparisons, groups]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [indexQuery, setIndexQuery] = useState('');
  const indexRef = useRef<HTMLDivElement | null>(null);
  const indexTriggerRef = useRef<HTMLButtonElement | null>(null);
  const indexSearchRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const initialHashRef = useRef(location.hash);
  const alignedInitialAnchorRef = useRef(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const completed = comparisons.filter((row) => row.resultado !== 'PENDIENTE').length;
  const differences = comparisons.filter((row) => row.resultado === 'DIFIERE').length;
  let linkedCode = '';
  try { linkedCode = decodeURIComponent(location.hash.slice('#declaracion/'.length)); } catch { /* malformed anchors use the first category */ }
  const linkedRow = location.hash.startsWith('#declaracion/') ? comparisons.find((row) => row.codigo === linkedCode) : undefined;
  const linkedRowId = linkedRow?.id;
  const activeGroup = linkedRow?.categoria || (expandedGroup && groups.includes(expandedGroup) ? expandedGroup : groups[0] || null);
  const pending = orderedComparisons.filter((row) => row.resultado === 'PENDIENTE');
  const matchingComparisons = orderedComparisons.filter((row) => `${row.etiqueta} ${row.categoria} ${row.codigo}`.toLocaleLowerCase('es').includes(indexQuery.trim().toLocaleLowerCase('es')));
  const nextPendingAfter = (row: InspectionComparison) => {
    const position = orderedComparisons.indexOf(row);
    return orderedComparisons.slice(position + 1).find((entry) => entry.resultado === 'PENDIENTE')
      || orderedComparisons.slice(0, position).find((entry) => entry.resultado === 'PENDIENTE');
  };
  const openComparison = (row?: InspectionComparison) => {
    if (!row) return;
    setIndexOpen(false);
    setIndexQuery('');
    setExpandedGroup(row.categoria);
    setExpandedRowId(row.id);
    const hash = '#declaracion/' + encodeURIComponent(row.codigo);
    const align = () => document.getElementById('comparison-' + row.id)?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    navigate({ pathname: location.pathname, search: location.search, hash }, { replace: true });
    requestAnimationFrame(align);
    // A browser may restore its scroll position after React commits.
    window.setTimeout(() => { if (window.location.hash === hash) align(); }, 120);
  };
  useEffect(() => {
    if (!indexOpen) return;
    indexSearchRef.current?.focus();
    const closeOnOutside = (event: PointerEvent) => {
      if (!indexRef.current?.contains(event.target as Node)) { setIndexOpen(false); setIndexQuery(''); }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIndexOpen(false);
      setIndexQuery('');
      indexTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [indexOpen]);
  useEffect(() => {
    if (!linkedRowId) return;
    const align = () => document.getElementById('comparison-' + linkedRowId)?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    const frame = requestAnimationFrame(align);
    // A browser may restore its old scroll position after the React tree paints
    // on reload. Only correct that initial deep link; a later timer must never
    // pull the inspector away from a control they have already scrolled to.
    const initialDeepLink = !alignedInitialAnchorRef.current && initialHashRef.current === location.hash;
    alignedInitialAnchorRef.current = true;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const restoration = initialDeepLink && navigation?.type === 'reload' ? window.setTimeout(align, 120) : null;
    return () => { cancelAnimationFrame(frame); if (restoration !== null) window.clearTimeout(restoration); };
  }, [linkedRowId, location.hash]);
  const resultLabel = (row: InspectionComparison) => row.resultado === 'PENDIENTE' ? 'Pendiente de validar' : 'Revisado · ' + (row.resultado === 'NO_APLICA' ? 'No aplica' : OPTIONS.find((option) => option.value === row.resultado)?.label || row.resultado);
  const toggleDetail = (row: InspectionComparison, expanded: boolean) => {
    if (expanded) {
      setExpandedRowId('');
      navigate({ pathname: location.pathname, search: location.search, hash: '#declaracion' }, { replace: true });
      return;
    }
    openComparison(row);
  };
  const selectResult = (row: InspectionComparison, result: InspectionComparisonResult) => {
    onChange(row.id, { resultado: result });
    if (result === 'DIFIERE') openComparison(row);
  };
  const declaredLines = (row: InspectionComparison) => (row.valorDeclarado || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const treatmentGroups = (row: InspectionComparison) => {
    const byDescription = new Map<string, string[]>();
    for (const line of declaredLines(row)) {
      const [code, ...description] = line.split(' · ');
      const detail = description.join(' · ') || 'Sin descripción declarada';
      byDescription.set(detail, [...(byDescription.get(detail) || []), code]);
    }
    return Array.from(byDescription, ([description, codes]) => ({ description, codes }));
  };
  const declaredPreview = (row: InspectionComparison) => {
    const lines = declaredLines(row);
    if (!lines.length) return 'Sin dato declarado';
    if (row.codigo === 'ACT-TRATAMIENTOS') return `${lines.length} ${lines.length === 1 ? 'tratamiento declarado' : 'tratamientos declarados'} · ${lines.map((line) => line.split(' · ')[0]).join(', ')}`;
    return lines.length > 1 ? `${lines[0]} · +${lines.length - 1} más` : lines[0];
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
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

      <div ref={indexRef} className="border-b border-neutral-200 p-4 sm:px-6">
        <button ref={indexTriggerRef} type="button" aria-label={`Ir a un dato declarado: ${linkedRow?.etiqueta || 'Buscar dato'}`} aria-expanded={indexOpen} aria-controls="comparison-jump-index" onClick={() => { if (indexOpen) setIndexQuery(''); setIndexOpen((open) => !open); }} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-semibold text-[#10213A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
          <span className="flex min-w-0 items-center gap-2"><Search size={17} className="shrink-0 text-primary-700" aria-hidden="true" /><span className="truncate">{linkedRow?.etiqueta || 'Ir a un dato declarado'}</span></span>
          {indexOpen ? <ChevronUp size={18} className="shrink-0 text-neutral-500" aria-hidden="true" /> : <ChevronDown size={18} className="shrink-0 text-neutral-500" aria-hidden="true" />}
        </button>
        <div id="comparison-jump-index" hidden={!indexOpen} className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {indexOpen && <>
          <label className="flex min-h-11 items-center gap-2 border-b border-neutral-200 px-3">
            <Search size={17} className="shrink-0 text-neutral-500" aria-hidden="true" />
            <span className="sr-only">Buscar dato declarado</span>
            <input ref={indexSearchRef} type="search" value={indexQuery} onChange={(event) => setIndexQuery(event.target.value)} placeholder="Nombre, categoría o código" className="min-h-11 w-full min-w-0 bg-transparent text-sm text-[#10213A] outline-none placeholder:text-neutral-500" />
          </label>
          <nav aria-label="Datos declarados" className="max-h-[min(50dvh,22rem)] overflow-y-auto overscroll-contain py-1">
            {matchingComparisons.length ? matchingComparisons.map((row) => {
              const position = orderedComparisons.indexOf(row) + 1;
              const status = row.resultado === 'PENDIENTE' ? 'Pendiente' : row.resultado === 'COINCIDE' ? 'Coincide' : row.resultado === 'DIFIERE' ? 'Difiere' : 'No verificado';
              return <button key={row.id} type="button" aria-current={linkedRow?.id === row.id ? 'location' : undefined} onClick={() => openComparison(row)} className={`flex min-h-12 w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 ${linkedRow?.id === row.id ? 'bg-primary-50' : ''}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">{position}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-snug text-[#10213A]">{row.etiqueta}</span><span className="block text-xs text-neutral-600">{row.categoria}</span></span>
                <span className={`shrink-0 text-xs font-semibold ${row.resultado === 'DIFIERE' ? 'text-error-700' : row.resultado === 'COINCIDE' ? 'text-primary-700' : 'text-neutral-600'}`}>{status}</span>
              </button>;
            }) : <p className="px-4 py-4 text-sm text-neutral-600">No hay datos con ese nombre.</p>}
          </nav>
          </>}
        </div>
      </div>
      {groups.map((group) => {
        const rows = comparisons.filter((row) => row.categoria === group);
        const groupDone = rows.filter((row) => row.resultado !== 'PENDIENTE').length;
        return (
          <div key={group} className="border-b border-neutral-200 last:border-0">
            <button type="button" aria-expanded={activeGroup === group} onClick={() => openComparison(rows[0])} style={{ top: 'var(--inspection-middle-top, 0px)' }} className="sticky z-10 flex min-h-11 w-full items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-left sm:px-6">
              <span className="flex min-w-0 flex-wrap items-center gap-2.5"><FileSearch size={19} className="shrink-0 text-primary-700" /><span className="font-bold text-[#10213A]">{group}</span><span className="text-xs font-semibold text-neutral-600">{groupDone}/{rows.length} revisados{groupDone < rows.length ? ` · ${rows.length - groupDone} pendientes` : ''}</span></span>
              {activeGroup === group ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
            </button>
            {activeGroup === group && rows.map((row) => {
              const expanded = linkedRow ? linkedRow.id === row.id : expandedRowId === null ? rows[0]?.id === row.id : expandedRowId === row.id;
              return <article key={row.id} id={'comparison-' + row.id} data-inspection-anchor={'declaracion/' + row.codigo} data-result={row.resultado} style={{ scrollMarginTop: 'var(--inspection-anchor-offset, 8rem)' }} className={`border-t border-neutral-100 px-4 py-3 first:border-t-0 sm:px-6 ${row.resultado === 'DIFIERE' ? 'border-l-[3px] border-l-error-500 bg-error-50/30 pl-[13px] sm:pl-[21px]' : ''}`}>
                <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,350px)] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-500">{orderedComparisons.indexOf(row) + 1}/{comparisons.length}</span><h4 className="min-w-0 text-sm font-bold text-[#10213A]">{row.etiqueta}</h4><span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${row.resultado === 'PENDIENTE' ? 'bg-warning-50 text-warning-900' : row.resultado === 'DIFIERE' ? 'bg-error-50 text-error-800' : row.resultado === 'COINCIDE' ? 'bg-success-50 text-success-800' : 'bg-neutral-100 text-neutral-700'}`}>{resultLabel(row)}</span></div>
                    <p className="mt-1 truncate text-xs leading-relaxed text-neutral-600" title={declaredPreview(row)}>{declaredPreview(row)}</p>
                    <button type="button" aria-expanded={expanded} aria-controls={'comparison-detail-' + row.id} onClick={() => toggleDetail(row, expanded)} className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-md text-xs font-semibold text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{expanded ? 'Ocultar detalle' : row.observacion || row.valorObservado || row.evidencias.length ? 'Ver detalle y evidencia' : 'Agregar detalle'}{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                  </div>
                  <div role="group" aria-label={`Resultado: ${row.etiqueta}`} className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3">
                    {OPTIONS.map((option, index) => {
                      const selected = row.resultado === option.value;
                      return <button key={option.value} type="button" aria-pressed={selected} disabled={!editable} onClick={() => selectResult(row, option.value)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg border px-1.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${index === OPTIONS.length - 1 ? 'col-span-2 min-[420px]:col-span-1' : ''} ${selected ? option.active : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'} disabled:cursor-default`}>{option.icon}<span>{option.label}</span></button>;
                    })}
                  </div>
                </div>
                {expanded && <div id={'comparison-detail-' + row.id} className="mt-3 border-t border-neutral-200 pt-3">
                  <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] md:items-start">
                    <div className="min-w-0 rounded-lg bg-neutral-100 px-3 py-3">
                      <span className="text-xs font-semibold text-neutral-600">Declarado</span>
                      {row.codigo === 'ACT-TRATAMIENTOS' && declaredLines(row).length > 0 ? <ul className="mt-2 space-y-2">{treatmentGroups(row).map(({ description, codes }) => <li key={description} className="min-w-0 border-t border-neutral-200 pt-2 first:border-0 first:pt-0"><div className="mb-1 flex flex-wrap gap-1">{codes.map((code) => <span key={code} className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-primary-800">{code}</span>)}</div><p className="break-words text-sm font-normal leading-relaxed text-[#10213A]">{description}</p></li>)}</ul> : <p className="mt-1 whitespace-pre-line break-words text-sm font-normal leading-relaxed text-[#10213A]">{row.valorDeclarado || 'Sin dato declarado'}</p>}
                    </div>
                    <div className="hidden justify-center pt-9 text-neutral-400 md:flex"><ArrowRight size={17} aria-hidden="true" /></div>
                    <label className="block min-w-0"><span className="text-xs font-semibold text-neutral-600">Verificado en campo</span><textarea aria-label={`Valor verificado: ${row.etiqueta}`} disabled={!editable} rows={3} value={row.valorObservado || ''} onChange={(event) => onChange(row.id, { valorObservado: event.target.value })} placeholder="Qué encontraste en campo" className="mt-2 min-h-20 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-[#10213A] outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50" /></label>
                  </div>
                  {(row.resultado === 'DIFIERE' || row.observacion || row.evidencias.length > 0) && <div className="mt-3 grid gap-3 border-l-2 border-error-300 pl-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="block"><span className="mb-1 block text-xs font-bold text-error-800">Hallazgo y acción requerida</span><textarea aria-label={`Hallazgo: ${row.etiqueta}`} disabled={!editable} rows={2} value={row.observacion || ''} onChange={(event) => onChange(row.id, { observacion: event.target.value })} placeholder="Explicá la diferencia y qué debe corregirse" className="w-full resize-y rounded-lg border border-error-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-error-500 focus:ring-2 focus:ring-error-100 disabled:bg-neutral-50" /></label><div className="flex flex-wrap items-start gap-2">{row.evidencias.filter((e) => e.tipo === 'FOTO').map((evidence) => <InspectionEvidenceImage key={evidence.id} inspectionId={inspectionId} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} className="h-16 w-20 rounded-lg object-cover" />)}{editable && <button type="button" onClick={() => { setTargetId(row.id); inputRef.current?.click(); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-neutral-400 px-3 text-xs font-bold text-neutral-700"><Camera size={17} />Foto</button>}</div></div>}
                  <div className="mt-3 flex min-h-14 flex-col gap-2 border-t border-neutral-200 pt-3 sm:flex-row sm:items-center sm:justify-between"><p role="status" className={`min-w-0 text-xs leading-relaxed ${saveStatus?.tone === 'error' ? 'text-error-800' : saveStatus?.tone === 'success' ? 'text-primary-800' : 'text-neutral-700'}`}>{saveStatus?.message || 'Los cambios aún no se guardaron en el servidor.'}</p>{editable && onSave && <button type="button" disabled={saving || saveDisabled} onClick={() => void onSave()} className="min-h-11 shrink-0 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar cambios'}</button>}</div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><a href="#declaracion" onClick={(event) => { event.preventDefault(); document.getElementById('declaracion')?.scrollIntoView({ block: 'start' }); }} className="rounded-md px-2 py-3 text-xs font-semibold text-neutral-600 !no-underline hover:bg-neutral-100">Volver al índice de datos</a><button type="button" disabled={!nextPendingAfter(row)} onClick={() => openComparison(nextPendingAfter(row))} className="min-h-11 rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-bold text-primary-800 disabled:bg-neutral-50 disabled:text-neutral-500">{nextPendingAfter(row) ? 'Siguiente dato pendiente' : pending.length ? 'Último dato pendiente' : 'Datos revisados'}</button></div>
                </div>}
              </article>;
            })}
          </div>
        );
      })}
      <input ref={inputRef} type="file" accept={INSPECTION_PHOTO_ACCEPT} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file && targetId) onEvidence(file, targetId); event.currentTarget.value = ''; }} />
      {!editable && <div className="flex items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 sm:px-6"><Paperclip size={15} />Comparación en modo consulta. La edición depende de la etapa, los permisos y la disponibilidad del borrador.</div>}
    </section>
  );
}
