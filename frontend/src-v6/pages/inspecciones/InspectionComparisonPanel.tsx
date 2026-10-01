import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, ChevronDown, ChevronUp, CircleMinus, Download, FileSearch, Paperclip, Search } from 'lucide-react';
import type { InspectionComparison, InspectionComparisonResult, InspectionDeclaredDocument } from '../../types/inspection';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';
import { INSPECTION_PHOTO_ACCEPT } from '../../services/inspectionOfflineEvidence';
import { inspeccionService } from '../../services/inspeccion.service';
import { toast } from '../../components/ui/Toast';
import { revealInspectionAnchor, preserveInspectionAnchor } from './inspectionScroll';

const OPTIONS: Array<{ value: InspectionComparisonResult; label: string; icon: React.ReactNode; active: string }> = [
  { value: 'COINCIDE', label: 'Coincide', icon: <CheckCircle2 size={17} />, active: 'border-emerald-600 bg-emerald-50 text-emerald-800' },
  { value: 'DIFIERE', label: 'Difiere', icon: <AlertTriangle size={17} />, active: 'border-error-500 bg-error-50 text-error-800' },
  { value: 'NO_VERIFICADO', label: 'No verificado', icon: <CircleMinus size={17} />, active: 'border-slate-500 bg-slate-100 text-slate-800' },
];
const BLOCK_SIZE = 6;

