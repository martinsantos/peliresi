import { manifestProposalsVisible } from '../../utils/manifestFeatures';
import { TrainingTaskQueue } from '../../components/TrainingTaskQueue';
/**
 * SITREP v6 - Mobile Dashboard Page
 * ==================================
 * Dashboard optimizado para dispositivos móviles
 */

import { workspaceNavigation, isInspectionStaff } from '../../utils/workspaceNavigation';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { OperatorActionQueue } from '../../components/mobile/OperatorActionQueue';
import { TransportistaTripQueue } from '../../components/mobile/TransportistaTripQueue';
import { useAuth } from '../../contexts/AuthContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import { manifestFeatureVisible } from '../../utils/manifestFeatures';
import { Button } from '../../components/ui/ButtonV2';

export const MobileDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { data: dashData, isLoading: dashLoading, isError: dashError } = useDashboardStats();
  const connectivity = useConnectivity({ pingInterval: 60_000 });
  const mp = useMobilePrefix();
  const isTransportista = currentUser?.rol === 'TRANSPORTISTA';
  const isOperador = currentUser?.rol === 'OPERADOR';
  const proposals = manifestProposalsVisible(currentUser);

  // FIX 2: Fetch assigned/active trips for TRANSPORTISTA
  const { data: tripsEnTransito, isLoading: activeTripsLoading, isError: activeTripsError } = useManifiestos(
    isTransportista ? { estado: EstadoManifiesto.EN_TRANSITO, modalidad: 'FIJO', limit: 50 } : undefined,
    { enabled: isTransportista && !proposals },
  );
  const { data: tripsAprobados } = useManifiestos(
    isTransportista ? { estado: EstadoManifiesto.APROBADO, modalidad: 'FIJO', limit: 50 } : undefined,
    { enabled: isTransportista && !proposals },
  );
  const { data: entregadosOperador } = useManifiestos(
    isOperador ? { estado: EstadoManifiesto.ENTREGADO, limit: 5 } : undefined,
    { enabled: isOperador && !proposals },
  );
  const { data: recibidosOperador } = useManifiestos(
    isOperador ? { estado: EstadoManifiesto.RECIBIDO, limit: 5 } : undefined,
    { enabled: isOperador && !proposals },
  );
  const { data: enTratamientoOperador } = useManifiestos(
    isOperador ? { estado: EstadoManifiesto.EN_TRATAMIENTO, limit: 5 } : undefined,
    { enabled: isOperador && !proposals },
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

  const usingSavedTrip = activeTrips.length === 0 && (!connectivity.isOnline || activeTripsLoading || activeTripsError) && Boolean(savedTripSnapshot && savedTripId && savedTripSnapshot.estado === EstadoManifiesto.EN_TRANSITO);
  const activeQueueTrips = useMemo(() => (
    activeTrips.length > 0
      ? activeTrips
      : usingSavedTrip && savedTripSnapshot && savedTripId
        ? [{
            id: savedTripId,
            numero: savedTripSnapshot.numero,
            operador: savedTripSnapshot.operador,
            generador: savedTripSnapshot.generador,
          }]
        : []
  ), [activeTrips, usingSavedTrip, savedTripId, savedTripSnapshot]);

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const displayModeStandalone = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;
    const navigatorStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    return displayModeStandalone || navigatorStandalone;
  }, []);

  const accesosRapidos = useMemo(() => {
    const available = workspaceNavigation(currentUser);
    if (isInspectionStaff(currentUser)) return available
      .filter(item => ['/inspecciones','/admin/solicitudes','/actores'].includes(item.path))
      .map(item => ({id:item.path, label:item.label, icon:item.icon, path:mp(item.path)}));
    if (['GENERADOR','TRANSPORTISTA','OPERADOR'].includes(currentUser?.rol || '')) return [
      ...(currentUser?.rol === 'GENERADOR' || proposals ? [{id:'nuevo',label:'Nuevo manifiesto',icon:FileText,path:mp('/manifiestos/nuevo')}] : []),
      ...(isTransportista ? [{id:'viajes',label:'Viajes',icon:Truck,path:mp('/transporte/perfil')}, ...(manifestFeatureVisible(import.meta.env.VITE_TRANSPORT_MULTI_GPS_ENABLED,currentUser) ? [{id:'gps',label:'GPS de mis viajes',icon:MapPin,path:mp('/transporte/cargas')}] : [])] : []),
    ];
    return available.filter(item => ['/manifiestos','/reportes'].includes(item.path))
      .map(item => ({id:item.path,label:item.label,icon:item.icon,path:mp(item.path)}));
  }, [currentUser, isTransportista, proposals, mp]);

  const est = dashData?.estadisticas;
  const count = (value: number | undefined) => dashLoading || dashError || value == null ? '—' : String(value);

  const stats = [
    { id: 1, label: 'Manifiestos', value: count(est?.total), icon: FileText, color: 'primary', href: '/manifiestos' },
    { id: 2, label: 'En tránsito', value: count(est?.enTransito), icon: MapPin, color: 'info', href: '/manifiestos?estado=EN_TRANSITO' },
    { id: 3, label: 'Borradores', value: count(est?.borradores), icon: Clock, color: 'warning', href: '/manifiestos?estado=BORRADOR' },
    { id: 4, label: 'Tratados', value: count(est?.tratados), icon: CheckCircle2, color: 'success', href: '/manifiestos?estado=TRATADO' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm text-neutral-600">{currentUser?.sector || currentUser?.nombre || 'SITREP'}</p>
          <h2 className="text-xl font-bold text-neutral-900">{isInspectionStaff(currentUser) ? 'Gestión y seguimiento' : isTransportista ? 'Viajes por resolver' : isOperador ? 'Cargas por recibir y tratar' : 'Manifiestos por resolver'}</h2>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Acciones principales">
          {accesosRapidos.map(item => <Button key={item.id} variant={item.id==='nuevo'?'primary':'outline'} leftIcon={<item.icon size={18}/>} onClick={()=>navigate(item.path)}>{item.label}</Button>)}
        </div>
      </header>

      {!connectivity.isOnline && <p role="status" className="rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-900">Sin conexión. Revisá abajo qué trabajo quedó guardado en este dispositivo.</p>}

      {manifestProposalsVisible(currentUser) && <TrainingTaskQueue/>}
      {isTransportista && !currentUser?.training && (!proposals || usingSavedTrip) && (
        <>{usingSavedTrip && <p role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">Se muestra sólo el último viaje guardado en este teléfono. Conectate para ver todos los viajes actuales.</p>}<TransportistaTripQueue
          activeTrips={activeQueueTrips}
          pendingTrips={manifestProposalsVisible(currentUser) ? [] : pendingTrips}
          activeTotal={tripsEnTransito?.total}
          pendingTotal={manifestProposalsVisible(currentUser) ? 0 : tripsAprobados?.total}
          simultaneousGpsAvailable={manifestFeatureVisible(import.meta.env.VITE_TRANSPORT_MULTI_GPS_ENABLED,currentUser)}
          onOpenTrip={(tripId) => navigate(mp(`/transporte/viaje/${tripId}`))}
        /></>
      )}

      {isOperador && !manifestProposalsVisible(currentUser) && (
        <OperatorActionQueue
          manifiestos={operatorQueue}
          onOpenManifiesto={(manifiestoId) => navigate(mp(`/manifiestos/${manifiestoId}`))}
        />
      )}

      {dashError && <p role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800">No se pudieron actualizar las cifras. Abrí el listado para consultar los datos actuales.</p>}

      <section aria-label="Resumen de manifiestos" className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Resumen de manifiestos</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(stat => <button key={stat.id} type="button" onClick={()=>navigate(mp(stat.href))}
            className="flex min-h-14 items-center gap-3 rounded-lg px-2 text-left hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
            <stat.icon size={19} className="shrink-0 text-primary-800" aria-hidden="true"/>
            <span><span className="block text-lg font-bold tabular-nums text-neutral-900">{stat.value}</span><span className="block text-xs text-neutral-600">{stat.label}</span></span>
          </button>)}
        </div>
      </section>

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
