/**
 * SITREP v6 - Centro de Inteligencia de Reportes (v3)
 * ====================================================
 * Shell: filter bar, tab switcher, lazy-loaded tab content
 */

import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
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
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { useReporteManifiestos, useReporteTratados, useReporteTransporte, useExportarReporte } from '../../hooks/useReportes';
import { useCentroControl } from '../../hooks/useCentroControl';
import type { ActorGenerador, ActorTransportista, ActorOperador } from '../../hooks/useCentroControl';
import { exportReportePDF } from '../../utils/exportPdf';
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
const TratamientosTab = lazy(() => import('./tabs/TratamientosTab'));

// Lazy-load the modal from DepartamentosTab
const DepartamentoDetalleModalLazy = lazy(() =>
  import('./tabs/DepartamentosTab').then(mod => ({ default: mod.DepartamentoDetalleModal }))
);

type TabType = 'manifiestos' | 'tratados' | 'transporte' | 'generadores' | 'operadores' | 'tratamientos' | 'departamentos' | 'mapa';

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'manifiestos', label: 'Manifiestos', icon: FileText },
  { id: 'tratados', label: 'Residuos Tratados', icon: Package },
  { id: 'transporte', label: 'Transporte', icon: Truck },
  { id: 'generadores', label: 'Generadores', icon: Factory },
  { id: 'operadores', label: 'Operadores', icon: FlaskConical },
  { id: 'tratamientos', label: 'Tratamientos', icon: FlaskConical },
  { id: 'departamentos', label: 'Departamentos', icon: MapPin },
  { id: 'mapa', label: 'Mapa de Actores', icon: MapIcon },
];

function TabSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <BarChart3 size={24} className="absolute inset-0 m-auto text-primary-500" />
      </div>
      <p className="mt-4 text-neutral-600 font-medium">Cargando módulo...</p>
    </div>
  );
}

