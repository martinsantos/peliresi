import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Truck, Activity, TrendingUp, FileDown, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';

export default function TransporteTab({ data, periodo, onExportPDF }: { data: any; periodo: string; onExportPDF: () => void }) {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const resumen = data.resumen || {};
  const transportistas = data.transportistas || [];

  const toggleSort = (key: string) => setSortConfig(prev =>
    prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
  );
  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ChevronUp size={12} className="ml-1 opacity-30 inline" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-1 text-primary-600 inline" /> : <ChevronDown size={12} className="ml-1 text-primary-600 inline" />;
  };

  const sortedTransportistas = useMemo(() => {
    if (!sortConfig) return transportistas;
    return [...transportistas].sort((a: any, b: any) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.key) {
        case 'transportista': return dir * (a.transportista || '').localeCompare(b.transportista || '', 'es');
        case 'totalViajes': return dir * ((a.totalViajes || 0) - (b.totalViajes || 0));
        case 'completados': return dir * ((a.completados || 0) - (b.completados || 0));
        case 'enTransito': return dir * ((a.enTransito || 0) - (b.enTransito || 0));
        case 'vehiculos': return dir * ((a.vehiculosRegistrados || 0) - (b.vehiculosRegistrados || 0));
        case 'choferes': return dir * ((a.choferesRegistrados || 0) - (b.choferesRegistrados || 0));
        case 'tasa': return dir * (parseFloat(a.tasaCompletitud || '0') - parseFloat(b.tasaCompletitud || '0'));
        default: return 0;
      }
    });
  }, [transportistas, sortConfig]);

  const chartData = useMemo(() =>
    transportistas
      .map((t: any) => ({
        name: t.transportista?.length > 18 ? t.transportista.substring(0, 15) + '...' : t.transportista,
        completados: t.completados || 0,
        enTransito: t.enTransito || 0,
        total: t.totalViajes || 0,
      }))
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 8),
  [transportistas]);

  const avgTasa = transportistas.length > 0
    ? transportistas.reduce((s: number, t: any) => s + parseFloat(t.tasaCompletitud || '0'), 0) / transportistas.length
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Transportistas" value={resumen.totalTransportistas || 0} color="from-violet-600 to-violet-700" />
        <KpiCard icon={Truck} label="Total Viajes" value={resumen.totalViajes || 0} color="from-blue-600 to-blue-700" />
        <KpiCard icon={Activity} label="En Tránsito" value={resumen.viajesActivos || 0} color="from-amber-600 to-amber-700" sub="viajes activos" />
        <KpiCard icon={TrendingUp} label="Tasa Promedio" value={`${avgTasa.toFixed(1)}%`} color="from-emerald-600 to-emerald-700" sub="completitud" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Viajes por Transportista" subtitle="Completados vs en tránsito" />
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} stroke="#94a3b8" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="completados" name="Completados" stackId="a" fill="#0D8A4F" radius={[0, 0, 0, 0]} barSize={22} />
                  <Bar dataKey="enTransito" name="En Tránsito" stackId="a" fill="#F59E0B" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos de transporte</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader title="Tasa de Completitud" subtitle="Promedio de todos los transportistas" />
          <CardContent>
            <div className="h-[320px] flex flex-col items-center justify-center">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={avgTasa >= 80 ? '#0D8A4F' : avgTasa >= 50 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${avgTasa * 2.64} 264`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-neutral-900">{avgTasa.toFixed(1)}%</span>
                  <span className="text-xs text-neutral-500">promedio</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-neutral-600">&ge;80% Óptimo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs text-neutral-600">&ge;50% Regular</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-xs text-neutral-600">&lt;50% Bajo</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {transportistas.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader
            title={`Detalle de Transportistas (${transportistas.length})`}
            subtitle="Estadísticas de cada transportista"
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
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('transportista')}>Transportista<SortIcon col="transportista" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('totalViajes')}>Viajes<SortIcon col="totalViajes" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('completados')}>Completados<SortIcon col="completados" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('enTransito')}>En Tránsito<SortIcon col="enTransito" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('vehiculos')}>Vehículos<SortIcon col="vehiculos" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('choferes')}>Choferes<SortIcon col="choferes" /></th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('tasa')}>Tasa<SortIcon col="tasa" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedTransportistas.map((t: any, i: number) => {
                    const tasa = parseFloat(t.tasaCompletitud || '0');
                    return (
                      <tr
                        key={i}
                        className="hover:bg-primary-50/30 transition-colors cursor-pointer"
                        onClick={() => t.transportistaId && navigate(`/admin/actores/transportistas/${t.transportistaId}`)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[200px] truncate">{t.transportista}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-neutral-900">{t.totalViajes}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600 font-semibold">{t.completados}</td>
                        <td className="px-4 py-3 text-sm text-amber-600 hidden md:table-cell">{t.enTransito}</td>
                        <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">{t.vehiculosRegistrados}</td>
                        <td className="px-4 py-3 text-sm text-neutral-600 hidden lg:table-cell">{t.choferesRegistrados}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-neutral-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${Math.min(tasa, 100)}%`,
                                backgroundColor: tasa >= 80 ? '#0D8A4F' : tasa >= 50 ? '#F59E0B' : '#EF4444',
                              }} />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: tasa >= 80 ? '#0D8A4F' : tasa >= 50 ? '#F59E0B' : '#EF4444' }}>
                              {t.tasaCompletitud}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
