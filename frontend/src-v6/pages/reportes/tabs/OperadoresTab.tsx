import React, { useState, useMemo } from 'react';
import {
  Factory, Package, Activity, TrendingUp, Calendar, Search,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { CHART_COLORS } from '../../../utils/chart-colors';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';
import type { CentroControlData } from '../../../hooks/useCentroControl';

export default function OperadoresTab({
  ccData,
  periodoLabel,
}: {
  ccData: CentroControlData | null;
  periodoLabel: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');

  const operadores = ccData?.operadores || [];

  const filtered = useMemo(() => {
    let list = operadores;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => o.razonSocial.toLowerCase().includes(q) || o.cuit.toLowerCase().includes(q));
    }
    if (categoriaFilter.trim()) {
      const q = categoriaFilter.toLowerCase();
      list = list.filter(o => (o.categoria || '').toLowerCase().includes(q));
    }
    return list;
  }, [operadores, searchQuery, categoriaFilter]);

  const byCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of operadores) {
      const cat = o.categoria || 'Sin categoría';
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value], i) => ({
        name: name.length > 20 ? name.substring(0, 17) + '...' : name,
        fullName: name,
        value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [operadores]);

  const totalRecibidos = operadores.reduce((s, o) => s + o.cantRecibidos, 0);
  const totalTratados = operadores.reduce((s, o) => s + o.cantTratados, 0);

  if (!ccData) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <p className="mt-4 text-neutral-600 font-medium">Cargando operadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Calendar size={14} className="text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800">
          Operadores filtrados por: <strong>{periodoLabel}</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Factory} label="Total Operadores" value={operadores.length} color="from-blue-600 to-blue-700" />
        <KpiCard icon={Package} label="Recibidos" value={totalRecibidos} color="from-amber-600 to-amber-700" sub="manifiestos" />
        <KpiCard icon={Activity} label="Tratados" value={totalTratados} color="from-emerald-600 to-emerald-700" sub="manifiestos" />
        <KpiCard icon={TrendingUp} label="Tasa Tratamiento" value={totalRecibidos > 0 ? `${((totalTratados / totalRecibidos) * 100).toFixed(1)}%` : '0%'} color="from-teal-600 to-teal-700" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Por Categoría" subtitle="Tipos de operadores" />
          <CardContent>
            {byCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={byCategoria}
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
                    {byCategoria.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any, props: any) => [value, props.payload.fullName || name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader title="Recibidos vs Tratados" subtitle="Por operador (top 10)" />
          <CardContent>
            {operadores.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={operadores
                    .map(o => ({
                      name: o.razonSocial.length > 15 ? o.razonSocial.substring(0, 12) + '...' : o.razonSocial,
                      recibidos: o.cantRecibidos,
                      tratados: o.cantTratados,
                    }))
                    .sort((a, b) => (b.recibidos + b.tratados) - (a.recibidos + a.tratados))
                    .slice(0, 10)
                  }
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} stroke="#94a3b8" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="recibidos" name="Recibidos" stackId="a" fill="#F59E0B" barSize={22} />
                  <Bar dataKey="tratados" name="Tratados" stackId="a" fill="#0D8A4F" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader
          title={`Listado de Operadores (${filtered.length})`}
          subtitle="Plantas de tratamiento registradas"
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
                placeholder="Categoría..."
                value={categoriaFilter}
                onChange={e => setCategoriaFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 w-32"
              />
            </div>
          }
        />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-neutral-50/80 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Razón Social</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">CUIT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Categoría</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Recibidos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Tratados</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Tasa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.slice(0, 50).map((o, i) => {
                  const tasa = o.cantRecibidos > 0 ? (o.cantTratados / o.cantRecibidos) * 100 : 0;
                  return (
                    <tr key={`${o.id}-${i}`} className="hover:bg-primary-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[200px] truncate">{o.razonSocial}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 font-mono text-xs">{o.cuit}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">{o.categoria || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="soft" color="orange">{o.cantRecibidos}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="soft" color="green">{o.cantTratados}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${Math.min(tasa, 100)}%`,
                              backgroundColor: tasa >= 80 ? '#0D8A4F' : tasa >= 50 ? '#F59E0B' : '#EF4444',
                            }} />
                          </div>
                          <span className="text-xs font-semibold" style={{ color: tasa >= 80 ? '#0D8A4F' : tasa >= 50 ? '#F59E0B' : '#EF4444' }}>
                            {tasa.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-neutral-400 text-sm">Sin operadores que coincidan</td>
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
