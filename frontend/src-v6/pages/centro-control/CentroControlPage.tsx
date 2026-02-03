/**
 * SITREP v6 - Centro de Control Page (Conectado a API)
 * =====================================================
 * Dashboard operativo - Tema claro consistente con el resto de la app
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  ArrowLeft
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useManifiestos } from '../../hooks/useManifiestos';
import { useAlertas } from '../../hooks/useAlertas';
import { EstadoManifiesto } from '../../types/models';
import { formatRelativeTime } from '../../utils/formatters';

// Fallback mock data
const MOCK_KPIS = [
  { label: 'Viajes Activos', value: 12, change: '+2', icon: Truck, color: 'primary' },
  { label: 'En Retraso', value: 3, change: '+1', icon: Clock, color: 'warning' },
  { label: 'Alertas Críticas', value: 5, change: '-2', icon: AlertTriangle, color: 'error' },
  { label: 'Operadores Online', value: 8, change: '0', icon: Users, color: 'success' },
];

const MOCK_VIAJES = [
  { id: 'M-2025-089', chofer: 'Juan Pérez', patente: 'AB-123-CD', progreso: 75, estado: 'normal', destino: 'Planta Las Heras', eta: '20:30' },
  { id: 'M-2025-090', chofer: 'María González', patente: 'AC-456-EF', progreso: 45, estado: 'retraso', destino: 'Planta Godoy Cruz', eta: '21:45' },
  { id: 'M-2025-091', chofer: 'Carlos Rodríguez', patente: 'AD-789-GH', progreso: 30, estado: 'normal', destino: 'Planta Las Heras', eta: '22:15' },
  { id: 'M-2025-092', chofer: 'Ana Martínez', patente: 'AE-012-IJ', progreso: 90, estado: 'normal', destino: 'Planta Luján', eta: '19:45' },
];

const MOCK_ALERTAS = [
  { id: '1', tipo: 'critical', mensaje: 'M-2025-045 vencido hace 2 días', tiempo: 'Hace 5 min' },
  { id: '2', tipo: 'warning', mensaje: 'M-2025-090 retrasado +45 min', tiempo: 'Hace 12 min' },
  { id: '3', tipo: 'warning', mensaje: '3 manifiestos pendientes de firma', tiempo: 'Hace 25 min' },
  { id: '4', tipo: 'info', mensaje: 'Mantenimiento programado: 15/02', tiempo: 'Hace 1 hora' },
  { id: '5', tipo: 'success', mensaje: 'M-2025-088 completado exitosamente', tiempo: 'Hace 2 horas' },
];

const MOCK_ACTIVIDAD = [
  { id: '1', accion: 'Manifiesto creado', usuario: 'Juan Pérez', item: 'M-2025-095', tiempo: 'Hace 5 min' },
  { id: '2', accion: 'Viaje iniciado', usuario: 'María González', item: 'M-2025-090', tiempo: 'Hace 15 min' },
  { id: '3', accion: 'Entrega confirmada', usuario: 'Operador A', item: 'M-2025-088', tiempo: 'Hace 32 min' },
  { id: '4', accion: 'Alerta resuelta', usuario: 'Admin', item: 'M-2025-082', tiempo: 'Hace 45 min' },
  { id: '5', accion: 'Manifiesto aprobado', usuario: 'Carlos López', item: 'M-2025-087', tiempo: 'Hace 1 hora' },
];

const kpiColorMap: Record<string, { bg: string; icon: string; accent: string; changePlus: string; changeMinus: string }> = {
  primary: { bg: 'bg-primary-50', icon: 'text-primary-600', accent: 'bg-primary-500', changePlus: 'text-primary-600', changeMinus: 'text-primary-600' },
  warning: { bg: 'bg-warning-50', icon: 'text-warning-600', accent: 'bg-warning-500', changePlus: 'text-warning-600', changeMinus: 'text-warning-600' },
  error: { bg: 'bg-error-50', icon: 'text-error-600', accent: 'bg-error-500', changePlus: 'text-error-600', changeMinus: 'text-error-600' },
  success: { bg: 'bg-success-50', icon: 'text-success-600', accent: 'bg-success-500', changePlus: 'text-success-600', changeMinus: 'text-success-600' },
};

export const CentroControlPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedView, setSelectedView] = useState<'mapa' | 'lista'>('mapa');

  // API hooks
  const { data: statsData } = useDashboardStats();
  const { data: transitData } = useManifiestos({ estado: EstadoManifiesto.EN_TRANSITO, limit: 10 });
  const { data: alertasData } = useAlertas({ limit: 10 });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute KPIs from API data or use mock
  const kpis = useMemo(() => {
    const stats = statsData?.data || statsData;
    if (!stats) return MOCK_KPIS;
    return [
      { label: 'Viajes Activos', value: stats.manifiestos?.enTransito ?? 12, change: '+2', icon: Truck, color: 'primary' },
      { label: 'Pendientes', value: stats.manifiestos?.pendientes ?? 3, change: '+1', icon: Clock, color: 'warning' },
      { label: 'Alertas Críticas', value: stats.alertas?.criticas ?? 5, change: '-2', icon: AlertTriangle, color: 'error' },
      { label: 'Operadores', value: stats.actores?.operadores ?? 8, change: '0', icon: Users, color: 'success' },
    ];
  }, [statsData]);

  // Compute viajes from API data or use mock
  const viajesActivos = useMemo(() => {
    const items = transitData?.data?.items || transitData?.data;
    if (!items || !Array.isArray(items) || items.length === 0) return MOCK_VIAJES;
    return items.slice(0, 6).map((m: any, i: number) => ({
      id: m.numero || m.id,
      chofer: m.transportista?.razonSocial || `Transportista ${i + 1}`,
      patente: m.vehiculo?.patente || '-',
      progreso: Math.min(95, 20 + i * 18),
      estado: 'normal',
      destino: m.operador?.razonSocial || 'Planta destino',
      eta: new Date(Date.now() + (i + 1) * 3600000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    }));
  }, [transitData]);

  // Compute alertas from API data or use mock
  const alertas = useMemo(() => {
    const items = alertasData?.data?.items || alertasData?.data;
    if (!items || !Array.isArray(items) || items.length === 0) return MOCK_ALERTAS;
    return items.slice(0, 5).map((a: any) => ({
      id: a.id,
      tipo: a.estado === 'PENDIENTE' ? (a.regla?.evento?.includes('CRITICO') ? 'critical' : 'warning') : 'info',
      mensaje: a.regla?.nombre || a.datos || 'Alerta del sistema',
      tiempo: formatRelativeTime(a.createdAt),
    }));
  }, [alertasData]);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'normal': return 'bg-success-500';
      case 'retraso': return 'bg-warning-500';
      case 'critico': return 'bg-error-500';
      default: return 'bg-neutral-400';
    }
  };

  const getEstadoBarColor = (estado: string) => {
    switch (estado) {
      case 'normal': return 'bg-success-500';
      case 'retraso': return 'bg-warning-500';
      default: return 'bg-neutral-300';
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Header con reloj */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-primary-50">
                <Command className="text-primary-600" size={22} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900">Centro de Control</h2>
            </div>
            <p className="text-sm text-neutral-500">Monitoreo en tiempo real del sistema</p>
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

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const colors = kpiColorMap[kpi.color] || kpiColorMap.primary;
          return (
            <Card key={index} className="card-interactive stat-card" style={{ '--stat-accent': undefined } as React.CSSProperties}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500 mb-1 truncate font-medium">{kpi.label}</p>
                    <p className="text-2xl font-bold text-neutral-900 animate-count-up">{kpi.value}</p>
                    <p className={`text-xs mt-1 font-medium ${
                      kpi.change.startsWith('+') ? 'text-success-600' :
                      kpi.change.startsWith('-') ? 'text-error-600' : 'text-neutral-400'
                    }`}>
                      {kpi.change} vs ayer
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${colors.bg}`}>
                    <Icon size={20} className={colors.icon} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapa / Lista de viajes */}
        <div className="lg:col-span-2 space-y-4">
          <Card padding="none">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900">Viajes en Progreso</h3>
              <div className="flex bg-neutral-100 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setSelectedView('mapa')}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all min-w-[80px] ${
                    selectedView === 'mapa'
                      ? 'bg-white text-[#1B5E3C] shadow-sm border border-neutral-200'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <MapPin size={16} />
                  <span>Mapa</span>
                </button>
                <button
                  onClick={() => setSelectedView('lista')}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all min-w-[80px] ${
                    selectedView === 'lista'
                      ? 'bg-white text-[#1B5E3C] shadow-sm border border-neutral-200'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <FileText size={16} />
                  <span>Lista</span>
                </button>
              </div>
            </div>
            <div className="p-5">
              {selectedView === 'mapa' ? (
                <div className="h-64 sm:h-80 bg-neutral-50 rounded-xl relative border border-neutral-200">
                  <div className="absolute inset-0 rounded-xl overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.06]" style={{
                      backgroundImage: 'linear-gradient(to right, #A3A3A0 1px, transparent 1px), linear-gradient(to bottom, #A3A3A0 1px, transparent 1px)',
                      backgroundSize: '40px 40px'
                    }} />
                    {viajesActivos.map((viaje, i) => (
                      <div
                        key={viaje.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2"
                        style={{ top: `${20 + i * 20}%`, left: `${15 + i * 18}%` }}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${getEstadoColor(viaje.estado)} text-white`}>
                          <Truck size={18} />
                        </div>
                        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white border border-neutral-200 px-2 py-1 rounded-lg shadow-sm text-xs font-medium text-neutral-700">
                          {viaje.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {viajesActivos.map((viaje) => (
                    <div key={viaje.id} className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-100 rounded-xl row-hover">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getEstadoColor(viaje.estado)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm text-neutral-900">{viaje.id}</span>
                          <Badge variant="soft" color={viaje.estado === 'retraso' ? 'warning' : 'success'}>
                            {viaje.estado === 'retraso' ? 'Retrasado' : 'Normal'}
                          </Badge>
                        </div>
                        <p className="text-xs text-neutral-500 truncate">{viaje.chofer} • {viaje.patente}</p>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getEstadoBarColor(viaje.estado)}`}
                            style={{ width: `${viaje.progreso}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-neutral-900">{viaje.progreso}%</p>
                        <p className="text-xs text-neutral-400">ETA: {viaje.eta}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar derecha */}
        <div className="space-y-4">
          {/* Alertas en tiempo real */}
          <Card padding="none">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Radio size={18} className="text-error-500 animate-pulse-soft" />
                <h3 className="font-semibold text-neutral-900">Alertas en Vivo</h3>
              </div>
              <Badge variant="solid" color="error">{alertas.length}</Badge>
            </div>
            <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`p-3 border-l-4 ${
                    alerta.tipo === 'critical' ? 'border-error-500 bg-error-50/50' :
                    alerta.tipo === 'warning' ? 'border-warning-500 bg-warning-50/50' :
                    alerta.tipo === 'success' ? 'border-success-500 bg-success-50/50' :
                    'border-info-500 bg-info-50/50'
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    alerta.tipo === 'critical' ? 'text-error-700' :
                    alerta.tipo === 'warning' ? 'text-warning-700' :
                    alerta.tipo === 'success' ? 'text-success-700' :
                    'text-info-700'
                  }`}>
                    {alerta.mensaje}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">{alerta.tiempo}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Actividad reciente */}
          <Card padding="none">
            <div className="flex items-center gap-2 p-4 border-b border-neutral-100">
              <Activity size={18} className="text-primary-600" />
              <h3 className="font-semibold text-neutral-900">Actividad Reciente</h3>
            </div>
            <div className="divide-y divide-neutral-100">
              {MOCK_ACTIVIDAD.map((item) => (
                <div key={item.id} className="p-3 flex items-start gap-3 row-hover">
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={14} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{item.accion}</p>
                    <p className="text-xs text-neutral-500">{item.usuario} • {item.item}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{item.tiempo}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Acciones rápidas */}
          <Card padding="none">
            <div className="p-4 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900">Acciones Rápidas</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { icon: Bell, label: 'Enviar Alerta' },
                { icon: Truck, label: 'Ver Flota' },
                { icon: FileText, label: 'Reporte' },
                { icon: Activity, label: 'Logs' },
              ].map((action, i) => {
                const Icon = action.icon;
                return (
                  <button
                    key={i}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:border-[#1B5E3C]/30 hover:text-[#1B5E3C] hover:bg-primary-50 active:scale-[0.98] transition-all touch-target"
                  >
                    <Icon size={16} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CentroControlPage;
