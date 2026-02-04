/**
 * SITREP v6 - Centro de Inteligencia de Reportes (v3)
 * ====================================================
 * Recharts charts + jsPDF export + period presets + departamentos + actor map
 * + Ver Todos + Departamento Detail Modal + Interlinking
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  MapPin,
  Map as MapIcon,
  Eye,
  EyeOff,
  Layers,
  Factory,
  X,
  Search,
  ChevronRight,
  Filter,
  Building2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { useReporteManifiestos, useReporteTratados, useReporteTransporte, useExportarReporte } from '../../hooks/useReportes';
import { useCentroControl } from '../../hooks/useCentroControl';
import type { CentroControlData, ActorGenerador, ActorTransportista, ActorOperador } from '../../hooks/useCentroControl';
import { exportReportePDF } from '../../utils/exportPdf';
import { ESTADO_CHART_COLORS, CHART_COLORS } from '../../utils/chart-colors';
import { ChartTooltip } from '../../components/charts/ChartTooltip';
import { KpiCard } from '../../components/charts/KpiCard';
import { DATE_PRESETS, computeDateRange } from '../../utils/date-presets';
import { agruparPorDepartamento, getDepartamento } from '../../utils/mendoza-departamentos';
import { ACTOR_ICONS, ACTOR_COLORS, createColorIcon, createClusterIcon } from '../../utils/map-icons';
import type { ReporteFilters } from '../../types/api';

// ── Leaflet default icon fix ──
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type TabType = 'manifiestos' | 'tratados' | 'transporte' | 'establecimientos' | 'operadores' | 'departamentos' | 'mapa';

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'manifiestos', label: 'Manifiestos', icon: FileText },
  { id: 'tratados', label: 'Residuos Tratados', icon: Package },
  { id: 'transporte', label: 'Transporte', icon: Truck },
  { id: 'establecimientos', label: 'Establecimientos', icon: Building2 },
  { id: 'operadores', label: 'Operadores', icon: Factory },
  { id: 'departamentos', label: 'Departamentos', icon: MapPin },
  { id: 'mapa', label: 'Mapa de Actores', icon: MapIcon },
];

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

// ── Cluster helper ──
function clusterMarkers<T extends { latitud: number; longitud: number }>(
  items: T[],
): (T & { count?: number })[] {
  if (items.length < 50) return items;
  const gridSize = 0.05;
  const clusters = new Map<string, { items: T[]; lat: number; lng: number }>();
  for (const item of items) {
    const key = `${Math.round(item.latitud / gridSize)}_${Math.round(item.longitud / gridSize)}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.items.push(item);
      existing.lat = (existing.lat * (existing.items.length - 1) + item.latitud) / existing.items.length;
      existing.lng = (existing.lng * (existing.items.length - 1) + item.longitud) / existing.items.length;
    } else {
      clusters.set(key, { items: [item], lat: item.latitud, lng: item.longitud });
    }
  }
  return Array.from(clusters.values()).map(c => ({
    ...c.items[0],
    latitud: c.lat,
    longitud: c.lng,
    count: c.items.length > 1 ? c.items.length : undefined,
  }));
}

// ── CSV download helper ──
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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

  const avgTasa = transportistas.length > 0
    ? transportistas.reduce((s: number, t: any) => s + parseFloat(t.tasaCompletitud || '0'), 0) / transportistas.length
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

// ════════════════════════════════
// DEPARTAMENTO DETALLE MODAL
// ════════════════════════════════
type ActorUnified = {
  tipo: 'generador' | 'transportista' | 'operador';
  id: string;
  razonSocial: string;
  cuit: string;
  categoria: string;
  actividad: string;
};

function DepartamentoDetalleModal({
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
      generador: '/actores',
      transportista: '/actores/transportistas',
      operador: '/actores/operadores',
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
        <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-neutral-50/50">
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
          <table className="w-full text-left min-w-[600px]">
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

// ════════════════════════════════
// DEPARTAMENTOS TAB
// ════════════════════════════════
function DepartamentosTab({
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
    const transByDep = agruparPorDepartamento(ccData.transportistas || []);
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <table className="w-full text-left min-w-[500px]">
                <thead className="bg-neutral-50/80 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Departamento</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Gen.</span>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Trans.</span>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">
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
                      <td className="px-4 py-3 text-sm text-orange-600 font-semibold text-center">{d.transportistas}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-semibold text-center">{d.operadores}</td>
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

// ════════════════════════════════
// MAPA DE ACTORES TAB
// ════════════════════════════════
function MapaActoresTab({
  ccData,
  onSelectDep,
  periodoLabel,
}: {
  ccData: CentroControlData | null;
  onSelectDep: (dep: string) => void;
  periodoLabel: string;
}) {
  const [layers, setLayers] = useState({
    generadores: true,
    transportistas: true,
    operadores: true,
  });

  const toggleLayer = useCallback((layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const generadoresClustered = useMemo(() => {
    if (!ccData?.generadores) return [];
    return clusterMarkers(ccData.generadores as any[]);
  }, [ccData?.generadores]);

  const totalGen = ccData?.generadores?.length || 0;
  const totalTrans = ccData?.transportistas?.length || 0;
  const totalOper = ccData?.operadores?.length || 0;

  if (!ccData) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <p className="mt-4 text-neutral-600 font-medium">Cargando datos del mapa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Active filter banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Calendar size={14} className="text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800">
          Actores en mapa filtrados por: <strong>{periodoLabel}</strong>
        </span>
      </div>

      {/* KPI + Layer toggles */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm">
        <Layers size={16} className="text-neutral-400" />
        {([
          { key: 'generadores' as const, label: 'Generadores', color: 'bg-green-500', count: totalGen },
          { key: 'transportistas' as const, label: 'Transportistas', color: 'bg-orange-500', count: totalTrans },
          { key: 'operadores' as const, label: 'Operadores', color: 'bg-blue-500', count: totalOper },
        ]).map(l => (
          <button
            key={l.key}
            onClick={() => toggleLayer(l.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              layers[l.key]
                ? 'bg-white border-neutral-200 text-neutral-700 shadow-sm'
                : 'bg-neutral-50 border-transparent text-neutral-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${layers[l.key] ? l.color : 'bg-neutral-300'}`} />
            <span>{l.label}</span>
            <Badge variant="soft" color="neutral" className="text-[10px] px-1.5 py-0 ml-1">{l.count}</Badge>
            {layers[l.key] ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        ))}
        <div className="ml-auto text-xs text-neutral-500">
          {totalGen + totalTrans + totalOper} actores totales
        </div>
      </div>

      {/* Map */}
      <Card padding="none">
        <div className="p-5">
          <div className="h-[32rem] sm:h-[36rem] rounded-xl overflow-hidden border border-neutral-200 relative isolate">
            <MapContainer
              center={[-32.9287, -68.8535]}
              zoom={10}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
              className="z-0"
            >
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* Generadores */}
              {layers.generadores && generadoresClustered.map((g: any, idx: number) => (
                <Marker
                  key={`gen-${g.id}-${idx}`}
                  position={[g.latitud, g.longitud]}
                  icon={g.count ? createClusterIcon(g.count, ACTOR_COLORS.generador) : ACTOR_ICONS.generador}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-green-700">{g.razonSocial}</strong>
                      {g.count && <span className="text-xs text-neutral-500 ml-1">({g.count} en zona)</span>}
                      <br />
                      <span className="text-xs text-neutral-500">CUIT: {g.cuit}</span><br />
                      <span className="text-xs text-neutral-500">Cat: {g.categoria}</span><br />
                      <span className="text-xs font-medium">Manifiestos: {g.cantManifiestos}</span><br />
                      <button
                        className="text-xs text-primary-600 hover:underline mt-1"
                        onClick={() => onSelectDep(getDepartamento(g.latitud, g.longitud))}
                      >
                        Ver departamento: {getDepartamento(g.latitud, g.longitud)}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Transportistas */}
              {layers.transportistas && ccData.transportistas?.map((t, idx) => (
                <Marker
                  key={`trans-${t.id}-${idx}`}
                  position={[t.latitud, t.longitud]}
                  icon={ACTOR_ICONS.transportista}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-orange-700">{t.razonSocial}</strong><br />
                      <span className="text-xs text-neutral-500">CUIT: {t.cuit}</span><br />
                      <span className="text-xs">Vehículos: {t.vehiculosActivos}</span><br />
                      <span className="text-xs font-medium">En tránsito: {t.enviosEnTransito}</span><br />
                      <button
                        className="text-xs text-primary-600 hover:underline mt-1"
                        onClick={() => onSelectDep(getDepartamento(t.latitud, t.longitud))}
                      >
                        Ver departamento: {getDepartamento(t.latitud, t.longitud)}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Operadores */}
              {layers.operadores && ccData.operadores?.map((o, idx) => (
                <Marker
                  key={`oper-${o.id}-${idx}`}
                  position={[o.latitud, o.longitud]}
                  icon={ACTOR_ICONS.operador}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-blue-700">{o.razonSocial}</strong><br />
                      <span className="text-xs text-neutral-500">CUIT: {o.cuit}</span><br />
                      <span className="text-xs text-neutral-500">Cat: {o.categoria}</span><br />
                      <span className="text-xs">Recibidos: {o.cantRecibidos} | Tratados: {o.cantTratados}</span><br />
                      <button
                        className="text-xs text-primary-600 hover:underline mt-1"
                        onClick={() => onSelectDep(getDepartamento(o.latitud, o.longitud))}
                      >
                        Ver departamento: {getDepartamento(o.latitud, o.longitud)}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Legend overlay */}
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-[400] text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Generadores</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Transportistas</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Operadores</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════
// ESTABLECIMIENTOS TAB
// ════════════════════════════════
function EstablecimientosTab({
  ccData,
  periodoLabel,
}: {
  ccData: CentroControlData | null;
  periodoLabel: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');

  const generadores = ccData?.generadores || [];

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
      const dep = getDepartamento(g.latitud, g.longitud);
      map[dep] = (map[dep] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [generadores]);

  if (!ccData) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <p className="mt-4 text-neutral-600 font-medium">Cargando establecimientos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Calendar size={14} className="text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800">
          Establecimientos filtrados por: <strong>{periodoLabel}</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Building2} label="Total Establecimientos" value={generadores.length} color="from-purple-600 to-purple-700" />
        <KpiCard icon={Package} label="Categorías" value={byCategoria.length} color="from-indigo-600 to-indigo-700" sub="tipos" />
        <KpiCard icon={MapPin} label="Departamentos" value={byDep.length} color="from-violet-600 to-violet-700" sub="con presencia" />
        <KpiCard icon={FileText} label="Manifiestos" value={generadores.reduce((s, g) => s + g.cantManifiestos, 0)} color="from-emerald-600 to-emerald-700" sub="generados" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader title="Por Categoría" subtitle="Distribución de establecimientos" />
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
          <CardHeader title="Por Departamento" subtitle="Top departamentos con establecimientos" />
          <CardContent>
            {byDep.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={byDep} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} stroke="#94a3b8" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Establecimientos" fill="#7C3AED" radius={[0, 8, 8, 0]} barSize={22} />
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
          title={`Listado de Establecimientos (${filtered.length})`}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-neutral-50/80 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Razón Social</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">CUIT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Categoría</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Departamento</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Manifiestos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.slice(0, 50).map((g, i) => (
                  <tr key={`${g.id}-${i}`} className="hover:bg-primary-50/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900 max-w-[200px] truncate">{g.razonSocial}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 font-mono text-xs">{g.cuit}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">{g.categoria || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{getDepartamento(g.latitud, g.longitud)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="soft" color="primary">{g.cantManifiestos}</Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-400 text-sm">Sin establecimientos que coincidan</td>
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

// ════════════════════════════════
// OPERADORES TAB
// ════════════════════════════════
function OperadoresTab({
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

// ════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════
const ReportesPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ── Period filter state (default: Ver Todos = days 0) ──
  const [datePreset, setDatePreset] = useState(0);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('manifiestos');

  // ── Department detail modal ──
  const [selectedDep, setSelectedDep] = useState<string | null>(null);

  const exportarReporte = useExportarReporte();

  // ── Filters computed reactively ──
  const appliedFilters: ReporteFilters | undefined = useMemo(() => {
    if (!fechaDesde && !fechaHasta) return undefined;
    return {
      ...(fechaDesde ? { fechaDesde } : {}),
      ...(fechaHasta ? { fechaHasta } : {}),
    };
  }, [fechaDesde, fechaHasta]);

  // ── Date preset handler ──
  const handleDatePreset = useCallback((days: number) => {
    setDatePreset(days);
    const range = computeDateRange(days);
    setFechaDesde(range.desde);
    setFechaHasta(range.hasta);
  }, []);

  // ── Queries — reports (only fetch if filters exist, i.e. dates are set) ──
  const manifiestos = useReporteManifiestos(activeTab === 'manifiestos' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);
  const tratados = useReporteTratados(activeTab === 'tratados' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);
  const transporte = useReporteTransporte(activeTab === 'transporte' ? (appliedFilters || { fechaDesde: '', fechaHasta: '' }) : undefined);

  // ── Centro Control data (for Departamentos + Mapa tabs) ──
  // When "Ver Todos" (empty dates), don't send date params → backend returns all actors
  const ccParams = useMemo(() => ({
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    capas: ['generadores', 'transportistas', 'operadores'],
  }), [fechaDesde, fechaHasta]);

  const { data: ccData } = useCentroControl(ccParams, 0);

  const activeQuery = activeTab === 'manifiestos' ? manifiestos
    : activeTab === 'tratados' ? tratados
    : activeTab === 'transporte' ? transporte
    : null; // departamentos & mapa use ccData

  const periodoLabel = fechaDesde && fechaHasta
    ? `${fechaDesde} — ${fechaHasta}`
    : 'Todos los períodos';

  const handleExportCSV = () => {
    const tipoMap: Record<string, string> = { manifiestos: 'manifiestos', tratados: 'manifiestos', transporte: 'transportistas' };
    const tipo = tipoMap[activeTab];
    if (tipo) {
      exportarReporte.mutate({ tipo, formato: 'csv', filters: appliedFilters || {} });
    }
  };

  const handleExportPDF = () => {
    const data = activeQuery?.data;
    if (!data) return;

    const tabLabels: Record<string, string> = {
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
    } else if (activeTab === 'transporte') {
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
      titulo: tabLabels[activeTab] || 'Reporte',
      subtitulo: `${tabs.find(t => t.id === activeTab)?.label} - Sistema SITREP`,
      periodo: periodoLabel,
      kpis,
      tabla: { headers, rows },
    });
  };

  // ── Department detail modal data ──
  const depModalData = useMemo(() => {
    if (!selectedDep || !ccData) return null;
    const genByDep = agruparPorDepartamento(ccData.generadores || []);
    const transByDep = agruparPorDepartamento(ccData.transportistas || []);
    const operByDep = agruparPorDepartamento(ccData.operadores || []);
    return {
      generadores: (genByDep[selectedDep] || []) as ActorGenerador[],
      transportistas: (transByDep[selectedDep] || []) as ActorTransportista[],
      operadores: (operByDep[selectedDep] || []) as ActorOperador[],
    };
  }, [selectedDep, ccData]);

  // ── Handle department selection (from any tab) ──
  const handleSelectDep = useCallback((dep: string) => {
    setSelectedDep(dep);
  }, []);

  // ── Is this a report tab (API-backed), geo tab (ccData-backed)? ──
  const isReportTab = activeTab === 'manifiestos' || activeTab === 'tratados' || activeTab === 'transporte';
  const isGeoTab = activeTab === 'departamentos' || activeTab === 'mapa' || activeTab === 'establecimientos' || activeTab === 'operadores';

  return (
    <>
      {/* ── Sticky Filter Bar + Tabs ── */}
      <div className="sticky top-0 z-20 bg-[#FAFAF8] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-1">
        {/* Period presets + export actions */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-2xl border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar size={16} className="text-neutral-400" />
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => handleDatePreset(p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  datePreset === p.days
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-neutral-500 hover:bg-neutral-50 border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="hidden sm:flex items-center gap-1.5 ml-2 text-xs text-neutral-400">
              <input
                type="date"
                value={fechaDesde}
                onChange={e => { setFechaDesde(e.target.value); setDatePreset(-1); }}
                className="px-2 py-1 rounded border border-neutral-200 text-neutral-600 text-xs"
              />
              <span>—</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => { setFechaHasta(e.target.value); setDatePreset(-1); }}
                className="px-2 py-1 rounded border border-neutral-200 text-neutral-600 text-xs"
              />
            </div>
          </div>
          {/* Right side: period badge + export buttons */}
          <div className="ml-auto flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              datePreset === 0
                ? 'text-neutral-600 bg-neutral-100 border-neutral-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              <Calendar size={11} />
              {periodoLabel}
            </span>
            {isReportTab && (
              <>
                <Button variant="outline" size="sm" leftIcon={<Printer size={14} />} onClick={() => window.print()} className="hidden sm:inline-flex">Imprimir</Button>
                <Button variant="outline" size="sm" leftIcon={exportarReporte.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} onClick={handleExportCSV} disabled={exportarReporte.isPending}>CSV</Button>
                <Button size="sm" leftIcon={<FileDown size={14} />} onClick={handleExportPDF} disabled={!activeQuery?.data}>PDF</Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 gap-1 overflow-x-auto mt-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="mt-4 isolate">
      {isReportTab ? (
        // Report tabs (manifiestos, tratados, transporte)
        activeQuery?.isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
              <BarChart3 size={24} className="absolute inset-0 m-auto text-primary-500" />
            </div>
            <p className="mt-4 text-neutral-600 font-medium">Generando reporte...</p>
            <p className="text-sm text-neutral-400 mt-1">Consultando datos del sistema</p>
          </div>
        ) : activeQuery?.isError ? (
          <Card className="border-0 shadow-sm">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="text-red-400" size={24} />
              </div>
              <p className="text-error-600 font-medium">Error al generar el reporte</p>
              <p className="text-sm text-neutral-500 mt-1">Verifica tu conexión e intenta nuevamente</p>
            </div>
          </Card>
        ) : activeQuery?.data ? (
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
              <p className="text-neutral-700 font-medium">Cargando reporte...</p>
              <p className="text-sm text-neutral-500 mt-1">Los gráficos se actualizarán automáticamente</p>
            </div>
          </Card>
        )
      ) : (
        // Geo/actor tabs (departamentos, mapa, establecimientos, operadores)
        <>
          {activeTab === 'departamentos' && <DepartamentosTab ccData={ccData || null} onSelectDep={handleSelectDep} periodoLabel={periodoLabel} />}
          {activeTab === 'mapa' && <MapaActoresTab ccData={ccData || null} onSelectDep={handleSelectDep} periodoLabel={periodoLabel} />}
          {activeTab === 'establecimientos' && <EstablecimientosTab ccData={ccData || null} periodoLabel={periodoLabel} />}
          {activeTab === 'operadores' && <OperadoresTab ccData={ccData || null} periodoLabel={periodoLabel} />}
        </>
      )}

      {/* ── Department Detail Modal ── */}
      {selectedDep && depModalData && (
        <DepartamentoDetalleModal
          departamento={selectedDep}
          generadores={depModalData.generadores}
          transportistas={depModalData.transportistas}
          operadores={depModalData.operadores}
          periodoLabel={periodoLabel}
          onClose={() => setSelectedDep(null)}
        />
      )}
      </div>
    </>
  );
};

export default ReportesPage;
