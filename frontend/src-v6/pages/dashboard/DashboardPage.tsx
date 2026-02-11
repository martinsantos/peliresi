/**
 * SITREP v6 - Dashboard Page
 * ===========================
 * Dashboard adaptativo según el rol del usuario
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Truck,
  MapPin,
  Factory,
  FlaskConical,
  Users,
  BarChart3,
  ArrowRight,
  QrCode,
  Plus,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { QuickActions } from '../../components/ui/QuickActions';
import { SkeletonStats, SkeletonCard } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useManifiestos } from '../../hooks/useManifiestos';

// ========================================
// ADMIN DASHBOARD
// ========================================
const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.includes('/mobile');

  const route = (path: string) => isMobile ? `/mobile${path}` : path;

  // Try real API data
  const { data: dashStats, isLoading: loadingStats, isError: errorStats } = useDashboardStats();
  const { data: recentManifiestos, isLoading: loadingRecent } = useManifiestos({ limit: 4 });

  const est = dashStats?.estadisticas;
  const totalM = est?.total ?? 0;
  const enTransitoM = est?.enTransito ?? 0;
  const tratadosM = est?.tratados ?? 0;
  const complianceRate = totalM > 0 ? `${((tratadosM / totalM) * 100).toFixed(1)}%` : '-';

  const stats = [
    { id: 1, label: 'Manifiestos Total', value: String(totalM), icon: FileText, color: 'primary', href: '/manifiestos' },
    { id: 2, label: 'En Tránsito', value: String(enTransitoM), icon: Truck, color: 'info', href: '/manifiestos?estado=EN_TRANSITO' },
    { id: 3, label: 'Tratados', value: String(tratadosM), icon: AlertCircle, color: 'warning', href: '/reportes' },
    { id: 4, label: 'Tasa Cumplimiento', value: complianceRate, icon: CheckCircle2, color: 'success', href: '/reportes' },
  ];

  const recientes = dashStats?.recientes || recentManifiestos?.items || [];
  const actividadReciente = recientes.slice(0, 4).map((m: any, i: number) => ({
    id: i + 1,
    manifiestoId: m.id,
    titulo: `Manifiesto #${m.numero || m.id}`,
    accion: m.generador?.razonSocial || m.generador || 'Generador',
    tiempo: m.updatedAt || m.createdAt
      ? new Date(m.updatedAt || m.createdAt).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })
      : '-',
    estado: m.estado === 'EN_TRANSITO' ? 'alerta' : m.estado === 'TRATADO' ? 'exito' : 'nuevo',
  }));

  const isLoading = loadingStats || loadingRecent;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Panel de Control</h2>
            <p className="text-neutral-600">Vista general del sistema de trazabilidad</p>
          </div>
        </div>
        <SkeletonStats count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard className="lg:col-span-2" lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  if (errorStats) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Panel de Control</h2>
            <p className="text-neutral-600">Vista general del sistema de trazabilidad</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="text-red-400" size={24} />
          </div>
          <p className="text-red-600 font-medium">Error al cargar datos del dashboard</p>
          <p className="text-sm text-neutral-500 mt-1">Verifica tu conexión e intenta nuevamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Panel de Control</h2>
          <p className="text-neutral-600">Vista general del sistema de trazabilidad</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => navigate(route('/manifiestos/nuevo'))} className="hover-glow">
          Nuevo Manifiesto
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6 stagger-children">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const accentVar = stat.color === 'primary' ? '--color-primary-500' :
            stat.color === 'info' ? '--color-info-500' :
            stat.color === 'warning' ? '--color-warning-500' : '--color-success-500';
          return (
            <Card key={stat.id} className="card-interactive stat-card" style={{ '--stat-accent': `var(${accentVar})` } as React.CSSProperties} onClick={() => navigate(route(stat.href))}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${
                    stat.color === 'primary' ? 'bg-primary-100' :
                    stat.color === 'info' ? 'bg-info-100' :
                    stat.color === 'warning' ? 'bg-warning-100' :
                    'bg-success-100'
                  }`}>
                    <Icon size={20} className={
                      stat.color === 'primary' ? 'text-primary-600' :
                      stat.color === 'info' ? 'text-info-600' :
                      stat.color === 'warning' ? 'text-warning-600' :
                      'text-success-600'
                    } />
                  </div>
                  {(stat as any).change && (
                    <span className="text-xs font-semibold text-success-600 bg-success-50 px-2 py-0.5 rounded-full">{(stat as any).change}</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-neutral-900 animate-count-up">{stat.value}</p>
                <p className="text-sm text-neutral-500 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actividad Reciente */}
        <Card className="lg:col-span-2">
          <CardHeader 
            title="Actividad Reciente" 
            action={<Button variant="ghost" size="sm" onClick={() => navigate(route('/manifiestos'))}>Ver todo</Button>}
          />
          <CardContent className="p-0">
            {actividadReciente.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No hay actividad reciente</div>
            ) : (
            <div className="divide-y divide-neutral-100">
              {actividadReciente.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 row-hover transition-colors cursor-pointer"
                  onClick={() => item.manifiestoId && navigate(route(`/manifiestos/${item.manifiestoId}`))}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.estado === 'nuevo' ? 'bg-primary-100 text-primary-600' :
                      item.estado === 'alerta' ? 'bg-warning-100 text-warning-600' :
                      item.estado === 'exito' ? 'bg-success-100 text-success-600' :
                      'bg-info-100 text-info-600'
                    }`}>
                      {item.estado === 'nuevo' ? <FileText size={18} /> :
                       item.estado === 'alerta' ? <AlertCircle size={18} /> :
                       item.estado === 'exito' ? <CheckCircle2 size={18} /> :
                       <Users size={18} />}
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{item.titulo}</p>
                      <p className="text-sm text-neutral-500">{item.accion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{item.tiempo}</span>
                    <ArrowRight size={14} className="text-neutral-300" />
                  </div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions - Componente Consistente */}
        <QuickActions
          title="Acciones Rápidas"
          actions={[
            { icon: FileText, label: 'Ver Manifiestos', onClick: () => navigate(route('/manifiestos')) },
            { icon: MapPin, label: 'Tracking', onClick: () => navigate(route('/tracking')) },
            { icon: BarChart3, label: 'Reportes', onClick: () => navigate(route('/reportes')) },
            { icon: Users, label: 'Usuarios', onClick: () => navigate(route('/admin/usuarios')) },
          ]}
        />
      </div>
    </div>
  );
};

// ========================================
// GENERADOR DASHBOARD
// ========================================
const GeneradorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const isMobile = location.pathname.includes('/mobile');
  const route = (path: string) => isMobile ? `/mobile${path}` : path;

  const { data: dashStats } = useDashboardStats();
  const { data: recentManifiestos } = useManifiestos({ limit: 4 });

  const est = dashStats?.estadisticas;
  const stats = [
    { id: 1, label: 'Mis Manifiestos', value: String(est?.total ?? 0), icon: FileText, color: 'purple', href: '/manifiestos' },
    { id: 2, label: 'En Tránsito', value: String(est?.enTransito ?? 0), icon: Truck, color: 'info', href: '/manifiestos?estado=EN_TRANSITO' },
    { id: 3, label: 'Pendientes', value: String(est?.borradores ?? 0), icon: Clock, color: 'warning', href: '/manifiestos?estado=BORRADOR' },
    { id: 4, label: 'Tratados', value: String(est?.tratados ?? 0), icon: Factory, color: 'success', href: '/manifiestos?estado=TRATADO' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">¡Hola, {currentUser?.nombre?.split(' ')[0] || 'Usuario'}!</h2>
        <p className="text-neutral-600">{currentUser?.sector}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(route(stat.href))}>
              <CardContent className="p-4">
                <div className={`p-2 rounded-lg w-fit mb-2 ${
                  stat.color === 'purple' ? 'bg-purple-100' :
                  stat.color === 'info' ? 'bg-info-100' :
                  stat.color === 'warning' ? 'bg-warning-100' :
                  'bg-success-100'
                }`}>
                  <Icon size={18} className={
                    stat.color === 'purple' ? 'text-purple-600' :
                    stat.color === 'info' ? 'text-info-600' :
                    stat.color === 'warning' ? 'text-warning-600' :
                    'text-success-600'
                  } />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-sm text-neutral-500">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Acciones principales */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          size="lg" 
          leftIcon={<Plus size={20} />}
          onClick={() => navigate(route('/manifiestos/nuevo'))}
        >
          Nuevo Manifiesto
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          leftIcon={<QrCode size={20} />}
          onClick={() => navigate(route('/manifiestos'))}
        >
          Escanear QR
        </Button>
      </div>

      {/* Mis Manifiestos Recientes */}
      <Card>
        <CardHeader 
          title="Mis Manifiestos Recientes" 
          action={<Button variant="ghost" size="sm" onClick={() => navigate(route('/manifiestos'))}>Ver todo</Button>}
        />
        <CardContent className="p-0">
          {(() => {
            const recientes = dashStats?.recientes || recentManifiestos?.items || [];
            return recientes.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No hay manifiestos recientes</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {recientes.slice(0, 3).map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                    onClick={() => navigate(route(`/manifiestos/${m.id}`))}
                  >
                    <div>
                      <p className="font-medium text-neutral-900">{m.numero || m.id}</p>
                      <p className="text-sm text-neutral-500">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-AR') : '-'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="soft" color={m.estado === 'TRATADO' || m.estado === 'ENTREGADO' ? 'success' : 'info'}>
                        {m.estado === 'EN_TRANSITO' ? 'En Tránsito' : m.estado?.replace(/_/g, ' ') || '-'}
                      </Badge>
                      <ArrowRight size={14} className="text-neutral-300" />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

// ========================================
// TRANSPORTISTA DASHBOARD
// ========================================
const TransportistaDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const isMobile = location.pathname.includes('/mobile');
  const route = (path: string) => isMobile ? `/mobile${path}` : path;

  const { data: dashStats } = useDashboardStats();
  const { data: tripsEnTransito } = useManifiestos({ estado: 'EN_TRANSITO' as any, limit: 5 });
  const { data: tripsAprobados } = useManifiestos({ estado: 'APROBADO' as any, limit: 5 });
  const activeTrips = tripsEnTransito?.items || [];
  const pendingTrips = tripsAprobados?.items || [];

  const est = dashStats?.estadisticas;
  const stats = [
    { id: 1, label: 'Entregados', value: String(est?.entregados ?? 0), icon: CheckCircle2, color: 'orange', href: '/manifiestos?estado=ENTREGADO' },
    { id: 2, label: 'En Camino', value: String(est?.enTransito ?? 0), icon: Truck, color: 'info', href: '/manifiestos?estado=EN_TRANSITO' },
    { id: 3, label: 'Pendientes', value: String(est?.aprobados ?? 0), icon: Clock, color: 'warning', href: '/manifiestos?estado=APROBADO' },
    { id: 4, label: 'Recibidos', value: String(est?.recibidos ?? 0), icon: MapPin, color: 'success', href: '/manifiestos?estado=RECIBIDO' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">¡Hola, {currentUser?.nombre?.split(' ')[0] || 'Usuario'}!</h2>
        <p className="text-neutral-600">{currentUser?.sector}</p>
      </div>

      {/* Trip Assignment Banner — viajes EN_TRANSITO o APROBADO */}
      {(activeTrips.length > 0 || pendingTrips.length > 0) && (
        <div className="space-y-3">
          {/* Active trips (EN_TRANSITO) — green banner */}
          {activeTrips.map((trip: any) => (
            <Card key={trip.id} className="border-2 border-success-200 bg-success-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center">
                      <Truck size={20} className="text-success-600 animate-pulse" />
                    </div>
                    <div>
                      <p className="font-bold text-success-800">Viaje en Curso</p>
                      <p className="text-sm text-success-600">#{trip.numero || trip.id?.slice(0, 8)}</p>
                    </div>
                  </div>
                  <Badge variant="soft" color="success">EN TRÁNSITO</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-success-700 mb-3">
                  <span>{trip.generador?.razonSocial || '-'}</span>
                  <ArrowRight size={14} />
                  <span>{trip.operador?.razonSocial || '-'}</span>
                </div>
                <Button fullWidth onClick={() => navigate(route(`/transporte/viaje/${trip.id}`))}>
                  <MapPin size={16} className="mr-2" />
                  Ir al Viaje
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Pending trips (APROBADO) — warning banner */}
          {pendingTrips.length > 0 && (
            <Card className="border-2 border-warning-200 bg-warning-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-warning-100 flex items-center justify-center">
                    <Truck size={20} className="text-warning-600" />
                  </div>
                  <div>
                    <p className="font-bold text-warning-800">
                      {pendingTrips.length} viaje{pendingTrips.length > 1 ? 's' : ''} asignado{pendingTrips.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-warning-600">Pendientes de retiro</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {pendingTrips.slice(0, 3).map((trip: any) => (
                    <button
                      key={trip.id}
                      onClick={() => navigate(route(`/transporte/viaje/${trip.id}`))}
                      className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-warning-200 hover:bg-warning-50 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm font-semibold text-neutral-800">#{trip.numero || trip.id?.slice(0, 8)}</p>
                        <p className="text-xs text-neutral-500">
                          {trip.generador?.razonSocial || '-'} → {trip.operador?.razonSocial || '-'}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-warning-400" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(route(stat.href))}>
              <CardContent className="p-4">
                <div className={`p-2 rounded-lg w-fit mb-2 ${
                  stat.color === 'orange' ? 'bg-orange-100' :
                  stat.color === 'info' ? 'bg-info-100' :
                  stat.color === 'warning' ? 'bg-warning-100' :
                  'bg-success-100'
                }`}>
                  <Icon size={18} className={
                    stat.color === 'orange' ? 'text-orange-600' :
                    stat.color === 'info' ? 'text-info-600' :
                    stat.color === 'warning' ? 'text-warning-600' :
                    'text-success-600'
                  } />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-sm text-neutral-500">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          size="lg"
          leftIcon={<MapPin size={20} />}
          onClick={() => navigate(route('/transporte/perfil'))}
        >
          Mis Viajes
        </Button>
        <Button
          variant="outline"
          size="lg"
          leftIcon={<QrCode size={20} />}
          onClick={() => navigate(route('/manifiestos'))}
        >
          Escanear
        </Button>
      </div>

      {/* Entregas Pendientes */}
      <Card>
        <CardHeader title="Entregas Pendientes" />
        <CardContent className="p-0">
          {(() => {
            const enTransito = dashStats?.enTransitoList || [];
            return enTransito.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No hay entregas pendientes</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {enTransito.slice(0, 5).map((m: any) => (
                  <div
                    key={m.id}
                    className="p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                    onClick={() => navigate(route(`/transporte/viaje/${m.id}`))}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-neutral-900">{m.numero || m.id}</p>
                      <Badge variant="soft" color="warning">{m.estado?.replace(/_/g, ' ') || 'En Tránsito'}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <span>{m.generador?.razonSocial || m.generador || '-'}</span>
                      <ArrowRight size={14} />
                      <span>{m.operador?.razonSocial || m.operador || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

// ========================================
// OPERADOR DASHBOARD
// ========================================
const OperadorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const isMobile = location.pathname.includes('/mobile');
  const route = (path: string) => isMobile ? `/mobile${path}` : path;

  const { data: dashStats } = useDashboardStats();

  const est = dashStats?.estadisticas;
  const stats = [
    { id: 1, label: 'Recibidos', value: String(est?.recibidos ?? 0), icon: FlaskConical, color: 'blue', href: '/manifiestos?estado=RECIBIDO' },
    { id: 2, label: 'En Tránsito', value: String(est?.enTransito ?? 0), icon: Factory, color: 'info', href: '/manifiestos?estado=EN_TRANSITO' },
    { id: 3, label: 'Pendientes', value: String(est?.entregados ?? 0), icon: Clock, color: 'warning', href: '/manifiestos?estado=ENTREGADO' },
    { id: 4, label: 'Tratados', value: String(est?.tratados ?? 0), icon: CheckCircle2, color: 'success', href: '/manifiestos?estado=TRATADO' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">¡Hola, {currentUser?.nombre?.split(' ')[0] || 'Usuario'}!</h2>
        <p className="text-neutral-600">{currentUser?.sector}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(route(stat.href))}>
              <CardContent className="p-4">
                <div className={`p-2 rounded-lg w-fit mb-2 ${
                  stat.color === 'green' ? 'bg-green-100' :
                  stat.color === 'info' ? 'bg-info-100' :
                  stat.color === 'warning' ? 'bg-warning-100' :
                  'bg-success-100'
                }`}>
                  <Icon size={18} className={
                    stat.color === 'green' ? 'text-green-600' :
                    stat.color === 'info' ? 'text-info-600' :
                    stat.color === 'warning' ? 'text-warning-600' :
                    'text-success-600'
                  } />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-sm text-neutral-500">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          size="lg" 
          leftIcon={<QrCode size={20} />}
          onClick={() => navigate(route('/manifiestos'))}
        >
          Recibir
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          leftIcon={<FileText size={20} />}
          onClick={() => navigate(route('/reportes'))}
        >
          Reportes
        </Button>
      </div>

      {/* Manifiestos por Recibir */}
      <Card>
        <CardHeader title="Recientes" />
        <CardContent className="p-0">
          {(() => {
            const recientes = dashStats?.recientes || [];
            return recientes.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No hay manifiestos recientes</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {recientes.slice(0, 5).map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                    onClick={() => navigate(route(`/manifiestos/${m.id}`))}
                  >
                    <div>
                      <p className="font-medium text-neutral-900">{m.numero || m.id}</p>
                      <p className="text-sm text-neutral-500">{m.transportista?.razonSocial || m.transportista || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="soft" color="info">{m.estado?.replace(/_/g, ' ') || '-'}</Badge>
                      <ArrowRight size={14} className="text-neutral-300" />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

// ========================================
// MAIN DASHBOARD PAGE
// ========================================
export const DashboardPage: React.FC = () => {
  const { isAdmin, isGenerador, isTransportista, isOperador } = useAuth();

  if (isAdmin) return <AdminDashboard />;
  if (isGenerador) return <GeneradorDashboard />;
  if (isTransportista) return <TransportistaDashboard />;
  if (isOperador) return <OperadorDashboard />;

  // Default fallback
  return <AdminDashboard />;
};

export default DashboardPage;
