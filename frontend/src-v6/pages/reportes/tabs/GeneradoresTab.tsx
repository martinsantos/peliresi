import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory, Package, MapPin, FileText, Calendar, Search,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { CHART_COLORS } from '../../../utils/chart-colors';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';
import { getDepartamento } from '../../../utils/mendoza-departamentos';
import { useGeneradores } from '../../../hooks/useActores';

export default function GeneradoresTab({
  periodoLabel,
}: {
  ccData?: any; // kept for API compatibility
  periodoLabel: string;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');

  // Fetch ALL generadores from DB directly (not via Centro Control which filters by latitud != null)
  const { data: paginatedData, isLoading } = useGeneradores({ limit: 500 });
  const generadores = (paginatedData?.items || []).map((g: any) => ({
    ...g,
    cantManifiestos: g._count?.manifiestos || 0,
  }));

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
    return list;
  }, [generadores, searchQuery, categoriaFilter]);

  const byCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of generadores) {
      const cat = g.categoria || 'Sin categoría';
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
  }, [generadores]);

  const byDep = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of generadores) {
      const dep = (g.latitud && g.longitud) ? getDepartamento(g.latitud, g.longitud) : 'Sin coordenadas';
      map[dep] = (map[dep] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [generadores]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <p className="mt-4 text-neutral-600 font-medium">Cargando generadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Calendar size={14} className="text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800">
          Generadores filtrados por: <strong>{periodoLabel}</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={Factory} label="Total Generadores" value={generadores.length} color="from-purple-600 to-purple-700" />
        <KpiCard icon={Package} label="Categorías" value={byCategoria.length} color="from-indigo-600 to-indigo-700" sub="tipos" />
        <KpiCard icon={MapPin} label="Departamentos" value={byDep.length} color="from-violet-600 to-violet-700" sub="con presencia" />
        <KpiCard icon={FileText} label="Manifiestos" value={generadores.reduce((s, g) => s + g.cantManifiestos, 0)} color="from-emerald-600 to-emerald-700" sub="generados" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Por Categoría" subtitle="Distribución de generadores" />
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
          <CardHeader title="Por Departamento" subtitle="Top departamentos con generadores" />
          <CardContent>
            {byDep.length > 0 ? (
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
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader
          title={`Listado de Generadores (${filtered.length})`}
          subtitle="Generadores registrados en el sistema"
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
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50/80 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Razón Social</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">CUIT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Categoría</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Departamento</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Manifiestos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.slice(0, 100).map((g, i) => (
                  <tr key={`${g.id}-${i}`} className="hover:bg-primary-50/30 transition-colors cursor-pointer" onClick={() => g.id && navigate(`/admin/actores/generadores/${g.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[200px] truncate">{g.razonSocial}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 font-mono text-xs">{g.cuit}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">{g.categoria || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">{(g.latitud && g.longitud) ? getDepartamento(g.latitud, g.longitud) : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="soft" color="primary">{g.cantManifiestos}</Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-400 text-sm">Sin generadores que coincidan</td>
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
