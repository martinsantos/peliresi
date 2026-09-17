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
import { addToSyncQueue } from '../services/indexeddb';
import { EstadoManifiesto } from '../types/models';
import { gpsPendingStorageKey } from '../utils/userContext';

export type GpsStatus = 'checking' | 'acquiring' | 'active' | 'denied' | 'unavailable' | 'error';

export interface GpsDetails {
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  lastUpdate: Date | null;
}

export interface PendingGpsPoint {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  sampledAt: string;
}

const MENDOZA_CENTER: [number, number] = [-32.9287, -68.8535];

interface UseGPSTrackingOptions {
  manifiestoId: string | undefined;
  userId: string | number | undefined;
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
  isStale: boolean;
  flushPending: () => Promise<boolean>;
  stagePendingForSync: (userId: string | number) => Promise<number>;
  cleanupGps: () => void;
}

export function useGPSTracking({ manifiestoId, userId, estado, viajeStatus }: UseGPSTrackingOptions): UseGPSTrackingReturn {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>(() => (
    'geolocation' in navigator ? 'checking' : 'unavailable'
  ));
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([]);
  const [gpsDetails, setGpsDetails] = useState<GpsDetails>({
    accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null,
  });
  const [gpsSendStatus, setGpsSendStatus] = useState<'ok' | 'error' | 'idle'>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [isStale, setIsStale] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingUpdatesRef = useRef<PendingGpsPoint[]>([]);
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);
  const lastQueuedAtRef = useRef(0);
  const lastFixReceivedAtRef = useRef(0);
  // Use refs for current position/details inside the interval callback
  // to avoid stale closures
  const currentPositionRef = useRef<[number, number] | null>(null);
  const gpsStatusRef = useRef<GpsStatus>(gpsStatus);

  // Keep refs in sync with state
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);
  useEffect(() => { gpsStatusRef.current = gpsStatus; }, [gpsStatus]);

  const id = manifiestoId;
  const pendingStorageKey = id && userId != null ? gpsPendingStorageKey(userId, id) : null;

  const persistPending = useCallback((points: PendingGpsPoint[]) => {
    pendingUpdatesRef.current = points.slice(-500);
    setPendingCount(pendingUpdatesRef.current.length);
    if (!pendingStorageKey) return;
    if (pendingUpdatesRef.current.length > 0) {
      localStorage.setItem(pendingStorageKey, JSON.stringify(pendingUpdatesRef.current));
    } else {
      localStorage.removeItem(pendingStorageKey);
    }
  }, [pendingStorageKey]);

  const flushPending = useCallback((): Promise<boolean> => {
    if (!id || pendingUpdatesRef.current.length === 0) return Promise.resolve(true);
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const run = (async () => {
      const queued = [...pendingUpdatesRef.current];
      let flushed = 0;
      for (const point of queued) {
        try {
          await manifiestoService.actualizarUbicacion(
            id,
            point.lat,
            point.lng,
            point.speed,
            point.heading,
            point.sampledAt,
          );
          flushed += 1;
        } catch {
          break;
        }
      }
      persistPending(queued.slice(flushed));
      const complete = flushed === queued.length;
      setGpsSendStatus(complete ? 'ok' : 'error');
      return complete;
    })().finally(() => {
      flushPromiseRef.current = null;
    });
    flushPromiseRef.current = run;
    return run;
  }, [id, persistPending]);

  const stagePendingForSync = useCallback(async (userId: string | number): Promise<number> => {
    if (!id) return 0;
    const queued = [...pendingUpdatesRef.current];
    for (const point of queued) {
      await addToSyncQueue({
        type: 'POST',
        endpoint: `/manifiestos/${id}/ubicacion`,
        data: {
          latitud: point.lat,
          longitud: point.lng,
          ...(point.speed != null && { velocidad: point.speed }),
          ...(point.heading != null && { direccion: point.heading }),
          timestamp: point.sampledAt,
        },
        userId,
      });
    }
    persistPending([]);
    return queued.length;
  }, [id, persistPending]);

  // Robust cleanup function — clears watcher + flushes pending to localStorage
  const cleanupGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    // Persist synchronously before navigation/backgrounding.
    persistPending(pendingUpdatesRef.current);
  }, [persistPending]);

  // Check GPS permission on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      return;
    }
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(result => {
        if (result.state === 'denied') {
          setGpsStatus(current => current === 'active' ? current : 'denied');
        } else {
          setGpsStatus(current => current === 'active' ? current : 'checking');
        }
      }).catch(() => {
        setGpsStatus(current => current === 'active' ? current : 'checking');
      });
    }
  }, []);

  // Restore pending GPS updates from localStorage on mount and flush in order
  useEffect(() => {
    if (!id || !pendingStorageKey) return;
    const savedPending = localStorage.getItem(pendingStorageKey);
    if (savedPending) {
      try {
        const parsed = JSON.parse(savedPending);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((point): point is PendingGpsPoint => Boolean(
            point &&
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lng) &&
            typeof point.sampledAt === 'string',
          ));
          persistPending(valid);
          if (navigator.onLine) void flushPending();
        }
      } catch {
        localStorage.removeItem(pendingStorageKey);
      }
    }
  }, [id, pendingStorageKey, flushPending, persistPending]);

  // Start GPS tracking when EN_TRANSITO and ACTIVO
  useEffect(() => {
    if (estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
    if (gpsStatusRef.current === 'denied' || gpsStatusRef.current === 'unavailable') return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed, heading, altitude } = pos.coords;
        const point: [number, number] = [latitude, longitude];
        setCurrentPosition(point);
        setTrackPoints(prev => [...prev, point]);
        setGpsDetails({ accuracy, speed, heading, altitude, lastUpdate: new Date(pos.timestamp) });
        setGpsStatus('active');
        lastFixReceivedAtRef.current = Date.now();
        setIsStale(false);

        // Persist the first fix immediately, then keep a 15s trail. This
        // protects short trips and app closures before the 30s network tick.
        if (lastQueuedAtRef.current === 0 || pos.timestamp - lastQueuedAtRef.current >= 15_000) {
          lastQueuedAtRef.current = pos.timestamp;
          const pointToQueue: PendingGpsPoint = {
            lat: latitude,
            lng: longitude,
            speed,
            heading,
            sampledAt: new Date(pos.timestamp).toISOString(),
          };
          persistPending([...pendingUpdatesRef.current, pointToQueue]);
          if (pendingUpdatesRef.current.length === 1 && navigator.onLine) void flushPending();
        }
      },
      (err) => {
        if (err.code === 1) {
          setGpsStatus('denied');
          toast.error('Permiso de ubicación denegado. Activa GPS en Ajustes.');
        } else if (err.code === 2) {
          setGpsStatus('unavailable');
          toast.error('No se pudo obtener ubicación. Verifica que el GPS esté activo.');
        } else {
          setGpsStatus('error');
          toast.error('Tiempo de espera GPS agotado. Reintentando...');
        }
        if (!currentPositionRef.current) setCurrentPosition(MENDOZA_CENTER);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    // GPS send interval: every 30s
    sendIntervalRef.current = setInterval(async () => {
      if (!id || pendingUpdatesRef.current.length === 0) return;
      const complete = await flushPending();
      if (!complete && pendingUpdatesRef.current.length === 1) {
        toast.warning('Sin conexión GPS. Los puntos se guardan localmente.');
      }
    }, 30000);

    // beforeunload listener to flush GPS data when PWA closes
    const handleBeforeUnload = () => cleanupGps();
    const handlePageHide = () => cleanupGps();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        persistPending(pendingUpdatesRef.current);
        if (navigator.onLine) void flushPending();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cleanupGps();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [estado, viajeStatus, id, cleanupGps, flushPending, persistPending]);

  useEffect(() => {
    if (gpsStatus !== 'active') {
      return;
    }

    const updateStaleness = () => {
      setIsStale(
        lastFixReceivedAtRef.current > 0 &&
        Date.now() - lastFixReceivedAtRef.current >= 90_000,
      );
    };
    const interval = window.setInterval(updateStaleness, 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') updateStaleness();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gpsStatus]);

  return {
    position: currentPosition,
    trackPoints,
    status: gpsStatus,
    details: gpsDetails,
    sendStatus: gpsSendStatus,
    pendingCount,
    isStale: gpsStatus === 'active' && isStale,
    flushPending,
    stagePendingForSync,
    cleanupGps,
  };
}

export function headingToCompass(heading: number | null): string {
  if (heading == null) return '-';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(heading / 45) % 8];
}
