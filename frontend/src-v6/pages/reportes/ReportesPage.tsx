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
  Building2,
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
const EstablecimientosTab = lazy(() => import('./tabs/EstablecimientosTab'));
const OperadoresTab = lazy(() => import('./tabs/OperadoresTab'));
const DepartamentosTab = lazy(() => import('./tabs/DepartamentosTab'));
const MapaActoresTab = lazy(() => import('./tabs/MapaActoresTab'));

// Lazy-load the modal from DepartamentosTab
const DepartamentoDetalleModalLazy = lazy(() =>
  import('./tabs/DepartamentosTab').then(mod => ({ default: mod.DepartamentoDetalleModal }))
);

type TabType = 'manifiestos' | 'tratados' | 'transporte' | 'establecimientos' | 'operadores' | 'departamentos' | 'mapa';

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'manifiestos', label: 'Manifiestos', icon: FileText },
  { id: 'tratados', label: 'Residuos Tratados', icon: Package },
  { id: 'transporte', label: 'Transporte', icon: Truck },
  { id: 'establecimientos', label: 'Establecimientos', icon: Building2 },
  { id: 'operadores', label: 'Operadores', icon: Factory },
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
  }, []);

  // ── Queries — reports (only fetch if filters exist, i.e. dates are set) ──
  const manifiestos = useReporteManifiestos(activeTab === 'manifiestos' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);
  const tratados = useReporteTratados(activeTab === 'tratados' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);
  const transporte = useReporteTransporte(activeTab === 'transporte' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);

  // ── Centro Control data (for Departamentos + Mapa tabs) ──
  const ccParams = useMemo(() => ({
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    capas: ['generadores', 'transportistas', 'operadores'],
  }), [fechaDesde, fechaHasta]);

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

    if (activeTab === 'manifiestos') {
      const r: any = data.resumen || {};
      const list = (data as any).manifiestos || [];
      kpis = [
        { label: 'Total Manifiestos', value: r.totalManifiestos || 0 },
        { label: 'Total Residuos (kg)', value: Number(r.totalResiduos || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 }) },
        { label: 'Estados', value: Object.keys((data as any).porEstado || {}).length },
      ];
      headers = ['Número', 'Estado', 'Generador', 'Transportista', 'Operador', 'Fecha'];
      rows = list.map((m: any) => [
        m.numero || '',
        m.estado || '',
        m.generador || '',
        m.transportista || '',
        m.operador || '',
        m.fechaCreacion ? new Date(m.fechaCreacion).toLocaleDateString('es-AR') : '',
      ]);
    } else if (activeTab === 'tratados') {
      const r: any = data.resumen || {};
      const list = (data as any).detalle || [];
      kpis = [
        { label: 'Manifiestos Tratados', value: r.totalManifiestosTratados || 0 },
        { label: 'Residuos Tratados (kg)', value: Number(r.totalResiduosTratados || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 }) },
        { label: 'Generadores', value: Object.keys((data as any).porGenerador || {}).length },
      ];
      headers = ['Número', 'Generador', 'Método', 'Fecha', 'Residuos'];
      rows = list.map((d: any) => [
        d.numero || '',
        d.generador || '',
        d.metodoTratamiento || '',
        d.fechaTratamiento ? new Date(d.fechaTratamiento).toLocaleDateString('es-AR') : '',
        d.residuos?.length || 0,
      ]);
    } else if (activeTab === 'transporte') {
      const r: any = data.resumen || {};
      const list = (data as any).transportistas || [];
      kpis = [
        { label: 'Transportistas', value: r.totalTransportistas || 0 },
        { label: 'Total Viajes', value: r.totalViajes || 0 },
        { label: 'En Tránsito', value: r.viajesActivos || 0 },
      ];
      headers = ['Transportista', 'Viajes', 'Completados', 'En Tránsito', 'Vehículos', 'Tasa'];
      rows = list.map((t: any) => [
        t.transportista || '',
        t.totalViajes || 0,
        t.completados || 0,
        t.enTransito || 0,
        t.vehiculosRegistrados || 0,
        t.tasaCompletitud || '0%',
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
    const transByDep = agruparPorDepartamento(ccData.transportistas || []);
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
      {/* ── Sticky Filter Bar + Tabs ── */}
      <div className="sticky top-0 z-20 bg-[#FAFAF8] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-1">
        {/* Period presets + export actions */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-2xl border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar size={16} className="text-neutral-400" />
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => handleDatePreset(p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  datePreset === p.days
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-neutral-500 hover:bg-neutral-50 border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="hidden sm:flex items-center gap-1.5 ml-2 text-xs text-neutral-400">
              <input
                type="date"
                value={fechaDesde}
                onChange={e => { setFechaDesde(e.target.value); setDatePreset(-1); }}
                className="px-2 py-1 rounded border border-neutral-200 text-neutral-600 text-xs"
              />
              <span>—</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => { setFechaHasta(e.target.value); setDatePreset(-1); }}
                className="px-2 py-1 rounded border border-neutral-200 text-neutral-600 text-xs"
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              datePreset === 0
                ? 'text-neutral-600 bg-neutral-100 border-neutral-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              <Calendar size={11} />
              {periodoLabel}
            </span>
            {isReportTab && (
              <>
                <Button variant="outline" size="sm" leftIcon={<Printer size={14} />} onClick={() => window.print()} className="hidden sm:inline-flex">Imprimir</Button>
                <Button variant="outline" size="sm" leftIcon={exportarReporte.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} onClick={handleExportCSV} disabled={exportarReporte.isPending}>CSV</Button>
                <Button size="sm" leftIcon={<FileDown size={14} />} onClick={handleExportPDF} disabled={!activeQuery?.data}>PDF</Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 gap-1 overflow-x-auto mt-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
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
          {activeTab === 'mapa' && <MapaActoresTab ccData={ccData || null} onSelectDep={handleSelectDep} periodoLabel={periodoLabel} />}
          {activeTab === 'establecimientos' && <EstablecimientosTab ccData={ccData || null} periodoLabel={periodoLabel} />}
          {activeTab === 'operadores' && <OperadoresTab ccData={ccData || null} periodoLabel={periodoLabel} />}
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
