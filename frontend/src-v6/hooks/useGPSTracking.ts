/**
 * SITREP v6 - GPS Tracking Hook
 * ==============================
 * Encapsulates all GPS logic for the transportista trip view:
 * - navigator.geolocation.watchPosition
 * - Pending updates queue + localStorage persistence
 * - GPS status state machine (checking -> acquiring -> active | denied | unavailable | error)
 * - Cleanup handlers (clearWatch, beforeunload)
 * - 30s send interval with offline fallback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '../components/ui/Toast';
import { manifiestoService } from '../services/manifiesto.service';
import { GPS_DELIVERY_CONFIRMED_EVENT, GpsPendingError, acknowledgeGpsPoint, gpsTasksForTrip, newGpsPointId, prepareGpsPoints, readPendingGpsQueue, runExclusiveGpsTask, savePendingGpsQueue, trackGpsTask, type GpsStorageIssue, type PendingGpsPoint } from '../services/gpsQueue';
import { EstadoManifiesto } from '../types/models';

// Bound the rendered route independently from the persisted upload queue.
const MAX_LOCAL_TRACK_POINTS = 500;

export type GpsStatus = 'checking' | 'acquiring' | 'active' | 'denied' | 'unavailable' | 'error';

export interface GpsDetails {
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  lastUpdate: Date | null;
}

interface UseGPSTrackingOptions {
  manifiestoId: string | undefined;
  ownerId: string | number | undefined;
  estado: string | undefined;
  viajeStatus: 'ACTIVO' | 'PAUSADO';
}

interface UseGPSTrackingReturn {
  position: [number, number] | null;
  trackPoints: [number, number][];
  status: GpsStatus;
  details: GpsDetails;
  sendStatus: 'ok' | 'error' | 'idle';
  sendError: string | null;
  lastSendError: () => string | null;
  pendingCount: number;
  hasPending: boolean;
  storageError: boolean;
  storageIssue: GpsStorageIssue | null;
  lastSyncAt: Date | null;
  cleanupGps: () => void;
  stopAndDrain: () => Promise<void>;
  flushPending: () => Promise<boolean>;
  deliveryWasConfirmed: () => boolean;
  hasStorageError: () => boolean;
  resumeGps: () => void;
  retryGps: () => Promise<void>;
}

function gpsSendErrorMessage(error: unknown): string {
  if (error instanceof GpsPendingError) return error.message;
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401) return 'No se pudo verificar tu sesión. Volvé a ingresar y retomá la sincronización.';
  if (status === 403) return 'Tu cuenta no tiene permiso para enviar ubicaciones de este viaje. Contactá a soporte.';
  if (status === 409) return 'El viaje o la ubicación cambiaron. Actualizá el manifiesto y, si persiste, contactá a soporte.';
  return 'No se pudieron enviar las ubicaciones. Revisá la conexión y volvé a intentar.';
}

function gpsStorageErrorMessage(issue: GpsStorageIssue): string {
  if (issue === 'legacy') return 'Hay ubicaciones anteriores sin titular identificado. Se conservaron; contactá a soporte antes de confirmar.';
  if (issue === 'invalid') return 'No se pudieron leer las ubicaciones guardadas. Se conservaron; contactá a soporte antes de confirmar.';
  if (issue === 'reference') return 'No se pudo preparar la ubicación para enviarla de forma segura. Contactá a soporte.';
  return 'No se pudo guardar el recorrido en el dispositivo. Mantené esta pantalla abierta y revisá el almacenamiento o la conexión.';
}

export function useGPSTracking({ manifiestoId, ownerId, estado, viajeStatus }: UseGPSTrackingOptions): UseGPSTrackingReturn {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('checking');
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([]);
  const [gpsDetails, setGpsDetails] = useState<GpsDetails>({
    accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null,
  });
  const [gpsSendStatus, setGpsSendStatus] = useState<'ok' | 'error' | 'idle'>('idle');
  const [gpsSendError, setGpsSendError] = useState<string | null>(null);
  const gpsSendErrorRef = useRef<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [storageIssue, setStorageIssue] = useState<GpsStorageIssue | null>(null);
  const storageErrorRef = useRef(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acquisitionRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingGenerationRef = useRef(0);
  const pendingUpdatesRef = useRef<PendingGpsPoint[]>([]);
  const lastGpsSearchToastAtRef = useRef(0);
  // Use refs for current position/details inside the interval callback
  // to avoid stale closures
  const currentPositionRef = useRef<[number, number] | null>(null);
  const gpsDetailsRef = useRef<GpsDetails>(gpsDetails);
  const observationRef = useRef<{ key: string; puntoId: string | null } | null>(null);
  const lastQueuedObservationRef = useRef<string | null>(null);
  const unidentifiedObservationSequence = useRef(0);
  const referenceErrorRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);
  useEffect(() => { gpsDetailsRef.current = gpsDetails; }, [gpsDetails]);

  const id = manifiestoId;
  const owner = ownerId == null ? undefined : String(ownerId);
  const context = id && owner ? JSON.stringify([owner, id]) : null;
  const activeContextRef = useRef(context);
  activeContextRef.current = context;
  const previousContextRef = useRef(context);
  const uploadsStoppedRef = useRef(false);
  const deliveryConfirmedRef = useRef(false);
  const [restart, setRestart] = useState(0);
  const sendPoint = useCallback((tripId: string, p: PendingGpsPoint) => {
    return manifiestoService.actualizarUbicacion(tripId, p.lat, p.lng, p.speed, p.heading, p.puntoId);
  }, []);
  const reportSendError = useCallback((error: unknown) => {
    const message = gpsSendErrorMessage(error);
    gpsSendErrorRef.current = message; setGpsSendError(message); setGpsSendStatus('error');
  }, []);
  const clearSendError = useCallback(() => { gpsSendErrorRef.current = null; setGpsSendError(null); }, []);

  const setPendingUpdates = useCallback((points: PendingGpsPoint[]) => {
    if (activeContextRef.current === context) {
      pendingUpdatesRef.current = points;
      setPendingCount(points.length);
    }
    if (!id || !owner) return false;
    const saved = savePendingGpsQueue(owner, id, points);
    if (activeContextRef.current === context) {
      storageErrorRef.current = !saved;
      setStorageError(!saved);
      setStorageIssue(saved ? null : 'storage');
    }
    return saved;
  }, [context, id, owner]);

  const acknowledgePendingUpdate = useCallback((point: PendingGpsPoint) => {
    if (!id || !owner || !point.puntoId) return null;
    const result = acknowledgeGpsPoint(owner, id, point.puntoId);
    if (activeContextRef.current === context) {
      if (!result.ok) { storageErrorRef.current = true; setStorageError(true); setStorageIssue(result.reason); }
      else {
        pendingUpdatesRef.current = result.points; setPendingCount(result.points.length);
        storageErrorRef.current = !result.durable; setStorageError(!result.durable); setStorageIssue(result.durable ? null : 'storage');
      }
    }
    return result;
  }, [context, id, owner]);

  // Stop the watcher. Points were persisted before sending, so do not replace
  // a newer queue written by another tab with this page's stale snapshot.
  const cleanupGps = useCallback(() => {
    // getCurrentPosition cannot be cancelled; invalidate its pending callbacks.
    trackingGenerationRef.current++;
    uploadsStoppedRef.current = true;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    if (acquisitionRetryIntervalRef.current) {
      clearInterval(acquisitionRetryIntervalRef.current);
      acquisitionRetryIntervalRef.current = null;
    }
  }, []);

  // Finish in-flight HTTP writes before changing the server trip state.
  const stopAndDrain = useCallback(async () => {
    cleanupGps();
    if (id) await Promise.allSettled(gpsTasksForTrip(id));
  }, [cleanupGps, id]);
  // Called after stopAndDrain, before a state change that would reject older GPS points.
  const flushPending = useCallback(async (): Promise<boolean> => {
    if (!id || !owner || !uploadsStoppedRef.current || deliveryConfirmedRef.current) return false;
    const generation = trackingGenerationRef.current;
    let completed = false;
    await runExclusiveGpsTask(id, async () => {
      if (activeContextRef.current !== context || trackingGenerationRef.current !== generation || deliveryConfirmedRef.current) return;
      const saved = readPendingGpsQueue(owner, id);
      if (!saved.ok) {
        storageErrorRef.current = true; setStorageError(true); setStorageIssue(saved.reason);
        reportSendError(new GpsPendingError(gpsStorageErrorMessage(saved.reason))); return;
      }
      let pending: PendingGpsPoint[];
      try { pending = prepareGpsPoints(owner, id, saved.points); }
      catch (error) { storageErrorRef.current = true; setStorageError(true); setStorageIssue(error instanceof GpsPendingError ? error.issue ?? 'storage' : 'storage'); reportSendError(error); return; }
      if (!setPendingUpdates(pending) && pending.length === 0) { reportSendError(new GpsPendingError(gpsStorageErrorMessage('storage'))); return; }
      let sent = false;
      while (pending.length) {
        const point = pending[0];
        try { await sendPoint(id, point); } catch (error) { reportSendError(error); return; }
        const acknowledged = acknowledgePendingUpdate(point);
        if (!acknowledged?.ok || !acknowledged.durable) {
          reportSendError(new GpsPendingError(gpsStorageErrorMessage(acknowledged && !acknowledged.ok ? acknowledged.reason : 'storage'))); return;
        }
        sent = true;
        pending = acknowledged.points;
        if (activeContextRef.current !== context || trackingGenerationRef.current !== generation || deliveryConfirmedRef.current) return;
      }
      clearSendError();
      if (sent) { setLastSyncAt(new Date()); setGpsSendStatus('ok'); }
      completed = true;
    });
    return completed;
  }, [context, id, owner, sendPoint, setPendingUpdates, acknowledgePendingUpdate, reportSendError, clearSendError]);
  const resumeGps = useCallback(() => { if (!deliveryConfirmedRef.current) setRestart(value => value + 1); }, []);
  // A retry must not re-enable tracking if a delivery, handoff or unmount
  // stopped it while an outstanding GPS upload was being drained.
  const retryGps = useCallback(async () => {
    if (!id || !owner || deliveryConfirmedRef.current || estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus !== 'ACTIVO') return;
    const expectedGeneration = trackingGenerationRef.current + 1;
    await stopAndDrain();
    if (trackingGenerationRef.current !== expectedGeneration || activeContextRef.current !== context) return;
    const emptyDetails: GpsDetails = { accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null };
    currentPositionRef.current = null;
    observationRef.current = null;
    gpsDetailsRef.current = emptyDetails;
    setCurrentPosition(null);
    setGpsDetails(emptyDetails);
    setRestart(value => value + 1);
  }, [context, estado, id, owner, stopAndDrain, viajeStatus]);

  // A position and its pending queue belong to one manifest only.
  useEffect(() => {
    if (previousContextRef.current === context) return;
    previousContextRef.current = context;
    deliveryConfirmedRef.current = false;
    const emptyDetails: GpsDetails = { accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null };
    pendingUpdatesRef.current = [];
    storageErrorRef.current = false;
    currentPositionRef.current = null;
    observationRef.current = null;
    lastQueuedObservationRef.current = null;
    referenceErrorRef.current = false;
    gpsDetailsRef.current = emptyDetails;
    setPendingCount(0);
    setStorageError(false);
    setStorageIssue(null);
    setCurrentPosition(null);
    setTrackPoints([]);
    setGpsDetails(emptyDetails);
    setGpsSendStatus('idle');
    clearSendError();
    setLastSyncAt(null);
    setGpsStatus('checking');
  }, [context, clearSendError]);

  // Check GPS permission on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      return;
    }
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(result => {
        if (result.state === 'denied') {
          setGpsStatus('denied');
        } else {
          setGpsStatus('checking');
        }
      }).catch(() => {
        setGpsStatus('checking');
      });
    } else {
      setGpsStatus('checking');
    }
  }, []);

  // Restore pending GPS updates from localStorage on mount and flush in order
  useEffect(() => {
    if (!id || !owner || deliveryConfirmedRef.current || estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
    uploadsStoppedRef.current = false;
    let isMounted = true;
    const earlierTasks = gpsTasksForTrip(id);
    const savedPending = readPendingGpsQueue(owner, id);
    if (!savedPending.ok) {
      storageErrorRef.current = true;
      setStorageError(true);
      setStorageIssue(savedPending.reason);
    } else if (!savedPending.durable) {
      setPendingUpdates(savedPending.points);
    }
    if ((!savedPending.ok || savedPending.points.length > 0) || earlierTasks.length > 0) {
      const replay = (async () => {
        if (earlierTasks.length > 0) await Promise.allSettled(earlierTasks);
        if (!isMounted || uploadsStoppedRef.current || activeContextRef.current !== context) return;
        const saved = readPendingGpsQueue(owner, id);
        if (!saved.ok) {
          storageErrorRef.current = true;
          setStorageError(true);
          setStorageIssue(saved.reason);
          return;
        }
        let parsed: PendingGpsPoint[];
        try { parsed = prepareGpsPoints(owner, id, saved.points); }
        catch (error) { storageErrorRef.current = true; setStorageError(true); setStorageIssue(error instanceof GpsPendingError ? error.issue ?? 'storage' : 'storage'); return; }
        if (parsed.length > 0) {
            setPendingUpdates(parsed);
            for (const p of parsed) {
              if (!isMounted || uploadsStoppedRef.current || activeContextRef.current !== context) break;
              try {
                await sendPoint(id, p);
                if (isMounted && activeContextRef.current === context) setLastSyncAt(new Date());
                const acknowledged = acknowledgePendingUpdate(p);
                if (!acknowledged?.ok || !acknowledged.durable) break;
                if (isMounted && activeContextRef.current === context && acknowledged.points.length === 0) { clearSendError(); setGpsSendStatus('ok'); }
              } catch (error) {
                if (isMounted && activeContextRef.current === context) reportSendError(error);
                break;
              }
            }
        }
      })();
      trackGpsTask(id, replay);
    }
    return () => {
      isMounted = false;
    };
  }, [context, id, owner, estado, viajeStatus, restart, setPendingUpdates, sendPoint, acknowledgePendingUpdate, reportSendError, clearSendError]);

  // Start GPS tracking when EN_TRANSITO and ACTIVO
  useEffect(() => {
    if (!id || !owner || deliveryConfirmedRef.current || estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      return;
    }

    uploadsStoppedRef.current = false;
    const generation = ++trackingGenerationRef.current;
    const isActive = () => trackingGenerationRef.current === generation && activeContextRef.current === context;
    let fallbackPositionInFlight = false;
    let permissionDenied = false;
    setGpsStatus('acquiring');

    const applyPosition = (pos: GeolocationPosition) => {
      if (!isActive() || permissionDenied) return;
      const { latitude, longitude, accuracy, speed, heading, altitude } = pos.coords;
      const point: [number, number] = [latitude, longitude];
      const measuredAt = Number.isFinite(pos.timestamp) && pos.timestamp > 0 ? pos.timestamp : null;
      const key = measuredAt === null ? `unknown:${++unidentifiedObservationSequence.current}`
        : JSON.stringify([measuredAt, latitude, longitude, accuracy, speed, heading, altitude]);
      if (observationRef.current?.key !== key) observationRef.current = { key, puntoId: null };
      const details = { accuracy, speed, heading, altitude, lastUpdate: new Date(measuredAt ?? Date.now()) };
      currentPositionRef.current = point;
      gpsDetailsRef.current = details;
      setCurrentPosition(point);
      setTrackPoints(prev => [...prev, point].slice(-MAX_LOCAL_TRACK_POINTS));
      setGpsDetails(details);
      setGpsStatus('active');
    };

    const requestCoarseFallback = () => {
      if (!isActive() || permissionDenied || fallbackPositionInFlight) return;
      fallbackPositionInFlight = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isActive()) return;
          fallbackPositionInFlight = false;
          applyPosition(pos);
        },
        (err) => {
          if (!isActive()) return;
          fallbackPositionInFlight = false;
          if (err.code === 1) permissionDenied = true;
          setGpsStatus(permissionDenied ? 'denied' : 'acquiring');
        },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
      );
    };

    const notifyGpsSearching = (message: string) => {
      const now = Date.now();
      if (now - lastGpsSearchToastAtRef.current > 30000) {
        toast.warning(message);
        lastGpsSearchToastAtRef.current = now;
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isActive()) return;
        permissionDenied = false;
        applyPosition(pos);
      },
      (err) => {
        if (!isActive()) return;
        if (err.code === 1) {
          permissionDenied = true;
          setGpsStatus('denied');
        } else if (err.code === 2) {
          setGpsStatus('acquiring');
          notifyGpsSearching('GPS activo. Esperando señal de ubicación del dispositivo.');
          requestCoarseFallback();
        } else if (err.code === 3) {
          setGpsStatus('acquiring');
          notifyGpsSearching('GPS activo. Reintentando con ubicación aproximada.');
          requestCoarseFallback();
        } else {
          setGpsStatus('error');
          toast.error('Tiempo de espera GPS agotado. Reintentando...');
        }
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 }
    );

    requestCoarseFallback();
    acquisitionRetryIntervalRef.current = setInterval(() => {
      if (!currentPositionRef.current) requestCoarseFallback();
    }, 15000);

    // GPS send interval: every 30s
    sendIntervalRef.current = setInterval(() => {
      // Do not overlap queue replay or an earlier send when the network is slow.
      if (!id || gpsTasksForTrip(id).length > 0) return;
      trackGpsTask(id, (async () => {
        if (!isActive() || permissionDenied) return;
        if (storageErrorRef.current && !referenceErrorRef.current && pendingUpdatesRef.current.length === 0) return;
        const pos = currentPositionRef.current;
        const details = gpsDetailsRef.current;
        const observation = observationRef.current;
        if (!pos || !id || !observation) return;

        const isNewObservation = observation.key !== lastQueuedObservationRef.current;
        if (isNewObservation && !observation.puntoId) {
          try {
            observation.puntoId = newGpsPointId();
            if (referenceErrorRef.current) { referenceErrorRef.current = false; storageErrorRef.current = false; setStorageError(false); setStorageIssue(null); }
          } catch {
            referenceErrorRef.current = true; storageErrorRef.current = true;
            setStorageError(true); setStorageIssue('reference'); setGpsSendStatus('error'); return;
          }
        }
        const saved = readPendingGpsQueue(owner, id);
        if (!saved.ok) { storageErrorRef.current = true; setStorageError(true); setStorageIssue(saved.reason); return; }
        let pending: PendingGpsPoint[];
        try {
          pending = prepareGpsPoints(owner, id, saved.points);
          if (isNewObservation) pending = [...pending, { lat: pos[0], lng: pos[1], speed: details.speed, heading: details.heading, puntoId: observation.puntoId! }];
        }
        catch (error) { storageErrorRef.current = true; setStorageError(true); setStorageIssue(error instanceof GpsPendingError ? error.issue ?? 'storage' : 'storage'); setGpsSendStatus('error'); return; }
        if (pending.length === 0) return;

        // Write ahead: if a response is lost or the page closes, retry the
        // same observation with the same ID instead of inventing a new point.
        const durable = setPendingUpdates(pending);
        if (isNewObservation) lastQueuedObservationRef.current = observation.key;
        if (!durable) { if (isActive()) setGpsSendStatus('error'); return; }
        for (const queued of [...pending]) {
          if (!isActive()) return;
          try { await sendPoint(id, queued); }
          catch (error) {
            if (isActive()) {
              reportSendError(error);
            }
            return;
          }
          const acknowledged = acknowledgePendingUpdate(queued);
          if (!acknowledged?.ok || !acknowledged.durable) { if (isActive()) setGpsSendStatus('error'); return; }
          pending = acknowledged.points;
          if (isActive()) setLastSyncAt(new Date());
        }
        if (isActive() && pending.length === 0) { clearSendError(); setGpsSendStatus('ok'); }
      })());
    }, 30000);

    // beforeunload listener to flush GPS data when PWA closes
    const handleBeforeUnload = () => cleanupGps();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cleanupGps();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [context, estado, viajeStatus, id, owner, restart, cleanupGps, setPendingUpdates, sendPoint, acknowledgePendingUpdate, reportSendError, clearSendError]);

  useEffect(() => {
    const onDelivery = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; owner: string }>).detail;
      if (detail?.id !== id || detail.owner !== owner) return;
      deliveryConfirmedRef.current = true;
      pendingUpdatesRef.current = [];
      storageErrorRef.current = false;
      setPendingCount(0);
      setStorageError(false);
      setStorageIssue(null);
      clearSendError();
      setGpsSendStatus('idle');
      cleanupGps();
    };
    window.addEventListener(GPS_DELIVERY_CONFIRMED_EVENT, onDelivery);
    return () => window.removeEventListener(GPS_DELIVERY_CONFIRMED_EVENT, onDelivery);
  }, [cleanupGps, id, owner, clearSendError]);

  return {
    position: currentPosition,
    trackPoints,
    status: gpsStatus,
    details: gpsDetails,
    sendStatus: gpsSendStatus,
    sendError: gpsSendError,
    lastSendError: () => gpsSendErrorRef.current,
    pendingCount,
    hasPending: pendingCount > 0 || storageError,
    storageError,
    storageIssue,
    lastSyncAt,
    cleanupGps,
    stopAndDrain,
    flushPending,
    deliveryWasConfirmed: () => deliveryConfirmedRef.current,
    hasStorageError: () => storageErrorRef.current,
    resumeGps,
    retryGps,
  };
}

export function headingToCompass(heading: number | null): string {
  if (heading == null) return '-';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(heading / 45) % 8];
}
