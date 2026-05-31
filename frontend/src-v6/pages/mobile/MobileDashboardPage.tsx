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
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { MobileRoleHero } from '../../components/mobile/MobileRoleHero';
import { TransportistaTripQueue } from '../../components/mobile/TransportistaTripQueue';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';

export const MobileDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { data: dashData, isLoading: dashLoading } = useDashboardStats();
  const mp = useMobilePrefix();
  const isTransportista = currentUser?.rol === 'TRANSPORTISTA';

  // FIX 2: Fetch assigned/active trips for TRANSPORTISTA
  const { data: tripsEnTransito } = useManifiestos(
    isTransportista ? { estado: EstadoManifiesto.EN_TRANSITO, limit: 5 } : undefined,
    { enabled: isTransportista },
  );
  const { data: tripsAprobados } = useManifiestos(
    isTransportista ? { estado: EstadoManifiesto.APROBADO, limit: 5 } : undefined,
    { enabled: isTransportista },
  );

  const activeTrips = tripsEnTransito?.items || [];
  const pendingTrips = tripsAprobados?.items || [];

  // Fallback: read active trip from localStorage when API hasn't responded yet
  const savedTripId = useMemo(() => localStorage.getItem('sitrep_active_trip_id'), []);
  const savedTripSnapshot = useMemo(() => {
    if (!savedTripId) return null;
    try {
      const s = localStorage.getItem(`viaje_snapshot_${savedTripId}`);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }, [savedTripId]);

  const activeQueueTrips = useMemo(() => (
    activeTrips.length > 0
      ? activeTrips
      : savedTripSnapshot && savedTripId
        ? [{
            id: savedTripId,
            numero: savedTripSnapshot.numero,
            operador: { razonSocial: savedTripSnapshot.operador },
            generador: { razonSocial: savedTripSnapshot.generador },
          }]
        : []
  ), [activeTrips, savedTripId, savedTripSnapshot]);

  const accesosRapidos = useMemo(() => [
    { id: 1, label: 'Nuevo Manifiesto', icon: FileText, path: mp('/manifiestos/nuevo'), color: 'primary' },
    { id: 2, label: 'Escanear QR', icon: MapPin, path: mp('/escaner-qr'), color: 'success' },
    { id: 3, label: 'Ver Tracking', icon: Package, path: mp('/centro-control'), color: 'info' },
    { id: 4, label: 'Reportes', icon: TrendingUp, path: mp('/reportes'), color: 'purple' },
  ], [mp]);

  const dashStats = dashData;

  const stats = [
    { id: 1, label: 'Manifiestos Total', value: String(dashStats?.manifiestos?.total ?? 0), change: undefined, icon: FileText, color: 'primary', href: '/manifiestos' },
    { id: 2, label: 'En Tránsito', value: String(dashStats?.manifiestos?.enTransito ?? 0), change: undefined, icon: MapPin, color: 'info', href: '/manifiestos?estado=EN_TRANSITO' },
    { id: 3, label: 'Pendientes', value: String(dashStats?.manifiestos?.pendientes ?? 0), icon: Clock, color: 'warning', href: '/manifiestos?estado=BORRADOR' },
    { id: 4, label: 'Completados', value: String(dashStats?.manifiestos?.completados ?? 0), change: undefined, icon: CheckCircle2, color: 'success', href: '/manifiestos?estado=TRATADO' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <MobileRoleHero
        role={currentUser?.rol || 'ADMIN'}
        userName={currentUser?.nombre || 'Usuario'}
        activeCount={isTransportista ? activeQueueTrips.length : 0}
        pendingCount={isTransportista ? pendingTrips.length : 0}
      />

      {isTransportista && (
        <TransportistaTripQueue
          activeTrips={activeQueueTrips}
          pendingTrips={pendingTrips}
          onOpenTrip={(tripId) => navigate(mp(`/transporte/viaje/${tripId}`))}
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(mp(stat.href))}>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    ? `${dashStats?.manifiestos?.enTransito} manifiestos en tránsito`
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
              onClick={() => navigate(mp('/centro-control'))}
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
