/**
 * SITREP v6 - Centro de Inteligencia de Reportes
 * ================================================
 * World-class reporting with Recharts + jsPDF export
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Truck,
  BarChart3,
  Calendar,
  Download,
  ArrowLeft,
  Loader2,
  FileDown,
  Activity,
  Package,
  Users,
  TrendingUp,
  Printer,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { useReporteManifiestos, useReporteTratados, useReporteTransporte, useExportarReporte } from '../../hooks/useReportes';
import { exportReportePDF } from '../../utils/exportPdf';
import type { ReporteFilters } from '../../types/api';

// ── Colors ──
const CHART_COLORS = ['#0D8A4F', '#1B5E3C', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: '#94A3B8',
  APROBADO: '#6366F1',
  EN_TRANSITO: '#F59E0B',
  ENTREGADO: '#14B8A6',
  RECIBIDO: '#3B82F6',
  TRATADO: '#0D8A4F',
  RECHAZADO: '#EF4444',
  ANULADO: '#DC2626',
};

type TabType = 'manifiestos' | 'tratados' | 'transporte';

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'manifiestos', label: 'Manifiestos', icon: FileText },
  { id: 'tratados', label: 'Residuos Tratados', icon: Package },
  { id: 'transporte', label: 'Transporte', icon: Truck },
];

// ── Custom Recharts Tooltip ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-neutral-200 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-neutral-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: p.color }}>
          <span className="font-bold">{p.value}</span> {p.name}
        </p>
      ))}
    </div>
  );
}

// ── KPI Card ──
function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-5 group hover:shadow-lg transition-all duration-300 hover-lift`}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -translate-y-1/3 translate-x-1/3 group-hover:scale-125 transition-transform duration-500" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon size={20} className="text-white" />
          </div>
        </div>
        <p className="text-3xl font-extrabold text-white tracking-tight">{value}</p>
        <p className="text-sm text-white/80 font-medium mt-1">{label}</p>
        {sub && <p className="text-xs text-white/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Donut Center Label ──
function DonutCenterLabel({ viewBox, total }: any) {
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} y={cy - 8} className="fill-neutral-900 text-2xl font-bold">{total}</tspan>
      <tspan x={cx} y={cy + 12} className="fill-neutral-500 text-xs">Total</tspan>
    </text>
  );
}

// ════════════════════════════════
// MANIFIESTOS TAB
// ════════════════════════════════
function ManifiestosTab({ data, periodo, onExportPDF }: { data: any; periodo: string; onExportPDF: () => void }) {
  const resumen = data.resumen || {};
  const porEstado = data.porEstado || {};
  const porTipoResiduo = data.porTipoResiduo || {};
  const manifiestosList = data.manifiestos || [];

  const estadoData = useMemo(() =>
    Object.entries(porEstado).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value: value as number,
      fill: ESTADO_COLORS[name] || '#94A3B8',
    })),
  [porEstado]);

  const residuoData = useMemo(() =>
    Object.entries(porTipoResiduo).map(([name, value], i) => ({
      name: name.length > 25 ? name.substring(0, 22) + '...' : name,
      fullName: name,
      value: value as number,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
  [porTipoResiduo]);

  const totalEstados = estadoData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={FileText} label="Total Manifiestos" value={resumen.totalManifiestos || 0} color="from-emerald-600 to-emerald-700" />
        <KpiCard icon={Package} label="Total Residuos" value={`${(resumen.totalResiduos || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`} color="from-blue-600 to-blue-700" />
        <KpiCard icon={Activity} label="Estados Activos" value={Object.keys(porEstado).length} color="from-indigo-600 to-indigo-700" sub="tipos de estado" />
        <KpiCard icon={TrendingUp} label="Tipos de Residuo" value={Object.keys(porTipoResiduo).length} color="from-amber-600 to-amber-700" sub="categorías" />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar Chart - Por Estado */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Manifiestos por Estado" subtitle="Distribución según estado actual" />
          <CardContent>
            {estadoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={estadoData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} />
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

        {/* Donut Chart - Por Tipo Residuo */}
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

      {/* Data Table */}
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
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-neutral-50/80 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Número</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Generador</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Transportista</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Operador</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {manifiestosList.slice(0, 50).map((m: any, i: number) => (
                    <tr key={i} className="hover:bg-primary-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-primary-600">{m.numero}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{
                          backgroundColor: (ESTADO_COLORS[m.estado] || '#94A3B8') + '18',
                          color: ESTADO_COLORS[m.estado] || '#94A3B8',
                        }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ESTADO_COLORS[m.estado] || '#94A3B8' }} />
                          {m.estado?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 max-w-[200px] truncate">{m.generador}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 max-w-[200px] truncate hidden md:table-cell">{m.transportista || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 max-w-[200px] truncate hidden lg:table-cell">{m.operador || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500">{m.fechaCreacion ? new Date(m.fechaCreacion).toLocaleDateString('es-AR') : '-'}</td>
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

// ════════════════════════════════
// TRATADOS TAB
// ════════════════════════════════
function TratadosTab({ data, periodo, onExportPDF }: { data: any; periodo: string; onExportPDF: () => void }) {
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
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={Package} label="Manifiestos Tratados" value={resumen.totalManifiestosTratados || 0} color="from-emerald-600 to-emerald-700" />
        <KpiCard icon={Activity} label="Residuos Tratados" value={`${(resumen.totalResiduosTratados || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`} color="from-teal-600 to-teal-700" />
        <KpiCard icon={Users} label="Generadores" value={Object.keys(porGenerador).length} color="from-blue-600 to-blue-700" sub="involucrados" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar - Por Generador */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Manifiestos por Generador" subtitle="Top generadores por volumen" />
          <CardContent>
            {generadorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={generadorData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="manifiestos" name="manifiestos" fill="#0D8A4F" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-neutral-400">Sin datos de generadores</div>
            )}
          </CardContent>
        </Card>

        {/* Pie - Por Código Residuo */}
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

      {/* Table */}
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
              <table className="w-full text-left min-w-[600px]">
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
                  {detalle.slice(0, 50).map((d: any, i: number) => (
                    <tr key={i} className="hover:bg-primary-50/30 transition-colors">
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

// ════════════════════════════════
// TRANSPORTE TAB
// ════════════════════════════════
function TransporteTab({ data, periodo, onExportPDF }: { data: any; periodo: string; onExportPDF: () => void }) {
  const resumen = data.resumen || {};
  const transportistas = data.transportistas || [];

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

  // Gauge data for completion rate
  const avgTasa = transportistas.length > 0
    ? transportistas.reduce((s: number, t: any) => s + parseFloat(t.tasaCompletitud || '0'), 0) / transportistas.length
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Transportistas" value={resumen.totalTransportistas || 0} color="from-violet-600 to-violet-700" />
        <KpiCard icon={Truck} label="Total Viajes" value={resumen.totalViajes || 0} color="from-blue-600 to-blue-700" />
        <KpiCard icon={Activity} label="En Tránsito" value={resumen.viajesActivos || 0} color="from-amber-600 to-amber-700" sub="viajes activos" />
        <KpiCard icon={TrendingUp} label="Tasa Promedio" value={`${avgTasa.toFixed(1)}%`} color="from-emerald-600 to-emerald-700" sub="completitud" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Stacked Bar - Viajes por Transportista */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Viajes por Transportista" subtitle="Completados vs en tránsito" />
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} />
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

        {/* Gauge/Radial - Tasa de completitud */}
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

      {/* Table */}
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
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-neutral-50/80 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Transportista</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Viajes</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Completados</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">En Tránsito</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Vehículos</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Choferes</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tasa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {transportistas.map((t: any, i: number) => {
                    const tasa = parseFloat(t.tasaCompletitud || '0');
                    return (
                      <tr key={i} className="hover:bg-primary-50/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[200px] truncate">{t.transportista}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-neutral-900">{t.totalViajes}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600 font-semibold">{t.completados}</td>
                        <td className="px-4 py-3 text-sm text-amber-600 hidden md:table-cell">{t.enTransito}</td>
                        <td className="px-4 py-3 text-sm text-neutral-600 hidden lg:table-cell">{t.vehiculosRegistrados}</td>
                        <td className="px-4 py-3 text-sm text-neutral-600 hidden lg:table-cell">{t.choferesRegistrados}</td>
                        <td className="px-4 py-3">
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

// ════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════
const ReportesPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // State
  const [activeTab, setActiveTab] = useState<TabType>('manifiestos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<ReporteFilters>({});

  const exportarReporte = useExportarReporte();

  // Queries - all enabled based on appliedFilters
  const manifiestos = useReporteManifiestos(activeTab === 'manifiestos' ? appliedFilters : undefined);
  const tratados = useReporteTratados(activeTab === 'tratados' ? appliedFilters : undefined);
  const transporte = useReporteTransporte(activeTab === 'transporte' ? appliedFilters : undefined);

  const activeQuery = activeTab === 'manifiestos' ? manifiestos : activeTab === 'tratados' ? tratados : transporte;

  const periodoLabel = appliedFilters.fechaDesde && appliedFilters.fechaHasta
    ? `${appliedFilters.fechaDesde} — ${appliedFilters.fechaHasta}`
    : appliedFilters.fechaDesde
    ? `Desde ${appliedFilters.fechaDesde}`
    : appliedFilters.fechaHasta
    ? `Hasta ${appliedFilters.fechaHasta}`
    : 'Todo el período';

  const handleGenerar = () => {
    const filters: ReporteFilters = {};
    if (fechaDesde) filters.fechaDesde = fechaDesde;
    if (fechaHasta) filters.fechaHasta = fechaHasta;
    setAppliedFilters(filters);
  };

  const handleExportCSV = () => {
    const tipoMap: Record<TabType, string> = { manifiestos: 'manifiestos', tratados: 'manifiestos', transporte: 'transportistas' };
    exportarReporte.mutate({ tipo: tipoMap[activeTab], formato: 'csv', filters: appliedFilters });
  };

  const handleExportPDF = () => {
    const data = activeQuery.data;
    if (!data) return;

    const tabLabels: Record<TabType, string> = {
      manifiestos: 'Reporte de Manifiestos',
      tratados: 'Reporte de Residuos Tratados',
      transporte: 'Reporte de Transporte',
    };

    let kpis: { label: string; value: string | number }[] = [];
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeTab === 'manifiestos') {
      const r: any = data.resumen || {};
      const list = (data as any).manifiestos || [];
      kpis = [
        { label: 'Total Manifiestos', value: r.totalManifiestos || 0 },
        { label: 'Total Residuos (kg)', value: Number(r.totalResiduos || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 }) },
        { label: 'Estados', value: Object.keys((data as any).porEstado || {}).length },
      ];
      headers = ['Número', 'Estado', 'Generador', 'Transportista', 'Operador', 'Fecha'];
      rows = list.map((m: any) => [
        m.numero || '',
        m.estado || '',
        m.generador || '',
        m.transportista || '',
        m.operador || '',
        m.fechaCreacion ? new Date(m.fechaCreacion).toLocaleDateString('es-AR') : '',
      ]);
    } else if (activeTab === 'tratados') {
      const r: any = data.resumen || {};
      const list = (data as any).detalle || [];
      kpis = [
        { label: 'Manifiestos Tratados', value: r.totalManifiestosTratados || 0 },
        { label: 'Residuos Tratados (kg)', value: Number(r.totalResiduosTratados || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 }) },
        { label: 'Generadores', value: Object.keys((data as any).porGenerador || {}).length },
      ];
      headers = ['Número', 'Generador', 'Método', 'Fecha', 'Residuos'];
      rows = list.map((d: any) => [
        d.numero || '',
        d.generador || '',
        d.metodoTratamiento || '',
        d.fechaTratamiento ? new Date(d.fechaTratamiento).toLocaleDateString('es-AR') : '',
        d.residuos?.length || 0,
      ]);
    } else {
      const r: any = data.resumen || {};
      const list = (data as any).transportistas || [];
      kpis = [
        { label: 'Transportistas', value: r.totalTransportistas || 0 },
        { label: 'Total Viajes', value: r.totalViajes || 0 },
        { label: 'En Tránsito', value: r.viajesActivos || 0 },
      ];
      headers = ['Transportista', 'Viajes', 'Completados', 'En Tránsito', 'Vehículos', 'Tasa'];
      rows = list.map((t: any) => [
        t.transportista || '',
        t.totalViajes || 0,
        t.completados || 0,
        t.enTransito || 0,
        t.vehiculosRegistrados || 0,
        t.tasaCompletitud || '0%',
      ]);
    }

    exportReportePDF({
      titulo: tabLabels[activeTab],
      subtitulo: `${tabs.find(t => t.id === activeTab)?.label} - Sistema SITREP`,
      periodo: periodoLabel,
      kpis,
      tabla: { headers, rows },
    });
  };

  // Auto-generate on mount with empty filters
  React.useEffect(() => {
    setAppliedFilters({});
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-neutral-600" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-neutral-900">Centro de Reportes</h2>
              <Badge variant="soft" color="primary">Inteligencia</Badge>
            </div>
            <p className="text-neutral-600 mt-1">
              Análisis dinámico con gráficos interactivos y exportación profesional
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer size={16} />}
            onClick={() => window.print()}
          >
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={exportarReporte.isPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            onClick={handleExportCSV}
            disabled={exportarReporte.isPending}
          >
            CSV
          </Button>
          <Button
            size="sm"
            leftIcon={<FileDown size={16} />}
            onClick={handleExportPDF}
            disabled={!activeQuery.data}
          >
            PDF
          </Button>
        </div>
      </div>

      {/* ── Filters Row ── */}
      <Card className="border-0 shadow-sm">
        <div className="p-4 flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white transition-all"
              />
            </div>
          </div>
          <Button
            leftIcon={activeQuery.isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            onClick={handleGenerar}
            disabled={activeQuery.isLoading}
          >
            Generar
          </Button>
        </div>
      </Card>

      {/* ── Tabs ── */}
      <div className="flex border-b border-neutral-200 gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {activeQuery.isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
            <BarChart3 size={24} className="absolute inset-0 m-auto text-primary-500" />
          </div>
          <p className="mt-4 text-neutral-600 font-medium">Generando reporte...</p>
          <p className="text-sm text-neutral-400 mt-1">Consultando datos del sistema</p>
        </div>
      ) : activeQuery.isError ? (
        <Card className="border-0 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="text-red-400" size={24} />
            </div>
            <p className="text-error-600 font-medium">Error al generar el reporte</p>
            <p className="text-sm text-neutral-500 mt-1">Verifica tu conexión e intenta nuevamente</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleGenerar}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : activeQuery.data ? (
        <>
          {activeTab === 'manifiestos' && <ManifiestosTab data={activeQuery.data} periodo={periodoLabel} onExportPDF={handleExportPDF} />}
          {activeTab === 'tratados' && <TratadosTab data={activeQuery.data} periodo={periodoLabel} onExportPDF={handleExportPDF} />}
          {activeTab === 'transporte' && <TransporteTab data={activeQuery.data} periodo={periodoLabel} onExportPDF={handleExportPDF} />}
        </>
      ) : (
        <Card className="border-0 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="text-neutral-400" size={24} />
            </div>
            <p className="text-neutral-700 font-medium">Selecciona un período y genera el reporte</p>
            <p className="text-sm text-neutral-500 mt-1">Los gráficos se actualizarán automáticamente</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReportesPage;
