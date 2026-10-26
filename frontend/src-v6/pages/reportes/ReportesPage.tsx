/**
 * SITREP v6 - Centro de Inteligencia de Reportes (v3)
 * ====================================================
 * Shell: filter bar, tab switcher, lazy-loaded tab content
 */

import { useScopedSearchParams } from '../../hooks/useScopedSearchParams';
import { inspectionWorkspaceOwner, inspectionDateFilter, inspectionPage } from '../../utils/inspectionWorkspace';
import { LoadingIndicator } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { canUseInspectionOperations } from '../../services/inspectionOperations.service';
import React, { useState, useRef, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import {
  FileText,
  Truck,
  BarChart3,
  Calendar,
  Download,
  Loader2,
  FileDown,
  Package,
  Printer,
  MapPin,
  Map as MapIcon,
  Factory,
  FlaskConical,
  ClipboardCheck,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { useReporteManifiestos, useReporteTratados, useReporteTransporte, useExportarReporte } from '../../hooks/useReportes';
import { useCentroControl } from '../../hooks/useCentroControl';
import type { ActorGenerador, ActorTransportista, ActorOperador } from '../../hooks/useCentroControl';
import { exportReportePDF } from '../../utils/exportPdf';
import { formatReportQuantities } from '../../utils/report-quantities';
import { formatEstado } from '../../utils/formatters';
import type { EstadoManifiesto } from '../../types/models';
import { DATE_PRESETS, computeDateRange } from '../../utils/date-presets';
import { agruparPorDepartamento } from '../../utils/mendoza-departamentos';
import type { ReporteFilters } from '../../types/api';

// ── Lazy-loaded tab components ──
const ManifiestosTab = lazy(() => import('./tabs/ManifiestosTab'));
const TratadosTab = lazy(() => import('./tabs/TratadosTab'));
const TransporteTab = lazy(() => import('./tabs/TransporteTab'));
const GeneradoresTab = lazy(() => import('./tabs/GeneradoresTab'));
const OperadoresTab = lazy(() => import('./tabs/OperadoresTab'));
const DepartamentosTab = lazy(() => import('./tabs/DepartamentosTab'));
const MapaActoresTab = lazy(() => import('./tabs/MapaActoresTab'));
const InspeccionesTab = lazy(() => import('../inspecciones/InspectionOperationsPanel').then(mod => ({ default: mod.InspectionOperationsPanel })));
const TratamientosTab = lazy(() => import('./tabs/TratamientosTab'));

// Lazy-load the modal from DepartamentosTab
const DepartamentoDetalleModalLazy = lazy(() =>
  import('./tabs/DepartamentosTab').then(mod => ({ default: mod.DepartamentoDetalleModal }))
);

type TabType = 'manifiestos' | 'tratados' | 'transporte' | 'generadores' | 'operadores' | 'tratamientos' | 'departamentos' | 'mapa' | 'inspecciones';

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'inspecciones', label: 'Inspecciones', icon: ClipboardCheck },
  { id: 'manifiestos', label: 'Manifiestos', icon: FileText },
  { id: 'tratados', label: 'Residuos Tratados', icon: Package },
  { id: 'transporte', label: 'Transporte', icon: Truck },
  { id: 'generadores', label: 'Generadores', icon: Factory },
  { id: 'operadores', label: 'Operadores', icon: FlaskConical },
  { id: 'tratamientos', label: 'Tratamientos', icon: FlaskConical },
  { id: 'departamentos', label: 'Departamentos', icon: MapPin },
  { id: 'mapa', label: 'Mapa de Actores', icon: MapIcon },
];

const REPORT_FILTER_KEYS = ['tipo', 'desde', 'hasta', 'pagina', 'periodo', 'todos'] as const;
function TabSpinner() { return <div className="flex justify-center py-12"><LoadingIndicator label="Cargando reporte…" size={32}/></div>; }

