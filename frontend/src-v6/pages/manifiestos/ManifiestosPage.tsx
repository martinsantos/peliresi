/**
 * SITREP v6 - Manifiestos Page
 * ============================
 * Infinite-scroll table with sticky group headers that adapt to the active sort column.
 * Sort by fecha → headers show month; by estado → headers show estado; by numero → headers show series.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Search, Filter, Plus, Eye, Edit, Trash2, Loader2, AlertTriangle, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown,
  ShieldCheck, Download, FileDown, Printer, Calendar,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { useManifiestos } from '../../hooks/useManifiestos';
import { useGeneradores } from '../../hooks/useGeneradores';
import { useOperadores } from '../../hooks/useOperadores';
import { manifiestoService } from '../../services/manifiesto.service';
import { EstadoManifiesto } from '../../types/models';
import { ESTADO_LABELS } from '../../utils/constants';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { downloadCsv } from '../reportes/tabs/shared';
import { exportReportePDF } from '../../utils/exportPdf';

// ── Types ────────────────────────────────────────────────────────────────────

interface MRow {
  id: string;
  numero: string;
  generadorNombre: string;
  operadorNombre: string;
  estado: string;
  fecha: string;
  actividad: string;
  peso: number;
  unidad: string;
  blockchainStatus: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const estadoBadgeColor: Record<string, string> = {
  BORRADOR: 'neutral', PENDIENTE_APROBACION: 'warning', APROBADO: 'success',
  EN_TRANSITO: 'info', ENTREGADO: 'secondary', RECIBIDO: 'warning',
  EN_TRATAMIENTO: 'info', TRATADO: 'primary', RECHAZADO: 'error', CANCELADO: 'neutral',
};

// ── Group helpers ────────────────────────────────────────────────────────────

type SortCol = 'createdAt' | 'numero' | 'estado' | 'generador' | 'operador';

function getGroupKey(m: MRow, col: SortCol): string {
  switch (col) {
    case 'createdAt': {
      if (!m.fecha) return 'sin-fecha';
      const d = new Date(m.fecha);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    case 'numero':
      return m.numero.substring(0, 4) || '—';
    case 'estado':
      return m.estado;
    case 'generador':
      return m.generadorNombre;
    case 'operador':
      return m.operadorNombre;
  }
}

function getGroupLabel(key: string, col: SortCol): string {
  switch (col) {
    case 'createdAt': {
      if (key === 'sin-fecha') return 'Sin fecha';
      const l = new Date(key + '-15T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      return l.charAt(0).toUpperCase() + l.slice(1);
    }
    case 'numero':
      return `Serie ${key}`;
    case 'estado':
      return ESTADO_LABELS[key as EstadoManifiesto] || key.replace(/_/g, ' ');
    case 'generador':
    case 'operador':
      return key || 'Sin asignar';
  }
}

function mapRow(m: any): MRow {
  return {
    id: m.id,
    numero: m.numero,
    generadorNombre: m.generador?.razonSocial || 'Sin generador',
    operadorNombre: m.operador?.razonSocial || '-',
    estado: m.estado,
    fecha: m.createdAt,
    actividad: m.updatedAt || m.createdAt,
    peso: Array.isArray(m.residuos) ? m.residuos.reduce((acc: number, r: any) => acc + (typeof r.cantidad === 'number' ? r.cantidad : 0), 0) : 0,
    unidad: Array.isArray(m.residuos) && m.residuos.length > 0 ? m.residuos[0]?.unidad || 'kg' : 'kg',
    blockchainStatus: m.blockchainStatus || null,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

const ManifiestosPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Filters
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [estadoFilter, setEstadoFilter] = useState(searchParams.get('estado') || '');
  const [fechaDesde, setFechaDesde] = useState(searchParams.get('fechaDesde') || '');
  const [fechaHasta, setFechaHasta] = useState(searchParams.get('fechaHasta') || '');
  const [generadorFilter, setGeneradorFilter] = useState('');
  const [operadorFilter, setOperadorFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortBy, setSortBy] = useState<SortCol>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Infinite scroll
  const [page, setPage] = useState(1);
  const [allRows, setAllRows] = useState<MRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const desktopSentinelRef = useRef<HTMLDivElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [theadH, setTheadH] = useState(34); // fallback; measured accurately via callback ref

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; numero: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Callback ref: measures thead height the instant it mounts in the DOM
  const theadRefCb = useCallback((node: HTMLTableSectionElement | null) => {
    theadRef.current = node;
    if (node) setTheadH(node.offsetHeight);
  }, []);

  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
  };

  const filterCount = [fechaDesde, fechaHasta, estadoFilter, generadorFilter, operadorFilter].filter(Boolean).length;

  // Reset accumulator when any filter/sort changes
  const filterKey = `${searchTerm}|${estadoFilter}|${generadorFilter}|${operadorFilter}|${fechaDesde}|${fechaHasta}|${sortBy}|${sortOrder}`;
  useEffect(() => {
    setPage(1);
    setAllRows([]);
    setTotalCount(0);
  }, [filterKey]);

  // Actor lists for filter dropdowns
  const { data: generadoresData } = useGeneradores({ limit: 200 });
  const { data: operadoresData } = useOperadores({ limit: 200 });

  const { data: apiData, isLoading, isFetching, isError, refetch } = useManifiestos({
    search: searchTerm || undefined,
    estado: (estadoFilter || undefined) as EstadoManifiesto | undefined,
    generadorId: generadorFilter || undefined,
    operadorId: operadorFilter || undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
    page,
    limit: 20,
    sortBy,
    sortOrder,
  });

  const totalPages = apiData?.totalPages || 1;
  const hasMore = page < totalPages;

  // Accumulate rows
  useEffect(() => {
    if (!apiData?.items || apiData.items.length === 0) return;
    setTotalCount(apiData.total);
    setAllRows(prev => {
      const mapped = apiData.items.map(mapRow);
      if (page === 1) return mapped;
      const existing = new Set(prev.map(r => r.id));
      return [...prev, ...mapped.filter(r => !existing.has(r.id))];
    });
  }, [apiData, page]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) setPage(p => p + 1);
  }, [hasMore, isFetching]);

  // Desktop IntersectionObserver (root = scroll container)
  // allRows.length in deps: ensures effect re-runs when table mounts (sentinel appears in DOM)
  useEffect(() => {
    const sentinel = desktopSentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container || !hasMore || isFetching) return;
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMore(); },
      { root: container, rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetching, loadMore, allRows.length]);

  // Mobile IntersectionObserver (root = viewport)
  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    if (!sentinel || !hasMore || isFetching) return;
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMore(); },
      { rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetching, loadMore, allRows.length]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await manifiestoService.delete(deleteTarget.id);
      toast.success('Manifiesto eliminado', `El manifiesto ${deleteTarget.numero} fue eliminado exitosamente`);
      setDeleteTarget(null);
      setAllRows(prev => prev.filter(r => r.id !== deleteTarget.id));
      setTotalCount(c => c - 1);
      refetch();
    } catch (err: any) {
      toast.error('Error al eliminar', err?.response?.data?.message || 'No se pudo eliminar el manifiesto');
    } finally {
      setIsDeleting(false);
    }
  };

  // Is this the start of a new group?
  const isGroupStart = (idx: number) => idx === 0 || getGroupKey(allRows[idx], sortBy) !== getGroupKey(allRows[idx - 1], sortBy);

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortBy !== col) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />;
  };

  // ── Blockchain badge helper ──────────────────────────────────────────────
  const BcBadge = ({ status }: { status: string | null }) => {
    if (status === 'CONFIRMADO') return <span title="Verificado en blockchain" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-semibold border border-emerald-200 shrink-0"><ShieldCheck size={10} />BC</span>;
    if (status === 'PENDIENTE') return <span title="Blockchain pendiente" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-semibold border border-amber-200 animate-pulse shrink-0"><ShieldCheck size={10} />BC</span>;
    if (status === 'ERROR') return <span title="Error blockchain" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-red-50 text-red-600 text-[9px] font-semibold border border-red-200 shrink-0"><ShieldCheck size={10} />BC</span>;
    return null;
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 xl:max-w-7xl xl:mx-auto">
        <h2 className="text-xl font-bold text-neutral-900">Manifiestos</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => window.print()} className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors" title="Imprimir">
            <Printer size={13} />
          </button>
          <button
            onClick={() => {
              const headers = ['Numero', 'Generador', 'Operador', 'Estado', 'Actividad', 'Peso', 'Unidad'];
              const rows = allRows.map(m => [m.numero, m.generadorNombre, m.operadorNombre, ESTADO_LABELS[m.estado as EstadoManifiesto] || m.estado, formatDateTime(m.actividad), typeof m.peso === 'number' ? m.peso : 0, m.unidad]);
              downloadCsv(`manifiestos-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows, { titulo: 'Listado de Manifiestos', periodo: fechaDesde || fechaHasta ? `${fechaDesde || '...'} a ${fechaHasta || '...'}` : 'Todos', filtros: estadoFilter ? `Estado: ${ESTADO_LABELS[estadoFilter as EstadoManifiesto] || estadoFilter}` : 'Todos', total: totalCount });
            }}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg border border-primary-200 transition-colors" title="CSV"
          ><Download size={13} /> CSV</button>
          <button
            onClick={() => {
              exportReportePDF({ titulo: 'Listado de Manifiestos', subtitulo: estadoFilter ? `Estado: ${ESTADO_LABELS[estadoFilter as EstadoManifiesto] || estadoFilter}` : 'Todos', periodo: fechaDesde || fechaHasta ? `${fechaDesde || '...'} a ${fechaHasta || '...'}` : 'Todos', kpis: [{ label: 'Cargados', value: allRows.length }, { label: 'Total', value: totalCount }], tabla: { headers: ['Numero', 'Generador', 'Estado', 'Actividad', 'Peso'], rows: allRows.map(m => [m.numero, m.generadorNombre, ESTADO_LABELS[m.estado as EstadoManifiesto] || m.estado, formatDateTime(m.actividad), `${typeof m.peso === 'number' ? m.peso.toLocaleString('es-AR') : '0'} ${m.unidad}`]) } });
            }}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-error-600 bg-error-50 hover:bg-error-100 rounded-lg border border-error-200 transition-colors" title="PDF"
          ><FileDown size={13} /> PDF</button>
          <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => navigate('/manifiestos/nuevo')}>Nuevo Manifiesto</Button>
        </div>
      </div>

      {/* Filters — sticky */}
      <div className="sticky top-0 z-20 bg-[#FAFAF8] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-2">
        <Card padding="base">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Input placeholder="Buscar por número o generador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search size={18} />} />
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-full md:w-48">
                <Select value={estadoFilter} onChange={(val) => setEstadoFilter(val)} options={[{ value: '', label: 'Todos los estados' }, ...Object.values(EstadoManifiesto).map((e) => ({ value: e, label: ESTADO_LABELS[e] || e }))]} placeholder="Filtrar estado..." size="sm" clearable />
              </div>
              <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${showFilters || filterCount > 0 ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300'}`}>
                <Filter size={15} />
                <span className="hidden sm:inline">Filtros</span>
                {filterCount > 0 && <span className="bg-primary-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{filterCount}</span>}
                <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <label className="text-xs font-medium text-neutral-500">Generador</label>
                <select value={generadorFilter} onChange={(e) => setGeneradorFilter(e.target.value)} className="text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 w-full sm:max-w-[220px]">
                  <option value="">Todos</option>
                  {(generadoresData?.items || []).map((g: any) => <option key={g.id} value={g.id}>{g.razonSocial}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <label className="text-xs font-medium text-neutral-500">Operador</label>
                <select value={operadorFilter} onChange={(e) => setOperadorFilter(e.target.value)} className="text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 w-full sm:max-w-[220px]">
                  <option value="">Todos</option>
                  {(operadoresData?.items || []).map((o: any) => <option key={o.id} value={o.id}>{o.razonSocial}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-neutral-500">Desde</label>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-neutral-500">Hasta</label>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              {(fechaDesde || fechaHasta || generadorFilter || operadorFilter) && (
                <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setGeneradorFilter(''); setOperadorFilter(''); }} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-error-600 px-2 py-2"><X size={13} /> Limpiar</button>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="xl:max-w-7xl xl:mx-auto">
        {/* Initial loading */}
        {isLoading && allRows.length === 0 && (
          <div className="flex items-center justify-center py-12"><Loader2 size={32} className="animate-spin text-primary-500" /></div>
        )}

        {/* ── Mobile Card View ──────────────────────────────── */}
        {allRows.length > 0 && (
          <div className="md:hidden space-y-1 mt-3">
            {allRows.map((m, idx) => (
              <React.Fragment key={m.id}>
                {isGroupStart(idx) && (
                  <div className="sticky top-[52px] z-[2] -mx-1 px-3 py-1.5 bg-neutral-100/95 backdrop-blur-sm border-b border-neutral-200 rounded-t-lg mt-3 first:mt-0">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-primary-500" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">{getGroupLabel(getGroupKey(m, sortBy), sortBy)}</span>
                    </div>
                  </div>
                )}
                <Card className="active:scale-[0.98] transition-transform cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-sm text-neutral-900">{m.numero}</span>
                        <BcBadge status={m.blockchainStatus} />
                      </div>
                      <Badge variant="soft" color={estadoBadgeColor[m.estado] || 'neutral'} className="text-[10px] shrink-0">
                        {ESTADO_LABELS[m.estado as EstadoManifiesto] || m.estado}
                      </Badge>
                    </div>
                    <p className="text-sm text-neutral-600 truncate">{m.generadorNombre}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-neutral-400">{formatDateTime(m.actividad)}</span>
                      <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="p-1" onClick={() => navigate(`/manifiestos/${m.id}`)}><Eye size={14} /></Button>
                        <Button variant="ghost" size="sm" className="p-1 text-error-500" onClick={() => setDeleteTarget({ id: m.id, numero: m.numero })}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </React.Fragment>
            ))}
            {hasMore && <div ref={mobileSentinelRef} className="flex items-center justify-center py-4 gap-2 text-neutral-400">{isFetching && <><Loader2 size={16} className="animate-spin" /><span className="text-xs">Cargando...</span></>}</div>}
            {!hasMore && allRows.length > 0 && <p className="text-center text-xs text-neutral-400 py-3">{totalCount} manifiestos</p>}
          </div>
        )}

        {/* ── Desktop Grid List — div-based so sticky works reliably ── */}
        {allRows.length > 0 && (
          <div className="hidden md:block mt-3 rounded-xl border border-[#E0E0DC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div ref={scrollRef} className="overflow-y-auto rounded-xl" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              {/* Column header — sticky */}
              <div ref={theadRefCb} className="sticky top-0 z-10 bg-[#F5F5F3] border-b border-neutral-200 grid grid-cols-[minmax(140px,1.2fr)_1.5fr_100px_100px] lg:grid-cols-[minmax(140px,1.2fr)_1.5fr_100px_160px_70px_100px] xl:grid-cols-[minmax(140px,1.2fr)_1.3fr_1.3fr_100px_160px_70px_100px] items-center px-1">
                <div className="px-3 py-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                  <button onClick={() => handleSort('numero')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">N° Manifiesto <SortIcon col="numero" /></button>
                </div>
                <div className="px-3 py-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                  <button onClick={() => handleSort('generador')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">Generador <SortIcon col="generador" /></button>
                </div>
                <div className="px-3 py-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider hidden xl:block">
                  <button onClick={() => handleSort('operador')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">Operador <SortIcon col="operador" /></button>
                </div>
                <div className="px-3 py-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                  <button onClick={() => handleSort('estado')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">Estado <SortIcon col="estado" /></button>
                </div>
                <div className="px-3 py-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider hidden lg:block">
                  <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">Actividad <SortIcon col="createdAt" /></button>
                </div>
                <div className="px-3 py-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider hidden lg:block">Peso</div>
                <div className="px-3 py-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider text-right">Acciones</div>
              </div>

              {/* Rows with sticky group headers */}
              {allRows.map((m, idx) => (
                <React.Fragment key={m.id}>
                  {isGroupStart(idx) && (
                    <div className="sticky z-[5] bg-neutral-100/95 backdrop-blur-sm px-4 py-1.5 border-y border-neutral-200 flex items-center gap-1.5" style={{ top: `${theadH}px` }}>
                      <Calendar size={12} className="text-primary-500" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">{getGroupLabel(getGroupKey(m, sortBy), sortBy)}</span>
                    </div>
                  )}
                  <div
                    className="grid grid-cols-[minmax(140px,1.2fr)_1.5fr_100px_100px] lg:grid-cols-[minmax(140px,1.2fr)_1.5fr_100px_160px_70px_100px] xl:grid-cols-[minmax(140px,1.2fr)_1.3fr_1.3fr_100px_160px_70px_100px] items-center px-1 border-b border-neutral-50 hover:bg-neutral-50/60 cursor-pointer transition-colors"
                    onClick={() => navigate(`/manifiestos/${m.id}`)}
                  >
                    <div className="px-3 py-2 flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm font-semibold text-neutral-900 whitespace-nowrap">{m.numero}</span>
                      <BcBadge status={m.blockchainStatus} />
                    </div>
                    <div className="px-3 py-2 text-sm text-neutral-700 truncate" title={m.generadorNombre}>{m.generadorNombre}</div>
                    <div className="px-3 py-2 text-sm text-neutral-700 truncate hidden xl:block" title={m.operadorNombre}>{m.operadorNombre}</div>
                    <div className="px-3 py-2">
                      <Badge variant="soft" color={estadoBadgeColor[m.estado] || 'neutral'} className="text-[10px]">{ESTADO_LABELS[m.estado as EstadoManifiesto] || m.estado}</Badge>
                    </div>
                    <div className="px-3 py-2 text-xs text-neutral-500 whitespace-nowrap hidden lg:block">{formatDateTime(m.actividad)}</div>
                    <div className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap hidden lg:block">{typeof m.peso === 'number' ? m.peso.toLocaleString('es-AR') : '0'} {m.unidad}</div>
                    <div className="px-3 py-2 flex items-center justify-end gap-0.5">
                      <button className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-primary-600 transition-colors" onClick={(e) => { e.stopPropagation(); navigate(`/manifiestos/${m.id}`); }}><Eye size={15} /></button>
                      <button className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-primary-600 transition-colors" onClick={(e) => { e.stopPropagation(); navigate(`/manifiestos/${m.id}/editar`); }}><Edit size={15} /></button>
                      <button className="p-1.5 rounded-lg hover:bg-error-50 text-neutral-400 hover:text-error-500 transition-colors" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: m.id, numero: m.numero }); }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                </React.Fragment>
              ))}

              {/* Desktop sentinel */}
              {hasMore && (
                <div ref={desktopSentinelRef} className="flex items-center justify-center py-4 gap-2 text-neutral-400">
                  {isFetching && <><Loader2 size={16} className="animate-spin" /><span className="text-xs">Cargando más...</span></>}
                </div>
              )}
              {!hasMore && allRows.length > 0 && <p className="text-center text-xs text-neutral-400 py-3 border-t border-neutral-100">{totalCount} manifiestos</p>}
            </div>
          </div>
        )}

        {/* Empty state */}
        {allRows.length === 0 && !isLoading && !isFetching && (
          <Card className="mt-3">
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-neutral-300 mb-4" />
              <p className="text-neutral-500 font-medium">No se encontraron manifiestos</p>
              <p className="text-sm text-neutral-400 mt-1">Prueba con otros filtros de búsqueda</p>
            </div>
          </Card>
        )}

        {/* Status bar */}
        {allRows.length > 0 && (
          <div className="px-3 py-1.5 mt-2 flex items-center gap-2 text-xs text-neutral-400">
            <span>{allRows.length} de {totalCount}</span>
            {isFetching && <Loader2 size={12} className="animate-spin" />}
            {isError && <span className="text-warning-600">(offline)</span>}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-error-50 rounded-full flex items-center justify-center"><AlertTriangle size={20} className="text-error-500" /></div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Eliminar Manifiesto</h3>
                <p className="text-sm text-neutral-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-neutral-700 mb-6">¿Eliminar <span className="font-mono font-semibold">{deleteTarget.numero}</span>?</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancelar</Button>
              <Button variant="danger" onClick={handleDeleteConfirm} disabled={isDeleting}>{isDeleting ? 'Eliminando...' : 'Eliminar'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManifiestosPage;
