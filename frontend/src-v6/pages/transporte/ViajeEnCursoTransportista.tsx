import { ManifestProposalApprovals } from '../manifiestos/components/ManifestProposalApprovals';
import { TransportLegs } from '../manifiestos/components/TransportLegs';
import { useTransportLegs } from '../../services/transport-handoff.service';
import { manifestFeatureVisible, manifestProposalsVisible } from '../../utils/manifestFeatures';
/**
 * SITREP v6 - Viaje en Curso (Transportista)
 * Conectado a API real con GPS tracking
 *
 * FIXES applied:
 * 1. GPS permission check + status state machine + full metadata
 * 2. (Dashboard banner — separate file)
 * 3. Pause persistence via backend incident events + localStorage
 * 4. Incident fix — description fallback + GPS coords
 * 5. Retiro/Entrega send GPS coordinates
 * 6. Timer persistence from m.fechaRetiro server timestamp
 * 7. Full GPS data capture (speed, heading) sent to backend
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import {
  ArrowLeft, Truck, MapPin, Clock, Package,
  CheckCircle2, AlertTriangle, Radio, Map as MapIcon, List,
  Loader2, Crosshair, WifiOff
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { GpsStatusPanel } from '../../components/mobile/GpsStatusPanel';
import { hasParkedGpsLease } from '../../services/gpsCoordination';
import { PendingGpsReceipts } from '../../components/mobile/PendingGpsReceipts';
import { PendingIncidentNotice } from '../../components/manifiestos/PendingIncidentNotice';
import { TripActionBar } from '../../components/mobile/TripActionBar';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ACTOR_ICONS } from '../../utils/map-icons';
import {
  useManifiesto,
  useConfirmarRetiro,
  useConfirmarEntrega,
  useRegistrarIncidente,
} from '../../hooks/useManifiestos';
import { EstadoManifiesto, type EventoManifiesto, type Manifiesto, type ManifiestoResiduo } from '../../types/models';
import { formatDateTime } from '../../utils/formatters';
import { declaredQuantities, formatDeclaredQuantity } from '../../utils/declaredQuantities';
import { offlineSafeMutation } from '../../utils/offline-mutation';
import { useGPSTracking } from '../../hooks/useGPSTracking';
import { GpsPendingError, gpsContextScope, gpsStorageErrorMessage } from '../../services/gpsQueue';
import { getSyncQueue } from '../../services/indexeddb';
import { subscribeDeliveryConfirmed, subscribeOfflineQueueChanged } from '../../services/offlineSyncEvents';
import { queuedDeliveryContext } from '../../services/syncQueuePolicy';
import { clearTripSnapshot, readTripSnapshot, readInitialTripStatus, tripAccessDenied, tripHandoffState, tripStatusKey, writeTripSnapshot } from '../../services/tripSnapshot';
import { useAuth } from '../../contexts/AuthContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useQueryOwner } from '../../hooks/useQueryOwner';
import { supportRequestContext } from '../../utils/supportSession';
import { getApiErrorMessage } from '../../utils/api-error';
import { gpsEventCoordinates, gpsFixFreshness } from '../../utils/gpsFreshness';
import type { IncidentResult } from '../../services/incidentCommand';

// Recenter map when position changes (respects user pan/zoom)
function RecenterMap({ position, onUserInteract, followUser }: {
  position: [number, number] | null;
  onUserInteract: () => void;
  followUser: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    map.on('dragstart', onUserInteract);
    map.on('zoomstart', onUserInteract);
    return () => { map.off('dragstart', onUserInteract); map.off('zoomstart', onUserInteract); };
  }, [map, onUserInteract]);
  useEffect(() => {
    if (position && followUser) map.setView(position, map.getZoom());
  }, [position, map, followUser]);
  return null;
}

type DeliveryQueueState = 'checking' | 'pending' | 'other' | 'sent' | 'none' | 'error';
type SavedTrip = Partial<Manifiesto> & { handoffActive?: boolean };
function DeliveryQueueNotice({ status, onRetry }: { status: DeliveryQueueState; onRetry: () => void }) {
  if (status === 'none') return null;
  return <div role="status" className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900">
    {status === 'checking' ? 'Comprobando entregas pendientes…' : status === 'pending' ? 'Entrega guardada. Se intentará enviar o comprobar al sincronizar, después de las ubicaciones pendientes.' : status === 'other' ? 'Hay una entrega guardada en otra cuenta o actividad de este dispositivo. Volvé al contexto original para revisarla.' : status === 'sent' ? 'Entrega confirmada. Actualizando el manifiesto…' : 'No se pudo comprobar si hay una entrega guardada en este dispositivo.'}
    {(status === 'error' || status === 'pending' || status === 'other') && <button type="button" className="ml-2 min-h-11 font-semibold underline" onClick={onRetry}>{status === 'error' ? 'Reintentar' : 'Actualizar estado'}</button>}
  </div>;
}

const ViajeEnCursoTransportistaContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const { currentUser } = useAuth();
  const { isOnline } = useConnectivity({ enablePing: false, debounceMs: 0 });
  const syncOwner = useQueryOwner();
  const requestContext = useMemo(() => supportRequestContext(), [currentUser, syncOwner]);
  const gpsOwner = gpsContextScope(syncOwner, requestContext);
  const queryClient = useQueryClient();
  const [snapshotError, setSnapshotError] = useState(false);
  const [snapshotRevision, setSnapshotRevision] = useState(0);
  const [deliveryQueue, setDeliveryQueue] = useState<DeliveryQueueState>('checking');
  const [queueCheck, setQueueCheck] = useState(0);
  const queueCheckVersion = useRef(0);
  const queueContext = useRef('');
  const deliveryConfirmed = useRef(false);
  const deliveryInitiatedHere = useRef(false);
  const gpsWasActive = useRef(false);
  const parkedRecoveryKey = useRef<string | null>(null);
  // Map recenter control
  const [followUser, setFollowUser] = useState(true);
  const handleMapInteract = useCallback(() => setFollowUser(false), []);

  // Real data from API
  const { data: apiData, isLoading, isFetching, isFetchedAfterMount, isError, error: apiError, refetch: reloadTrip } = useManifiesto(id || '');

  // Restore cached trip data while API is loading (stale-while-revalidate).
  // Keep the same nested shape as the API so the recovery view actually renders.
  const cachedSnapshot = useMemo<SavedTrip | null>(() => {
    if (!id) return null;
    return readTripSnapshot<SavedTrip>(syncOwner, id);
  }, [id, syncOwner, snapshotRevision, isError, isFetching]);
  const denied = tripAccessDenied(apiError);
  const waitingForValidation = isOnline && (!isFetchedAfterMount || (isFetching && !!apiData?.offline));
  const safeSnapshot = !denied && !waitingForValidation && (!isOnline || isError) ? cachedSnapshot : null;
  const visibleData = denied || waitingForValidation || (isOnline && apiData?.offline) ? undefined : apiData;
  const showingSavedCopy = !!safeSnapshot && (!isOnline || !visibleData || isError);
  const m: Partial<Manifiesto> = (showingSavedCopy ? safeSnapshot : visibleData) || {};
  const assignment = m.asignacionTransporte?.version === 1 && m.asignacionTransporte.transportistaId === m.transportistaId
    ? m.asignacionTransporte : null;
  const handoffEnabled = manifestFeatureVisible(import.meta.env.VITE_MANIFEST_TRANSPORT_HANDOFF_ENABLED, currentUser);
  const legs = useTransportLegs(m.modalidad === 'IN_SITU' ? '' : id || '', syncOwner);
  const verifiedHandoff = legs.isFetchedAfterMount && legs.isSuccess && !legs.isError
    ? legs.data.tramos.some(leg => !leg.fin && leg.tipo !== 'ORIGINAL') : null;
  const handoffState = tripHandoffState(handoffEnabled, showingSavedCopy, safeSnapshot?.handoffActive, verifiedHandoff);
  const hasHandoff = handoffState === true;
  const handoffUnknown = handoffState === null;

  // Persist active trip snapshot to localStorage for recovery after app restart
  useEffect(() => {
    if (isOnline && id && syncOwner && visibleData?.id === id && !visibleData.offline && !isError && m.estado === EstadoManifiesto.EN_TRANSITO) {
      const snapshot = {
        id,
        numero: m.numero,
        estado: m.estado,
        modalidad: m.modalidad,
        generador: m.generador ? { razonSocial: m.generador.razonSocial, domicilio: m.generador.domicilio } : undefined,
        operador: m.operador ? { razonSocial: m.operador.razonSocial, domicilio: m.operador.domicilio } : undefined,
        transportista: m.transportista ? { razonSocial: m.transportista.razonSocial } : undefined,
        transportistaId: m.transportistaId,
        asignacionTransporte: m.asignacionTransporte,
        residuos: m.residuos,
        eventos: m.eventos,
        fechaRetiro: m.fechaRetiro,
        handoffActive: handoffEnabled ? verifiedHandoff ?? undefined : false,
        savedAt: new Date().toISOString(),
      };
      try {
        writeTripSnapshot(syncOwner, id, snapshot);
        setSnapshotError(false);
        // The first render reads before this effect writes. Re-read the new
        // copy so a loss of connectivity in the same open page can use it.
        setSnapshotRevision(value => value + 1);
      } catch {
        setSnapshotError(true);
      }
    }
  }, [id, syncOwner, isOnline, isError, handoffEnabled, verifiedHandoff, visibleData, m.id, m.numero, m.estado, m.modalidad, m.generador, m.operador, m.transportista, m.transportistaId, m.asignacionTransporte, m.residuos, m.eventos, m.fechaRetiro]);

  // Mutations
  const confirmarRetiro = useConfirmarRetiro();
  const confirmarEntrega = useConfirmarEntrega();
  const registrarIncidente = useRegistrarIncidente(id);

  // UI state
  const [viajeStatus, setViajeStatus] = useState<'ACTIVO' | 'PAUSADO'>(() => readInitialTripStatus(syncOwner, id || ''));
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');
  const deliveryErrorRef = useRef<HTMLParagraphElement>(null);
  const [isFinishingTrip, setIsFinishingTrip] = useState(false);
  const deliveryInFlightRef = useRef(false);
  const gpsRetryInFlightRef = useRef(false);
  const [retryingGps, setRetryingGps] = useState(false);
  const [retryingGpsSend, setRetryingGpsSend] = useState(false);
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [incidenteTipo, setIncidenteTipo] = useState('');
  const [incidenteDescripcion, setIncidenteDescripcion] = useState('');
  const [incidenteError, setIncidenteError] = useState('');
  const incidenteErrorRef = useRef<HTMLParagraphElement>(null);
  const incidenteInFlightRef = useRef(false);
  const [vistaMapa, setVistaMapa] = useState(true);
  useEffect(() => { if (deliveryError) deliveryErrorRef.current?.focus(); }, [deliveryError]);
  useEffect(() => { if (showIncidenteModal && incidenteError) incidenteErrorRef.current?.focus(); }, [showIncidenteModal, incidenteError]);

  useEffect(() => {
    if (!id || currentUser?.id == null) return;
    const owner = currentUser.id;
    const version = ++queueCheckVersion.current;
    let active = true;
    const context = JSON.stringify([String(owner), syncOwner, id]);
    if (queueContext.current !== context) { queueContext.current = context; setDeliveryQueue('checking'); }
    void getSyncQueue().then(actions => {
      if (active && queueCheckVersion.current === version) setDeliveryQueue(queuedDeliveryContext(actions, owner, syncOwner, id));
    }).catch(() => { if (active && queueCheckVersion.current === version) setDeliveryQueue('error'); });
    return () => { active = false; };
  }, [currentUser?.id, syncOwner, id, queueCheck]);

  useEffect(() => { deliveryConfirmed.current = false; deliveryInitiatedHere.current = false; gpsWasActive.current = false; }, [id, syncOwner]);

  useEffect(() => {
    const onDelivery = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; owner: string }>).detail;
      if (detail?.id !== id) return;
      deliveryConfirmed.current = true;
      ++queueCheckVersion.current;
      setDeliveryQueue('sent');
      void queryClient.invalidateQueries({ queryKey:['manifiestos', 'detail', id] });
    };
    return subscribeDeliveryConfirmed(onDelivery);
  }, [id, queryClient]);

  useEffect(() => {
    const onQueueChanged = () => { if (!deliveryConfirmed.current) setQueueCheck(value => value + 1); };
    return subscribeOfflineQueueChanged(onQueueChanged);
  }, []);

  // GPS tracking via custom hook
  // A delivery queued in another tab must not silently stop an active GPS:
  // that screen owns its live observations until the user closes it safely.
  const recoveryKey = JSON.stringify([String(currentUser?.id ?? ''), gpsOwner, id]);
  if (id && currentUser?.id != null && gpsOwner && hasParkedGpsLease(id, gpsOwner)) parkedRecoveryKey.current = recoveryKey;
  const trackingDuringPending = (deliveryQueue === 'pending' || deliveryQueue === 'other' || deliveryQueue === 'error') && viajeStatus === 'ACTIVO'
    && (gpsWasActive.current || parkedRecoveryKey.current === recoveryKey) && !deliveryInitiatedHere.current;
  const gps = useGPSTracking({
    manifiestoId: id,
    ownerId: currentUser?.id,
    leaseOwner: gpsOwner || undefined,
    sessionContext: requestContext,
    estado: !gpsOwner||hasHandoff||handoffUnknown||m.modalidad==='IN_SITU'||(deliveryQueue!=='none'&&!trackingDuringPending)?undefined:m.estado,
    viajeStatus,
  });
  useEffect(() => { if (deliveryQueue === 'none' && gps.status === 'active') gpsWasActive.current = true; }, [deliveryQueue, gps.status]);
  useEffect(() => { if (deliveryQueue === 'none' || deliveryQueue === 'sent') parkedRecoveryKey.current = null; }, [deliveryQueue]);

  const currentPosition = gps.position;
  const trackPoints = gps.trackPoints;
  const gpsStatus = gps.status;
  const gpsDetails = gps.details;
  const gpsSendStatus = gps.sendStatus;
  const cleanupGps = gps.cleanupGps;
  const gpsForEvent = {
    position: currentPosition,
    status: gpsStatus,
    lastUpdate: gpsDetails.lastUpdate,
    tripActive: m.estado === EstadoManifiesto.EN_TRANSITO && viajeStatus === 'ACTIVO' && !hasHandoff && !handoffUnknown,
  };
  // Delivery can wait for pending uploads: check the newest fix when the
  // request is actually dispatched, not the fix captured by the first click.
  const gpsForEventRef = useRef(gpsForEvent);
  gpsForEventRef.current = gpsForEvent;
  const eventLocation = gpsEventCoordinates(gpsForEvent);
  const fixFreshness = gpsFixFreshness(gpsDetails.lastUpdate);
  const displayGpsStatus = gpsStatus === 'active' && fixFreshness !== 'fresh' ? fixFreshness : gpsStatus;

  const [elapsedTime, setElapsedTime] = useState(0);

  const isActionPending = isFinishingTrip || confirmarRetiro.isPending || confirmarEntrega.isPending || registrarIncidente.isPending;

  // Default center (Mendoza, Argentina)
  const defaultCenter: [number, number] = [-32.9287, -68.8535];

  // Elapsed time is measured from the immutable pickup time, including stops.
  // Recompute from the clock so a paused/backgrounded tab cannot lose minutes.
  useEffect(() => {
    const start = m.fechaRetiro ? new Date(m.fechaRetiro).getTime() : NaN;
    if (m.estado !== EstadoManifiesto.EN_TRANSITO || !Number.isFinite(start)) {
      setElapsedTime(0);
      return;
    }
    const updateElapsed = () => setElapsedTime(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [m.estado, m.fechaRetiro]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const min = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${min}:${s}`;
  };

  const handleRetryGps = async () => {
    if (gpsRetryInFlightRef.current || deliveryInFlightRef.current || isActionPending || hasHandoff || handoffUnknown || viajeStatus !== 'ACTIVO') return;
    gpsRetryInFlightRef.current = true;
    setRetryingGps(true);
    try { await gps.retryGps(); }
    catch { toast.error('No se pudo reintentar el GPS', 'Revisá el permiso de ubicación y la conexión.'); }
    finally { gpsRetryInFlightRef.current = false; setRetryingGps(false); }
  };

  const handleRetryGpsSend = async () => {
    if (gpsRetryInFlightRef.current || deliveryInFlightRef.current || isActionPending || hasHandoff || handoffUnknown
      || viajeStatus !== 'ACTIVO' || !gps.canRetryPending) return;
    gpsRetryInFlightRef.current = true;
    setRetryingGpsSend(true);
    try { await gps.retryPending(); }
    catch { toast.error('No se pudo comprobar el envío GPS', 'Revisá la conexión y volvé a intentar.'); }
    finally { gpsRetryInFlightRef.current = false; setRetryingGpsSend(false); }
  };

  useEffect(() => {
    if (!gps.storageError && deliveryError.startsWith('Ubicaciones sin guardar.')) setDeliveryError('');
  }, [gps.storageError, deliveryError]);

  // Confirmar Retiro with GPS coordinates + offline queue
  const handleConfirmarRetiro = async () => {
    if (!currentUser || !syncOwner) return toast.error('Sesión no disponible', 'Volvé a ingresar antes de continuar.');
    try {
      const location = gpsEventCoordinates(gpsForEventRef.current);
      const result = await offlineSafeMutation(
        () => confirmarRetiro.mutateAsync({
          id: id!,
          ...location,
          observaciones: 'Retiro confirmado',
        }),
        { type: 'POST', endpoint: `/manifiestos/${id}/confirmar-retiro`, data: { ...location, observaciones: 'Retiro confirmado' }, userId: currentUser.id, contextOwner: syncOwner }
      );
      if (result === 'QUEUED') {
        toast.info('Sin conexión — El retiro se confirmará al reconectar');
        return;
      }
      toast.success('Retiro confirmado — viaje iniciado');
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo confirmar el retiro');
    }
  };

  // Confirmar Entrega with GPS coordinates + offline queue
  const handleConfirmarEntrega = async () => {
    if (!currentUser || !syncOwner) { setDeliveryError('Sesión no disponible. Volvé a iniciar sesión.'); return; }
    if (deliveryInFlightRef.current) return;
    deliveryInFlightRef.current = true;
    deliveryInitiatedHere.current = true;
    setDeliveryError('');
    setIsFinishingTrip(true);
    try {
      await gps.stopAndDrain();
      const offline = !navigator.onLine;
      if (gps.hasStorageError()) {
        deliveryInitiatedHere.current = false;
        gps.resumeGps();
        setDeliveryError('Ubicaciones sin guardar. Mantené esta pantalla abierta y recuperá la conexión o el almacenamiento antes de confirmar.');
        return;
      }
      if (!offline && !(await gps.flushPending())) {
        if (gps.deliveryWasConfirmed()) setDeliveryError('La entrega ya fue confirmada. Actualizá el manifiesto para ver su estado.');
        else {
          deliveryInitiatedHere.current = false;
          gps.resumeGps();
          setDeliveryError('Ubicaciones pendientes. ' + (gps.lastSendError() || 'No se pudo confirmar el envío de las ubicaciones. Revisá la conexión y volvé a intentar.'));
        }
        return;
      }
      const delivery = { ...gpsEventCoordinates(gpsForEventRef.current), observaciones: 'Entrega confirmada' };
      const result = await confirmarEntrega.mutateAsync({ id: id!, ...delivery });
      if (result.status === 'pending') {
        ++queueCheckVersion.current;
        if (deliveryConfirmed.current) {
          setDeliveryQueue('sent');
          toast.info('Entrega confirmada', 'Actualizando el manifiesto y la copia local.');
        } else {
          setDeliveryQueue('pending');
          toast.info('Entrega pendiente', result.message);
        }
        cleanupGps();
        setShowFinalizarModal(false);
        return;
      }
      cleanupGps();
      try { if (id) clearTripSnapshot(syncOwner, id); toast.success('Entrega confirmada exitosamente'); }
      catch { toast.info('Entrega confirmada', 'No se pudo actualizar la copia local. Consultá el manifiesto al reconectar.'); }
      setShowFinalizarModal(false);
    } catch (err: any) {
      deliveryInitiatedHere.current = false;
      gps.resumeGps();
      setDeliveryError(getApiErrorMessage(err, 'No se pudo confirmar la entrega. Revisá la conexión y volvé a intentar.'));
    } finally {
      deliveryInFlightRef.current = false;
      setIsFinishingTrip(false);
    }
  };

  const prepareHandoff = async () => {
    await gps.stopAndDrain();
    if (gps.hasStorageError()) throw new GpsPendingError(gpsStorageErrorMessage(gps.storageIssue));
    if (!(await gps.flushPending())) throw new GpsPendingError(gps.deliveryWasConfirmed() ? 'La entrega ya fue confirmada. Actualizá el manifiesto para ver su estado.' : gps.lastSendError() || undefined);
  };

  const applyIncidentResult = (result: IncidentResult) => {
    if (result.body.tipo === 'PAUSA' || result.body.tipo === 'REANUDACION') {
      const status = result.body.tipo === 'PAUSA' ? 'PAUSADO' : 'ACTIVO';
      setViajeStatus(status);
      try { if (id && syncOwner) localStorage.setItem(tripStatusKey(syncOwner, id), status); }
      catch { toast.info('Acción confirmada', 'No se pudo actualizar el estado en este dispositivo. Revisá el viaje al reabrir.'); }
    } else if (result.cleaned) {
      setShowIncidenteModal(false); setIncidenteTipo(''); setIncidenteDescripcion(''); setIncidenteError('');
    }
  };
  const incidentNotice = {
    pending: registrarIncidente.pendingIncident, storageError: registrarIncidente.incidentStorageError,
    checking: registrarIncidente.checkingIncident, busy: registrarIncidente.isPending,
    onRetry: () => registrarIncidente.retryIncident(), onRefresh: registrarIncidente.refreshIncident,
    onConfirmed: applyIncidentResult,
  };
  const incidentUnavailable = incidentNotice.checking || !!incidentNotice.pending || !!incidentNotice.storageError;

  // Incident saving with description fallback + GPS coords
  const handleRegistrarIncidente = async () => {
    if (incidenteInFlightRef.current) return;
    if (!incidenteTipo) {
      setIncidenteError('Seleccioná un tipo de incidente.');
      return;
    }
    incidenteInFlightRef.current = true;
    setIncidenteError('');
    const tipoLabels: Record<string, string> = {
      accidente: 'Accidente vehicular',
      derrame: 'Derrame de residuos',
      robo: 'Robo o asalto',
      desvio: 'Desvío de ruta',
      averia: 'Avería mecánica',
      otro: 'Otro incidente',
    };
    const descripcionFinal = incidenteDescripcion.trim() || tipoLabels[incidenteTipo] || incidenteTipo;
    try {
      const result = await registrarIncidente.mutateAsync({
        id: id!,
        tipo: incidenteTipo,
        descripcion: descripcionFinal,
        ...gpsEventCoordinates(gpsForEventRef.current),
      });
      applyIncidentResult(result);
      if (result.cleaned) toast.success('Incidente registrado');
      else toast.info('Incidente registrado', 'No pudimos actualizar la copia local. Conservá este dispositivo y comprobá el envío.');
    } catch (err: any) {
      const reason = getApiErrorMessage(err, 'No se pudo confirmar el registro.').replace(/[.!?]+$/, '');
      setIncidenteError(reason + '.');
    } finally {
      incidenteInFlightRef.current = false;
    }
  };

  // Pause/resume persisted via backend incident events
  const handlePausar = async () => {
    if (incidenteInFlightRef.current) return;
    incidenteInFlightRef.current = true;
    const newStatus = viajeStatus === 'ACTIVO' ? 'PAUSADO' : 'ACTIVO';
    try {
      const result = await registrarIncidente.mutateAsync({
        id: id!,
        tipo: newStatus === 'PAUSADO' ? 'PAUSA' : 'REANUDACION',
        descripcion: newStatus === 'PAUSADO' ? 'Viaje pausado por el transportista' : 'Viaje reanudado',
        ...gpsEventCoordinates(gpsForEventRef.current),
      });
      applyIncidentResult(result);
      if (result.cleaned) toast.info(newStatus === 'PAUSADO' ? 'Viaje pausado' : 'Viaje reanudado');
      else toast.info('Acción registrada', 'No pudimos actualizar la copia local. Conservá este dispositivo y comprobá el envío.');
    } catch (error) {
      toast.error('No se pudo confirmar la acción', error instanceof Error ? error.message : 'Comprobá el envío antes de continuar.');
    } finally { incidenteInFlightRef.current = false; }
  };

  const mapCenter = currentPosition || defaultCenter;

  if ((isLoading || waitingForValidation) && !m.id) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if ((!visibleData || isError) && !showingSavedCopy) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4">
        <div className="flex items-center gap-3 mb-6">
          <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">{denied ? 'Viaje no disponible' : 'No pudimos cargar el viaje'}</h2>
        </div>
        <Card><CardContent className="space-y-3 py-8 text-center text-neutral-600">
          <p>{denied ? 'La sesión o actividad actual no tiene acceso a este viaje, o ya no está disponible.' : 'Revisá la conexión y volvé a intentarlo.'}</p>
          {!denied && <Button variant="outline" onClick={() => void reloadTrip()}>Reintentar</Button>}
        </CardContent></Card>
      </div>
    );
  }

  if (m.modalidad === 'IN_SITU') {
    return <div className="min-h-screen bg-neutral-50 p-4"><Card><CardContent className="space-y-4 p-5">
      <h2 className="text-lg font-bold">Tratamiento en origen · sin viaje</h2>
      <p>El transporte participa en la aprobación, pero no hay retiro ni GPS para este manifiesto.</p>
      <Button onClick={() => navigate(mp(`/manifiestos/${id}`))}>Abrir manifiesto</Button>
    </CardContent></Card></div>;
  }

  const cantidadesDeclaradas = declaredQuantities(m.residuos || [])
    .map(({ unidad, cantidad }) => `${formatDeclaredQuantity(cantidad)} ${unidad}`).join(' · ') || 'Sin cantidades informadas';
  const eventos: EventoManifiesto[] = Array.isArray(m.eventos) ? m.eventos : [];
  const hasProposal = eventos.some(e => e.tipo === 'PROPUESTA_PARTES_V1');
  const canConfirmPickup = m.aprobacionOperacion === 'LISTA';

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="flex min-h-14 items-center gap-3 px-4 py-2">
          <button aria-label="Volver" onClick={() => navigate(-1)} className="shrink-0 p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="break-words text-xs text-neutral-500 font-medium">{m.numero || id}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-bold text-neutral-900">
                {m.estado === EstadoManifiesto.APROBADO ? (canConfirmPickup ? 'Confirmar retiro' : 'Revisar aprobaciones') :
                 m.estado === EstadoManifiesto.EN_TRANSITO ? 'En tránsito' :
                 m.estado === EstadoManifiesto.ENTREGADO ? 'Entrega confirmada' : 'Estado del viaje'}
              </h2>
              {m.estado === EstadoManifiesto.EN_TRANSITO && (
                <div className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full ${deliveryQueue === 'none' && viajeStatus === 'ACTIVO' && !hasHandoff && !handoffUnknown ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-warning-50 text-warning-700 border border-warning-200'}`}>
                  <Radio size={14} className={deliveryQueue === 'none' && viajeStatus === 'ACTIVO' && !hasHandoff && !handoffUnknown ? 'animate-pulse' : ''} />
                  <span className="text-xs font-semibold">{trackingDuringPending ? (deliveryQueue === 'error' ? 'Entrega sin verificar · seguimiento abierto' : 'Entrega pendiente · seguimiento abierto') : deliveryQueue === 'pending' || deliveryQueue === 'other' ? 'Entrega pendiente' : deliveryQueue === 'sent' ? 'Actualizando entrega' : deliveryQueue === 'error' ? 'Verificar entrega' : deliveryQueue === 'checking' ? 'Comprobando entrega' : handoffUnknown ? 'Comprobando relevo' : hasHandoff ? 'Transporte relevado' : viajeStatus === 'ACTIVO' ? 'Viaje activo' : 'Viaje pausado'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {!showIncidenteModal && <PendingIncidentNotice {...incidentNotice} />}
        {showingSavedCopy && <div role="status" className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
          <WifiOff size={16} className="mt-0.5 shrink-0" />
          <p><strong>Último estado guardado.</strong> Una entrega confirmada sin conexión queda en este dispositivo. SITREP verificará el estado y los permisos al reconectar. La pausa y los incidentes requieren conexión.</p>
        </div>}
        {handoffUnknown && m.estado === EstadoManifiesto.EN_TRANSITO && <div role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">Comprobando si hay un relevo. Si no se recupera, revisá la conexión antes de continuar con el GPS o la entrega.
          {isOnline && legs.isError && <button type="button" className="ml-2 min-h-11 font-semibold underline" onClick={() => void legs.refetch()}>Reintentar</button>}
        </div>}
        {snapshotError && <p role="alert" className="rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-900">No se pudo guardar una copia del viaje en el dispositivo. Si perdés conexión, sus datos podrían no estar disponibles; revisá el almacenamiento.</p>}
        {m.estado === EstadoManifiesto.APROBADO && !hasProposal && <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
          <p className="font-semibold">Este manifiesto necesita una nueva propuesta</p>
          <p className="mt-1">{manifestProposalsVisible(currentUser) ? 'Creá una nueva propuesta con las tres partes.' : 'Contactá a Ambiente para habilitar una nueva propuesta con las tres partes.'} El registro anterior se conserva.</p>
          <Link to={mp(`/manifiestos/${id}`)} className="mt-2 inline-flex min-h-11 items-center font-semibold underline">Ver manifiesto</Link>
        </div>}
        {m.estado === EstadoManifiesto.APROBADO && hasProposal && ['INCONSISTENTE','RECHAZADA'].includes(m.aprobacionOperacion || '') && <p role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">No se pueden comprobar las aprobaciones. Contactá a Ambiente para revisar este manifiesto; el historial se conserva y no se puede iniciar.</p>}
        {m.estado === EstadoManifiesto.APROBADO && hasProposal && !m.aprobacionOperacion && <p role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">No se pudo verificar si están cumplidas las aprobaciones. Actualizá el manifiesto antes de continuar. <button type="button" className="min-h-11 font-semibold underline" onClick={() => void reloadTrip()}>Actualizar manifiesto</button></p>}
        {m.estado === EstadoManifiesto.APROBADO && hasProposal && !manifestProposalsVisible(currentUser) && m.aprobacionOperacion && !['LISTA','INCONSISTENTE','RECHAZADA'].includes(m.aprobacionOperacion) && <p role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">La operación todavía no está lista para iniciarse. Contactá a Ambiente para revisar las aprobaciones y la coordinación.</p>}
        {id && currentUser?.id != null && ['TRANSPORTISTA', 'ADMIN'].includes(currentUser.rol) && (m.estado !== EstadoManifiesto.EN_TRANSITO || hasHandoff) && <PendingGpsReceipts key={`${gpsOwner}:${id}`} ownerId={currentUser.id} contextOwner={gpsOwner} manifestId={id} />}
        {trackingDuringPending && <p role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">El seguimiento sigue abierto en esta pantalla para conservar las ubicaciones. Sincronizalas y cerrá esta pantalla antes de continuar con la entrega.</p>}
        {m.estado === EstadoManifiesto.EN_TRANSITO && !hasHandoff && !handoffUnknown && (deliveryQueue === 'none' || trackingDuringPending) && <GpsStatusPanel
          status={displayGpsStatus}
          sendStatus={gpsSendStatus}
          sendError={gps.sendError}
          position={currentPosition}
          details={gpsDetails}
          pendingCount={gps.pendingCount}
          lastSyncAt={gps.lastSyncAt}
          onRetry={viajeStatus === 'ACTIVO' ? handleRetryGps : undefined}
          onRetrySend={gps.canRetryPending ? handleRetryGpsSend : undefined}
          retrying={retryingGps}
          retryingSend={retryingGpsSend}
          retryDisabled={isActionPending}
          paused={viajeStatus === 'PAUSADO'}
          storageError={gps.storageError}
          storageIssue={gps.storageIssue}
        />}
        <Link to={mp('/transporte/perfil')} className="flex w-fit min-h-11 items-center gap-2 text-sm font-semibold text-primary-800 underline"><Truck size={17} aria-hidden="true" />Ver todos mis viajes</Link>
        {m.estado !== EstadoManifiesto.APROBADO && deliveryQueue === 'none' && !showingSavedCopy && <TransportLegs id={id!} beforeHandoff={prepareHandoff} onHandoffError={gps.resumeGps}/>}
        {hasHandoff&&<p role="status" className="rounded-xl bg-primary-50 p-3 text-sm text-primary-900">El GPS continúa desde el enlace del reemplazo. Como transportista de origen, seguís registrando la entrega del manifiesto.</p>}
        {manifestFeatureVisible(import.meta.env.VITE_MANIFEST_ADDENDA_ENABLED, currentUser) && <Link to={mp(`/manifiestos/${id}/adendas`)} className="flex w-fit min-h-11 items-center text-primary-700 underline">Adendas y revisión posterior</Link>}
        {assignment && <dl aria-label="Transporte asignado" className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-xs text-neutral-600">Vehículo</dt><dd className="break-words text-sm font-semibold text-neutral-900">{assignment.vehiculo?.patente || 'Sin asignación registrada'}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-neutral-600">Chofer</dt><dd className="break-words text-sm font-semibold text-neutral-900">{assignment.chofer ? `${assignment.chofer.nombre} ${assignment.chofer.apellido}` : 'Sin asignación registrada'}</dd></div>
        </dl>}
        {hasProposal && m.estado === EstadoManifiesto.APROBADO && !['INCONSISTENTE','RECHAZADA'].includes(m.aprobacionOperacion || '') && <ManifestProposalApprovals id={id!} estado={m.estado} onSign={()=>{}}/>}
        {/* APROBADO state: Show confirm pickup */}
        {m.estado === EstadoManifiesto.APROBADO && canConfirmPickup && (
          <>
            <Card variant="elevated" className="border-2 border-primary-200">
              <CardContent className="p-5 text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Truck className="text-primary-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">Listo para retirar</h3>
                <p className="text-neutral-600 mb-1">Generador: <span className="font-semibold">{m.generador?.razonSocial || '-'}</span></p>
                <p className="text-sm text-neutral-500">{m.generador?.domicilio || '-'}</p>
                <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
                  <p className="text-sm text-neutral-600">Residuos: <span className="font-semibold">{m.residuos?.length || 0} items</span> — {cantidadesDeclaradas}</p>
                </div>
              </CardContent>
            </Card>
            <TripActionBar
              estado={m.estado}
              viajeStatus={viajeStatus}
              delegated={hasHandoff}
              isPending={isActionPending}
              connectionLimited={showingSavedCopy}
              incidentUnavailable={incidentUnavailable}
              hasPendingSync={gps.hasPending}
              onConfirmPickup={handleConfirmarRetiro}
              onTogglePause={handlePausar}
              onReportIncident={() => setShowIncidenteModal(true)}
              onConfirmDelivery={() => { setDeliveryError(''); setShowFinalizarModal(true); }}
            />
          </>
        )}

        {/* EN_TRANSITO state: Active trip */}
        {m.estado === EstadoManifiesto.EN_TRANSITO && (
          <>
            {/* Timer */}
            <Card variant="elevated" className="bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="text-white/80" size={20} />
                  <div className="text-center"><span className="block text-xs font-semibold uppercase tracking-wide text-white/90">Tiempo transcurrido desde el retiro</span><span className="text-4xl font-bold tabular-nums text-white drop-shadow-sm">{formatTimer(elapsedTime)}</span></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-white/30">
                  <div className="text-center">
                    <p className="text-xs text-white/90 mb-1 font-medium tracking-wide">DESTINO</p>
                    <p className="text-sm font-bold text-white drop-shadow-sm">{m.operador?.razonSocial || '-'}</p>
                  </div>
                  <div className="text-center border-l border-white/30">
                    <p className="text-xs text-white/90 mb-1 font-medium tracking-wide">CANTIDADES DECLARADAS</p>
                    <p className="text-lg font-bold text-white drop-shadow-sm">{cantidadesDeclaradas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Manifiesto badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-neutral-200 shadow-sm">
                <span className="text-xs text-neutral-500">Manifiesto</span>
                <span className="text-sm font-mono font-semibold text-neutral-900">#{m.numero || id}</span>
              </div>
            </div>

            {deliveryQueue === 'none' ? <TripActionBar
              estado={m.estado}
              viajeStatus={viajeStatus}
              delegated={hasHandoff}
              isPending={isActionPending}
              disabled={m.estado === EstadoManifiesto.EN_TRANSITO && handoffUnknown}
              connectionLimited={showingSavedCopy}
              incidentUnavailable={incidentUnavailable}
              hasPendingSync={gps.hasPending}
              onConfirmPickup={handleConfirmarRetiro}
              onTogglePause={handlePausar}
              onReportIncident={() => setShowIncidenteModal(true)}
              onConfirmDelivery={() => { setDeliveryError(''); setShowFinalizarModal(true); }}
            /> : <DeliveryQueueNotice status={deliveryQueue} onRetry={() => { setQueueCheck(value => value + 1); void reloadTrip(); }} />}

            {/* Toggle map/events */}
            {!hasHandoff&&<div className="flex bg-neutral-100 rounded-xl p-1">
              <button onClick={() => setVistaMapa(false)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${!vistaMapa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}>
                <List size={16} /> Eventos
              </button>
              <button onClick={() => setVistaMapa(true)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${vistaMapa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}>
                <MapIcon size={16} /> Mapa
              </button>
            </div>}

            {/* Map or events */}
            {vistaMapa&&!hasHandoff ? (
              <div className="relative z-0">
                <Card className="overflow-hidden p-0 border-2 border-neutral-200">
                  <div className="h-64 relative isolate">
                    <MapContainer
                      center={mapCenter}
                      zoom={13}
                      style={{ height: '100%', width: '100%', zIndex: 0 }}
                      className="z-0"
                    >
                      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {trackPoints.length > 1 && <Polyline positions={trackPoints} color="#0D8A4F" weight={4} opacity={0.8} />}
                      {currentPosition && <Marker position={currentPosition} icon={ACTOR_ICONS.enTransito}><Popup>Última ubicación disponible del teléfono</Popup></Marker>}
                      <RecenterMap position={currentPosition} onUserInteract={handleMapInteract} followUser={followUser} />
                    </MapContainer>
                    {!followUser && currentPosition && (
                      <button
                        onClick={() => setFollowUser(true)}
                        className="absolute bottom-3 right-3 z-[400] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg text-xs font-medium text-primary-700 flex items-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <Crosshair size={14} />
                        Recentrar
                      </button>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                {eventos.length === 0 ? (
                  <Card className="p-4 text-center text-neutral-500">Sin eventos registrados</Card>
                ) : (
                  eventos.map((ev: any, i: number) => (
                    <Card key={ev.id || i} className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-neutral-900">{String(ev.tipo || '').replace(/_/g, ' ')}</p>
                          <p className="text-sm text-neutral-500">{ev.descripcion || ''}</p>
                        </div>
                        <span className="text-xs text-neutral-400">{formatDateTime(ev.createdAt)}</span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* ENTREGADO state: Trip completed */}
        {m.estado === EstadoManifiesto.ENTREGADO && (
          <Card variant="elevated" className="border-2 border-success-200">
            <CardContent className="p-5 text-center">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-success-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Entrega Completada</h3>
              <p className="text-neutral-600">Esperando confirmación de recepción del operador</p>
              <p className="text-sm text-neutral-500 mt-2">Operador: {m.operador?.razonSocial || '-'}</p>
            </CardContent>
          </Card>
        )}

        {/* Residuos info (always visible) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-neutral-500" />
              <span className="font-semibold text-neutral-900">Residuos</span>
            </div>
            <div className="space-y-2">
              {(m.residuos || []).map((r: ManifiestoResiduo) => (
                <div key={r.id} className="flex justify-between items-center p-2 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-700">{r.tipoResiduo?.nombre || r.descripcion || 'Residuo'}</span>
                  <span className="text-sm font-semibold text-neutral-900">{r.cantidad} {r.unidad}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Finalizar / Confirmar Entrega */}
      <Modal isOpen={showFinalizarModal} onClose={() => { setDeliveryError(''); setShowFinalizarModal(false); }}
        title="Confirmar Entrega?" size="sm" showCloseButton={false} closeOnOverlayClick={false} isBusy={isActionPending}>
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${gps.storageError ? 'bg-error-100' : 'bg-success-100'}`}>
            {gps.storageError ? <AlertTriangle className="text-error-600" size={32} aria-hidden="true" /> : <CheckCircle2 className="text-success-600" size={32} aria-hidden="true" />}
          </div>
          <p className="text-neutral-600 text-sm mb-4">{gps.storageError ? 'Destino: ' : 'Se confirmará la entrega en '}{m.operador?.razonSocial || 'destino'}</p>
          {gps.storageError ? <div role="alert" className="mb-4 rounded-lg border border-error-200 bg-error-50 p-3 text-left text-sm text-error-900">
            <p className="font-semibold">No se puede confirmar la entrega todavía.</p>
            <p>{gpsStorageErrorMessage(gps.storageIssue)}</p>
          </div> : eventLocation ? (
            <p className="text-xs text-neutral-400 mb-4">
              Se adjuntará la ubicación si sigue siendo reciente al confirmar.
            </p>
          ) : <p className="text-xs text-neutral-600 mb-4">No se adjuntará una ubicación: no hay una lectura reciente verificable. Podés continuar.</p>}
          {deliveryError && !gps.storageError && <p ref={deliveryErrorRef} role="alert" tabIndex={-1} className="mb-4 rounded-lg border border-error-200 bg-error-50 p-3 text-left text-sm text-error-900 focus:outline focus:outline-2 focus:outline-error-600">{deliveryError}</p>}
          <div className="space-y-3">
            {gps.storageError && (!gps.storageIssue || gps.storageIssue === 'storage') && <Button variant="outline" fullWidth onClick={handleRetryGps} disabled={isActionPending || retryingGps}>
              {retryingGps ? 'Reintentando guardado' : 'Reintentar guardado'}
            </Button>}
            <Button fullWidth onClick={handleConfirmarEntrega} disabled={isActionPending || gps.storageError}>
              {isActionPending ? 'Confirmando...' : 'Sí, Confirmar Entrega'}
            </Button>
            <Button variant="outline" fullWidth onClick={() => { setDeliveryError(''); setShowFinalizarModal(false); }} disabled={isActionPending}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Incidente */}
      <Modal isOpen={showIncidenteModal} onClose={() => { setShowIncidenteModal(false); setIncidenteError(''); }}
        title="Reportar Incidente" size="sm" showCloseButton={false} closeOnOverlayClick={false} isBusy={registrarIncidente.isPending}>
        <div className="mb-3"><PendingIncidentNotice {...incidentNotice} /></div>
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-error-600" size={32} aria-hidden="true" />
          </div>
          <p className="mt-2 text-sm text-neutral-600">Si hubo avería, registrala antes de coordinar otro vehículo o transportista. El incidente conserva el viaje y no cambia la asignación por sí solo.</p>
        </div>
        <div className="space-y-3 mb-4">
          {/* Incident type buttons instead of native select */}
          <fieldset disabled={registrarIncidente.isPending || incidentUnavailable}>
            <legend className="block text-sm font-medium text-neutral-700 mb-2">Tipo de incidente</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'accidente', label: 'Accidente vehicular' },
                { value: 'derrame', label: 'Derrame de residuos' },
                { value: 'robo', label: 'Robo o asalto' },
                { value: 'desvio', label: 'Desvío de ruta' },
                { value: 'averia', label: 'Avería mecánica' },
                { value: 'otro', label: 'Otro' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={incidenteTipo === opt.value}
                  onClick={() => { setIncidenteTipo(opt.value); setIncidenteError(''); }}
                  className={`min-h-11 px-3 py-2.5 rounded-lg text-xs font-medium border-2 transition-all ${
                    incidenteTipo === opt.value
                      ? 'border-error-500 bg-error-50 text-error-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="incidente-descripcion" className="block text-sm font-medium text-neutral-700 mb-1">Descripción (opcional)</label>
            <textarea
              id="incidente-descripcion"
              disabled={registrarIncidente.isPending || incidentUnavailable}
              value={incidenteDescripcion}
              onChange={(e) => setIncidenteDescripcion(e.target.value)}
              placeholder="Describe el incidente..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none text-sm"
            />
          </div>
          {eventLocation ? (
            <p className="text-xs text-neutral-400 flex items-center gap-1">
              <MapPin size={12} /> Se adjuntará la ubicación si sigue siendo reciente al registrar.
            </p>
          ) : <p className="text-xs text-neutral-600">No se adjuntará una ubicación: no hay una lectura reciente verificable. Podés continuar.</p>}
        </div>
        {incidenteError && !incidentNotice.pending && <p ref={incidenteErrorRef} role="alert" tabIndex={-1} className="mb-4 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-900 focus:outline focus:outline-2 focus:outline-error-600">{incidenteError}</p>}
        <div className="space-y-2">
          <Button fullWidth onClick={handleRegistrarIncidente} disabled={registrarIncidente.isPending || incidentUnavailable}>
            {registrarIncidente.isPending ? 'Registrando...' : 'Registrar Incidente'}
          </Button>
          <Button variant="outline" fullWidth onClick={() => { setShowIncidenteModal(false); setIncidenteError(''); }} disabled={registrarIncidente.isPending}>
            Cerrar
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// Keep the pause state, dialogs and GPS view bound to the selected manifest.
const ViajeEnCursoTransportista: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const owner = useQueryOwner();
  return <ViajeEnCursoTransportistaContent key={JSON.stringify([owner, id ?? null])} />;
};

export default ViajeEnCursoTransportista;
