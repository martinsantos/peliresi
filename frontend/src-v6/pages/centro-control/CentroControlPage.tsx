/**
 * SITREP v6 - Centro de Control — Sala de Operaciones (v2)
 * =========================================================
 * Mapa de actividad con capas toggleables (generadores, transportistas,
 * operadores, en tránsito), filtros por fecha, clustering, estadísticas.
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
  ChevronDown,
  Package,
  Factory,
  Layers,
  Calendar,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useManifiestos } from '../../hooks/useManifiestos';
import { useAlertas } from '../../hooks/useAlertas';
// useReporteManifiestos removed — pipeline now uses cc.estadisticas.porEstado
import { useCentroControl } from '../../hooks/useCentroControl';
import { useAuth } from '../../contexts/AuthContext';
import type { CentroControlData, ActorGenerador, ActorTransportista, ActorOperador, EnTransitoItem } from '../../hooks/useCentroControl';
import { EstadoManifiesto } from '../../types/models';
import { formatRelativeTime, formatDateTime } from '../../utils/formatters';
import { ESTADO_CHART_COLORS } from '../../utils/chart-colors';
import { ChartTooltip } from '../../components/charts/ChartTooltip';
import { DATE_PRESETS, computeDateRange } from '../../utils/date-presets';
import { ACTOR_ICONS, ACTOR_COLORS, createClusterIcon } from '../../utils/map-icons';

// ── Constants ──
const POLL_INTERVAL = 30;
const ESTADO_PIPELINE = ['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'] as const;
// ESTADO_CHART_COLORS imported from shared utils

// DATE_PRESETS imported from shared utils

// ChartTooltip imported from shared components

// ── Cluster helper: group nearby markers ──
function clusterMarkers<T extends { latitud: number; longitud: number }>(
  items: T[],
  zoomThreshold: number
): (T & { count?: number })[] {
  if (items.length < 50 || zoomThreshold > 11) return items;
  const gridSize = 0.05; // ~5km at Mendoza latitude
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

// ── Fly to selected marker ──
function FlyToMarker({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 14, { duration: 0.8 });
  }, [position, map]);
  return null;
}

// ── Map zoom tracker ──
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    map.on('zoomend', handler);
    return () => { map.off('zoomend', handler); };
  }, [map, onZoom]);
  return null;
}

// ── Fit map to bounds ──
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo(points[0], 13, { duration: 0.8 });
    } else {
      map.flyToBounds(L.latLngBounds(points), { padding: [40, 40], duration: 0.8, maxZoom: 14 });
    }
  }, [points, map]);
  return null;
}

export const CentroControlPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isTransportista } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [countdown, setCountdown] = useState(POLL_INTERVAL);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ── Trip selection & filter ──
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedRealizadoId, setSelectedRealizadoId] = useState<string | null>(null);
  const [tripFilter, setTripFilter] = useState('');
  const [tripPanel, setTripPanel] = useState<'activos' | 'realizados'>('activos');

  // ── Layer toggles ──
  const [layers, setLayers] = useState({
    generadores: true,
    transportistas: true,
    operadores: true,
    transito: true,
  });

  // ── Date range (default: Hoy) ──
  const [datePreset, setDatePreset] = useState(1);
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);

  // ── Map zoom ──
  const [mapZoom, setMapZoom] = useState(10);

  // ── API Hooks ──
  const { data: statsData, refetch: refetchStats } = useDashboardStats();
  const { data: ccData, refetch: refetchCC } = useCentroControl({
    fechaDesde,
    fechaHasta,
    capas: Object.entries(layers).filter(([, v]) => v).map(([k]) => k),
  });
  // Only fetch alertas for ADMIN — TRANSPORTISTA gets 403
  const { data: alertasData } = useAlertas({ limit: 10 }, isAdmin);
  const { data: completedData } = useManifiestos({ estado: EstadoManifiesto.ENTREGADO, limit: 20 });
  // Pipeline data now comes from cc.estadisticas.porEstado (filtered by date)

  // ── Clock + Countdown ──
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setCountdown(prev => {
        if (prev <= 1) {
          refetchStats();
          refetchCC();
          return POLL_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refetchStats, refetchCC]);

  const handleManualRefresh = useCallback(() => {
    refetchStats();
    refetchCC();
    setCountdown(POLL_INTERVAL);
  }, [refetchStats, refetchCC]);

  const handleDatePreset = useCallback((days: number) => {
    setDatePreset(days);
    const range = computeDateRange(days);
    setFechaDesde(range.desde);
    setFechaHasta(range.hasta);
  }, []);

  const toggleLayer = useCallback((layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

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
      manifiestos: raw.manifiestos || {},
      alertas: raw.alertas || {},
    };
  }, [statsData]);

  // ── Centro Control data ──
  const cc: CentroControlData | null = ccData || null;

  // ── KPIs (all from centro-control, filtered by date) ──
  const kpis = useMemo(() => [
    {
      label: 'Total Manifiestos',
      value: cc?.estadisticas?.totalManifiestos || 0,
      icon: FileText,
      gradient: 'from-emerald-600 to-emerald-700',
    },
    {
      label: 'En Tránsito',
      value: cc?.estadisticas?.enTransitoActivos || 0,
      icon: Truck,
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      label: 'Generadores Activos',
      value: cc?.estadisticas?.generadoresActivos || 0,
      icon: Factory,
      gradient: 'from-green-600 to-green-700',
    },
    {
      label: 'Operadores Activos',
      value: cc?.estadisticas?.operadoresActivos || 0,
      icon: Package,
      gradient: 'from-blue-600 to-blue-700',
    },
    {
      label: 'Toneladas Período',
      value: cc?.estadisticas?.toneladasPeriodo || 0,
      icon: TrendingUp,
      gradient: 'from-teal-600 to-teal-700',
      suffix: 't',
    },
  ], [cc]);

  // ── Pipeline data (from centro-control, filtered by date) ──
  const pipelineData = useMemo(() => {
    const porEstado = (cc?.estadisticas as any)?.porEstado || {};
    return ESTADO_PIPELINE.map(estado => ({
      name: estado.replace(/_/g, ' '),
      key: estado,
      count: porEstado[estado] || 0,
      color: ESTADO_CHART_COLORS[estado],
    }));
  }, [cc]);

  const pipelineTotal = pipelineData.reduce((s, d) => s + d.count, 0) || 1;

  // ── Donut data ──
  const donutData = useMemo(() => {
    return pipelineData.filter(d => d.count > 0).map(d => ({ name: d.name, value: d.count, fill: d.color }));
  }, [pipelineData]);

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // ── Manifiestos por día (sparkline) ──
  const sparklineData = useMemo(() => {
    return (cc?.estadisticas?.manifiestosPorDia || []).map(d => ({
      fecha: new Date(d.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      cantidad: d.cantidad,
    }));
  }, [cc]);

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

  // ── Clustered generadores ──
  const generadoresClustered = useMemo(() => {
    if (!cc?.generadores) return [];
    return clusterMarkers(cc.generadores as any[], mapZoom);
  }, [cc?.generadores, mapZoom]);

  // ── Filtered trips + fly-to position ──
  // FIX: TRANSPORTISTA only sees their own trips (matched by company name)
  const userTransportista = isTransportista ? (currentUser?.sector || '') : '';
  const filteredEnTransito = useMemo(() => {
    if (!cc?.enTransito) return [];
    let items = cc.enTransito;
    // Filter by user's transportista when role is TRANSPORTISTA
    if (userTransportista) {
      items = items.filter(m => m.transportista === userTransportista);
    }
    if (!tripFilter.trim()) return items;
    const q = tripFilter.toLowerCase();
    return items.filter(m =>
      m.numero.toLowerCase().includes(q) || m.transportista.toLowerCase().includes(q)
    );
  }, [cc?.enTransito, tripFilter, userTransportista]);

  // enTransito for map markers — also filtered by user role
  const enTransitoForMap = useMemo(() => {
    if (!cc?.enTransito) return [];
    if (!userTransportista) return cc.enTransito;
    return cc.enTransito.filter(m => m.transportista === userTransportista);
  }, [cc?.enTransito, userTransportista]);

  // All points for the selected active trip (vehicle + origin + destination)
  const activeTripFlyPoints = useMemo((): [number, number][] => {
    if (!selectedTripId || !enTransitoForMap.length) return [];
    const trip = enTransitoForMap.find(m => m.manifiestoId === selectedTripId);
    if (!trip) return [];
    const pts: [number, number][] = [];
    if (trip.ultimaPosicion) pts.push([trip.ultimaPosicion.latitud, trip.ultimaPosicion.longitud]);
    if (trip.origenLatLng) pts.push(trip.origenLatLng);
    if (trip.destinoLatLng) pts.push(trip.destinoLatLng);
    return pts;
  }, [selectedTripId, enTransitoForMap]);

  const viajesRealizados = useMemo(() => {
    const items = (completedData as any)?.items || (completedData as any)?.data?.items || [];
    if (!Array.isArray(items)) return [];
    return items.map((m: any) => ({
      id: m.id,
      numero: m.numero || m.id,
      transportista: m.transportista?.razonSocial || 'Transportista',
      origen: m.generador?.razonSocial || 'Origen',
      destino: m.operador?.razonSocial || 'Destino',
      origenPos: m.generador?.latitud && m.generador?.longitud
        ? [m.generador.latitud, m.generador.longitud] as [number, number] : null,
      destinoPos: m.operador?.latitud && m.operador?.longitud
        ? [m.operador.latitud, m.operador.longitud] as [number, number] : null,
      estado: m.estado,
      fechaEntrega: m.updatedAt || m.fechaEntrega,
    }));
  }, [completedData]);

  // Bounds points for auto-fit when switching panels
  const panelBoundsPoints = useMemo((): [number, number][] => {
    if (tripPanel === 'activos') {
      return enTransitoForMap
        .filter(m => m.ultimaPosicion)
        .map(m => [m.ultimaPosicion!.latitud, m.ultimaPosicion!.longitud] as [number, number]);
    }
    if (tripPanel === 'realizados') {
      const pts: [number, number][] = [];
      for (const m of viajesRealizados) {
        if (m.origenPos) pts.push(m.origenPos);
        if (m.destinoPos) pts.push(m.destinoPos);
      }
      return pts;
    }
    return [];
  }, [tripPanel, enTransitoForMap, viajesRealizados]);

  // Fly-to points for selected realizado trip
  const realizadoFlyPoints = useMemo((): [number, number][] => {
    if (!selectedRealizadoId) return [];
    const trip = viajesRealizados.find((m: any) => m.id === selectedRealizadoId);
    if (!trip) return [];
    const pts: [number, number][] = [];
    if (trip.origenPos) pts.push(trip.origenPos);
    if (trip.destinoPos) pts.push(trip.destinoPos);
    return pts;
  }, [selectedRealizadoId, viajesRealizados]);

  // Auto-switch to realizados if no active trips (uses filtered data)
  useEffect(() => {
    if (cc && filteredEnTransito.length === 0 && viajesRealizados.length > 0) {
      setTripPanel('realizados');
    } else if (cc && filteredEnTransito.length > 0) {
      setTripPanel('activos');
    }
  }, [cc, filteredEnTransito.length, viajesRealizados.length]);

  // Clear selections when switching panels
  useEffect(() => {
    setSelectedTripId(null);
    setSelectedRealizadoId(null);
  }, [tripPanel]);

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
    <>
      {/* ══════ Sticky Filters Bar ══════ */}
      <div className="sticky top-0 z-20 bg-[#FAFAF8] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-2">
        {/* Row 1: Date presets + LIVE badge + layers + period */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-2xl border border-neutral-100 shadow-sm">
          {/* LIVE badge + refresh */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-red-600">LIVE</span>
          </span>
          <span className="text-xs text-neutral-400">{countdown}s</span>
          <button onClick={handleManualRefresh} className="p-1 hover:bg-neutral-100 rounded transition-colors text-neutral-400" title="Actualizar ahora">
            <RefreshCw size={13} />
          </button>

          <div className="h-5 w-px bg-neutral-200 hidden sm:block" />

          {/* Date presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar size={16} className="text-neutral-400" />
            {DATE_PRESETS.filter(p => p.days > 0).map(p => (
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

          <div className="h-5 w-px bg-neutral-200 hidden sm:block" />

          {/* Layer toggles */}
          <div className="flex items-center gap-1.5">
            <Layers size={16} className="text-neutral-400" />
            {([
              { key: 'generadores' as const, label: 'Generadores', color: 'bg-purple-500' },
              { key: 'transportistas' as const, label: 'Transportistas', color: 'bg-orange-500' },
              { key: 'operadores' as const, label: 'Operadores', color: 'bg-blue-500' },
              { key: 'transito' as const, label: 'En Tránsito', color: 'bg-red-500' },
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
                <span className="hidden sm:inline">{l.label}</span>
                {layers[l.key] ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            ))}
          </div>

          {/* Active period indicator */}
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border text-amber-700 bg-amber-50 border-amber-200">
              <Calendar size={11} />
              {fechaDesde} — {fechaHasta}
            </span>
          </div>
        </div>
      </div>

      {/* ══════ Main Content ══════ */}
      <div className="space-y-6 mt-4 xl:max-w-7xl xl:mx-auto isolate">

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
                <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {kpi.value}{(kpi as any).suffix || ''}
                </p>
                <p className="text-xs text-white/75 font-medium mt-0.5">{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════ Pipeline ══════ */}
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
                  {i < pipelineData.length - 1 && (
                    <ChevronRight size={16} className="absolute -right-2.5 text-neutral-300 z-10 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex h-2 mt-3 rounded-full overflow-hidden bg-neutral-100">
            {pipelineData.map(stage => (
              <div
                key={stage.key}
                className="transition-all duration-700"
                style={{ flex: `${Math.max(1, stage.count)} 1 0%`, backgroundColor: stage.color }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ══════ Mapa de Actividad + Viajes Activos ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-neutral-900">Mapa de Actividad</h3>
                <Badge variant="soft" color="primary">
                  {enTransitoForMap.length} en tránsito
                </Badge>
              </div>
              {/* Map legend — matches icon shapes */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: ACTOR_COLORS.generador }} /> Generadores</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: ACTOR_COLORS.transportista, transform: 'rotate(45deg)' }} /> Transportistas</span>
                <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,4 13,10 7,13 1,10 1,4" fill={ACTOR_COLORS.operador}/></svg> Operadores</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: ACTOR_COLORS.enTransito }} /> En Tránsito</span>
              </div>
            </div>
            <div className="p-5">
              <div className="h-[28rem] sm:h-[32rem] rounded-xl overflow-hidden border border-neutral-200 relative isolate">
                <MapContainer
                  center={[-32.9287, -68.8535]}
                  zoom={10}
                  style={{ height: '100%', width: '100%', zIndex: 0 }}
                  className="z-0"
                >
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <ZoomTracker onZoom={setMapZoom} />
                  {/* ── Fly to selected active trip (all points) ── */}
                  {activeTripFlyPoints.length > 0 && (
                    <FitBounds points={activeTripFlyPoints} />
                  )}

                  {/* ── Generadores ── */}
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
                          <span className="text-xs font-medium">Manifiestos: {g.cantManifiestos}</span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* ── Transportistas ── */}
                  {layers.transportistas && cc?.transportistas?.map((t, idx) => (
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
                          <span className="text-xs font-medium">En tránsito: {t.enviosEnTransito}</span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* ── Operadores ── */}
                  {layers.operadores && cc?.operadores?.map((o, idx) => (
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
                          <span className="text-xs">Recibidos: {o.cantRecibidos} | Tratados: {o.cantTratados}</span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* ── En Tránsito (markers + polylines) — filtered by user role ── */}
                  {layers.transito && enTransitoForMap.map((m, idx) => (
                    <React.Fragment key={`transit-${m.manifiestoId}-${idx}`}>
                      {m.ultimaPosicion && (
                        <Marker
                          position={[m.ultimaPosicion.latitud, m.ultimaPosicion.longitud]}
                          icon={m.manifiestoId === selectedTripId ? ACTOR_ICONS.enTransitoSelected : ACTOR_ICONS.enTransito}
                          eventHandlers={{ click: () => setSelectedTripId(m.manifiestoId) }}
                        >
                          <Popup>
                            <div className="text-sm min-w-[200px]">
                              <strong className="text-red-700">{m.numero}</strong>
                              {m.ultimaPosicion.velocidad != null && (
                                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>{Math.round(m.ultimaPosicion.velocidad)} km/h</span>
                              )}
                              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '11px' }}><strong style={{ color: '#15803d' }}>ORIGEN:</strong> {m.origen}</span>
                                <span style={{ fontSize: '11px' }}><strong style={{ color: '#b45309' }}>TRANSPORTE:</strong> {m.transportista}</span>
                                <span style={{ fontSize: '11px' }}><strong style={{ color: '#1d4ed8' }}>OPERADOR:</strong> {m.destino}</span>
                              </div>
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const prefix = isMobile ? '/mobile' : '';
                                  navigate(`${prefix}/manifiestos/${m.manifiestoId}`);
                                }}
                                style={{ color: '#0D8A4F', fontWeight: 600, fontSize: '12px', display: 'block', marginTop: '6px' }}
                              >
                                Ver detalle
                              </a>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                      {m.ruta.length > 1 && (
                        <Polyline
                          positions={m.ruta.map(p => [p.lat, p.lng] as [number, number])}
                          color="#ef4444"
                          weight={3}
                          opacity={0.6}
                          dashArray="8 4"
                        />
                      )}
                    </React.Fragment>
                  ))}

                  {/* ── Selected active trip: show origin/destination markers ── */}
                  {tripPanel === 'activos' && selectedTripId && (() => {
                    const trip = enTransitoForMap.find(m => m.manifiestoId === selectedTripId);
                    if (!trip) return null;
                    return (
                      <>
                        {trip.origenLatLng && (
                          <Marker position={trip.origenLatLng} icon={ACTOR_ICONS.generador}>
                            <Popup><strong>Origen:</strong> {trip.origen}</Popup>
                          </Marker>
                        )}
                        {trip.destinoLatLng && (
                          <Marker position={trip.destinoLatLng} icon={ACTOR_ICONS.operador}>
                            <Popup><strong>Destino:</strong> {trip.destino}</Popup>
                          </Marker>
                        )}
                        {trip.origenLatLng && trip.destinoLatLng && (
                          <Polyline
                            positions={[trip.origenLatLng, trip.destinoLatLng]}
                            pathOptions={{ color: '#6366f1', weight: 2, dashArray: '8 8', opacity: 0.7 }}
                          />
                        )}
                      </>
                    );
                  })()}

                  {/* ── Viajes Realizados: show origin/destination markers ── */}
                  {tripPanel === 'realizados' && viajesRealizados.map((m: any) => {
                    if (!m.origenPos && !m.destinoPos) return null;
                    const isSelected = m.id === selectedRealizadoId;
                    return (
                      <React.Fragment key={`realizado-${m.id}`}>
                        {m.origenPos && (
                          <Marker position={m.origenPos} icon={ACTOR_ICONS.generador}>
                            <Popup>
                              <div className="text-sm">
                                <strong className="text-green-700">Origen</strong><br />
                                {m.origen}<br />
                                <span className="text-xs text-neutral-500">{m.numero}</span>
                              </div>
                            </Popup>
                          </Marker>
                        )}
                        {m.destinoPos && (
                          <Marker position={m.destinoPos} icon={ACTOR_ICONS.operador}>
                            <Popup>
                              <div className="text-sm">
                                <strong className="text-blue-700">Destino</strong><br />
                                {m.destino}<br />
                                <span className="text-xs text-neutral-500">{m.numero}</span>
                              </div>
                            </Popup>
                          </Marker>
                        )}
                        {m.origenPos && m.destinoPos && (
                          <Polyline
                            positions={[m.origenPos, m.destinoPos]}
                            pathOptions={{
                              color: isSelected ? '#6366f1' : '#94a3b8',
                              weight: isSelected ? 3 : 1.5,
                              dashArray: '8 6',
                              opacity: isSelected ? 0.9 : 0.4,
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* ── Auto-fit map bounds on panel switch ── */}
                  {!selectedTripId && !selectedRealizadoId && panelBoundsPoints.length > 0 && (
                    <FitBounds points={panelBoundsPoints} />
                  )}

                  {/* ── Fly to selected realizado trip ── */}
                  {realizadoFlyPoints.length > 0 && (
                    <FitBounds points={realizadoFlyPoints} />
                  )}
                </MapContainer>

                {/* Mobile legend */}
                <div className="sm:hidden absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-[400] text-xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: ACTOR_COLORS.generador }} /> Gen</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: ACTOR_COLORS.transportista, transform: 'rotate(45deg)' }} /> Trans</span>
                    <span className="flex items-center gap-1"><svg width="11" height="11" viewBox="0 0 14 14"><polygon points="7,1 13,4 13,10 7,13 1,10 1,4" fill={ACTOR_COLORS.operador}/></svg> Oper</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: ACTOR_COLORS.enTransito }} /> Tránsito</span>
                  </div>
                </div>

                {!cc && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[400]">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <RefreshCw size={16} className="animate-spin" /> Cargando datos...
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Viajes Activos + Realizados — accordion right of map */}
        <div className="flex flex-col gap-0 max-h-[calc(100vh-12rem)] self-start">
          {/* ── Viajes Activos accordion ── */}
          <Card padding="none" className={`flex flex-col ${tripPanel === 'activos' ? 'flex-1 min-h-0' : ''}`}>
            <button
              onClick={() => setTripPanel(tripPanel === 'activos' ? 'realizados' : 'activos')}
              className="flex items-center justify-between p-4 border-b border-neutral-100 w-full text-left hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-amber-600" />
                <h3 className="font-semibold text-neutral-900">Viajes Activos</h3>
                <Badge variant="soft" color="warning">{filteredEnTransito.length}</Badge>
              </div>
              <ChevronDown size={18} className={`text-neutral-400 transition-transform duration-200 ${tripPanel === 'activos' ? 'rotate-180' : ''}`} />
            </button>
            {tripPanel === 'activos' && (
              <>
                <div className="p-3 border-b border-neutral-100">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Buscar por número o transportista..."
                      value={tripFilter}
                      onChange={e => setTripFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-neutral-400"
                    />
                  </div>
                </div>
                <div className="divide-y divide-neutral-100 flex-1 overflow-y-auto">
                  {filteredEnTransito.map((m) => {
                    const isSelected = m.manifiestoId === selectedTripId;
                    return (
                      <div
                        key={m.manifiestoId}
                        className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary-50 border-l-4 border-l-primary-500'
                            : 'row-hover border-l-4 border-l-transparent'
                        }`}
                        onClick={() => setSelectedTripId(isSelected ? null : m.manifiestoId)}
                      >
                        <div className={`w-3 h-3 rounded-full bg-red-500 flex-shrink-0 mt-1.5 ${isSelected ? '' : 'animate-pulse'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-semibold text-neutral-900">{m.numero}</p>
                          <div className="mt-1 space-y-0.5">
                            <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-green-700">ORIGEN:</span> {m.origen}</p>
                            <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-amber-700">TRANSPORTE:</span> {m.transportista}</p>
                            <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-blue-700">OPERADOR:</span> {m.destino}</p>
                          </div>
                          {isSelected && (
                            <button
                              className="mt-2 w-full text-center text-xs font-semibold text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-lg py-1.5 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                const prefix = isMobile ? '/mobile' : '';
                                navigate(`${prefix}/manifiestos/${m.manifiestoId}`);
                              }}
                            >
                              Ver detalle del viaje
                            </button>
                          )}
                        </div>
                        {m.ultimaPosicion?.velocidad != null && (
                          <span className="text-xs font-medium text-neutral-500 flex-shrink-0">
                            {Math.round(m.ultimaPosicion.velocidad)} km/h
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {filteredEnTransito.length === 0 && (
                    <div className="p-6 text-center text-sm text-neutral-400">
                      {tripFilter.trim() ? 'Sin resultados para la búsqueda' : 'Sin viajes activos'}
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* ── Viajes Realizados accordion ── */}
          <Card padding="none" className={`flex flex-col ${tripPanel === 'realizados' ? 'flex-1 min-h-0' : ''} mt-[-1px]`}>
            <button
              onClick={() => setTripPanel(tripPanel === 'realizados' ? 'activos' : 'realizados')}
              className="flex items-center justify-between p-4 border-b border-neutral-100 w-full text-left hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-neutral-900">Viajes Realizados</h3>
                <Badge variant="soft" color="success">{viajesRealizados.length}</Badge>
              </div>
              <ChevronDown size={18} className={`text-neutral-400 transition-transform duration-200 ${tripPanel === 'realizados' ? 'rotate-180' : ''}`} />
            </button>
            {tripPanel === 'realizados' && (
              <div className="divide-y divide-neutral-100 flex-1 overflow-y-auto">
                {viajesRealizados.map((m: any) => {
                  const isSelected = m.id === selectedRealizadoId;
                  return (
                    <div
                      key={m.id}
                      className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 border-l-4 border-l-emerald-500'
                          : 'row-hover border-l-4 border-l-transparent'
                      }`}
                      onClick={() => setSelectedRealizadoId(isSelected ? null : m.id)}
                    >
                      <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono font-semibold text-neutral-900">{m.numero}</p>
                          <Badge variant="soft" color="success" className="text-[10px] px-1.5 py-0">Entregado</Badge>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-green-700">ORIGEN:</span> {m.origen}</p>
                          <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-amber-700">TRANSPORTE:</span> {m.transportista}</p>
                          <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-blue-700">OPERADOR:</span> {m.destino}</p>
                        </div>
                        {m.fechaEntrega && (
                          <p className="text-[10px] text-neutral-400 mt-1">{formatDateTime(m.fechaEntrega)}</p>
                        )}
                        {isSelected && (
                          <button
                            className="mt-2 w-full text-center text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg py-1.5 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const prefix = isMobile ? '/mobile' : '';
                              navigate(`${prefix}/manifiestos/${m.id}`);
                            }}
                          >
                            Ver detalle del viaje
                          </button>
                        )}
                      </div>
                      <ChevronRight size={14} className={`flex-shrink-0 mt-1 ${isSelected ? 'text-emerald-500' : 'text-neutral-300'}`} />
                    </div>
                  );
                })}
                {viajesRealizados.length === 0 && (
                  <div className="p-6 text-center text-sm text-neutral-400">Sin viajes realizados recientes</div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ══════ Actividad del Período + Alertas (below map) ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estadísticas del período */}
        <Card padding="none">
          <div className="flex items-center gap-2 p-4 border-b border-neutral-100">
            <TrendingUp size={18} className="text-primary-600" />
            <h3 className="font-semibold text-neutral-900">Actividad del Período</h3>
          </div>
          <div className="p-4">
            {/* Sparkline */}
            {sparklineData.length > 0 ? (
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={80}>
                  <AreaChart data={sparklineData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D8A4F" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0D8A4F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="fecha" tick={{ fontSize: 9 }} stroke="#94a3b8" interval="preserveStartEnd" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="cantidad" name="manifiestos" stroke="#0D8A4F" fill="url(#sparkGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-neutral-400 mb-3">Sin datos de actividad diaria</div>
            )}
            {/* Mini stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-neutral-50 rounded-lg">
                <span className="text-neutral-500">Total</span>
                <p className="font-bold text-neutral-900">{cc?.estadisticas?.totalManifiestos || 0}</p>
              </div>
              <div className="p-2 bg-neutral-50 rounded-lg">
                <span className="text-neutral-500">En tránsito</span>
                <p className="font-bold text-amber-600">{cc?.estadisticas?.enTransitoActivos || 0}</p>
              </div>
              <div className="p-2 bg-neutral-50 rounded-lg">
                <span className="text-neutral-500">Generadores</span>
                <p className="font-bold text-green-600">{cc?.estadisticas?.generadoresActivos || 0}</p>
              </div>
              <div className="p-2 bg-neutral-50 rounded-lg">
                <span className="text-neutral-500">Toneladas</span>
                <p className="font-bold text-teal-600">{cc?.estadisticas?.toneladasPeriodo || 0}t</p>
              </div>
            </div>
          </div>
        </Card>

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
      </div>

      {/* ══════ Charts Row ══════ */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Distribución por Estado" subtitle="Proporción actual de manifiestos" />
          <CardContent>
            {donutData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height={300} minWidth={200} minHeight={200}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={3} dataKey="value" stroke="none">
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 28, fontWeight: 800 }} className="fill-neutral-900">
                      {donutTotal}
                    </text>
                    <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 12 }} className="fill-neutral-500">
                      Total
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-neutral-400">Sin datos</div>
            )}
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

        {/* Manifiestos por día bar chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Manifiestos por Día" subtitle={`Últimos ${datePreset || 'N'} días`} />
          <CardContent>
            {sparklineData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height={300} minWidth={200} minHeight={200}>
                  <BarChart data={sparklineData} margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="#94a3b8" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="cantidad" name="manifiestos" fill="#0D8A4F" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-neutral-400">Sin datos del período</div>
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
    </>
  );
};

export default CentroControlPage;
