import React, { useState, useMemo } from 'react';
import { ReportRow, ReportSortHeader } from './ReportTableControls';
import {
  Package, Activity, Factory, FileDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { CHART_COLORS } from '../../../utils/chart-colors';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';
import { CategoryBarChart } from '../../../components/charts/CategoryBarChart';

export default function TratadosTab({ data, periodo, onExportPDF }: { data: any; periodo: string; onExportPDF: () => void }) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const resumen = data.resumen || {};
  const porGenerador = data.porGenerador || {};
  const totalPorTipo = data.totalPorTipo || {};
  const detalle = data.detalle || [];

  const toggleSort = (key: string) => setSortConfig(prev =>
    prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
  );

  const sortedDetalle = useMemo(() => {
    if (!sortConfig) return detalle;
    return [...detalle].sort((a: any, b: any) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.key) {
        case 'numero': return dir * (a.numero || '').localeCompare(b.numero || '', 'es');
        case 'generador': return dir * (a.generador || '').localeCompare(b.generador || '', 'es');
        case 'metodo': return dir * (a.metodoTratamiento || '').localeCompare(b.metodoTratamiento || '', 'es');
        case 'residuos': return dir * ((a.residuos?.length || 0) - (b.residuos?.length || 0));
        case 'fecha': return dir * (new Date(a.fechaTratamiento || 0).getTime() - new Date(b.fechaTratamiento || 0).getTime());
        default: return 0;
      }
    });
  }, [detalle, sortConfig]);

  const generadorData = useMemo(() =>
    Object.entries(porGenerador)
      .map(([name, value]) => ({
        name: name.length > 20 ? name.substring(0, 17) + '...' : name,
        fullName: name,
        manifiestos: value as number,
      }))
      .sort((a, b) => b.manifiestos - a.manifiestos)
      .slice(0, 10),
  [porGenerador]);

  const tipoData = useMemo(() =>
    Object.entries(totalPorTipo).map(([name, value], i) => ({
      name: name.length > 25 ? name.substring(0, 22) + '...' : name,
      fullName: name,
      value: value as number,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
  [totalPorTipo]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={Package} label="Manifiestos Tratados" value={resumen.totalManifiestosTratados || 0} color="from-emerald-600 to-emerald-700" />
        <KpiCard icon={Activity} label="Residuos Tratados" value={`${(resumen.totalResiduosTratados || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`} color="from-teal-600 to-teal-700" />
        <KpiCard icon={Factory} label="Generadores" value={Object.keys(porGenerador).length} color="from-blue-600 to-blue-700" sub="involucrados" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Manifiestos por Generador" subtitle="Top generadores por volumen" />
          <CardContent>
            {generadorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={generadorData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} stroke="#94a3b8" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="manifiestos" name="manifiestos" fill="#0D8A4F" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos de generadores</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader title="Distribución por Código de Residuo" subtitle="Proporción de cada tipo tratado" />
          <CardContent>
            <div className="max-h-[320px] overflow-y-auto pr-2">
              <CategoryBarChart data={tipoData} maxItems={12} emptyMessage="Sin datos de tipos" />
            </div>
          </CardContent>
        </Card>
      </div>

      {detalle.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader
            className="flex-col sm:flex-row"
            title={`Detalle de Tratamientos (${detalle.length})`}
            subtitle="Registros de residuos tratados"
            action={
              <Button variant="outline" size="sm" leftIcon={<FileDown size={16} />} onClick={onExportPDF}>
                Exportar PDF
              </Button>
            }
          />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-50/80 border-b border-neutral-200">
                  <tr>
                    <ReportSortHeader column="numero" label="Número" sort={sortConfig} onSort={toggleSort} />
                    <ReportSortHeader column="generador" label="Generador" sort={sortConfig} onSort={toggleSort} />
                    <ReportSortHeader column="metodo" label="Método" sort={sortConfig} onSort={toggleSort} className="hidden md:table-cell" />
                    <ReportSortHeader column="fecha" label="Fecha" sort={sortConfig} onSort={toggleSort} />
                    <ReportSortHeader column="residuos" label="Residuos" sort={sortConfig} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedDetalle.map((d: any, i: number) => (
                    <ReportRow key={i} to={d.id ? `/manifiestos/${d.id}` : undefined}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-primary-600">{d.numero}</td>
                      <td className="px-4 py-3 text-sm text-neutral-900 max-w-[200px] truncate" title={d.generador}>{d.generador}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 hidden md:table-cell">{d.metodoTratamiento || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500">{d.fechaTratamiento ? new Date(d.fechaTratamiento).toLocaleDateString('es-AR') : '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="soft" color="primary">{d.residuos?.length || 0}</Badge>
                      </td>
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
