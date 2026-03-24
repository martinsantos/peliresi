import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Truck, Factory, Package, Calendar, Filter, ChevronRight,
  Search, X, Download, Printer, FileDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { KpiCard } from '../../../components/charts/KpiCard';
import { ACTOR_COLORS } from '../../../utils/map-icons';
import { agruparPorDepartamento } from '../../../utils/mendoza-departamentos';
import { exportReportePDF } from '../../../utils/exportPdf';
import { downloadCsv } from './shared';
import type { CentroControlData, ActorGenerador, ActorTransportista, ActorOperador } from '../../../hooks/useCentroControl';

// ── Types ──
type ActorUnified = {
  tipo: 'generador' | 'transportista' | 'operador';
  id: string;
  razonSocial: string;
  cuit: string;
  categoria: string;
  actividad: string;
};

// ── DepartamentoDetalleModal ──
export function DepartamentoDetalleModal({
  departamento,
  generadores,
  transportistas,
  operadores,
  periodoLabel,
  onClose,
}: {
  departamento: string;
  generadores: ActorGenerador[];
  transportistas: ActorTransportista[];
  operadores: ActorOperador[];
  periodoLabel: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'generador' | 'transportista' | 'operador'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');

  const allActors: ActorUnified[] = useMemo(() => {
    const result: ActorUnified[] = [];
    for (const g of generadores) {
      result.push({
        tipo: 'generador',
        id: g.id,
        razonSocial: g.razonSocial,
        cuit: g.cuit,
        categoria: g.categoria || '-',
        actividad: `${g.cantManifiestos} manifiestos`,
      });
    }
    for (const t of transportistas) {
      result.push({
        tipo: 'transportista',
        id: t.id,
        razonSocial: t.razonSocial,
        cuit: t.cuit,
        categoria: '-',
        actividad: `${t.vehiculosActivos} veh. / ${t.enviosEnTransito} en tránsito`,
      });
    }
    for (const o of operadores) {
      result.push({
        tipo: 'operador',
        id: o.id,
        razonSocial: o.razonSocial,
        cuit: o.cuit,
        categoria: o.categoria || '-',
        actividad: `${o.cantRecibidos} recib. / ${o.cantTratados} tratados`,
      });
    }
    return result;
  }, [generadores, transportistas, operadores]);

  const filteredActors = useMemo(() => {
    let list = allActors;
    if (tipoFilter !== 'todos') {
      list = list.filter(a => a.tipo === tipoFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.razonSocial.toLowerCase().includes(q) || a.cuit.toLowerCase().includes(q));
    }
    if (categoriaFilter.trim()) {
      const q = categoriaFilter.toLowerCase();
      list = list.filter(a => a.categoria.toLowerCase().includes(q));
    }
    return list;
  }, [allActors, tipoFilter, searchQuery, categoriaFilter]);

  const tipoColor: Record<string, string> = {
    generador: 'text-green-700 bg-green-50',
    transportista: 'text-orange-700 bg-orange-50',
    operador: 'text-blue-700 bg-blue-50',
  };

  const tipoDot: Record<string, string> = {
    generador: 'bg-green-500',
    transportista: 'bg-orange-500',
    operador: 'bg-blue-500',
  };

  const tipoLabel: Record<string, string> = {
    generador: 'Generador',
    transportista: 'Transportista',
    operador: 'Operador',
  };

  const handleNavigateActor = (actor: ActorUnified) => {
    const routeMap: Record<string, string> = {
      generador: `/admin/actores/generadores/${actor.id}`,
      transportista: `/admin/actores/transportistas/${actor.id}`,
      operador: `/admin/actores/operadores/${actor.id}`,
    };
    navigate(routeMap[actor.tipo] || '/actores');
  };

  const handleExportPDF = () => {
    exportReportePDF({
      titulo: `Departamento: ${departamento}`,
      subtitulo: `Detalle de actores - Sistema SITREP`,
      periodo: `${filteredActors.length} actores${tipoFilter !== 'todos' ? ` (${tipoLabel[tipoFilter]})` : ''}`,
      kpis: [
        { label: 'Generadores', value: generadores.length },
        { label: 'Transportistas', value: transportistas.length },
        { label: 'Operadores', value: operadores.length },
        { label: 'Total', value: generadores.length + transportistas.length + operadores.length },
      ],
      tabla: {
        headers: ['Tipo', 'Razón Social', 'CUIT', 'Categoría', 'Actividad'],
        rows: filteredActors.map(a => [tipoLabel[a.tipo], a.razonSocial, a.cuit, a.categoria, a.actividad]),
      },
    });
  };

  const handleExportCSV = () => {
    downloadCsv(
      `departamento_${departamento.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`,
      ['Tipo', 'Razón Social', 'CUIT', 'Categoría', 'Actividad'],
      filteredActors.map(a => [tipoLabel[a.tipo], a.razonSocial, a.cuit, a.categoria, a.actividad]),
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl mx-4 bg-white rounded-2xl shadow-2xl animate-fade-in print:shadow-none print:rounded-none print:mx-0 print:max-w-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 print:border-neutral-300">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <MapPin size={20} className="text-primary-600" />
              Departamento: {departamento}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-neutral-500">
                {generadores.length + transportistas.length + operadores.length} actores registrados
              </p>
              <span className="text-neutral-300">|</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Calendar size={11} />
                {periodoLabel}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors print:hidden">
            <X size={20} className="text-neutral-500" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 sm:px-6 py-4 bg-neutral-50/50">
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-neutral-100">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-neutral-900">{generadores.length}</span>
            <span className="text-xs text-neutral-500">Generadores</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-neutral-100">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-sm font-semibold text-neutral-900">{transportistas.length}</span>
            <span className="text-xs text-neutral-500">Transportistas</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-neutral-100">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm font-semibold text-neutral-900">{operadores.length}</span>
            <span className="text-xs text-neutral-500">Operadores</span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-neutral-100 print:hidden">
          <Filter size={14} className="text-neutral-400" />
          <select
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 bg-white"
          >
            <option value="todos">Todos los tipos</option>
            <option value="generador">Generadores</option>
            <option value="transportista">Transportistas</option>
            <option value="operador">Operadores</option>
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar razón social o CUIT..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 w-52"
            />
          </div>
          <input
            type="text"
            placeholder="Filtrar categoría..."
            value={categoriaFilter}
            onChange={e => setCategoriaFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 w-36"
          />
          <span className="ml-auto text-xs text-neutral-400">{filteredActors.length} resultados</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-neutral-50/80 border-b border-neutral-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Razón Social</th>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">CUIT</th>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Categoría</th>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actividad</th>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider w-8 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredActors.map((a, i) => (
                <tr
                  key={`${a.tipo}-${a.id}-${i}`}
                  className="hover:bg-primary-50/30 transition-colors cursor-pointer group"
                  onClick={() => handleNavigateActor(a)}
                >
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${tipoColor[a.tipo]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tipoDot[a.tipo]}`} />
                      {tipoLabel[a.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[200px] truncate">{a.razonSocial}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 font-mono text-xs">{a.cuit}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">{a.categoria}</td>
                  <td className="px-4 py-3 text-sm text-neutral-700">{a.actividad}</td>
                  <td className="px-4 py-3 print:hidden">
                    <ChevronRight size={14} className="text-neutral-300 group-hover:text-primary-500 transition-colors" />
                  </td>
                </tr>
              ))}
              {filteredActors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-400 text-sm">
                    Sin actores que coincidan con los filtros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50/50 rounded-b-2xl print:hidden">
          <span className="text-xs text-neutral-500">
            {filteredActors.length} de {allActors.length} actores
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" leftIcon={<Printer size={14} />} onClick={handlePrint}>
              Imprimir
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={handleExportCSV}>
              CSV
            </Button>
            <Button size="sm" leftIcon={<FileDown size={14} />} onClick={handleExportPDF}>
              PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DepartamentosTab ──
export default function DepartamentosTab({
  ccData,
  onSelectDep,
  periodoLabel,
}: {
  ccData: CentroControlData | null;
  onSelectDep: (dep: string) => void;
  periodoLabel: string;
}) {
  const [depFilter, setDepFilter] = useState('');

  const depStats = useMemo(() => {
    if (!ccData) return [];
    const genByDep = agruparPorDepartamento(ccData.generadores || []);
    const transByDep = agruparPorDepartamento((ccData.transportistas || []).filter(t => t.latitud != null && t.longitud != null) as any);
    const operByDep = agruparPorDepartamento(ccData.operadores || []);

    const allDeps = new Set([
      ...Object.keys(genByDep),
      ...Object.keys(transByDep),
      ...Object.keys(operByDep),
    ]);

    return Array.from(allDeps)
      .map(dep => ({
        departamento: dep,
        generadores: genByDep[dep]?.length || 0,
        transportistas: transByDep[dep]?.length || 0,
        operadores: operByDep[dep]?.length || 0,
        total: (genByDep[dep]?.length || 0) + (transByDep[dep]?.length || 0) + (operByDep[dep]?.length || 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [ccData]);

  const filteredStats = useMemo(() => {
    if (!depFilter) return depStats;
    return depStats.filter(d => d.departamento === depFilter);
  }, [depStats, depFilter]);

  const totalGen = ccData?.generadores?.length || 0;
  const totalTrans = ccData?.transportistas?.length || 0;
  const totalOper = ccData?.operadores?.length || 0;

  const chartData = useMemo(() =>
    filteredStats.slice(0, 12).map(d => ({
      name: d.departamento.length > 14 ? d.departamento.substring(0, 11) + '...' : d.departamento,
      fullName: d.departamento,
      generadores: d.generadores,
      transportistas: d.transportistas,
      operadores: d.operadores,
    })),
  [filteredStats]);

  if (!ccData) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <p className="mt-4 text-neutral-600 font-medium">Cargando datos geográficos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Active filter banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Calendar size={14} className="text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800">
          Actores filtrados por: <strong>{periodoLabel}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={MapPin} label="Departamentos" value={depStats.length} color="from-violet-600 to-violet-700" sub="con actividad" />
        <KpiCard icon={Factory} label="Generadores" value={totalGen} color="from-green-600 to-green-700" />
        <KpiCard icon={Truck} label="Transportistas" value={totalTrans} color="from-orange-600 to-orange-700" />
        <KpiCard icon={Package} label="Operadores" value={totalOper} color="from-blue-600 to-blue-700" />
      </div>

      {/* Department filter */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm">
        <Filter size={16} className="text-neutral-400" />
        <select
          value={depFilter}
          onChange={e => {
            const val = e.target.value;
            setDepFilter(val);
            if (val) onSelectDep(val);
          }}
          className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 bg-white"
        >
          <option value="">Todos los departamentos</option>
          {depStats.map(d => (
            <option key={d.departamento} value={d.departamento}>
              {d.departamento} ({d.total})
            </option>
          ))}
        </select>
        {depFilter && (
          <button
            onClick={() => setDepFilter('')}
            className="text-xs text-primary-600 hover:underline"
          >
            Limpiar filtro
          </button>
        )}
        <span className="ml-auto text-xs text-neutral-500">
          Click en fila o barra para ver detalle del departamento
        </span>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader title="Actores por Departamento" subtitle="Distribución geográfica de generadores, transportistas y operadores" />
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 40)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} stroke="#94a3b8" />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="generadores"
                  name="Generadores"
                  stackId="a"
                  fill={ACTOR_COLORS.generador}
                  barSize={22}
                  className="cursor-pointer"
                  onClick={(_data: any, _idx: number, e: any) => {
                    const payload = e?.payload || _data;
                    if (payload?.fullName) onSelectDep(payload.fullName);
                  }}
                />
                <Bar
                  dataKey="transportistas"
                  name="Transportistas"
                  stackId="a"
                  fill={ACTOR_COLORS.transportista}
                  barSize={22}
                  className="cursor-pointer"
                  onClick={(_data: any, _idx: number, e: any) => {
                    const payload = e?.payload || _data;
                    if (payload?.fullName) onSelectDep(payload.fullName);
                  }}
                />
                <Bar
                  dataKey="operadores"
                  name="Operadores"
                  stackId="a"
                  fill={ACTOR_COLORS.operador}
                  radius={[0, 8, 8, 0]}
                  barSize={22}
                  className="cursor-pointer"
                  onClick={(_data: any, _idx: number, e: any) => {
                    const payload = e?.payload || _data;
                    if (payload?.fullName) onSelectDep(payload.fullName);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos geográficos</div>
          )}
        </CardContent>
      </Card>

      {filteredStats.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader title={`Detalle por Departamento (${filteredStats.length})`} subtitle="Click en una fila para ver los actores del departamento" />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-50/80 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Departamento</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Gen.</span>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center hidden md:table-cell">
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Trans.</span>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center hidden md:table-cell">
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Oper.</span>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Total</th>
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredStats.map((d, i) => (
                    <tr
                      key={i}
                      className="hover:bg-primary-50/30 transition-colors cursor-pointer group"
                      onClick={() => onSelectDep(d.departamento)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900">{d.departamento}</td>
                      <td className="px-4 py-3 text-sm text-green-600 font-semibold text-center">{d.generadores}</td>
                      <td className="px-4 py-3 text-sm text-orange-600 font-semibold text-center hidden md:table-cell">{d.transportistas}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-semibold text-center hidden md:table-cell">{d.operadores}</td>
                      <td className="px-4 py-3 text-sm font-bold text-neutral-900 text-center">{d.total}</td>
                      <td className="px-4 py-3">
                        <ChevronRight size={14} className="text-neutral-300 group-hover:text-primary-500 transition-colors" />
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
