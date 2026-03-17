import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Package, Activity, TrendingUp, FileDown, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { ESTADO_CHART_COLORS, CHART_COLORS } from '../../../utils/chart-colors';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';

export default function ManifiestosTab({ data, periodo, onExportPDF }: { data: any; periodo: string; onExportPDF: () => void }) {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const resumen = data.resumen || {};
  const porEstado = data.porEstado || {};
  const porTipoResiduo = data.porTipoResiduo || {};
  const manifiestosList = data.manifiestos || [];

  const toggleSort = (key: string) => setSortConfig(prev =>
    prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
  );
  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ChevronUp size={12} className="ml-1 opacity-30 inline" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-1 text-primary-600 inline" /> : <ChevronDown size={12} className="ml-1 text-primary-600 inline" />;
  };

  const sortedManifiestos = useMemo(() => {
    if (!sortConfig) return manifiestosList;
    return [...manifiestosList].sort((a: any, b: any) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.key) {
        case 'numero': return dir * (a.numero || '').localeCompare(b.numero || '', 'es');
        case 'estado': return dir * (a.estado || '').localeCompare(b.estado || '', 'es');
        case 'generador': return dir * (a.generador || '').localeCompare(b.generador || '', 'es');
        case 'transportista': return dir * (a.transportista || '').localeCompare(b.transportista || '', 'es');
        case 'operador': return dir * (a.operador || '').localeCompare(b.operador || '', 'es');
        case 'fecha': return dir * (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        default: return 0;
      }
    });
  }, [manifiestosList, sortConfig]);

  const estadoData = useMemo(() =>
    Object.entries(porEstado).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value: value as number,
      fill: ESTADO_CHART_COLORS[name] || '#94A3B8',
    })),
  [porEstado]);

  const residuoData = useMemo(() =>
    Object.entries(porTipoResiduo)
      .map(([name, value], i) => {
        // Backend returns { cantidad, unidad } objects OR plain numbers
        const numVal = typeof value === 'object' && value !== null
          ? Number((value as any).cantidad) || 0
          : Number(value) || 0;
        return {
          name: name.length > 25 ? name.substring(0, 22) + '...' : name,
          fullName: name,
          value: numVal,
          fill: CHART_COLORS[i % CHART_COLORS.length],
        };
      })
      .filter(d => d.value > 0),
  [porTipoResiduo]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={FileText} label="Total Manifiestos" value={resumen.totalManifiestos || 0} color="from-emerald-600 to-emerald-700" />
        <KpiCard icon={Package} label="Total Residuos" value={`${(resumen.totalResiduos || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`} color="from-blue-600 to-blue-700" />
        <KpiCard icon={Activity} label="Estados Activos" value={Object.keys(porEstado).length} color="from-indigo-600 to-indigo-700" sub="tipos de estado" />
        <KpiCard icon={TrendingUp} label="Tipos de Residuo" value={Object.keys(porTipoResiduo).length} color="from-amber-600 to-amber-700" sub="categorías" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Manifiestos por Estado" subtitle="Distribución según estado actual" />
          <CardContent>
            {estadoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={estadoData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} stroke="#94a3b8" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="manifiestos" radius={[0, 8, 8, 0]} barSize={28}>
                    {estadoData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos de estado</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader title="Distribución por Tipo de Residuo" subtitle="Proporción de cada categoría" />
          <CardContent>
            {residuoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={residuoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                  >
                    {residuoData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any, props: any) => [value, props.payload.fullName || name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos de residuos</div>
            )}
          </CardContent>
        </Card>
      </div>

      {manifiestosList.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader
            title={`Detalle de Manifiestos (${manifiestosList.length})`}
            subtitle="Registros individuales del período"
            action={
              <Button variant="outline" size="sm" leftIcon={<FileDown size={16} />} onClick={onExportPDF}>
                Exportar PDF
              </Button>
            }
          />
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-50/80 border-b border-neutral-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('numero')}>Número<SortIcon col="numero" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('estado')}>Estado<SortIcon col="estado" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('generador')}>Generador<SortIcon col="generador" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('transportista')}>Transportista<SortIcon col="transportista" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('operador')}>Operador<SortIcon col="operador" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('fecha')}>Fecha<SortIcon col="fecha" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedManifiestos.slice(0, 50).map((m: any, i: number) => (
                    <tr key={i} className="hover:bg-primary-50/30 transition-colors cursor-pointer" onClick={() => m.id && navigate(`/manifiestos/${m.id}`)}>
                      <td className="px-4 py-3 text-sm font-semibold text-primary-600">{m.numero}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{
                          backgroundColor: (ESTADO_CHART_COLORS[m.estado] || '#94A3B8') + '18',
                          color: ESTADO_CHART_COLORS[m.estado] || '#94A3B8',
                        }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ESTADO_CHART_COLORS[m.estado] || '#94A3B8' }} />
                          {m.estado?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 max-w-[200px] truncate">{m.generador}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 max-w-[200px] truncate hidden md:table-cell">{m.transportista || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 max-w-[200px] truncate hidden lg:table-cell">{m.operador || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500 hidden md:table-cell">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-AR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {manifiestosList.length > 50 && (
              <div className="px-4 py-3 bg-neutral-50/50 border-t border-neutral-100 text-center">
                <p className="text-sm text-neutral-500">Mostrando 50 de {manifiestosList.length} registros — Exporte para ver todos</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
