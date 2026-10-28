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

interface PendingGpsPoint {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
}

// A trip view can unmount while an upload is still in flight. Keep its tasks
// separate from other trips and wait for them before replaying the same queue.
const gpsTasksByTrip = new Map<string, Set<Promise<void>>>();

function trackGpsTask(tripId: string, task: Promise<void>): void {
  let tasks = gpsTasksByTrip.get(tripId);
  if (!tasks) {
    tasks = new Set();
    gpsTasksByTrip.set(tripId, tasks);
  }
  const bucket = tasks;
  bucket.add(task);
  const remove = () => {
    bucket.delete(task);
    if (bucket.size === 0 && gpsTasksByTrip.get(tripId) === bucket) gpsTasksByTrip.delete(tripId);
  };
  void task.then(remove, remove);
}

interface UseGPSTrackingOptions {
  manifiestoId: string | undefined;
  estado: string | undefined;
  viajeStatus: 'ACTIVO' | 'PAUSADO';
}

interface UseGPSTrackingReturn {
  position: [number, number] | null;
  trackPoints: [number, number][];
  status: GpsStatus;
  details: GpsDetails;
  sendStatus: 'ok' | 'error' | 'idle';
  pendingCount: number;
  hasPending: boolean;
  lastSyncAt: Date | null;
  cleanupGps: () => void;
  stopAndDrain: () => Promise<void>;
  resumeGps: () => void;
  retryGps: () => Promise<void>;
}

