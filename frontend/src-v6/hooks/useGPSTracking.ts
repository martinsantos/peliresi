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
  const pendingUpdatesRef = useRef<PendingGpsPoint[]>([]);
  const lastGpsSearchToastAtRef = useRef(0);
  // Use refs for current position/details inside the interval callback
  // to avoid stale closures
  const currentPositionRef = useRef<[number, number] | null>(null);
  const gpsDetailsRef = useRef<GpsDetails>(gpsDetails);

  // Keep refs in sync with state
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);
  useEffect(() => { gpsDetailsRef.current = gpsDetails; }, [gpsDetails]);

  const id = manifiestoId;

  const setPendingUpdates = useCallback((points: PendingGpsPoint[]) => {
    pendingUpdatesRef.current = points;
    setPendingCount(points.length);
    if (!id) return;

    if (points.length > 0) {
      localStorage.setItem(`gps_pending_${id}`, JSON.stringify(points));
    } else {
      localStorage.removeItem(`gps_pending_${id}`);
    }
  }, [id]);

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
    // Flush pending to localStorage on cleanup so they survive PWA close
    if (id && pendingUpdatesRef.current.length > 0) {
      localStorage.setItem(`gps_pending_${id}`, JSON.stringify(pendingUpdatesRef.current));
    }
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
    if (!id) return;
    let isMounted = true;
    const savedPending = localStorage.getItem(`gps_pending_${id}`);
    if (savedPending) {
      try {
        const parsed = JSON.parse(savedPending);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (isMounted) setPendingUpdates(parsed);
          (async () => {
            let flushed = 0;
            for (const p of parsed) {
              try {
                await manifiestoService.actualizarUbicacion(id, p.lat, p.lng, p.speed, p.heading);
                flushed++;
                if (isMounted) setLastSyncAt(new Date());
              } catch {
                break;
              }
            }
            if (!isMounted) {
              const remaining = parsed.slice(flushed);
              if (remaining.length > 0) {
                localStorage.setItem(`gps_pending_${id}`, JSON.stringify(remaining));
              } else {
                localStorage.removeItem(`gps_pending_${id}`);
              }
              return;
            }
            if (flushed === parsed.length) {
              setPendingUpdates([]);
            } else {
              setPendingUpdates(parsed.slice(flushed));
            }
          })();
        }
      } catch {
        localStorage.removeItem(`gps_pending_${id}`);
      }
    }
    return () => {
      isMounted = false;
    };
  }, [id, setPendingUpdates]);

  // Default center (Mendoza, Argentina)
  const defaultCenter: [number, number] = [-32.9287, -68.8535];

  // Start GPS tracking when EN_TRANSITO and ACTIVO
  useEffect(() => {
    if (estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
    if (gpsStatus === 'denied' || gpsStatus === 'unavailable') return;

    setGpsStatus('acquiring');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed, heading, altitude } = pos.coords;
        const point: [number, number] = [latitude, longitude];
        setCurrentPosition(point);
        setTrackPoints(prev => [...prev, point]);
        setGpsDetails({ accuracy, speed, heading, altitude, lastUpdate: new Date() });
        setGpsStatus('active');
      },
      (err) => {
        if (err.code === 1) {
          setGpsStatus('denied');
          toast.error('Permiso de ubicación denegado. Activa GPS en Ajustes.');
        } else if (err.code === 2) {
          setGpsStatus('acquiring');
          const now = Date.now();
          if (now - lastGpsSearchToastAtRef.current > 30000) {
            toast.warning('GPS activo. Esperando señal de ubicación del dispositivo.');
            lastGpsSearchToastAtRef.current = now;
          }
        } else {
          setGpsStatus('error');
          toast.error('Tiempo de espera GPS agotado. Reintentando...');
        }
        if (err.code !== 2 && !currentPositionRef.current) setCurrentPosition(defaultCenter);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    // GPS send interval: every 30s
    sendIntervalRef.current = setInterval(async () => {
      const pos = currentPositionRef.current;
      const details = gpsDetailsRef.current;
      if (!pos || !id) return;

      const point: PendingGpsPoint = {
        lat: pos[0],
        lng: pos[1],
        speed: details.speed,
        heading: details.heading,
      };

      try {
        // First flush any accumulated pending points in order
        if (pendingUpdatesRef.current.length > 0) {
          const pendingSnapshot = pendingUpdatesRef.current;
          let flushed = 0;
          for (const p of pendingSnapshot) {
            try {
              await manifiestoService.actualizarUbicacion(id, p.lat, p.lng, p.speed, p.heading);
              flushed++;
              setLastSyncAt(new Date());
            } catch {
              break;
            }
          }
          const remaining = pendingSnapshot.slice(flushed);
          setPendingUpdates(remaining);
          if (remaining.length > 0) throw new Error('Unable to flush pending GPS points');
        }

        // Now send current position
        await manifiestoService.actualizarUbicacion(id, point.lat, point.lng, point.speed, point.heading);
        setPendingUpdates([]);
        setLastSyncAt(new Date());
        setGpsSendStatus('ok');
      } catch {
        const nextPending = [...pendingUpdatesRef.current, point].slice(-500);
        setPendingUpdates(nextPending);
        setGpsSendStatus('error');
        if (nextPending.length === 1) {
          toast.warning('Sin conexión GPS. Los puntos se guardan localmente.');
        }
      }
    }, 30000);

    // beforeunload listener to flush GPS data when PWA closes
    const handleBeforeUnload = () => cleanupGps();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cleanupGps();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [estado, viajeStatus, id, gpsStatus, cleanupGps, setPendingUpdates]);

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
  };
}

export function headingToCompass(heading: number | null): string {
  if (heading == null) return '-';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(heading / 45) % 8];
}