const ReportesPage: React.FC = () => {
  // ── Period filter state (default: Ver Todos = days 0) ──
  const [datePreset, setDatePreset] = useState(0);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('manifiestos');
  const [incluirTodos, setIncluirTodos] = useState(true);

  // ── Department detail modal ──
  const [selectedDep, setSelectedDep] = useState<string | null>(null);

  const exportarReporte = useExportarReporte();

  // ── Filters computed reactively ──
  const appliedFilters: ReporteFilters | undefined = useMemo(() => {
    if (!fechaDesde && !fechaHasta) return undefined;
    return {
      ...(fechaDesde ? { fechaDesde } : {}),
      ...(fechaHasta ? { fechaHasta } : {}),
    };
  }, [fechaDesde, fechaHasta]);

  // ── Date preset handler ──
  const handleDatePreset = useCallback((days: number) => {
    setDatePreset(days);
    const range = computeDateRange(days);
    setFechaDesde(range.desde);
    setFechaHasta(range.hasta);
    setIncluirTodos(days === 0);
  }, []);

  // ── Queries — reports (only fetch if filters exist, i.e. dates are set) ──
  const manifiestos = useReporteManifiestos(activeTab === 'manifiestos' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);
  const tratados = useReporteTratados(activeTab === 'tratados' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);
  const transporte = useReporteTransporte(activeTab === 'transporte' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);

  // ── Centro Control data (for Departamentos + Mapa tabs) ──
  const ccParams = useMemo(() => ({
    ...(fechaDesde && !incluirTodos ? { fechaDesde } : {}),
    ...(fechaHasta && !incluirTodos ? { fechaHasta } : {}),
    capas: ['generadores', 'transportistas', 'operadores'],
    ...(incluirTodos ? { incluirTodos: 'true' } : {}),
  }), [fechaDesde, fechaHasta, incluirTodos]);

  const { data: ccData } = useCentroControl(ccParams, 0);

  const activeQuery = activeTab === 'manifiestos' ? manifiestos
    : activeTab === 'tratados' ? tratados
    : activeTab === 'transporte' ? transporte
    : null;

  const periodoLabel = fechaDesde && fechaHasta
    ? `${fechaDesde} — ${fechaHasta}`
    : 'Todos los períodos';

  const handleExportCSV = () => {
    const tipoMap: Record<string, string> = { manifiestos: 'manifiestos', tratados: 'manifiestos', transporte: 'transportistas' };
    const tipo = tipoMap[activeTab];
    if (tipo) {
      exportarReporte.mutate({ tipo, formato: 'csv', filters: appliedFilters || {} });
    }
  };

  const handleExportPDF = () => {
    const data = activeQuery?.data;
    if (!data) return;

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
        { label: 'Total Residuos (kg)', value: Number(r.totalResiduos || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 }) },
        { label: 'Estados', value: Object.keys((d.porEstado as Record<string, unknown>) || {}).length },
      ];
      headers = ['Número', 'Estado', 'Generador', 'Transportista', 'Operador', 'Fecha'];
      rows = list.map((m) => [
        (m.numero as string) || '',
        (m.estado as string) || '',
        (m.generador as string) || '',
        (m.transportista as string) || '',
        (m.operador as string) || '',
        m.createdAt ? new Date(m.createdAt as string).toLocaleDateString('es-AR') : '',
      ]);
    } else if (activeTab === 'tratados') {
      const list = (d.detalle as Record<string, unknown>[]) || [];
      kpis = [
        { label: 'Manifiestos Tratados', value: (r.totalManifiestosTratados as number) || 0 },
        { label: 'Residuos Tratados (kg)', value: Number(r.totalResiduosTratados || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 }) },
        { label: 'Generadores', value: Object.keys((d.porGenerador as Record<string, unknown>) || {}).length },
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
        { label: 'Total Viajes', value: (r.totalViajes as number) || 0 },
        { label: 'En Tránsito', value: (r.viajesActivos as number) || 0 },
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

    exportReportePDF({
      titulo: tabLabels[activeTab] || 'Reporte',
      subtitulo: `${tabs.find(t => t.id === activeTab)?.label} - Sistema SITREP`,
      periodo: periodoLabel,
      kpis,
      tabla: { headers, rows },
    });
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
      <div className="sticky top-0 z-20 bg-[#FAFAF8] pt-2 pb-1 -mx-4 lg:-mx-8 px-4 lg:px-8">
        {/* Row 1: Date presets + date inputs + period badge + export buttons */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-white rounded-t-xl border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-1 flex-wrap">
            <Calendar size={14} className="text-neutral-400" />
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => handleDatePreset(p.days)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  datePreset === p.days
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-neutral-500 hover:bg-neutral-50 border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="hidden sm:flex items-center gap-1.5 ml-1 text-xs text-neutral-400">
              <input
                type="date"
                value={fechaDesde}
                onChange={e => { setFechaDesde(e.target.value); setDatePreset(-1); setIncluirTodos(false); }}
                className="px-2 py-1 rounded border border-neutral-200 text-neutral-600 text-xs"
              />
              <span>—</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => { setFechaHasta(e.target.value); setDatePreset(-1); setIncluirTodos(false); }}
                className="px-2 py-1 rounded border border-neutral-200 text-neutral-600 text-xs"
              />
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
                <button onClick={() => window.print()} className="hidden sm:flex p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors" title="Imprimir"><Printer size={14} /></button>
                <button onClick={handleExportCSV} disabled={exportarReporte.isPending} className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors disabled:opacity-50" title="CSV">
                  {exportarReporte.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                </button>
                <button onClick={handleExportPDF} disabled={!activeQuery?.data} className="p-1.5 rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50" title="PDF"><FileDown size={14} /></button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Tabs — horizontally scrollable with gradient fade indicators */}
        <div className="relative bg-white rounded-b-xl border-x border-b border-neutral-100">
          {/* Left gradient fade */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 rounded-bl-xl" />
          {/* Right gradient fade */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 rounded-br-xl" />
          <div className="flex items-center gap-0.5 px-2 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 sm:py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="mt-4 isolate">
      <Suspense fallback={<TabSpinner />}>
      {isReportTab ? (
        activeQuery?.isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
              <BarChart3 size={24} className="absolute inset-0 m-auto text-primary-500" />
            </div>
            <p className="mt-4 text-neutral-600 font-medium">Generando reporte...</p>
            <p className="text-sm text-neutral-400 mt-1">Consultando datos del sistema</p>
          </div>
        ) : activeQuery?.isError ? (
          <Card className="border-0 shadow-sm">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="text-red-400" size={24} />
              </div>
              <p className="text-error-600 font-medium">Error al generar el reporte</p>
              <p className="text-sm text-neutral-500 mt-1">Verifica tu conexión e intenta nuevamente</p>
            </div>
          </Card>
        ) : activeQuery?.data ? (
          <>
            {activeTab === 'manifiestos' && <ManifiestosTab data={activeQuery.data} periodo={periodoLabel} onExportPDF={handleExportPDF} />}
            {activeTab === 'tratados' && <TratadosTab data={activeQuery.data} periodo={periodoLabel} onExportPDF={handleExportPDF} />}
            {activeTab === 'transporte' && <TransporteTab data={activeQuery.data} periodo={periodoLabel} onExportPDF={handleExportPDF} />}
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
      ) : (
        <>
          {activeTab === 'departamentos' && <DepartamentosTab ccData={ccData || null} onSelectDep={handleSelectDep} periodoLabel={periodoLabel} />}
          {activeTab === 'mapa' && <MapaActoresTab ccData={ccData || null} onSelectDep={handleSelectDep} periodoLabel={periodoLabel} incluirTodos={incluirTodos} onToggleIncluirTodos={setIncluirTodos} />}
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
