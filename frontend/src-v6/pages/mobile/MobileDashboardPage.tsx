/**
 * SITREP v6 - Mobile Dashboard Page
 * ==================================
 * Dashboard optimizado para dispositivos móviles
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  MapPin,
  TrendingUp,
  Clock,
  ChevronRight,
  Package,
  CheckCircle2,
  Truck,
  Radio,
  Navigation
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';

const roleLabelMap: Record<string, string> = {
  ADMIN: 'Admin',
  GENERADOR: 'Generador',
  TRANSPORTISTA: 'Transportista',
  OPERADOR: 'Operador',
  AUDITOR: 'Auditor',
};

const roleBadgeColor: Record<string, 'primary' | 'info' | 'warning' | 'success'> = {
  ADMIN: 'primary',
  GENERADOR: 'info',
  TRANSPORTISTA: 'warning',
  OPERADOR: 'success',
  AUDITOR: 'info',
};

export const MobileDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { data: dashData, isLoading: dashLoading } = useDashboardStats();
  const mp = useMobilePrefix();
  const isTransportista = currentUser?.rol === 'TRANSPORTISTA';

  // FIX 2: Fetch assigned/active trips for TRANSPORTISTA
  const { data: tripsEnTransito } = useManifiestos(
    isTransportista ? { estado: EstadoManifiesto.EN_TRANSITO, limit: 5 } : undefined
  );
  const { data: tripsAprobados } = useManifiestos(
    isTransportista ? { estado: EstadoManifiesto.APROBADO, limit: 5 } : undefined
  );

  const activeTrips = tripsEnTransito?.items || [];
  const pendingTrips = tripsAprobados?.items || [];

  const accesosRapidos = useMemo(() => [
    { id: 1, label: 'Nuevo Manifiesto', icon: FileText, path: mp('/manifiestos/nuevo'), color: 'primary' },
    { id: 2, label: 'Escanear QR', icon: MapPin, path: mp('/scan'), color: 'success' },
    { id: 3, label: 'Ver Tracking', icon: Package, path: mp('/tracking'), color: 'info' },
    { id: 4, label: 'Reportes', icon: TrendingUp, path: mp('/reportes'), color: 'purple' },
  ], [mp]);

  const dashStats = (dashData as any)?.data || dashData;

  const stats = [
    { id: 1, label: 'Manifiestos Total', value: String(dashStats?.manifiestos?.total ?? 0), change: undefined, icon: FileText, color: 'primary' },
    { id: 2, label: 'En Tránsito', value: String(dashStats?.manifiestos?.enTransito ?? 0), change: undefined, icon: MapPin, color: 'info' },
    { id: 3, label: 'Pendientes', value: String(dashStats?.manifiestos?.pendientes ?? 0), icon: Clock, color: 'warning' },
    { id: 4, label: 'Completados', value: String(dashStats?.manifiestos?.completados ?? 0), change: undefined, icon: CheckCircle2, color: 'success' },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{greeting()},</p>
          <h2 className="text-xl font-bold text-neutral-900">{currentUser?.nombre || 'Usuario'}</h2>
        </div>
        <Badge variant="soft" color={roleBadgeColor[currentUser?.rol || 'ADMIN'] || 'primary'}>
          {roleLabelMap[currentUser?.rol || 'ADMIN'] || currentUser?.rol || 'ADMIN'}
        </Badge>
      </div>

      {/* FIX 2: TRANSPORTISTA Trip Assignment Banner */}
      {isTransportista && (activeTrips.length > 0 || pendingTrips.length > 0) && (
        <div className="space-y-2">
          {/* Active trips (EN_TRANSITO) */}
          {activeTrips.map((trip: any) => (
            <Card key={trip.id} className="border-2 border-success-200 bg-success-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-success-100 flex items-center justify-center">
                      <Radio size={16} className="text-success-600 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-success-800">Viaje en Curso</p>
                      <p className="text-xs text-success-600">#{trip.numero || trip.id?.slice(0, 8)}</p>
                    </div>
                  </div>
                  <Badge variant="soft" color="success">EN TRANSITO</Badge>
                </div>
                <p className="text-xs text-success-700 mb-3">
                  Destino: {trip.operador?.razonSocial || '-'}
                </p>
                <Button
                  fullWidth
                  size="sm"
                  onClick={() => navigate(mp(`/transporte/viaje/${trip.id}`))}
                >
                  <Navigation size={14} className="mr-1.5" />
                  Ir al viaje
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Pending trips (APROBADO) */}
          {pendingTrips.length > 0 && (
            <Card className="border-2 border-warning-200 bg-warning-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-warning-100 flex items-center justify-center">
                    <Truck size={16} className="text-warning-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-warning-800">
                      {pendingTrips.length} viaje{pendingTrips.length > 1 ? 's' : ''} asignado{pendingTrips.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-warning-600">Pendientes de retiro</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {pendingTrips.slice(0, 3).map((trip: any) => (
                    <button
                      key={trip.id}
                      onClick={() => navigate(mp(`/transporte/viaje/${trip.id}`))}
                      className="w-full flex items-center justify-between p-2.5 bg-white rounded-lg border border-warning-200 hover:bg-warning-50 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-xs font-semibold text-neutral-800">#{trip.numero || trip.id?.slice(0, 8)}</p>
                        <p className="text-xs text-neutral-500">{trip.generador?.razonSocial || '-'}</p>
                      </div>
                      <ChevronRight size={16} className="text-warning-400" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(mp('/manifiestos'))}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-2 rounded-lg ${
                    stat.color === 'primary' ? 'bg-primary-100' :
                    stat.color === 'info' ? 'bg-info-100' :
                    stat.color === 'warning' ? 'bg-warning-100' :
                    'bg-success-100'
                  }`}>
                    <Icon size={18} className={
                      stat.color === 'primary' ? 'text-primary-600' :
                      stat.color === 'info' ? 'text-info-600' :
                      stat.color === 'warning' ? 'text-warning-600' :
                      'text-success-600'
                    } />
                  </div>
                  {stat.change && (
                    <span className="text-xs font-medium text-success-600">{stat.change}</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-xs text-neutral-500">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Access */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Accesos Rápidos</h3>
        <div className="grid grid-cols-4 gap-2">
          {accesosRapidos.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-neutral-100 active:scale-95 transition-transform"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  item.color === 'primary' ? 'bg-primary-100' :
                  item.color === 'success' ? 'bg-success-100' :
                  item.color === 'info' ? 'bg-info-100' :
                  'bg-purple-100'
                }`}>
                  <Icon size={22} className={
                    item.color === 'primary' ? 'text-primary-600' :
                    item.color === 'success' ? 'text-success-600' :
                    item.color === 'info' ? 'text-info-600' :
                    'text-purple-600'
                  } />
                </div>
                <span className="text-[10px] font-medium text-neutral-700 text-center leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">Actividad Reciente</h3>
          <button 
            onClick={() => navigate(mp('/manifiestos'))}
            className="text-xs text-primary-600 font-medium flex items-center gap-0.5"
          >
            Ver todo
            <ChevronRight size={14} />
          </button>
        </div>
        
        <div className="space-y-2 animate-fade-in">
          {dashLoading ? (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="animate-spin w-6 h-6 border-3 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-2" />
                <p className="text-xs text-neutral-400">Cargando...</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-neutral-500">
                  {(dashStats?.manifiestos?.enTransito ?? 0) > 0
                    ? `${dashStats.manifiestos.enTransito} manifiestos en tránsito`
                    : 'Sin actividad reciente'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Resumen del día */}
      <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-primary-100 text-sm">Resumen del día</p>
              <h3 className="text-xl font-bold mt-1">{dashStats?.manifiestos?.enTransito ?? 0} manifiestos activos</h3>
              <p className="text-primary-100 text-sm mt-1">{dashStats?.manifiestos?.pendientes ?? 0} pendientes</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp size={24} className="text-white" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button 
              onClick={() => navigate(mp('/manifiestos'))}
              className="flex-1 py-2 bg-white text-primary-600 font-medium rounded-lg text-sm"
            >
              Ver manifiestos
            </button>
            <button 
              onClick={() => navigate(mp('/tracking'))}
              className="flex-1 py-2 bg-primary-400/50 text-white font-medium rounded-lg text-sm"
            >
              Ver tracking
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileDashboardPage;
