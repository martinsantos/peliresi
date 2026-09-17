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
import { activeTripStorageKey, tripSnapshotStorageKey } from '../../utils/userContext';

const roleLabelMap: Record<string, string> = {
  ADMIN: 'Admin',
  GENERADOR: 'Generador',
  TRANSPORTISTA: 'Transportista',
  OPERADOR: 'Operador',
  AUDITOR: 'Auditor',
  ADMIN_GENERADOR: 'Adm. Generadores',
  ADMIN_OPERADOR: 'Adm. Operadores',
  ADMIN_TRANSPORTISTA: 'Adm. Transportistas',
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
  const { currentUser, isAuditor } = useAuth();
  const { data: dashData, isLoading: dashLoading, isError, isFetching, refetch } = useDashboardStats();
  const mp = useMobilePrefix();
  const isTransportista = currentUser?.rol === 'TRANSPORTISTA';
  const canCreate = ['ADMIN', 'GENERADOR', 'ADMIN_GENERADOR'].includes(currentUser?.rol ?? '');
  const canTrack = ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA', 'TRANSPORTISTA'].includes(currentUser?.rol ?? '');

  // FIX 2: Fetch assigned/active trips for TRANSPORTISTA
  const { data: tripsEnTransito } = useManifiestos(
    { estado: EstadoManifiesto.EN_TRANSITO, limit: 5 }, { enabled: isTransportista }
  );
  const { data: tripsAprobados } = useManifiestos(
    { estado: EstadoManifiesto.APROBADO, limit: 5 }, { enabled: isTransportista }
  );

  const activeTrips = tripsEnTransito?.items || [];
  const pendingTrips = tripsAprobados?.items || [];

  // Fallback: read active trip from localStorage when API hasn't responded yet
  const savedTripId = useMemo(() => (
    currentUser?.id != null ? localStorage.getItem(activeTripStorageKey(currentUser.id)) : null
  ), [currentUser?.id]);
  const savedTripSnapshot = useMemo(() => {
    if (!savedTripId) return null;
    try {
      if (currentUser?.id == null) return null;
      const s = localStorage.getItem(tripSnapshotStorageKey(currentUser.id, savedTripId));
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }, [savedTripId, currentUser?.id]);

  const accesosRapidos = useMemo(() => isAuditor ? [
    { id: 1, label: 'Ver Manifiestos', icon: FileText, path: mp('/manifiestos'), color: 'primary' },
    { id: 2, label: 'Reportes', icon: TrendingUp, path: mp('/reportes'), color: 'purple' },
  ] : [
    { id: 1, label: canCreate ? 'Nuevo Manifiesto' : isTransportista ? 'Mis Viajes' : 'Ver Manifiestos', icon: FileText, path: mp(canCreate ? '/manifiestos/nuevo' : isTransportista ? '/transporte/perfil' : '/manifiestos'), color: 'primary' },
    { id: 2, label: 'Escanear QR', icon: MapPin, path: mp('/escaner-qr'), color: 'success' },
    ...(canTrack ? [{ id: 3, label: 'Centro de Control', icon: Package, path: mp('/centro-control'), color: 'info' }] : []),
    { id: 4, label: 'Reportes', icon: TrendingUp, path: mp('/reportes'), color: 'purple' },
  ], [isAuditor, canCreate, canTrack, isTransportista, mp]);

  const dashStats = dashData;

  // The API's canonical shape is `estadisticas`; retain the legacy fallback
  // so older demo deployments keep rendering useful counters.
  const statsData = dashStats?.estadisticas;
  const legacyStats = dashStats?.manifiestos;
  const total = statsData?.total ?? legacyStats?.total;
  const enTransito = statsData?.enTransito ?? legacyStats?.enTransito;
  const pendientes = statsData ? statsData.borradores + statsData.aprobados : legacyStats?.pendientes;
  const display = (value: number | undefined) => value === undefined ? '—' : String(value);
  const stats = [
    { id: 1, label: 'Total de manifiestos', value: display(total), icon: FileText, color: 'primary', href: '/manifiestos' },
    { id: 2, label: 'En Tránsito', value: display(enTransito), icon: MapPin, color: 'info', href: '/manifiestos?estado=EN_TRANSITO' },
    { id: 3, label: 'Borradores', value: display(statsData?.borradores), icon: Clock, color: 'warning', href: '/manifiestos?estado=BORRADOR' },
    { id: 4, label: 'Aprobados', value: display(statsData?.aprobados), icon: Truck, color: 'warning', href: '/manifiestos?estado=APROBADO' },
    { id: 5, label: 'Recibidos', value: display(statsData?.recibidos), icon: Package, color: 'info', href: '/manifiestos?estado=RECIBIDO' },
    { id: 6, label: 'Tratados', value: display(statsData?.tratados ?? legacyStats?.completados), icon: CheckCircle2, color: 'success', href: '/manifiestos?estado=TRATADO' },
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

      {isError && (
        <div role="alert" className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
          <p>No pudimos actualizar el resumen. {dashData ? 'Los datos visibles son de la última consulta.' : 'Esto no significa que no haya manifiestos.'}</p>
          <Button size="sm" variant="outline" className="mt-2" disabled={isFetching} onClick={() => void refetch()}>Reintentar</Button>
        </div>
      )}
      {dashLoading && <p role="status" className="text-sm text-neutral-500">Cargando resumen…</p>}

      {/* FIX 2: TRANSPORTISTA Trip Assignment Banner */}
      {isTransportista && activeTrips.length === 0 && savedTripSnapshot && (
        <Card className="border-2 border-success-200 bg-success-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-success-100 flex items-center justify-center">
                  <Radio size={16} className="text-success-600 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-success-800">Viaje en Curso</p>
                  <p className="text-xs text-success-600">#{savedTripSnapshot.numero || savedTripId?.slice(0, 8)}</p>
                </div>
              </div>
              <Badge variant="soft" color="warning">Datos guardados</Badge>
            </div>
            <p className="text-xs text-success-700 mb-3">
              Destino: {savedTripSnapshot.operador || '-'}
            </p>
            <Button
              fullWidth
              size="sm"
              onClick={() => navigate(mp(`/transporte/viaje/${savedTripId}`))}
            >
              <Navigation size={14} className="mr-1.5" />
              Ir al viaje
            </Button>
          </CardContent>
        </Card>
      )}
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
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.id} type="button" className="text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" onClick={() => navigate(mp(stat.href))}>
            <Card className="hover:shadow-md transition-shadow h-full">
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
                </div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-xs text-neutral-500">{stat.label}</p>
              </CardContent>
            </Card>
            </button>
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
                <span className="text-xs font-medium text-neutral-700 text-center leading-tight">
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
          ) : dashStats?.recientes?.length ? (
            <div className="space-y-2">
              {dashStats.recientes.slice(0, 3).map(manifiesto => (
                <button key={manifiesto.id} type="button" onClick={() => navigate(mp(`/manifiestos/${manifiesto.id}`))} className="w-full flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-left">
                  <span className="text-sm font-medium">{manifiesto.numero}</span>
                  <span className="text-xs text-neutral-500">{manifiesto.estado.replaceAll('_', ' ')}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-neutral-500">
                  {isError ? 'Actividad no disponible. Reintentá la consulta.' : !dashData ? 'Actividad no disponible' : 'Sin actividad reciente'}
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
              <p className="text-primary-100 text-sm">Estado de tus manifiestos</p>
              <h3 className="text-xl font-bold mt-1">{display(enTransito)} en tránsito</h3>
              <p className="text-primary-100 text-sm mt-1">{display(pendientes)} por preparar o retirar</p>
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
            {canTrack && <button
              onClick={() => navigate(mp('/centro-control'))}
              className="flex-1 py-2 bg-primary-400/50 text-white font-medium rounded-lg text-sm"
            >
              Ver tracking
            </button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileDashboardPage;
