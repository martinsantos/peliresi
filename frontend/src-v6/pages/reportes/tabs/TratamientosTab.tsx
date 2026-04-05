/**
 * SITREP v6 - Reportes > Tab Tratamientos
 * ========================================
 * Estadísticas reales del catálogo de tratamientos de residuos peligrosos.
 * Datos estáticos derivados del CSV de operadores DPA/SAyOT.
 */

import React, { useState, useMemo } from 'react';
import {
  FlaskConical, AlertTriangle, Layers, Search, Calendar, Download, FileDown, Printer,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { Select } from '../../../components/ui/Select';
import { KpiCard } from '../../../components/charts/KpiCard';
import { downloadCsv } from '../../../utils/exportCsv';
import { exportReportePDF } from '../../../utils/exportPdf';
import {
  CATEGORIAS_TRATAMIENTO,
  TODOS_LOS_METODOS,
  STATS_TRATAMIENTOS,
  getRiesgoMetodo,
  getOperadorEnriched,
} from '../../../data/tratamientos-catalogo';
import { useOperadoresEnrichment } from '../../../hooks/useEnrichment';

const CAT_CHART_COLORS: Record<string, string> = {
  biologico: '#22C55E',
  fisicoquimico: '#3B82F6',
  termico: '#EF4444',
  extraccion_vapores: '#06B6D4',
  extraccion_liquidos: '#6366F1',
  remediacion: '#F59E0B',
  asbesto: '#F97316',
  almacenamiento: '#64748B',
  reciclaje: '#14B8A6',
  industrial: '#8B5CF6',
};

const RIESGO_COLORS: Record<string, string> = {
  critico: '#EF4444',
  alto: '#F59E0B',
  medio: '#3B82F6',
  bajo: '#22C55E',
};

const RIESGO_LABELS: Record<string, string> = {
  critico: 'Crítico (1 op.)',
  alto: 'Alto (2 op.)',
  medio: 'Medio (3-4 op.)',
  bajo: 'Bajo (5+ op.)',
};

export default function TratamientosTab({
  periodoLabel,
}: {
  periodoLabel: string;
}) {
  const { data: enrichmentData } = useOperadoresEnrichment();
  const OPERADORES_DATA = enrichmentData?.operadores || {};

  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // ── KPI data ──
  const byCategory = useMemo(() =>
    CATEGORIAS_TRATAMIENTO.map(c => ({
      name: c.nombre.length > 18 ? c.nombre.substring(0, 15) + '...' : c.nombre,
      fullName: c.nombre,
      value: c.metodos.length,
      fill: CAT_CHART_COLORS[c.id] || '#94A3B8',
    })).sort((a, b) => b.value - a.value),
  []);

  const byRisk = useMemo(() => {
    const counts: Record<string, number> = { critico: 0, alto: 0, medio: 0, bajo: 0 };
    for (const m of TODOS_LOS_METODOS) counts[getRiesgoMetodo(m)]++;
    return Object.entries(counts).map(([key, value]) => ({
      name: RIESGO_LABELS[key],
      value,
      fill: RIESGO_COLORS[key],
    }));
  }, []);

  // ── Corrientes coverage ──
  const corrienteCoverage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of TODOS_LOS_METODOS) {
      for (const y of m.corrientesY) {
        map[y] = (map[y] || 0) + 1;
      }
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, []);

  // ── Filtered table ──
  const filtered = useMemo(() => {
    let list = TODOS_LOS_METODOS;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m =>
        m.nombre.toLowerCase().includes(q) ||
        m.nombreCorto.toLowerCase().includes(q) ||
        m.descripcion.toLowerCase().includes(q) ||
        m.operadores.some(o => {
          const enr = getOperadorEnriched(o.cuit, OPERADORES_DATA);
          return enr && enr.empresa.toLowerCase().includes(q);
        })
      );
    }
    if (catFilter) {
      list = list.filter(m => {
        const cat = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));
        return cat?.id === catFilter;
      });
    }
    return list;
  }, [searchQuery, catFilter]);

  const handleExportCsv = () => {
    downloadCsv(
      filtered.map(m => {
        const cat = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));
        return {
          Categoría: cat?.nombre || '',
          Método: m.nombre,
          Descripción: m.descripcion,
          'Corrientes Y': m.corrientesY.join(', '),
          'Cant. Operadores': m.operadores.length,
          Operadores: m.operadores.map(o => {
            const enr = getOperadorEnriched(o.cuit, OPERADORES_DATA);
            return enr ? `${enr.empresa} (${o.tipo})` : o.cuit;
          }).join('; '),
          Riesgo: getRiesgoMetodo(m),
        };
      }),
      'reporte-tratamientos',
      {
        titulo: 'Reporte de Tratamientos',
        periodo: `${STATS_TRATAMIENTOS.totalMetodos} metodos en ${STATS_TRATAMIENTOS.totalCategorias} categorias`,
        filtros: [searchQuery ? `Busqueda: ${searchQuery}` : '', catFilter ? `Categoria: ${catFilter}` : ''].filter(Boolean).join(', ') || 'Sin filtros',
        total: filtered.length,
      }
    );
  };

  const handleExportPdf = () => {
    exportReportePDF({
      titulo: 'Reporte de Tratamientos',
      subtitulo: 'Métodos de tratamiento de residuos peligrosos',
      periodo: `${STATS_TRATAMIENTOS.totalMetodos} métodos en ${STATS_TRATAMIENTOS.totalCategorias} categorías`,
      kpis: [
        { label: 'Total Métodos', value: STATS_TRATAMIENTOS.totalMetodos },
        { label: 'Categorías', value: STATS_TRATAMIENTOS.totalCategorias },
        { label: 'Operadores', value: STATS_TRATAMIENTOS.totalOperadores },
        { label: 'Riesgo Crítico', value: STATS_TRATAMIENTOS.metodosCriticos },
      ],
      tabla: {
        headers: ['Categoría', 'Método', 'Corrientes Y', 'Operadores', 'Riesgo'],
        rows: filtered.map(m => {
          const cat = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));
          return [
            cat?.nombre || '',
            m.nombre,
            m.corrientesY.join(', '),
            m.operadores.length,
            getRiesgoMetodo(m),
          ];
        }),
      },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Period info banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
        <Calendar size={14} className="text-emerald-600 shrink-0" />
        <span className="text-xs font-medium text-emerald-800">
          Catálogo estático: <strong>{STATS_TRATAMIENTOS.totalMetodos} métodos de tratamiento en {STATS_TRATAMIENTOS.totalCategorias} categorías</strong> — derivado de los {STATS_TRATAMIENTOS.totalOperadores} operadores habilitados
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={FlaskConical} label="Métodos de Tratamiento" value={STATS_TRATAMIENTOS.totalMetodos} color="from-emerald-600 to-emerald-700" />
        <KpiCard icon={Layers} label="Categorías" value={STATS_TRATAMIENTOS.totalCategorias} color="from-blue-600 to-blue-700" />
        <KpiCard icon={FlaskConical} label="Operadores" value={STATS_TRATAMIENTOS.totalOperadores} color="from-blue-600 to-blue-700" sub="habilitados" />
        <KpiCard icon={AlertTriangle} label="Riesgo Crítico" value={STATS_TRATAMIENTOS.metodosCriticos} color="from-red-600 to-red-700" sub="solo 1 operador" />
      </div>

      {/* Charts: 2 columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut: By Category */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Métodos por Categoría" subtitle="Distribución de los 47 métodos" />
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={byCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={115}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {byCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, _: any, props: any) => [value, props.payload.fullName || _]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar: By Risk Level */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Nivel de Riesgo" subtitle="Basado en cantidad de operadores habilitados" />
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={byRisk}
                layout="vertical"
                margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" name="Métodos" radius={[0, 8, 8, 0]} barSize={28}>
                  {byRisk.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bar: Corrientes Y coverage */}
      <Card className="border-0 shadow-sm">
        <CardHeader title="Cobertura por Corriente Y" subtitle="Cantidad de métodos de tratamiento por cada corriente de residuo" />
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={corrienteCoverage} margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="value" name="Métodos" fill="#0D8A4F" radius={[6, 6, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader
          title={`Listado de Métodos (${filtered.length})`}
          subtitle="Todos los tratamientos con operadores habilitados"
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
              <Select
                value={catFilter}
                onChange={(val) => setCatFilter(val)}
                placeholder="Todas las categorías"
                options={[
                  { value: '', label: 'Todas las categorías' },
                  ...CATEGORIAS_TRATAMIENTO.map(c => ({ value: c.id, label: c.nombre })),
                ]}
                size="sm"
                isFullWidth={false}
              />
              <button onClick={() => window.print()} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors" title="Imprimir"><Printer size={14} />Imprimir</button>
              <button onClick={handleExportCsv} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg border border-primary-200 transition-colors" title="Exportar CSV"><Download size={14} />CSV</button>
              <button onClick={handleExportPdf} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error-700 bg-error-50 hover:bg-error-100 rounded-lg border border-error-200 transition-colors" title="Exportar PDF"><FileDown size={14} />PDF</button>
            </div>
          }
        />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50/80 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Método</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Categoría</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Operadores</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Corrientes Y</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.slice(0, 50).map((m, i) => {
                  const cat = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));
                  const riesgo = getRiesgoMetodo(m);
                  return (
                    <tr key={m.id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[280px]">
                        <p className="truncate" title={m.nombre}>{m.nombre}</p>
                        <p className="text-[11px] text-neutral-400 truncate">{m.descripcion.substring(0, 60)}...</p>
                      </td>
                      <td className="px-4 py-3">
                        {cat && (
                          <span
                            className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded"
                            style={{ backgroundColor: `${CAT_CHART_COLORS[cat.id]}15`, color: CAT_CHART_COLORS[cat.id] }}
                          >
                            {cat.nombre}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="soft" color="primary">{m.operadores.length}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-0.5">
                          {m.corrientesY.slice(0, 5).map(y => (
                            <span key={y} className="inline-block px-1 py-0.5 text-[9px] font-mono font-bold rounded bg-neutral-100 text-neutral-600">{y}</span>
                          ))}
                          {m.corrientesY.length > 5 && (
                            <span className="text-[9px] text-neutral-400 self-center">+{m.corrientesY.length - 5}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="soft"
                          color={riesgo === 'critico' ? 'error' : riesgo === 'alto' ? 'warning' : riesgo === 'medio' ? 'info' : 'success'}
                        >
                          {riesgo === 'critico' ? 'Crítico' : riesgo === 'alto' ? 'Alto' : riesgo === 'medio' ? 'Medio' : 'Bajo'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-400 text-sm">Sin métodos que coincidan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 50 && (
            <div className="px-4 py-3 bg-neutral-50/50 border-t border-neutral-100 text-center">
              <p className="text-sm text-neutral-500">Mostrando 50 de {filtered.length}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