export function InspectionComparisonPanel({ inspectionId, comparisons, declaredDocuments = [], editable, onChange, onEvidence, embedded = false, onSave, saving = false, saveStatus, saveDisabled = false }: {
  inspectionId: string;
  comparisons: InspectionComparison[];
  declaredDocuments?: InspectionDeclaredDocument[];
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
  // Independent groups do not collapse content above the inspector's finger.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(groups.slice(0, 1)));
  const [expandedRow, setExpandedRow] = useState<{ id: string; hash: string } | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [reviewSelection, setReviewSelection] = useState(false);
  const [blockByGroup, setBlockByGroup] = useState<Record<string, number>>({});
  const [blockRevealId, setBlockRevealId] = useState<string | null>(null);
  const toggleSelected = (id: string) => { setReviewSelection(false); setSelectedRows((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]); };
  const [indexQuery, setIndexQuery] = useState('');
  const indexRef = useRef<HTMLDivElement | null>(null);
  const indexTriggerRef = useRef<HTMLButtonElement | null>(null);
  const indexSearchRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const preserveAnchor = useRef<(() => void) | null>(null);
  const pendingScrollHash = useRef<string | null>(null);
  const handledScrollHash = useRef<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const completed = comparisons.filter((row) => row.resultado !== 'PENDIENTE').length;
  const differences = comparisons.filter((row) => row.resultado === 'DIFIERE').length;
  let linkedCode = '';
  try { linkedCode = decodeURIComponent(location.hash.slice('#declaracion/'.length)); } catch { /* malformed anchors use the first category */ }
  const linkedRow = location.hash.startsWith('#declaracion/') ? comparisons.find((row) => row.codigo === linkedCode) : undefined;
  const linkedRowId = linkedRow?.id;
  const groupIsOpen = (group: string) => expandedGroups.has(group) || linkedRow?.categoria === group;
  const blockFor = (group: string, rows: InspectionComparison[]) => linkedRow?.categoria === group
    ? Math.floor(rows.findIndex((row) => row.id === linkedRow.id) / BLOCK_SIZE)
    : Math.min(blockByGroup[group] || 0, Math.max(0, Math.ceil(rows.length / BLOCK_SIZE) - 1));
  const visibleComparisons = groups.filter(groupIsOpen).flatMap((group) => {
    const rows = comparisons.filter((row) => row.categoria === group);
    const block = blockFor(group, rows);
    return rows.slice(block * BLOCK_SIZE, (block + 1) * BLOCK_SIZE);
  });
  const selectedPending = visibleComparisons.filter((row) => row.resultado === 'PENDIENTE' && selectedRows.includes(row.id));
  const matchingComparisons = orderedComparisons.filter((row) => `${row.etiqueta} ${row.categoria} ${row.codigo}`.toLocaleLowerCase('es').includes(indexQuery.trim().toLocaleLowerCase('es')));
  const nextPendingAfter = (row: InspectionComparison) => {
    const position = orderedComparisons.indexOf(row);
    return orderedComparisons.slice(position + 1).find((entry) => entry.resultado === 'PENDIENTE')
      || orderedComparisons.slice(0, position).find((entry) => entry.resultado === 'PENDIENTE');
  };
  const openComparison = (row?: InspectionComparison, align = true) => {
    if (!row) return;
    preserveAnchor.current = !align ? preserveInspectionAnchor(document.getElementById('comparison-' + row.id)) : null;
    setSelectedRows([]);
    setReviewSelection(false);
    setIndexOpen(false);
    setIndexQuery('');
    setExpandedGroups((current) => new Set([...current, row.categoria]));
    setBlockByGroup((current) => ({ ...current, [row.categoria]: Math.floor(comparisons.filter((entry) => entry.categoria === row.categoria).findIndex((entry) => entry.id === row.id) / BLOCK_SIZE) }));
    const hash = '#declaracion/' + encodeURIComponent(row.codigo);
    pendingScrollHash.current = hash;
    setExpandedRow({ id: row.id, hash });
    navigate({ pathname: location.pathname, search: location.search, hash }, { replace: true });
  };
  useEffect(() => {
    if (!indexOpen) return;
    indexSearchRef.current?.focus({ preventScroll: true });
    const closeOnOutside = (event: PointerEvent) => {
      if (!indexRef.current?.contains(event.target as Node)) { setIndexOpen(false); setIndexQuery(''); }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIndexOpen(false);
      setIndexQuery('');
      indexTriggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [indexOpen]);
  useLayoutEffect(() => {
    if (pendingScrollHash.current !== null && pendingScrollHash.current !== location.hash) return;
    if (pendingScrollHash.current === null && handledScrollHash.current === location.hash) return;
    pendingScrollHash.current = null;
    handledScrollHash.current = location.hash;
    if (preserveAnchor.current) { preserveAnchor.current(); preserveAnchor.current = null; return; }
    if (!linkedRowId) return;
    const frame = requestAnimationFrame(() => revealInspectionAnchor(document.getElementById('comparison-' + linkedRowId)));
    return () => cancelAnimationFrame(frame);
  }, [linkedRowId, location.hash, expandedGroups, expandedRow, comparisons]);
  useLayoutEffect(() => {
    if (!blockRevealId) return;
    const frame = requestAnimationFrame(() => {
      revealInspectionAnchor(document.getElementById('comparison-' + blockRevealId));
      setBlockRevealId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [blockRevealId]);
  const changeBlock = (group: string, block: number, rows: InspectionComparison[]) => {
    setSelectedRows([]);
    setReviewSelection(false);
    setExpandedRow(null);
    setExpandedGroups((current) => new Set([...current, group]));
    setBlockByGroup((current) => ({ ...current, [group]: block }));
    setBlockRevealId(rows[block * BLOCK_SIZE]?.id || null);
    navigate({ pathname: location.pathname, search: location.search, hash: '#declaracion' }, { replace: true });
  };
  const downloadDeclaredDocument = async (document: InspectionDeclaredDocument) => {
    setDownloadingDocumentId(document.id);
    try {
      await inspeccionService.downloadDeclaredDocument(document.id, document.nombre);
    } catch {
      toast.error('No se pudo descargar el documento', 'El archivo citado sigue identificado en la fotografía del expediente.');
    } finally {
      setDownloadingDocumentId(null);
    }
  };
  const toggleDetail = (row: InspectionComparison, expanded: boolean) => {
    if (expanded) {
      preserveAnchor.current = preserveInspectionAnchor(document.getElementById('comparison-' + row.id));
      pendingScrollHash.current = '#declaracion';
      setExpandedRow({ id: '', hash: '#declaracion' });
      navigate({ pathname: location.pathname, search: location.search, hash: '#declaracion' }, { replace: true });
      return;
    }
    openComparison(row, false);
  };
  const selectResult = (row: InspectionComparison, result: InspectionComparisonResult) => {
    preserveAnchor.current = preserveInspectionAnchor(document.getElementById('comparison-' + row.id));
    pendingScrollHash.current = location.hash;
    onChange(row.id, { resultado: result });
    // Revealing a finding must not scroll the inspector away from the decision
    // they just made. The explicit index/next actions are the only jump points.
    if (result === 'DIFIERE' || result === 'NO_VERIFICADO') setExpandedRow({ id: row.id, hash: location.hash });
  };
  const toggleGroup = (group: string, button: HTMLButtonElement) => {
    preserveAnchor.current = preserveInspectionAnchor(button);
    const closing = groupIsOpen(group);
    pendingScrollHash.current = closing && linkedRow?.categoria === group ? '#declaracion' : location.hash;
    setExpandedGroups((current) => { const next = new Set(current); if (closing) next.delete(group); else next.add(group); return next; });
    setSelectedRows([]);
    setReviewSelection(false);
    if (closing && linkedRow?.categoria === group) {
      setExpandedRow(null);
      navigate({ pathname: location.pathname, search: location.search, hash: '#declaracion' }, { replace: true });
    }
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
    if (row.codigo === 'ACT-TRATAMIENTOS') {
      const codes = lines.map((line) => line.split(' · ')[0]);
      return `${lines.length} ${lines.length === 1 ? 'tratamiento declarado' : 'tratamientos declarados'} · ${codes.slice(0, 3).join(', ')}${codes.length > 3 ? ` y ${codes.length - 3} más` : ''}`;
    }
    return lines.length > 1 ? `${lines[0]} · +${lines.length - 1} más` : lines[0];
  };

  return (
    <section className={embedded ? "min-w-0 bg-white" : "rounded-xl border border-neutral-200 bg-white"}>
      {embedded && <div className="border-b border-neutral-300 pb-4"><h2 className="flex items-center gap-2 text-base font-bold text-primary-900"><FileSearch size={20} aria-hidden="true" />Contraste con lo declarado</h2><p className="mb-3 mt-1 text-sm text-neutral-700">Compará el registro con lo que verificaste en el lugar.</p><p className="text-sm font-semibold text-neutral-800">{completed} de {comparisons.length} revisados{differences > 0 && <span className="text-error-800"> · {differences} diferencias</span>}</p><div role="progressbar" aria-label="Datos declarados revisados" aria-valuemin={0} aria-valuemax={comparisons.length} aria-valuenow={completed} className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full rounded-full bg-primary-700" style={{ width: `${100 * completed / Math.max(1, comparisons.length)}%` }} /></div></div>}
      {!embedded && <div className="border-b border-neutral-200 px-4 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-[#10213A]">Lo informado y lo encontrado</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-700">Primero leé el dato informado cuando se abrió el expediente. Después marcá lo que pudiste comprobar en campo.</p>
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
      {editable && comparisons.length > 6 && <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <button type="button" aria-pressed={bulkMode} onClick={() => { setBulkMode((value) => !value); setSelectedRows([]); setReviewSelection(false); }} className="min-h-11 text-sm font-semibold text-primary-800">{bulkMode ? 'Salir de selección múltiple' : 'Selección múltiple'}</button>
        {bulkMode && <><span className="text-sm text-neutral-600">{selectedPending.length} seleccionados</span><button type="button" disabled={!selectedPending.length} onClick={() => setReviewSelection(true)} className="min-h-11 rounded-lg bg-primary-700 px-3 text-sm font-semibold text-white disabled:opacity-50">Revisar coincidencias</button><p className="w-full text-xs text-neutral-600">Seleccioná sólo lo que verificaste en el bloque visible. Las diferencias conservan su resultado.</p></>}
        {bulkMode && reviewSelection && selectedPending.length > 0 && <div role="region" aria-label="Revisión de coincidencias" className="w-full border-t border-neutral-200 pt-3">
          <h4 className="text-sm font-bold text-neutral-900">Confirmar {selectedPending.length} coincidencias</h4>
          <p className="mt-1 text-sm text-neutral-700">Esta decisión se aplicará únicamente a estos datos:</p>
          <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-sm text-neutral-800">{selectedPending.map((row) => <li key={row.id}>{row.etiqueta} · {row.codigo}</li>)}</ul>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { selectedPending.forEach((row) => onChange(row.id, { resultado: 'COINCIDE' })); setSelectedRows([]); setReviewSelection(false); }} className="min-h-11 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white">Aplicar a {selectedPending.length} datos</button><button type="button" onClick={() => setReviewSelection(false)} className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-800">Volver a seleccionar</button></div>
        </div>}
      </div>}
      {groups.map((group) => {
        const rows = comparisons.filter((row) => row.categoria === group);
        const open = groupIsOpen(group);
        const activeBlock = blockFor(group, rows);
        const visibleRows = rows.slice(activeBlock * BLOCK_SIZE, (activeBlock + 1) * BLOCK_SIZE);
        const groupDone = rows.filter((row) => row.resultado !== 'PENDIENTE').length;
        return (
          <div key={group} className="mt-5">
            <button type="button" aria-expanded={open} onClick={(event) => toggleGroup(group, event.currentTarget)} style={{ top: 'var(--inspection-middle-top, 0px)' }} className="sticky z-10 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-3 text-left sm:px-5">
              <span className="flex min-w-0 flex-wrap items-center gap-2.5"><FileSearch size={19} className="shrink-0 text-primary-700" /><span className="font-bold text-[#10213A]">{group}</span><span className="text-xs font-semibold text-neutral-600">{groupDone}/{rows.length} revisados{groupDone < rows.length ? ` · ${rows.length - groupDone} pendientes` : ''}</span></span>
              {open ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
            </button>
            {open && rows.length > BLOCK_SIZE && <p className="px-3 py-3 text-sm text-neutral-700 sm:px-5">Mostrando {activeBlock * BLOCK_SIZE + 1}–{Math.min(rows.length, (activeBlock + 1) * BLOCK_SIZE)} de {rows.length}</p>}
            {open && bulkMode && editable && <label className="flex min-h-12 items-center gap-3 border-b border-neutral-100 px-4 text-sm text-neutral-700"><input type="checkbox" aria-label={`Seleccionar pendientes de este bloque · ${group}`} className="h-5 w-5 accent-primary-700" checked={visibleRows.some((row) => row.resultado === 'PENDIENTE') && visibleRows.filter((row) => row.resultado === 'PENDIENTE').every((row) => selectedRows.includes(row.id))} onChange={(event) => { const ids = visibleRows.filter((row) => row.resultado === 'PENDIENTE').map((row) => row.id); setReviewSelection(false); setSelectedRows((current) => event.target.checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id))); }} />Seleccionar pendientes de este bloque</label>}
            {open && visibleRows.map((row) => {
              const expanded = expandedRow?.hash === location.hash ? expandedRow.id === row.id : linkedRow?.id === row.id;
              const showFullDeclared = declaredLines(row).length > 1 || (row.valorDeclarado || '').length > 120 || (row.codigo === 'DOC-VIGENTES' && declaredDocuments.length > 0);
              return <article key={row.id} id={'comparison-' + row.id} data-inspection-anchor={'declaracion/' + row.codigo} data-result={row.resultado} style={{ scrollMarginTop: 'var(--inspection-anchor-offset, 8rem)' }} className={`mt-3 rounded-lg border border-l-4 px-3 py-4 sm:px-5 ${row.resultado === 'DIFIERE' ? 'border-error-300 border-l-error-600 bg-error-50/30' : expanded ? 'border-primary-300 border-l-primary-700 bg-primary-50/50' : 'border-neutral-300 border-l-neutral-300 bg-white'}`}>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    {bulkMode && editable && row.resultado === 'PENDIENTE' && <input aria-label={`Seleccionar ${row.etiqueta}`} type="checkbox" className="h-5 w-5 shrink-0 accent-primary-700" checked={selectedRows.includes(row.id)} onChange={() => toggleSelected(row.id)} />}
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-500">{orderedComparisons.indexOf(row) + 1}/{comparisons.length}</span>
                    <h4 className="min-w-0 text-base font-bold leading-snug text-[#10213A]">{row.etiqueta}</h4>
                  </div>
                  <div className="mt-2 border-l-2 border-neutral-400 pl-3"><p className="text-xs font-bold text-neutral-700">Informado al abrir el expediente</p><p className="mt-0.5 line-clamp-2 break-words text-sm leading-snug text-neutral-800" title={declaredPreview(row)}>{declaredPreview(row)}</p></div>
                  {(!bulkMode || expanded) && <><p className="sr-only">En campo, ¿coincide?</p><div role="group" aria-label={`Resultado: ${row.etiqueta}`} data-testid={'comparison-decisions-' + row.id} className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
                    {OPTIONS.map((option) => {
                      const selected = row.resultado === option.value;
                      return <button key={option.value} type="button" aria-pressed={selected} disabled={!editable} onClick={() => selectResult(row, option.value)} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1 text-center text-sm font-semibold leading-tight transition-colors min-[480px]:min-h-11 min-[480px]:flex-row min-[480px]:gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${selected ? option.active : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50'} disabled:cursor-default`}>{option.icon}<span>{option.label}</span></button>;
                    })}
                  </div></>}
                  {!expanded && <button type="button" aria-expanded={false} aria-controls={'comparison-detail-' + row.id} onClick={() => toggleDetail(row, false)} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-semibold text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{row.resultado !== 'PENDIENTE' ? editable ? 'Ver o corregir detalle' : 'Ver detalle' : row.observacion || row.valorObservado || row.evidencias.length ? 'Ver detalle y evidencia' : bulkMode ? 'Verificar individualmente' : 'Anotar lo encontrado'}<ChevronDown size={16} /></button>}
                </div>
                {expanded && <div id={'comparison-detail-' + row.id} className="mt-3 border-t border-neutral-200 pt-3">
                  <div className={showFullDeclared ? 'grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] md:items-start' : 'min-w-0'}>
                    {showFullDeclared && <div className="min-w-0 rounded-lg bg-neutral-100 px-3 py-3">
                      <span className="text-sm font-bold text-neutral-800">Informado al abrir el expediente</span>
                      {row.codigo === 'ACT-TRATAMIENTOS' && declaredLines(row).length > 0 ? <ul className="mt-2 space-y-2">{treatmentGroups(row).map(({ description, codes }) => <li key={description} className="min-w-0 border-t border-neutral-200 pt-2 first:border-0 first:pt-0"><div className="mb-1 flex flex-wrap gap-1">{codes.map((code) => <span key={code} className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-primary-800">{code}</span>)}</div><p className="break-words text-sm font-normal leading-relaxed text-[#10213A]">{description}</p></li>)}</ul> : row.codigo === 'DOC-VIGENTES' && declaredDocuments.length > 0 ? <ul className="mt-2 space-y-2">{declaredDocuments.map((document) => <li key={document.id} className="flex min-w-0 items-start justify-between gap-3 border-t border-neutral-200 pt-2 first:border-0 first:pt-0"><span className="min-w-0"><span className="block break-words text-sm font-semibold text-[#10213A]">{document.nombre}</span><span className="block text-xs text-neutral-600">{document.tipo}{document.anio ? ` · ${document.anio}` : ''} · {document.estado}</span></span><button type="button" disabled={downloadingDocumentId === document.id} onClick={() => void downloadDeclaredDocument(document)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-bold text-primary-800 disabled:opacity-60"><Download size={15} />{downloadingDocumentId === document.id ? 'Abriendo…' : 'Descargar'}</button></li>)}</ul> : <p className="mt-1 whitespace-pre-line break-words text-sm font-normal leading-relaxed text-[#10213A]">{row.valorDeclarado || 'Sin dato declarado'}</p>}
                    </div>}
                    {showFullDeclared && <div className="hidden justify-center pt-9 text-neutral-400 md:flex"><ArrowRight size={17} aria-hidden="true" /></div>}
                    <label className="block min-w-0"><span className="text-sm font-bold text-neutral-800">{row.resultado === 'NO_VERIFICADO' ? 'Por qué no pudiste verificarlo' : 'Encontrado en campo'}</span><textarea aria-label={`${row.resultado === 'NO_VERIFICADO' ? 'Motivo de no verificación' : 'Valor verificado'}: ${row.etiqueta}`} disabled={!editable} rows={3} value={row.valorObservado || ''} onChange={(event) => onChange(row.id, { valorObservado: event.target.value })} placeholder={row.resultado === 'NO_VERIFICADO' ? 'Contá por qué no pudiste verificarlo' : 'Qué encontraste en campo'} className="mt-2 min-h-20 w-full resize-y rounded-lg border border-neutral-400 bg-white px-3 py-2.5 text-base leading-relaxed text-[#10213A] outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50" /></label>
                  </div>
                  {(row.resultado === 'DIFIERE' || row.observacion || row.evidencias.length > 0) && <div className="mt-3 grid gap-3 border-l-2 border-error-300 pl-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="block"><span className="mb-1 block text-xs font-bold text-error-800">Hallazgo y acción requerida</span><textarea aria-label={`Hallazgo: ${row.etiqueta}`} disabled={!editable} rows={2} value={row.observacion || ''} onChange={(event) => onChange(row.id, { observacion: event.target.value })} placeholder="Explicá la diferencia y qué debe corregirse" className="w-full resize-y rounded-lg border border-error-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-error-500 focus:ring-2 focus:ring-error-100 disabled:bg-neutral-50" /></label><div className="flex flex-wrap items-start gap-2">{row.evidencias.filter((e) => e.tipo === 'FOTO').map((evidence) => <InspectionEvidenceImage key={evidence.id} inspectionId={inspectionId} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} className="h-16 w-20 rounded-lg object-cover" />)}{editable && <button type="button" onClick={() => { setTargetId(row.id); inputRef.current?.click(); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-neutral-400 px-3 text-xs font-bold text-neutral-700"><Camera size={17} />Foto</button>}</div></div>}
                  {editable && <div className="mt-3 border-t border-neutral-200 pt-3">
                    {!embedded && <p role="status" className={`min-h-5 text-sm leading-snug ${saveStatus?.tone === 'error' ? 'text-error-800' : saveStatus?.tone === 'success' ? 'text-primary-800' : 'text-neutral-700'}`}>{saveStatus?.message || 'Sin guardar en el servidor.'}</p>}
                    <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      {nextPendingAfter(row) && <button type="button" onClick={() => openComparison(nextPendingAfter(row))} className="min-h-12 w-full rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 sm:w-auto">Siguiente pendiente</button>}
                      {!embedded && onSave && <button type="button" disabled={saving || saveDisabled} onClick={() => void onSave()} className="min-h-12 w-full rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">{saving ? 'Guardando…' : 'Guardar cambios'}</button>}
                    </div>
                  </div>}
                  <button type="button" aria-expanded={true} aria-controls={'comparison-detail-' + row.id} onClick={() => toggleDetail(row, true)} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-semibold text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Ocultar detalle<ChevronUp size={16} /></button>
                </div>}
              </article>;
            })}
            {open && rows.length > BLOCK_SIZE && <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-2 sm:px-6"><button type="button" disabled={activeBlock === 0} onClick={() => changeBlock(group, activeBlock - 1, rows)} className="min-h-11 rounded-md px-2 text-sm font-semibold text-primary-800 disabled:text-neutral-400">Bloque anterior</button><span className="text-xs tabular-nums text-neutral-600">{activeBlock + 1} / {Math.ceil(rows.length / BLOCK_SIZE)}</span><button type="button" disabled={(activeBlock + 1) * BLOCK_SIZE >= rows.length} onClick={() => changeBlock(group, activeBlock + 1, rows)} className="min-h-11 rounded-md px-2 text-sm font-semibold text-primary-800 disabled:text-neutral-400">Siguiente bloque</button></div>}
          </div>
        );
      })}
      <input ref={inputRef} type="file" accept={INSPECTION_PHOTO_ACCEPT} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file && targetId) onEvidence(file, targetId); event.currentTarget.value = ''; }} />
      {!editable && <div className="flex items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 sm:px-6"><Paperclip size={15} />Comparación en modo consulta. La edición depende de la etapa, los permisos y la disponibilidad del borrador.</div>}
    </section>
  );
}
