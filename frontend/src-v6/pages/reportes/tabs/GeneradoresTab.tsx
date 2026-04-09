import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory, Package, MapPin, FileText, Calendar, Search, ChevronUp, ChevronDown, Download, FileDown, Printer, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { CHART_COLORS } from '../../../utils/chart-colors';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';
import { CategoryBarChart } from '../../../components/charts/CategoryBarChart';
import { useGeneradores } from '../../../hooks/useActores';
import { downloadCsv } from './shared';
import { exportReportePDF } from '../../../utils/exportPdf';
import type { CentroControlData } from '../../../hooks/useCentroControl';

const TOP_N = 6; // top N categories in pie, rest -> "Otros"

export default function GeneradoresTab({
  ccData,
  periodoLabel,
  incluirTodos = true,
}: {
  ccData?: CentroControlData | null;
  periodoLabel: string;
  incluirTodos?: boolean;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const toggleSort = (key: string) => setSortConfig(prev =>
    prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
  );
  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ChevronUp size={12} className="ml-1 opacity-30 inline" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-1 text-primary-600 inline" /> : <ChevronDown size={12} className="ml-1 text-primary-600 inline" />;
  };

  // Fetch ALL generadores (used in "Ver Todos" mode)
  const { data: paginatedData, isLoading } = useGeneradores({ limit: 5000 });
  const allGeneradores = useMemo(() => (paginatedData?.items || []).map((g: any) => ({
    ...g,
    cantManifiestos: g._count?.manifiestos || 0,
    depto: g.domicilioRealDepto || g.domicilioLegalDepto || '',
  })), [paginatedData]);

  // Date-filtered generadores from Centro de Control
  const ccGeneradores = useMemo(() => {
    if (!ccData?.generadores?.length) return [];
    return ccData.generadores.map((g: any) => ({
      ...g,
      cantManifiestos: g.cantManifiestos || 0,
      depto: '',
    }));
  }, [ccData]);

  // Choose data source: ccData when date-filtered, full API when "Ver Todos"
  const isDateFiltered = !incluirTodos && ccGeneradores.length > 0;
  const generadores = isDateFiltered ? ccGeneradores : allGeneradores;

  const filtered = useMemo(() => {
    let list = generadores;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => g.razonSocial.toLowerCase().includes(q) || g.cuit.toLowerCase().includes(q));
    }
    if (categoriaFilter.trim()) {
      const q = categoriaFilter.toLowerCase();
      list = list.filter(g => (g.categoria || '').toLowerCase().includes(q));
    }
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        switch (sortConfig.key) {
          case 'razonSocial': return dir * (a.razonSocial || '').localeCompare(b.razonSocial || '', 'es');
          case 'categoria': return dir * (a.categoria || '').localeCompare(b.categoria || '', 'es');
          case 'departamento': return dir * (a.depto || '').localeCompare(b.depto || '', 'es');
          case 'manifiestos': return dir * (a.cantManifiestos - b.cantManifiestos);
          default: return 0;
        }
      });
    }
    return list;
  }, [generadores, searchQuery, categoriaFilter, sortConfig]);

  // Aggregate by categoria -- top N + "Otros"
  const byCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of generadores) {
      const cat = (g.categoria || '').trim() || 'Sin categoria';
      map[cat] = (map[cat] || 0) + 1;
    }
    const sorted = Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= TOP_N) {
      return sorted.map((s, i) => ({
        name: s.name.length > 22 ? s.name.substring(0, 19) + '...' : s.name,
        fullName: s.name,
        value: s.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }

    const top = sorted.slice(0, TOP_N);
    const otrosValue = sorted.slice(TOP_N).reduce((sum, s) => sum + s.value, 0);
    const otrosCount = sorted.length - TOP_N;
    return [
      ...top.map((s, i) => ({
        name: s.name.length > 22 ? s.name.substring(0, 19) + '...' : s.name,
        fullName: s.name,
        value: s.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
      {
        name: `Otros (${otrosCount})`,
        fullName: `Otros (${otrosCount} categorias)`,
        value: otrosValue,
        fill: '#CBD5E1',
      },
    ];
  }, [generadores]);

  // Aggregate by departamento from DB fields
  const byDep = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of generadores) {
      const dep = g.depto || 'Sin departamento';
      map[dep] = (map[dep] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [generadores]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const g of generadores) {
      if (g.categoria) cats.add(g.categoria);
    }
    return cats.size;
  }, [generadores]);

  if (isLoading && incluirTodos) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <p className="mt-4 text-neutral-600 font-medium">Cargando generadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${
        isDateFiltered
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        {isDateFiltered ? (
          <>
            <Filter size={14} className="text-amber-600 shrink-0" />
            <span className="text-xs font-medium text-amber-800">
              Mostrando <strong>{generadores.length} generadores con actividad</strong> en el periodo: <strong>{periodoLabel}</strong>
            </span>
          </>
        ) : (
          <>
            <Calendar size={14} className="text-blue-600 shrink-0" />
            <span className="text-xs font-medium text-blue-800">
              Mostrando: <strong>Todos los generadores registrados ({generadores.length})</strong>
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={Factory} label="Total Generadores" value={generadores.length} color="from-purple-600 to-purple-700" />
        <KpiCard icon={Package} label="Categorias" value={uniqueCategories} color="from-indigo-600 to-indigo-700" sub="tipos" />
        <KpiCard icon={MapPin} label="Departamentos" value={byDep.filter(d => d.name !== 'Sin departamento').length} color="from-violet-600 to-violet-700" sub="con presencia" />
        <KpiCard icon={FileText} label="Manifiestos" value={generadores.reduce((s: number, g: any) => s + g.cantManifiestos, 0)} color="from-emerald-600 to-emerald-700" sub={isDateFiltered ? 'en periodo' : 'generados'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Por Categoria" subtitle={`Distribucion de generadores (top ${TOP_N})`} />
          <CardContent>
            <div className="max-h-[320px] overflow-y-auto pr-2">
              <CategoryBarChart data={byCategoria} maxItems={10} emptyMessage="Sin datos" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader title="Por Departamento" subtitle="Top departamentos con generadores" />
          <CardContent>
            {byDep.length > 0 && byDep.some(d => d.name !== 'Sin departamento') ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={byDep} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} stroke="#94a3b8" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Generadores" fill="#7C3AED" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">
                {isDateFiltered ? 'Datos de departamento no disponibles con filtro de fecha' : 'Sin datos'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader
          title={`Listado de Generadores (${filtered.length})`}
          subtitle={isDateFiltered ? `Generadores con actividad en ${periodoLabel}` : 'Generadores registrados en el sistema'}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 w-44"
                />
              </div>
              <input
                type="text"
                placeholder="Categoria..."
                value={categoriaFilter}
                onChange={e => setCategoriaFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 w-32"
              />
              <button onClick={() => window.print()} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors" title="Imprimir"><Printer size={13} />Imprimir</button>
              <button
                onClick={() => {
                  const headers = ['Razon Social', 'CUIT', 'Categoria', 'Departamento', 'Manifiestos'];
                  const rows = filtered.map(g => [g.razonSocial, g.cuit, g.categoria || '-', g.depto || '-', g.cantManifiestos]);
                  downloadCsv(`generadores-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows, {
                    titulo: 'Reporte de Generadores',
                    periodo: periodoLabel || 'Todos los periodos',
                    filtros: [searchQuery ? `Busqueda: ${searchQuery}` : '', categoriaFilter ? `Categoria: ${categoriaFilter}` : ''].filter(Boolean).join(', ') || 'Sin filtros',
                    total: filtered.length,
                  });
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg border border-primary-200 transition-colors"
                title="Exportar a CSV"
              >
                <Download size={13} />
                CSV
              </button>
              <button
                onClick={() => {
                  exportReportePDF({
                    titulo: 'Reporte de Generadores',
                    subtitulo: `${filtered.length} generadores`,
                    periodo: periodoLabel || 'Todos los periodos',
                    kpis: [
                      { label: 'Total', value: generadores.length },
                      { label: 'Categorias', value: uniqueCategories },
                      { label: 'Departamentos', value: byDep.filter(d => d.name !== 'Sin departamento').length },
                      { label: 'Manifiestos', value: generadores.reduce((s: number, g: any) => s + g.cantManifiestos, 0) },
                    ],
                    tabla: {
                      headers: ['Razon Social', 'CUIT', 'Categoria', 'Departamento', 'Manifiestos'],
                      rows: filtered.map(g => [g.razonSocial, g.cuit, g.categoria || '-', g.depto || '-', g.cantManifiestos]),
                    },
                  });
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error-700 bg-error-50 hover:bg-error-100 rounded-lg border border-error-200 transition-colors"
                title="Exportar a PDF"
              >
                <FileDown size={13} />
                PDF
              </button>
            </div>
          }
        />
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50/80 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('razonSocial')}>Razon Social<SortIcon col="razonSocial" /></th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">CUIT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('categoria')}>Categoria<SortIcon col="categoria" /></th>
                  {!isDateFiltered && (
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('departamento')}>Departamento<SortIcon col="departamento" /></th>
                  )}
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('manifiestos')}>Manifiestos<SortIcon col="manifiestos" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.slice(0, 100).map((g, i) => (
                  <tr key={`${g.id}-${i}`} className="hover:bg-primary-50/30 transition-colors cursor-pointer" onClick={() => g.id && navigate(`/admin/actores/generadores/${g.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[200px] truncate">{g.razonSocial}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 font-mono text-xs">{g.cuit}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell max-w-[150px] truncate" title={g.categoria}>{g.categoria || '-'}</td>
                    {!isDateFiltered && (
                      <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">{g.depto || '\u2014'}</td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <Badge variant="soft" color="primary">{g.cantManifiestos}</Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isDateFiltered ? 4 : 5} className="px-4 py-12 text-center text-neutral-400 text-sm">Sin generadores que coincidan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <div className="px-4 py-3 bg-neutral-50/50 border-t border-neutral-100 text-center">
              <p className="text-sm text-neutral-500">Mostrando 100 de {filtered.length}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