const ReportesPage: React.FC = () => {
  const { currentUser } = useAuth();
  return <ReportWorkspace key={inspectionWorkspaceOwner(currentUser)}/>;
};
function ReportWorkspace() {
  const { currentUser } = useAuth();
  const [params, setParams] = useScopedSearchParams('reportes', REPORT_FILTER_KEYS, inspectionWorkspaceOwner(currentUser));
  const fechaDesde = inspectionDateFilter(params.get('desde'));
  const fechaHasta = inspectionDateFilter(params.get('hasta'));
  const validTab = tabs.find(tab => tab.id === params.get('tipo') && (tab.id !== 'inspecciones' || canUseInspectionOperations(currentUser)));
  const activeTab: TabType = validTab?.id || 'manifiestos';
  const reportNav = useRef<HTMLElement>(null);
  const selectedReport = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const nav = reportNav.current;
    const selected = selectedReport.current;
    if (!nav || !selected) return;
    const revealSelection = () => {
      if (!nav.clientWidth || nav.scrollWidth <= nav.clientWidth) return;
      const container = nav.getBoundingClientRect();
      const item = selected.getBoundingClientRect();
      // Scroll only the report choices, never the page or its focused field.
      nav.scrollLeft += item.left - container.left - Math.max(0, (nav.clientWidth - item.width) / 2);
    };
    revealSelection();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(revealSelection);
    observer?.observe(nav);
    return () => observer?.disconnect();
  }, [activeTab]);
  const reportPage = inspectionPage(params.get('pagina'));
  const datePreset = params.has('periodo') ? Number(params.get('periodo')) : (fechaDesde || fechaHasta ? -1 : 0);
  const incluirTodos = params.has('todos') ? params.get('todos') === 'true' : !fechaDesde && !fechaHasta;
  const invalidDates = !!fechaDesde && !!fechaHasta && fechaDesde > fechaHasta;
  function updateFilters(values: Record<string, string | number | undefined>) {
    setParams(next => {
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    });
  }
  const setReportPage = (page:number) => updateFilters({pagina:page>1?page:undefined});
  const setIncluirTodos = (value:boolean) => updateFilters({todos:String(value)});

  // ── Department detail modal ──
  const [selectedDep, setSelectedDep] = useState<string | null>(null);

  const exportarReporte = useExportarReporte();
  const [pdfPending,setPdfPending]=useState(false);
  const [pdfError,setPdfError]=useState(false);
  const pdfFlight=useRef(false), mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);

  // ── Filters computed reactively ──
  const appliedFilters: ReporteFilters | undefined = useMemo(() => {
    if (!fechaDesde && !fechaHasta) return undefined;
    return {
      ...(fechaDesde ? { fechaDesde } : {}),
      ...(fechaHasta ? { fechaHasta } : {}),
    };
  }, [fechaDesde, fechaHasta]);

  // ── Date preset handler ──
  const handleDatePreset = (days:number) => {
    const range=computeDateRange(days);
    updateFilters({periodo:days,desde:range.desde,hasta:range.hasta,pagina:undefined,todos:undefined});
  };

  // ── Queries — reports (only fetch if filters exist, i.e. dates are set) ──
  const reportFilters = useMemo(() => ({ ...appliedFilters, page: reportPage }), [appliedFilters, reportPage]);
  const manifiestos = useReporteManifiestos(!invalidDates && activeTab === 'manifiestos' ? reportFilters : undefined);
  const tratados = useReporteTratados(!invalidDates && activeTab === 'tratados' ? reportFilters : undefined);
  const transporte = useReporteTransporte(!invalidDates && activeTab === 'transporte' ? reportFilters : undefined);

  // ── Centro Control data (for Departamentos + Mapa tabs) ──
  const ccParams = useMemo(() => ({
    ...(fechaDesde && !incluirTodos ? { fechaDesde } : {}),
    ...(fechaHasta && !incluirTodos ? { fechaHasta } : {}),
    capas: ['generadores', 'transportistas', 'operadores'],
    ...(incluirTodos ? { incluirTodos: 'true' } : {}),
  }), [fechaDesde, fechaHasta, incluirTodos]);

  const needsCentroControl = ['departamentos', 'mapa', 'generadores', 'operadores'].includes(activeTab);
  const activityQuery = useCentroControl(ccParams, false, needsCentroControl && !invalidDates);
  const ccData = activityQuery.data;

  const activeQuery = activeTab === 'manifiestos' ? manifiestos
    : activeTab === 'tratados' ? tratados
    : activeTab === 'transporte' ? transporte
    : null;
  const pagination = activeQuery?.data?.pagination;
  useEffect(() => {
    if (pagination && reportPage > Math.max(1, pagination.pages)) setReportPage(1);
  }, [pagination, reportPage]);

  const displayDate=(value:string)=>value.split('-').reverse().join('/');
  const periodoLabel = fechaDesde && fechaHasta ? `${displayDate(fechaDesde)} — ${displayDate(fechaHasta)}`
    : fechaDesde ? `Desde ${displayDate(fechaDesde)}` : fechaHasta ? `Hasta ${displayDate(fechaHasta)}` : 'Todos los períodos';
  const canExport = !pdfPending && !invalidDates && !!activeQuery?.data && !activeQuery.isError && !activeQuery.isLoading && !activeQuery.isFetching && activeQuery.fetchStatus !== 'paused';

  const handleExportCSV = () => {
    if (!canExport) return;
    const tipoMap: Record<string, string> = { manifiestos: 'manifiestos', tratados: 'tratados', transporte: 'transporte' };
    const tipo = tipoMap[activeTab];
    if (tipo) {
      exportarReporte.mutate({ tipo, formato: 'csv', filters: appliedFilters || {} });
    }
  };

  const handleExportPDF = async () => {
    const data = activeQuery?.data;
    if (!data || !canExport || pdfFlight.current) return;
    pdfFlight.current=true;setPdfPending(true);setPdfError(false);
    try {

    const tabLabels: Record<string, string> = {
      manifiestos: 'Reporte de Manifiestos',
      tratados: 'Reporte de Residuos Tratados',
      transporte: 'Reporte de Transporte',
    };

    let kpis: { label: string; value: string | number }[] = [];
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    // ReporteData shape varies per tab; treat top-level as a string-keyed record for PDF export
    const d = data as unknown as Record<string, unknown>;
    const r = (d.resumen as Record<string, unknown>) || {};

    if (activeTab === 'manifiestos') {
      const list = (d.manifiestos as Record<string, unknown>[]) || [];
      kpis = [
        { label: 'Total Manifiestos', value: (r.totalManifiestos as number) || 0 },
        { label: 'Residuos de esta página', value: formatReportQuantities(list) },
        { label: 'Estados', value: Object.keys((d.porEstado as Record<string, unknown>) || {}).length },
      ];
      headers = ['Número', 'Estado', 'Generador', 'Transportista', 'Operador', 'Fecha'];
      rows = list.map((m) => [
        (m.numero as string) || '',
        m.estado ? formatEstado(m.estado as EstadoManifiesto) : 'Sin estado',
        (m.generador as string) || '',
        (m.transportista as string) || '',
        (m.operador as string) || '',
        m.createdAt ? new Date(m.createdAt as string).toLocaleDateString('es-AR') : '',
      ]);
    } else if (activeTab === 'tratados') {
      const list = (d.detalle as Record<string, unknown>[]) || [];
      kpis = [
        { label: 'Manifiestos Tratados', value: (r.totalManifiestosTratados as number) || 0 },
        { label: 'Residuos de esta página', value: formatReportQuantities(list) },
        { label: 'Generadores de esta página', value: Object.keys((d.porGenerador as Record<string, unknown>) || {}).length },
      ];
      headers = ['Número', 'Generador', 'Método', 'Fecha', 'Residuos'];
      rows = list.map((item) => [
        (item.numero as string) || '',
        (item.generador as string) || '',
        (item.metodoTratamiento as string) || '',
        item.fechaTratamiento ? new Date(item.fechaTratamiento as string).toLocaleDateString('es-AR') : '',
        (Array.isArray(item.residuos) ? item.residuos.length : 0),
      ]);
    } else if (activeTab === 'transporte') {
      const list = (d.transportistas as Record<string, unknown>[]) || [];
      kpis = [
        { label: 'Transportistas', value: (r.totalTransportistas as number) || 0 },
        { label: 'Viajes de esta página', value: (r.totalViajes as number) || 0 },
        { label: 'En Tránsito (página)', value: (r.viajesActivos as number) || 0 },
      ];
      headers = ['Transportista', 'Viajes', 'Completados', 'En Tránsito', 'Vehículos', 'Tasa'];
      rows = list.map((t) => [
        (t.transportista as string) || '',
        (t.totalViajes as number) || 0,
        (t.completados as number) || 0,
        (t.enTransito as number) || 0,
        (t.vehiculosRegistrados as number) || 0,
        (t.tasaCompletitud as string) || '0%',
      ]);
    }

    await exportReportePDF({
      canDownload: () => mounted.current,
      titulo: tabLabels[activeTab] || 'Reporte',
      subtitulo: `${tabs.find(t => t.id === activeTab)?.label} - Sistema SITREP${pagination ? ` · Página ${pagination.page} de ${Math.max(1, pagination.pages)} (${rows.length} registros de ${pagination.total})` : ''}`,
      periodo: periodoLabel,
      kpis,
      tabla: { headers, rows },
    });
    } catch { if(mounted.current)setPdfError(true); }
    finally { pdfFlight.current=false;if(mounted.current)setPdfPending(false); }
  };

  // ── Department detail modal data ──
  const depModalData = useMemo(() => {
    if (!selectedDep || !ccData) return null;
    const genByDep = agruparPorDepartamento(ccData.generadores || []);
    const transByDep = agruparPorDepartamento(
      (ccData.transportistas || []).filter(
        (t): t is ActorTransportista & { latitud: number; longitud: number } =>
          t.latitud != null && t.longitud != null,
      ),
    );
    const operByDep = agruparPorDepartamento(ccData.operadores || []);
    return {
      generadores: (genByDep[selectedDep] || []) as ActorGenerador[],
      transportistas: (transByDep[selectedDep] || []) as ActorTransportista[],
      operadores: (operByDep[selectedDep] || []) as ActorOperador[],
    };
  }, [selectedDep, ccData]);

  const handleSelectDep = useCallback((dep: string) => {
    setSelectedDep(dep);
  }, []);

  const isReportTab = activeTab === 'manifiestos' || activeTab === 'tratados' || activeTab === 'transporte';

  return (
    <>
      {/* Filter Bar (2 rows): Row 1 = dates + actions, Row 2 = tabs */}
      <div className="sm:sticky top-0 z-20 bg-[#FAFAF8] pt-2 pb-1 -mx-4 lg:-mx-8 px-4 lg:px-8">
        {/* Row 1: Date presets + date inputs + period badge + export buttons */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-white rounded-t-xl border border-neutral-100 shadow-sm">
          <div className="flex w-full min-w-0 sm:w-auto items-center gap-1 flex-wrap">
            <Calendar size={14} className="text-neutral-400" />
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                type="button"
                aria-pressed={datePreset === p.days}
                onClick={() => handleDatePreset(p.days)}
                className={`min-h-11 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 ${
                  datePreset === p.days
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-neutral-700 hover:bg-neutral-50 border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex w-full min-w-0 sm:w-auto items-end gap-2 text-sm text-neutral-700">
              <label className="flex min-w-0 flex-1 flex-col gap-1">Desde
              <input
                type="date"
                value={fechaDesde}
                onChange={e => updateFilters({desde:e.target.value,periodo:-1,todos:undefined,pagina:undefined})}
                className="min-h-11 min-w-0 w-full px-2 py-2 rounded border border-neutral-300 text-neutral-900 bg-white text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
              />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1">Hasta
              <input
                type="date"
                value={fechaHasta}
                onChange={e => updateFilters({hasta:e.target.value,periodo:-1,todos:undefined,pagina:undefined})}
                aria-invalid={invalidDates || undefined}
                aria-describedby={invalidDates ? 'report-period-error' : undefined}
                className="min-h-11 min-w-0 w-full px-2 py-2 rounded border border-neutral-300 text-neutral-900 bg-white text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
              />
              </label>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
              datePreset === 0
                ? 'text-neutral-600 bg-neutral-100 border-neutral-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              <Calendar size={10} />
              {periodoLabel}
            </span>
            {isReportTab && (
              <>
                <Button variant="ghost" disabled={!canExport} onClick={() => { if(canExport)window.print(); }} className="hidden sm:flex min-w-11 px-3" aria-label="Imprimir reporte" title="Imprimir"><Printer size={18} /></Button>
                <Button variant="outline" onClick={handleExportCSV} disabled={!canExport} isLoading={exportarReporte.isPending} className="min-w-11 px-3" aria-label="Exportar CSV" title="Exportar CSV"><Download size={18} /><span>CSV</span></Button>
                <Button onClick={() => void handleExportPDF()} disabled={!canExport} isLoading={pdfPending} className="min-w-11 px-3" aria-label="Exportar PDF" title="Exportar PDF"><FileDown size={18} /><span>PDF</span></Button>
              </>
            )}
          </div>
        </div>

        {/* One visible report chooser per viewport, using the same options and state. */}
        <div className="relative bg-white rounded-b-xl border-x border-b border-neutral-100">
          <label className="block px-3 pb-3 text-sm font-medium text-neutral-700 sm:hidden">
            Tipo de reporte
            <select value={activeTab} onChange={event => updateFilters({tipo:event.target.value,pagina:undefined})}
              className="mt-1 w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
              {tabs.filter(tab => tab.id !== 'inspecciones' || canUseInspectionOperations(currentUser)).map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
            </select>
          </label>
          {/* Left gradient fade */}
          <div className="hidden sm:block pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 rounded-bl-xl" />
          {/* Right gradient fade */}
          <div className="hidden sm:block pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 rounded-br-xl" />
          <nav ref={reportNav} aria-label="Tipos de reporte" className="hidden sm:flex items-center gap-0.5 px-2 overflow-x-auto scrollbar-hide">
            {tabs.filter(tab => tab.id !== 'inspecciones' || canUseInspectionOperations(currentUser)).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={isActive ? selectedReport : undefined}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => updateFilters({tipo:tab.id,pagina:undefined})}
                  className={`min-h-11 flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-700 ${
                    isActive
                      ? 'border-primary-700 text-primary-800'
                      : 'border-transparent text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="mt-4 isolate">
      {pdfError && <p role="alert" className="mb-4 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800">No se pudo preparar el PDF. Tus filtros se conservan; podés reintentar la descarga.</p>}
      {exportarReporte.isError && <p role="alert" className="mb-4 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800">No se pudo exportar el CSV. {exportarReporte.error instanceof Error ? exportarReporte.error.message : 'Tus filtros se conservan; podés reintentar la exportación.'}</p>}
      <Suspense key={activeTab} fallback={<TabSpinner />}>
      {invalidDates ? <p role="alert" id="report-period-error" className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-800">La fecha Hasta debe ser igual o posterior a Desde. Corregí el período para consultar o exportar.</p> : isReportTab ? (
        activeQuery?.fetchStatus === 'paused' ? (
          <p role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">Sin conexión. Tus filtros se conservan; el reporte se actualizará al reconectar.</p>
        ) : activeQuery?.isLoading ? (
          <TabSpinner/>
        ) : activeQuery?.isError ? (
          <Card className="border-0 shadow-sm">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="text-red-400" size={24} />
              </div>
              <p role="alert" className="text-error-600 font-medium">Error al generar el reporte</p>
              <p className="text-sm text-neutral-700 mt-1">No se pudieron cargar los datos. Tus filtros se conservan.</p>
              <Button variant="outline" className="mt-4" onClick={() => void activeQuery.refetch()}>Reintentar reporte</Button>
            </div>
          </Card>
        ) : activeQuery?.data ? (
          <>
            {activeQuery.isFetching && <div className="mb-4"><LoadingIndicator label="Actualizando reporte; la exportación estará disponible al terminar…"/></div>}
            {activeTab === 'manifiestos' && <ManifiestosTab data={activeQuery.data} periodo={periodoLabel} />}
            {activeTab === 'tratados' && <TratadosTab data={activeQuery.data} periodo={periodoLabel} />}
            {activeTab === 'transporte' && <TransporteTab data={activeQuery.data} periodo={periodoLabel} />}
            {pagination && (
              <nav aria-label="Páginas del reporte" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3">
                <p role="status" className="text-sm text-neutral-700">Página {pagination.page} de {Math.max(1, pagination.pages)} · {pagination.total} registros</p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={reportPage <= 1 || activeQuery.isFetching} onClick={() => setReportPage(reportPage - 1)}>Página anterior</Button>
                  <Button variant="outline" disabled={reportPage >= pagination.pages || activeQuery.isFetching} onClick={() => setReportPage(reportPage + 1)}>Página siguiente</Button>
                </div>
              </nav>
            )}
          </>
        ) : (
          <Card className="border-0 shadow-sm">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="text-neutral-400" size={24} />
              </div>
              <p className="text-neutral-700 font-medium">Cargando reporte...</p>
              <p className="text-sm text-neutral-500 mt-1">Los gráficos se actualizarán automáticamente</p>
            </div>
          </Card>
        )
      ) : needsCentroControl && activityQuery.fetchStatus === 'paused' ? (
        <p role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">Sin conexión. Tus filtros se conservan; la actividad se actualizará al reconectar.</p>
      ) : needsCentroControl && activityQuery.isPending ? (
        <p role="status" className="py-12 text-center text-neutral-700">Cargando actividad del período…</p>
      ) : needsCentroControl && activityQuery.isError ? (
        <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-800">
          No se pudo cargar la actividad. Tus filtros se conservan.
          <Button variant="outline" className="mt-3" onClick={() => void activityQuery.refetch()}>Reintentar actividad</Button>
        </div>
      ) : (
        <>
          {activeTab === 'inspecciones' && <InspeccionesTab key={`${fechaDesde}:${fechaHasta}`} mode="report" desde={fechaDesde} hasta={fechaHasta} />}
          {activeTab === 'departamentos' && <DepartamentosTab ccData={ccData || null} onSelectDep={handleSelectDep} periodoLabel={periodoLabel} />}
          {activeTab === 'mapa' && <MapaActoresTab ccData={ccData || null} onSelectDep={handleSelectDep} periodoLabel={periodoLabel} desde={fechaDesde} hasta={fechaHasta} incluirTodos={incluirTodos} onToggleIncluirTodos={setIncluirTodos} />}
          {activeTab === 'generadores' && <GeneradoresTab ccData={ccData || null} periodoLabel={periodoLabel} incluirTodos={incluirTodos} />}
          {activeTab === 'operadores' && <OperadoresTab ccData={ccData || null} periodoLabel={periodoLabel} incluirTodos={incluirTodos} />}
          {activeTab === 'tratamientos' && <TratamientosTab periodoLabel={periodoLabel} />}
        </>
      )}
      </Suspense>

      {/* ── Department Detail Modal ── */}
      {selectedDep && depModalData && (
        <Suspense fallback={null}>
          <DepartamentoDetalleModalLazy
            departamento={selectedDep}
            generadores={depModalData.generadores}
            transportistas={depModalData.transportistas}
            operadores={depModalData.operadores}
            periodoLabel={periodoLabel}
            onClose={() => setSelectedDep(null)}
          />
        </Suspense>
      )}
      </div>
    </>
  );
};

export default ReportesPage;
