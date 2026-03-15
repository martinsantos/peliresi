import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, Layers, MapPin, FileCheck, Calendar, Search, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { CHART_COLORS } from '../../../utils/chart-colors';
import { KpiCard } from '../../../components/charts/KpiCard';
import { useOperadores } from '../../../hooks/useActores';

export default function OperadoresTab({
  periodoLabel,
}: {
  ccData?: any; // Keep for compatibility but unused
  periodoLabel: string;
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

  // Fetch ALL operadores from database (not filtered by activity)
  const { data: paginatedData, isLoading } = useOperadores({ limit: 500 });
  const operadores = paginatedData?.items || [];

  const filtered = useMemo(() => {
    let list = operadores;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((o: any) =>
        o.razonSocial.toLowerCase().includes(q) ||
        o.cuit.toLowerCase().includes(q) ||
        (o.numeroHabilitacion || '').toLowerCase().includes(q)
      );
    }
    if (categoriaFilter.trim()) {
      const q = categoriaFilter.toLowerCase();
      list = list.filter((o: any) => (o.categoria || '').toLowerCase().includes(q));
    }
    if (sortConfig) {
      list = [...list].sort((a: any, b: any) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        switch (sortConfig.key) {
          case 'razonSocial': return dir * (a.razonSocial || '').localeCompare(b.razonSocial || '', 'es');
          case 'cuit': return dir * (a.cuit || '').localeCompare(b.cuit || '', 'es');
          case 'habilitacion': return dir * (a.numeroHabilitacion || '').localeCompare(b.numeroHabilitacion || '', 'es');
          case 'categoria': return dir * (a.categoria || '').localeCompare(b.categoria || '', 'es');
          case 'tratamientos': return dir * ((a.tratamientos?.length || 0) - (b.tratamientos?.length || 0));
          case 'estado': return dir * (Number(b.activo) - Number(a.activo));
          default: return 0;
        }
      });
    }
    return list;
  }, [operadores, searchQuery, categoriaFilter, sortConfig]);

  const byCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of operadores) {
      const cat = (o as any).categoria || 'Sin categoría';
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

  // Count by tipo (FIJO vs IN SITU)
  const byTipo = useMemo(() => {
    const fijo = operadores.filter((o: any) => (o.categoria || '').toUpperCase().includes('FIJO')).length;
    const inSitu = operadores.filter((o: any) => (o.categoria || '').toUpperCase().includes('IN SITU')).length;
    const mixto = operadores.filter((o: any) => {
      const cat = (o.categoria || '').toUpperCase();
      return cat.includes('FIJO') && cat.includes('IN SITU');
    }).length;
    return [
      { name: 'FIJO', value: fijo - mixto, fill: '#3B82F6' },
      { name: 'IN SITU', value: inSitu - mixto, fill: '#10B981' },
      { name: 'FIJO / IN SITU', value: mixto, fill: '#8B5CF6' },
    ].filter(x => x.value > 0);
  }, [operadores]);

  // Count tratamientos
  const totalTratamientos = useMemo(() => {
    return operadores.reduce((sum: number, o: any) => sum + (o.tratamientos?.length || 0), 0);
  }, [operadores]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <p className="mt-4 text-neutral-600 font-medium">Cargando operadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
        <Calendar size={14} className="text-blue-600 shrink-0" />
        <span className="text-xs font-medium text-blue-800">
          Mostrando: <strong>Todos los operadores registrados ({operadores.length})</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={FlaskConical} label="Total Operadores" value={operadores.length} color="from-blue-600 to-blue-700" />
        <KpiCard icon={Layers} label="Categorías" value={byCategoria.length} color="from-purple-600 to-purple-700" sub="tipos" />
        <KpiCard icon={FileCheck} label="Tratamientos" value={totalTratamientos} color="from-emerald-600 to-emerald-700" sub="autorizados" />
        <KpiCard icon={MapPin} label="FIJO" value={byTipo.find(x => x.name === 'FIJO')?.value || 0} color="from-cyan-600 to-cyan-700" sub="plantas fijas" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Por Tipo de Operación" subtitle="FIJO vs IN SITU" />
          <CardContent>
            {byTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={byTipo}
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
                    {byTipo.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader title="Por Categoría" subtitle="Distribución de operadores" />
          <CardContent>
            {byCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={byCategoria.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} stroke="#94a3b8" />
                  <Tooltip formatter={(value: any, name: any, props: any) => [value, props.payload.fullName || name]} />
                  <Bar dataKey="value" name="Operadores" fill="#3B82F6" radius={[0, 8, 8, 0]} barSize={22} />
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
          subtitle="Plantas de tratamiento registradas en el sistema"
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
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('razonSocial')}>Razón Social<SortIcon col="razonSocial" /></th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('cuit')}>CUIT<SortIcon col="cuit" /></th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('habilitacion')}>Habilitación<SortIcon col="habilitacion" /></th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('categoria')}>Categoría<SortIcon col="categoria" /></th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('tratamientos')}>Tratamientos<SortIcon col="tratamientos" /></th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort('estado')}>Estado<SortIcon col="estado" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.slice(0, 50).map((o: any, i: number) => (
                  <tr key={`${o.id}-${i}`} className="hover:bg-primary-50/30 transition-colors cursor-pointer" onClick={() => o.id && navigate(`/admin/actores/operadores/${o.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[250px] truncate" title={o.razonSocial}>
                      {o.razonSocial}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 font-mono text-xs">{o.cuit}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 font-mono text-xs">{o.numeroHabilitacion || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell max-w-[150px] truncate" title={o.categoria}>
                      {o.categoria || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="soft" color="primary">{o.tratamientos?.length || 0}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="soft" color={o.activo ? 'green' : 'red'}>
                        {o.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                  </tr>
                ))}
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