export function useGPSTracking({ manifiestoId, estado, viajeStatus }: UseGPSTrackingOptions): UseGPSTrackingReturn {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('checking');
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([]);
  const [gpsDetails, setGpsDetails] = useState<GpsDetails>({
    accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null,
  });
  const [gpsSendStatus, setGpsSendStatus] = useState<'ok' | 'error' | 'idle'>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acquisitionRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingGenerationRef = useRef(0);
  const pendingUpdatesRef = useRef<PendingGpsPoint[]>([]);
  const lastGpsSearchToastAtRef = useRef(0);
  const gpsErrorToastRef = useRef<string | null>(null);
  // Use refs for current position/details inside the interval callback
  // to avoid stale closures
  const currentPositionRef = useRef<[number, number] | null>(null);
  const gpsDetailsRef = useRef<GpsDetails>(gpsDetails);

  // Keep refs in sync with state
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);
  useEffect(() => { gpsDetailsRef.current = gpsDetails; }, [gpsDetails]);

  const id = manifiestoId;
  const activeTripRef = useRef(id);
  activeTripRef.current = id;
  const previousTripRef = useRef(id);
  const uploadsStoppedRef = useRef(false);
  const [restart, setRestart] = useState(0);
  const sendPoint = useCallback((tripId: string, p: PendingGpsPoint) => {
    return manifiestoService.actualizarUbicacion(tripId, p.lat, p.lng, p.speed, p.heading);
  }, []);

  const setPendingUpdates = useCallback((points: PendingGpsPoint[]) => {
    if (activeTripRef.current === id) {
      pendingUpdatesRef.current = points;
      setPendingCount(points.length);
    }
    if (!id) return;

    if (points.length > 0) {
      localStorage.setItem(`gps_pending_${id}`, JSON.stringify(points));
    } else {
      localStorage.removeItem(`gps_pending_${id}`);
    }
  }, [id]);

  const clearGpsErrorNotice = useCallback(() => {
    if (gpsErrorToastRef.current) toast.remove(gpsErrorToastRef.current);
    gpsErrorToastRef.current = null;
  }, []);

  // Robust cleanup function — clears watcher + flushes pending to localStorage
  const cleanupGps = useCallback(() => {
    // getCurrentPosition cannot be cancelled; invalidate its pending callbacks.
    trackingGenerationRef.current++;
    uploadsStoppedRef.current = true;
    clearGpsErrorNotice();
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
    // Flush pending to localStorage on cleanup so they survive PWA close
    if (id && pendingUpdatesRef.current.length > 0) {
      localStorage.setItem(`gps_pending_${id}`, JSON.stringify(pendingUpdatesRef.current));
    }
  }, [clearGpsErrorNotice, id]);

  // Finish in-flight HTTP writes before changing the server trip state.
  const stopAndDrain = useCallback(async () => {
    cleanupGps();
    if (id) await Promise.allSettled([...(gpsTasksByTrip.get(id) ?? [])]);
  }, [cleanupGps, id]);
  const resumeGps = useCallback(() => setRestart(value => value + 1), []);
  // A retry must not re-enable tracking if a delivery, handoff or unmount
  // stopped it while an outstanding GPS upload was being drained.
  const retryGps = useCallback(async () => {
    if (!id || estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus !== 'ACTIVO') return;
    const expectedGeneration = trackingGenerationRef.current + 1;
    await stopAndDrain();
    if (trackingGenerationRef.current !== expectedGeneration || activeTripRef.current !== id) return;
    const emptyDetails: GpsDetails = { accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null };
    currentPositionRef.current = null;
    gpsDetailsRef.current = emptyDetails;
    setCurrentPosition(null);
    setGpsDetails(emptyDetails);
    setRestart(value => value + 1);
  }, [estado, id, stopAndDrain, viajeStatus]);

  // A position and its pending queue belong to one manifest only.
  useEffect(() => {
    if (previousTripRef.current === id) return;
    previousTripRef.current = id;
    const emptyDetails: GpsDetails = { accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null };
    pendingUpdatesRef.current = [];
    currentPositionRef.current = null;
    gpsDetailsRef.current = emptyDetails;
    setPendingCount(0);
    setCurrentPosition(null);
    setTrackPoints([]);
    setGpsDetails(emptyDetails);
    setGpsSendStatus('idle');
    setLastSyncAt(null);
    setGpsStatus('checking');
  }, [id]);

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
    if (!id || estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
    uploadsStoppedRef.current = false;
    let isMounted = true;
    const earlierTasks = [...(gpsTasksByTrip.get(id) ?? [])];
    const savedPending = localStorage.getItem(`gps_pending_${id}`);
    if (savedPending || earlierTasks.length > 0) {
      const replay = (async () => {
        if (earlierTasks.length > 0) await Promise.allSettled(earlierTasks);
        if (!isMounted || uploadsStoppedRef.current || activeTripRef.current !== id) return;
        const saved = localStorage.getItem(`gps_pending_${id}`);
        if (!saved) return;
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPendingUpdates(parsed);
            let flushed = 0;
            for (const p of parsed) {
              if (!isMounted || uploadsStoppedRef.current || activeTripRef.current !== id) break;
              try {
                await sendPoint(id, p);
                flushed++;
                if (isMounted && activeTripRef.current === id) setLastSyncAt(new Date());
              } catch {
                break;
              }
            }
            // Persist to the original trip even if the view was unmounted.
            const remaining = parsed.slice(flushed);
            if (isMounted && activeTripRef.current === id) setPendingUpdates(remaining);
            else if (remaining.length > 0) localStorage.setItem(`gps_pending_${id}`, JSON.stringify(remaining));
            else localStorage.removeItem(`gps_pending_${id}`);
          }
        } catch {
          localStorage.removeItem(`gps_pending_${id}`);
        }
      })();
      trackGpsTask(id, replay);
    }
    return () => {
      isMounted = false;
    };
  }, [id, estado, viajeStatus, restart, setPendingUpdates, sendPoint]);

  // Start GPS tracking when EN_TRANSITO and ACTIVO
  useEffect(() => {
    if (estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      return;
    }

    uploadsStoppedRef.current = false;
    const generation = ++trackingGenerationRef.current;
    const isActive = () => trackingGenerationRef.current === generation && activeTripRef.current === id;
    let fallbackPositionInFlight = false;
    let permissionDenied = false;
    setGpsStatus('acquiring');

    const applyPosition = (pos: GeolocationPosition) => {
      if (!isActive() || permissionDenied) return;
      clearGpsErrorNotice();
      const { latitude, longitude, accuracy, speed, heading, altitude } = pos.coords;
      const point: [number, number] = [latitude, longitude];
      setCurrentPosition(point);
      setTrackPoints(prev => [...prev, point].slice(-MAX_LOCAL_TRACK_POINTS));
      setGpsDetails({ accuracy, speed, heading, altitude, lastUpdate: new Date() });
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
          gpsErrorToastRef.current = toast.error('Permiso de ubicación denegado', 'Permití el acceso para compartir el recorrido.');
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
      if (!id || (gpsTasksByTrip.get(id)?.size ?? 0) > 0) return;
      trackGpsTask(id, (async () => {
        if (!isActive() || permissionDenied) return;
        const pos = currentPositionRef.current;
        const details = gpsDetailsRef.current;
        if (!pos || !id) return;

        const point: PendingGpsPoint = {
          lat: pos[0],
          lng: pos[1],
          speed: details.speed,
          heading: details.heading,
        };

        let pendingForAttempt = [...pendingUpdatesRef.current];
        try {
          // First flush any accumulated pending points in order
          if (pendingForAttempt.length > 0) {
            const pendingSnapshot = pendingForAttempt;
            let flushed = 0;
            for (const p of pendingSnapshot) {
              if (!isActive()) {
                setPendingUpdates(pendingSnapshot.slice(flushed));
                return;
              }
              try {
                await sendPoint(id, p);
                flushed++;
                if (isActive()) setLastSyncAt(new Date());
              } catch {
                break;
              }
            }
            const remaining = pendingSnapshot.slice(flushed);
            pendingForAttempt = remaining;
            setPendingUpdates(remaining);
            if (!isActive()) return;
            if (remaining.length > 0) throw new Error('Unable to flush pending GPS points');
          }

          // Now send current position
          if (!isActive()) return;
          await sendPoint(id, point);
          if (!isActive()) return;
          setPendingUpdates([]);
          setLastSyncAt(new Date());
          setGpsSendStatus('ok');
        } catch {
          const nextPending = [...pendingForAttempt, point].slice(-500);
          setPendingUpdates(nextPending);
          if (isActive()) setGpsSendStatus('error');
          if (isActive() && nextPending.length === 1) {
            toast.warning('Sin conexión GPS. Los puntos se guardan localmente.');
          }
        }
      })());
    }, 30000);

    // beforeunload listener to flush GPS data when PWA closes
    const handleBeforeUnload = () => cleanupGps();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cleanupGps();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [estado, viajeStatus, id, restart, cleanupGps, clearGpsErrorNotice, setPendingUpdates, sendPoint]);

  return {
    position: currentPosition,
    trackPoints,
    status: gpsStatus,
    details: gpsDetails,
    sendStatus: gpsSendStatus,
    pendingCount,
    hasPending: pendingCount > 0,
    lastSyncAt,
    cleanupGps,
    stopAndDrain,
    resumeGps,
    retryGps,
  };
}

export function headingToCompass(heading: number | null): string {
  if (heading == null) return '-';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(heading / 45) % 8];
}
