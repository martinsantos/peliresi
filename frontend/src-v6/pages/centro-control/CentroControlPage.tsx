/**
 * SITREP v6 - Centro de Control — Sala de Operaciones
 * =====================================================
 * World-class operations dashboard with live polling,
 * pipeline funnel, Recharts, and expanded map
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Command,
  Activity,
  Truck,
  AlertTriangle,
  Clock,
  MapPin,
  TrendingUp,
  Users,
  FileText,
  Zap,
  Radio,
  Bell,
  ArrowLeft,
  RefreshCw,
  Shield,
  BarChart3,
  Settings,
  ChevronRight,
  Package,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useManifiestos } from '../../hooks/useManifiestos';
import { useAlertas } from '../../hooks/useAlertas';
import { useReporteManifiestos } from '../../hooks/useReportes';
import { EstadoManifiesto } from '../../types/models';
import { formatRelativeTime } from '../../utils/formatters';

// ── Leaflet Icons ──
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const truckIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

// ── Constants ──
const POLL_INTERVAL = 30; // seconds
const ESTADO_PIPELINE = ['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'] as const;
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
const CHART_COLORS = ['#0D8A4F', '#1B5E3C', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

// ── Custom Tooltip ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-neutral-200 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-neutral-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: p.color || p.fill }}>
          <span className="font-bold">{p.value}</span> {p.name}
        </p>
      ))}
    </div>
  );
}

export const CentroControlPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [countdown, setCountdown] = useState(POLL_INTERVAL);
  const [selectedView, setSelectedView] = useState<'mapa' | 'lista'>('mapa');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ── API Hooks ──
  const { data: statsData, refetch: refetchStats } = useDashboardStats();
  const { data: transitData } = useManifiestos({ estado: EstadoManifiesto.EN_TRANSITO, limit: 10 });
  const { data: alertasData } = useAlertas({ limit: 10 });
  const { data: reporteData } = useReporteManifiestos({});

  // ── Clock + Countdown ──
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setCountdown(prev => {
        if (prev <= 1) {
          refetchStats();
          return POLL_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refetchStats]);

  const handleManualRefresh = useCallback(() => {
    refetchStats();
    setCountdown(POLL_INTERVAL);
  }, [refetchStats]);

  // ── Compute dashboard stats ──
  const stats = useMemo(() => {
    const raw = (statsData as any)?.data || statsData || {};
    const estadisticas = raw.estadisticas || {};
    return {
      total: estadisticas.total || 0,
      borradores: estadisticas.borradores || 0,
      aprobados: estadisticas.aprobados || 0,
      enTransito: estadisticas.enTransito || 0,
      entregados: estadisticas.entregados || 0,
      recibidos: estadisticas.recibidos || 0,
      tratados: estadisticas.tratados || 0,
      // Fallback if data comes from other format
      manifiestos: raw.manifiestos || {},
      alertas: raw.alertas || {},
      actores: raw.actores || {},
    };
  }, [statsData]);

  // ── 5 KPI Cards ──
  const kpis = useMemo(() => [
    {
      label: 'Total Manifiestos',
      value: stats.total || stats.manifiestos?.total || 0,
      icon: FileText,
      gradient: 'from-emerald-600 to-emerald-700',
    },
    {
      label: 'En Tránsito',
      value: stats.enTransito || stats.manifiestos?.enTransito || 0,
      icon: Truck,
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      label: 'Pendientes',
      value: (stats.borradores || 0) + (stats.aprobados || 0) + (stats.manifiestos?.pendientes || 0),
      icon: Clock,
      gradient: 'from-blue-600 to-blue-700',
    },
    {
      label: 'Tratados',
      value: stats.tratados || stats.manifiestos?.tratados || 0,
      icon: Package,
      gradient: 'from-teal-600 to-teal-700',
    },
    {
      label: 'Alertas',
      value: stats.alertas?.criticas || stats.alertas?.total || 0,
      icon: AlertTriangle,
      gradient: 'from-red-500 to-red-600',
    },
  ], [stats]);

  // ── Pipeline data ──
  const pipelineData = useMemo(() => {
    // Try porEstado from reporte data first, then fallback to dashboard estadisticas
    const porEstado = (reporteData as any)?.porEstado || {};
    return ESTADO_PIPELINE.map(estado => ({
      name: estado.replace(/_/g, ' '),
      key: estado,
      count: porEstado[estado] || (stats as any)[estado.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] || 0,
      color: ESTADO_COLORS[estado],
    }));
  }, [reporteData, stats]);

  const pipelineTotal = pipelineData.reduce((s, d) => s + d.count, 0) || 1;

  // ── Donut data for distribution ──
  const donutData = useMemo(() => {
    return pipelineData
      .filter(d => d.count > 0)
      .map(d => ({ name: d.name, value: d.count, fill: d.color }));
  }, [pipelineData]);

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // ── Top generators bar chart ──
  const generadorData = useMemo(() => {
    const porGenerador = (reporteData as any)?.porTipoResiduo || {};
    return Object.entries(porGenerador)
      .map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 12) + '...' : name,
        value: value as number,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [reporteData]);

  // ── Viajes activos (map markers) ──
  const viajesActivos = useMemo(() => {
    const items = (transitData as any)?.data?.items || (transitData as any)?.data || transitData?.items;
    if (!items || !Array.isArray(items) || items.length === 0) return [];
    return items.slice(0, 8).map((m: any, i: number) => {
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      const angle = (angles[i % 8] * Math.PI) / 180;
      const radius = 0.02 + (i % 3) * 0.01;
      return {
        id: m.numero || m.id,
        rawId: m.id,
        chofer: m.transportista?.razonSocial || `Transportista ${i + 1}`,
        patente: m.vehiculo?.patente || '-',
        progreso: Math.min(95, 20 + i * 12),
        estado: i % 5 === 0 ? 'retraso' : 'normal',
        destino: m.operador?.razonSocial || 'Planta destino',
        lat: m.ultimaUbicacion?.latitud || -32.9287 + Math.cos(angle) * radius,
        lng: m.ultimaUbicacion?.longitud || -68.8535 + Math.sin(angle) * radius,
      };
    });
  }, [transitData]);

  // ── Alertas ──
  const alertas = useMemo(() => {
    const items = (alertasData as any)?.data?.items || (alertasData as any)?.data || alertasData?.items;
    if (!items || !Array.isArray(items) || items.length === 0) return [];
    return items.slice(0, 6).map((a: any) => ({
      id: a.id,
      tipo: a.estado === 'PENDIENTE' ? (a.regla?.evento?.includes('CRITICO') ? 'critical' : 'warning') : 'info',
      mensaje: a.regla?.nombre || a.datos || 'Alerta del sistema',
      tiempo: formatRelativeTime(a.createdAt),
    }));
  }, [alertasData]);

  // ── Recent activity ──
  const recentActivity = useMemo(() => {
    const recientes = (statsData as any)?.data?.recientes || (statsData as any)?.recientes || [];
    const transitItems = (transitData as any)?.data?.items || (transitData as any)?.data || transitData?.items || [];
    const combined = [...(Array.isArray(recientes) ? recientes : []), ...(Array.isArray(transitItems) ? transitItems : [])];
    const unique = combined.filter((item: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.id === item.id) === idx);
    return unique.slice(0, 6);
  }, [statsData, transitData]);

  // ── Quick Actions ──
  const quickActions = [
    { icon: FileText, label: 'Nuevo Manifiesto', path: '/manifiestos/nuevo', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
    { icon: Truck, label: 'Ver Flota', path: '/manifiestos?estado=EN_TRANSITO', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
    { icon: BarChart3, label: 'Reportes', path: '/reportes', color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
    { icon: Bell, label: 'Alertas', path: '/alertas', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
    { icon: Shield, label: 'Auditoría', path: '/auditoria', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
    { icon: Settings, label: 'Configuración', path: '/configuracion', color: 'text-neutral-600 bg-neutral-50 hover:bg-neutral-100' },
  ];

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* ══════ Header ══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-primary-50">
                <Command className="text-primary-600" size={22} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900">Centro de Control</h2>
              {/* LIVE badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-xs font-semibold text-red-600">LIVE</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-500">
              <span>Auto-refresh en {countdown}s</span>
              <button onClick={handleManualRefresh} className="p-1 hover:bg-neutral-100 rounded transition-colors" title="Actualizar ahora">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#1B5E3C]">
            {currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-xs sm:text-sm text-neutral-500">
            {currentTime.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      {/* ══════ 5 KPI Cards ══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 stagger-children">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${kpi.gradient} p-4 group hover:shadow-lg transition-all duration-300 hover-lift`}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-1/3 translate-x-1/3 group-hover:scale-125 transition-transform duration-500" />
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-2">
                  <Icon size={18} className="text-white" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{kpi.value}</p>
                <p className="text-xs text-white/75 font-medium mt-0.5">{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════ Pipeline / Workflow Funnel ══════ */}
      <Card className="border-0 shadow-sm">
        <CardHeader title="Pipeline de Manifiestos" subtitle="Flujo de trabajo: BORRADOR → TRATADO" />
        <CardContent>
          <div className="flex items-stretch gap-1 h-16 sm:h-20">
            {pipelineData.map((stage, i) => {
              const widthPercent = Math.max(8, (stage.count / pipelineTotal) * 100);
              return (
                <div
                  key={stage.key}
                  className="relative flex flex-col items-center justify-center rounded-xl transition-all duration-500 hover:scale-[1.02] group cursor-default"
                  style={{
                    flex: `${widthPercent} 1 0%`,
                    backgroundColor: stage.color + '18',
                    borderBottom: `4px solid ${stage.color}`,
                  }}
                  title={`${stage.name}: ${stage.count}`}
                >
                  <span className="text-lg sm:text-2xl font-extrabold" style={{ color: stage.color }}>{stage.count}</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-500 leading-tight text-center px-1">{stage.name}</span>
                  {/* Arrow connector */}
                  {i < pipelineData.length - 1 && (
                    <ChevronRight size={16} className="absolute -right-2.5 text-neutral-300 z-10 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Progress bar underneath */}
          <div className="flex h-2 mt-3 rounded-full overflow-hidden bg-neutral-100">
            {pipelineData.map(stage => (
              <div
                key={stage.key}
                className="transition-all duration-700"
                style={{
                  flex: `${Math.max(1, stage.count)} 1 0%`,
                  backgroundColor: stage.color,
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ══════ Map + Alerts/Activity ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map — bigger */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-neutral-900">Mapa Operativo</h3>
                <Badge variant="soft" color="primary">{viajesActivos.length} en tránsito</Badge>
              </div>
              <div className="flex bg-neutral-100 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setSelectedView('mapa')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    selectedView === 'mapa' ? 'bg-white text-[#1B5E3C] shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <MapPin size={16} /> Mapa
                </button>
                <button
                  onClick={() => setSelectedView('lista')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    selectedView === 'lista' ? 'bg-white text-[#1B5E3C] shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <FileText size={16} /> Lista
                </button>
              </div>
            </div>
            <div className="p-5">
              {selectedView === 'mapa' ? (
                <div className="h-80 sm:h-96 rounded-xl overflow-hidden border border-neutral-200 relative isolate">
                  <MapContainer
                    center={[-32.9287, -68.8535]}
                    zoom={12}
                    style={{ height: '100%', width: '100%', zIndex: 0 }}
                    className="z-0"
                  >
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {viajesActivos.map((viaje) => (
                      <Marker key={viaje.id} position={[viaje.lat, viaje.lng]} icon={truckIcon}>
                        <Popup>
                          <strong>{viaje.id}</strong><br />
                          {viaje.chofer}<br />
                          <span style={{ fontSize: '11px' }}>{viaje.patente} — {viaje.destino}</span><br />
                          <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/manifiestos/${viaje.rawId || viaje.id}`); }} style={{ color: '#0D8A4F', fontWeight: 600 }}>Ver detalle</a>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                  {/* Legend */}
                  <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-[400] text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Normal</div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Retrasado</div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Crítico</div>
                    </div>
                  </div>
                  {viajesActivos.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[400]">
                      <p className="text-sm text-neutral-500">Sin viajes activos</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {viajesActivos.map((viaje) => (
                    <div
                      key={viaje.id}
                      className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-100 rounded-xl row-hover cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${viaje.rawId || viaje.id}`)}
                    >
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${viaje.estado === 'retraso' ? 'bg-warning-500' : 'bg-success-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm text-neutral-900">{viaje.id}</span>
                          <Badge variant="soft" color={viaje.estado === 'retraso' ? 'warning' : 'success'}>
                            {viaje.estado === 'retraso' ? 'Retrasado' : 'Normal'}
                          </Badge>
                        </div>
                        <p className="text-xs text-neutral-500 truncate">{viaje.chofer} — {viaje.patente} → {viaje.destino}</p>
                        <div className="mt-2 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${viaje.estado === 'retraso' ? 'bg-warning-500' : 'bg-success-500'}`}
                            style={{ width: `${viaje.progreso}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-neutral-900">{viaje.progreso}%</p>
                      </div>
                    </div>
                  ))}
                  {viajesActivos.length === 0 && (
                    <div className="py-8 text-center text-sm text-neutral-400">Sin viajes en tránsito</div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar — Alertas + Activity */}
        <div className="space-y-4">
          {/* Alertas */}
          <Card padding="none">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Radio size={18} className="text-error-500 animate-pulse-soft" />
                <h3 className="font-semibold text-neutral-900">Alertas en Vivo</h3>
              </div>
              <Badge variant="solid" color="error">{alertas.length}</Badge>
            </div>
            <div className="divide-y divide-neutral-100 max-h-56 overflow-y-auto">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`p-3 border-l-4 ${
                    alerta.tipo === 'critical' ? 'border-error-500 bg-error-50/50' :
                    alerta.tipo === 'warning' ? 'border-warning-500 bg-warning-50/50' :
                    'border-info-500 bg-info-50/50'
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    alerta.tipo === 'critical' ? 'text-error-700' :
                    alerta.tipo === 'warning' ? 'text-warning-700' : 'text-info-700'
                  }`}>
                    {alerta.mensaje}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">{alerta.tiempo}</p>
                </div>
              ))}
              {alertas.length === 0 && (
                <div className="p-6 text-center text-sm text-neutral-400">Sin alertas activas</div>
              )}
            </div>
          </Card>

          {/* Actividad Reciente */}
          <Card padding="none">
            <div className="flex items-center gap-2 p-4 border-b border-neutral-100">
              <Activity size={18} className="text-primary-600" />
              <h3 className="font-semibold text-neutral-900">Actividad Reciente</h3>
            </div>
            <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
              {recentActivity.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="p-3 flex items-start gap-3 row-hover cursor-pointer"
                  onClick={() => navigate(`/manifiestos/${item.id}`)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={14} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">Manifiesto {item.numero || item.id}</p>
                    <p className="text-xs text-neutral-500">{item.generador?.razonSocial || 'Generador'} — {item.estado?.replace(/_/g, ' ') || '-'}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{item.createdAt ? formatRelativeTime(item.createdAt) : '-'}</p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="p-6 text-center text-sm text-neutral-400">Sin actividad reciente</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ══════ Charts Row ══════ */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut - Distribución por estado */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Distribución por Estado" subtitle="Proporción actual de manifiestos" />
          <CardContent>
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  {/* Center text */}
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-neutral-900 text-2xl font-bold" style={{ fontSize: 28, fontWeight: 800 }}>
                    {donutTotal}
                  </text>
                  <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-neutral-500" style={{ fontSize: 12 }}>
                    Total
                  </text>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-neutral-400">Sin datos</div>
            )}
            {/* Legend below */}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {donutData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span className="text-neutral-600">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bar - Top categorías */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Top Tipos de Residuo" subtitle="Categorías con mayor volumen" />
          <CardContent>
            {generadorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={generadorData} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="manifiestos" fill="#0D8A4F" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-neutral-400">Sin datos de tipos</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════ Quick Actions ══════ */}
      <Card className="border-0 shadow-sm">
        <CardHeader title="Acciones Rápidas" subtitle="Navegación directa a funciones clave" />
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={i}
                  onClick={() => navigate(action.path)}
                  className={`flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl text-sm font-medium border border-transparent hover:border-neutral-200 active:scale-[0.97] transition-all ${action.color}`}
                >
                  <Icon size={22} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CentroControlPage;
