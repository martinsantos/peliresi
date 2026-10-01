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
  ClipboardCheck,
  Factory,
  Bell,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { OperatorActionQueue } from '../../components/mobile/OperatorActionQueue';
import { TransportistaTripQueue } from '../../components/mobile/TransportistaTripQueue';
import { useAuth } from '../../contexts/AuthContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';

export const MobileDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { data: dashData, isLoading: dashLoading, isError: dashError } = useDashboardStats();
  const connectivity = useConnectivity({ pingInterval: 60_000 });
  const mp = useMobilePrefix();
  const isTransportista = currentUser?.rol === 'TRANSPORTISTA';
  const isOperador = currentUser?.rol === 'OPERADOR';
  const isInspector = Boolean(currentUser?.esInspector);

  // FIX 2: Fetch assigned/active trips for TRANSPORTISTA
  const { data: tripsEnTransito } = useManifiestos(
    isTransportista ? { estado: EstadoManifiesto.EN_TRANSITO, limit: 5 } : undefined,
    { enabled: isTransportista },
  );
  const { data: tripsAprobados } = useManifiestos(
    isTransportista ? { estado: EstadoManifiesto.APROBADO, limit: 5 } : undefined,
    { enabled: isTransportista },
  );
  const { data: entregadosOperador } = useManifiestos(
    isOperador ? { estado: EstadoManifiesto.ENTREGADO, limit: 5 } : undefined,
    { enabled: isOperador },
  );
  const { data: recibidosOperador } = useManifiestos(
    isOperador ? { estado: EstadoManifiesto.RECIBIDO, limit: 5 } : undefined,
    { enabled: isOperador },
  );
  const { data: enTratamientoOperador } = useManifiestos(
    isOperador ? { estado: EstadoManifiesto.EN_TRATAMIENTO, limit: 5 } : undefined,
    { enabled: isOperador },
  );

  const activeTrips = tripsEnTransito?.items || [];
  const pendingTrips = tripsAprobados?.items || [];
  const operatorQueue = [
    ...(isOperador ? entregadosOperador?.items || [] : []),
    ...(isOperador ? recibidosOperador?.items || [] : []),
    ...(isOperador ? enTratamientoOperador?.items || [] : []),
  ];

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

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const displayModeStandalone = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;
    const navigatorStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    return displayModeStandalone || navigatorStandalone;
  }, []);

  const accesosRapidos = useMemo(() => {
    if (isInspector) return [
      { id: 'inspecciones', label: 'Continuar inspección', icon: ClipboardCheck, path: mp('/inspecciones') },
      { id: 'actores', label: 'Consultar actores', icon: Factory, path: mp('/actores') },
    ];
    if (isTransportista) return [
      { id: 'viajes', label: 'Mis viajes', icon: Truck, path: mp('/transporte/perfil') },
      { id: 'manifiestos', label: 'Manifiestos', icon: FileText, path: mp('/manifiestos') },
    ];
    if (isOperador) return [
      { id: 'recepciones', label: 'Revisar cargas', icon: FileText, path: mp('/manifiestos') },
      { id: 'avisos', label: 'Avisos', icon: Bell, path: mp('/notificaciones') },
    ];
    if (currentUser?.rol === 'GENERADOR') return [
      { id: 'manifiestos', label: 'Mis manifiestos', icon: FileText, path: mp('/manifiestos') },
      { id: 'nuevo', label: 'Nuevo manifiesto', icon: ClipboardCheck, path: mp('/manifiestos/nuevo') },
    ];
    return [
      { id: 'inspecciones', label: 'Inspecciones', icon: ClipboardCheck, path: mp('/inspecciones') },
      { id: 'generadores', label: 'Generadores', icon: Factory, path: mp('/admin/generadores') },
      { id: 'alertas', label: 'Alertas', icon: Bell, path: mp('/alertas') },
      { id: 'reportes', label: 'Reportes', icon: TrendingUp, path: mp('/reportes') },
    ];
  }, [currentUser?.rol, isInspector, isOperador, isTransportista, mp]);

  const est = dashData?.estadisticas;
  const count = (value: number | undefined) => dashLoading || dashError || value == null ? '—' : String(value);

  const stats = [
    { id: 1, label: 'Manifiestos', value: count(est?.total), icon: FileText, color: 'primary', href: '/manifiestos' },
    { id: 2, label: 'En tránsito', value: count(est?.enTransito), icon: MapPin, color: 'info', href: '/manifiestos?estado=EN_TRANSITO' },
    { id: 3, label: 'Borradores', value: count(est?.borradores), icon: Clock, color: 'warning', href: '/manifiestos?estado=BORRADOR' },
    { id: 4, label: 'Tratados', value: count(est?.tratados), icon: CheckCircle2, color: 'success', href: '/manifiestos?estado=TRATADO' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <header>
        <p className="text-sm text-neutral-600">Hola, {currentUser?.nombre || 'Usuario'}</p>
        <h2 className="text-xl font-bold text-neutral-900">
          {isInspector ? 'Trabajo de inspección' : isTransportista ? 'Mi viaje' : isOperador ? 'Cargas por resolver' : currentUser?.rol === 'GENERADOR' ? 'Mis trámites' : 'Trabajo pendiente'}
        </h2>
      </header>

      {!connectivity.isOnline && <p role="status" className="rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-900">Sin conexión. Revisá abajo qué trabajo quedó guardado en este dispositivo.</p>}

      {isTransportista && (
        <TransportistaTripQueue
          activeTrips={activeQueueTrips}
          pendingTrips={pendingTrips}
          onOpenTrip={(tripId) => navigate(mp(`/transporte/viaje/${tripId}`))}
        />
      )}

      {isOperador && (
        <OperatorActionQueue
          manifiestos={operatorQueue}
          onOpenManifiesto={(manifiestoId) => navigate(mp(`/manifiestos/${manifiestoId}`))}
        />
      )}

      <section aria-label="Acciones principales">
        <div className="grid grid-cols-2 gap-2">
          {accesosRapidos.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" onClick={() => navigate(item.path)} className="flex min-h-14 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
              <Icon size={19} className="shrink-0 text-primary-700" aria-hidden="true" />{item.label}
            </button>;
          })}
        </div>
      </section>

      {dashError && <p role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800">No se pudieron actualizar las cifras. Abrí el listado para consultar los datos actuales.</p>}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.id} type="button" className="rounded-xl border border-neutral-200 bg-white text-left transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700" onClick={() => navigate(mp(stat.href))}>
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
            </button>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">Actividad Reciente</h3>
          <button 
            onClick={() => navigate(mp('/manifiestos'))}
            className="flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-xs font-medium text-primary-600"
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
          ) : dashError ? null : dashData?.recientes?.length ? dashData.recientes.slice(0, 3).map((m) => (
            <button key={m.id} type="button" onClick={() => navigate(mp(`/manifiestos/${m.id}`))} className="flex w-full min-h-14 items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left">
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-neutral-900">{m.numero}</span><span className="block truncate text-xs text-neutral-600">{m.generador?.razonSocial || 'Generador sin nombre'} · {m.estado}</span></span><ChevronRight size={18} className="shrink-0 text-neutral-400" />
            </button>
          )) : <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">Sin actividad reciente</p>}
        </div>
      </div>

      <details className="rounded-xl border border-neutral-200 bg-white">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-neutral-800">Conexión y dispositivo</summary>
        <div className="space-y-1 px-4 pb-4 text-sm text-neutral-700">
          <p>{!connectivity.isOnline ? 'Sin red' : connectivity.isApiReachable ? 'Conectado al servidor' : 'Sin respuesta del servidor'}</p>
          <p>{isStandalone ? 'Abierto como app instalada' : 'Abierto en el navegador'}</p>
        </div>
      </details>
    </div>
  );
};

export default MobileDashboardPage;
