import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Activity, Users, FileDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { CHART_COLORS } from '../../../utils/chart-colors';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';

export default function TratadosTab({ data, periodo, onExportPDF }: { data: any; periodo: string; onExportPDF: () => void }) {
  const navigate = useNavigate();
  const resumen = data.resumen || {};
  const porGenerador = data.porGenerador || {};
  const totalPorTipo = data.totalPorTipo || {};
  const detalle = data.detalle || [];

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
        <KpiCard icon={Users} label="Generadores" value={Object.keys(porGenerador).length} color="from-blue-600 to-blue-700" sub="involucrados" />
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
            {tipoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={tipoData}
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
                    {tipoData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any, props: any) => [value, props.payload.fullName || name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos de tipos</div>
            )}
          </CardContent>
        </Card>
      </div>

      {detalle.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader
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
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Número</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Generador</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Método</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Residuos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {detalle.slice(0, 200).map((d: any, i: number) => (
                    <tr key={i} className="hover:bg-primary-50/30 transition-colors cursor-pointer" onClick={() => d.id && navigate(`/manifiestos/${d.id}`)}>
                      <td className="px-4 py-3 text-sm font-semibold text-primary-600">{d.numero}</td>
                      <td className="px-4 py-3 text-sm text-neutral-900 max-w-[200px] truncate">{d.generador}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 hidden md:table-cell">{d.metodoTratamiento || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500">{d.fechaTratamiento ? new Date(d.fechaTratamiento).toLocaleDateString('es-AR') : '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="soft" color="primary">{d.residuos?.length || 0}</Badge>
                      </td>
                    </tr>
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
