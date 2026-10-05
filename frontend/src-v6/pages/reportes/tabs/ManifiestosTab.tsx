import React, { useState, useMemo } from 'react';
import { ReportRow, ReportSortHeader } from './ReportTableControls';
import { formatReportQuantities } from '../../../utils/report-quantities';
import {
  FileText, Package, Activity, TrendingUp, FileDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { CHART_TEXT_COLOR, ESTADO_CHART_COLORS } from '../../../utils/chart-colors';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';
import { ReportResidueBreakdown } from './ReportResidueBreakdown';

export default function ManifiestosTab({ data, periodo, onExportPDF }: { data: any; periodo: string; onExportPDF: () => void }) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const resumen = data.resumen || {};
  const porEstado = data.porEstado || {};
  const porTipoResiduo = data.porTipoResiduo || {};
  const manifiestosList = data.manifiestos || [];

  const toggleSort = (key: string) => setSortConfig(prev =>
    prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
  );

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={FileText} label="Total Manifiestos" value={resumen.totalManifiestos || 0} color="from-emerald-700 to-emerald-800" />
        <KpiCard icon={Package} label="Residuos de esta página" value={formatReportQuantities(manifiestosList)} valueClassName="text-xl sm:text-3xl break-words" color="from-blue-700 to-blue-800" />
        <KpiCard icon={Activity} label="Estados presentes" value={Object.keys(porEstado).length} color="from-indigo-700 to-indigo-800" sub="tipos de estado" />
        <KpiCard icon={TrendingUp} label="Tipos de esta página" value={Object.keys(porTipoResiduo).length} color="from-amber-700 to-amber-800" sub="categorías" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Manifiestos por Estado" subtitle="Distribución según estado actual" />
          <CardContent>
            {estadoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={estadoData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: CHART_TEXT_COLOR }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: CHART_TEXT_COLOR }} width={100} stroke="#94a3b8" />
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
          <CardHeader title="Distribución por Tipo de Residuo" subtitle="Cantidad por unidad · esta página" />
          <CardContent>
            <div className="max-h-[320px] overflow-y-auto pr-2">
              <ReportResidueBreakdown rows={manifiestosList} category="tipo" />
            </div>
          </CardContent>
        </Card>
      </div>

      {manifiestosList.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader
            className="flex-col sm:flex-row"
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
                    <ReportSortHeader column="numero" label="Número" sort={sortConfig} onSort={toggleSort} />
                    <ReportSortHeader column="estado" label="Estado" sort={sortConfig} onSort={toggleSort} />
                    <ReportSortHeader column="generador" label="Generador" sort={sortConfig} onSort={toggleSort} />
                    <ReportSortHeader column="transportista" label="Transportista" sort={sortConfig} onSort={toggleSort} className="hidden md:table-cell" />
                    <ReportSortHeader column="operador" label="Operador" sort={sortConfig} onSort={toggleSort} className="hidden lg:table-cell" />
                    <ReportSortHeader column="fecha" label="Fecha" sort={sortConfig} onSort={toggleSort} className="hidden md:table-cell" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedManifiestos.map((m: any, i: number) => (
                    <ReportRow key={i} to={m.id ? `/manifiestos/${m.id}` : undefined}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-primary-600">{m.numero}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-neutral-700" style={{
                          backgroundColor: (ESTADO_CHART_COLORS[m.estado] || '#94A3B8') + '18',
                        }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ESTADO_CHART_COLORS[m.estado] || '#94A3B8' }} />
                          {m.estado?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 max-w-[200px] truncate" title={m.generador}>{m.generador}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 max-w-[200px] truncate hidden md:table-cell" title={m.transportista || '-'}>{m.transportista || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 max-w-[200px] truncate hidden lg:table-cell" title={m.operador || '-'}>{m.operador || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500 hidden md:table-cell">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-AR') : '-'}</td>
                    </ReportRow>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
