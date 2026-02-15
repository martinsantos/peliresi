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
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Truck, MapPin, Clock, Navigation, Package,
  Play, Pause, CheckCircle2, AlertTriangle, Radio, Map as MapIcon, List,
  Loader2, Compass, Gauge, Crosshair, WifiOff, LocateFixed
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { toast } from '../../components/ui/Toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ACTOR_ICONS } from '../../utils/map-icons';
import {
  useManifiesto,
  useConfirmarRetiro,
  useConfirmarEntrega,
  useRegistrarIncidente,
} from '../../hooks/useManifiestos';
import { manifiestoService } from '../../services/manifiesto.service';
import { EstadoManifiesto } from '../../types/models';
import { formatDateTime, formatWeight } from '../../utils/formatters';

// Recenter map when position changes
function RecenterMap({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom());
  }, [position, map]);
  return null;
}

type GpsStatus = 'checking' | 'acquiring' | 'active' | 'denied' | 'unavailable' | 'error';

function headingToCompass(heading: number | null): string {
  if (heading == null) return '-';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(heading / 45) % 8];
}

const ViajeEnCursoTransportista: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  // Real data from API
  const { data: apiData, isLoading, isError } = useManifiesto(id || '');
  const manifiesto = (apiData as any)?.data || apiData;
  const m = manifiesto || {};

  // Persist active trip snapshot to localStorage for recovery after app restart
  useEffect(() => {
    if (id && m.id && m.estado === EstadoManifiesto.EN_TRANSITO) {
      const snapshot = {
        id: m.id,
        numero: m.numero,
        estado: m.estado,
        generador: m.generador?.razonSocial,
        operador: m.operador?.razonSocial,
        transportista: m.transportista?.razonSocial,
        fechaRetiro: m.fechaRetiro,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`viaje_snapshot_${id}`, JSON.stringify(snapshot));
      localStorage.setItem('sitrep_active_trip_id', id);
    }
  }, [id, m.id, m.estado]);

  // Restore cached trip data while API is loading (stale-while-revalidate)
  const cachedSnapshot = useMemo(() => {
    if (!id) return null;
    try {
      const saved = localStorage.getItem(`viaje_snapshot_${id}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }, [id]);

  const displayData = m.id ? m : (cachedSnapshot || {});

  // Mutations
  const confirmarRetiro = useConfirmarRetiro();
  const confirmarEntrega = useConfirmarEntrega();
  const registrarIncidente = useRegistrarIncidente();

  // UI state
  const [viajeStatus, setViajeStatus] = useState<'ACTIVO' | 'PAUSADO'>('ACTIVO');
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [incidenteTipo, setIncidenteTipo] = useState('');
  const [incidenteDescripcion, setIncidenteDescripcion] = useState('');
  const [vistaMapa, setVistaMapa] = useState(true);

  // GPS state — FIX 1: full state machine + metadata
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('checking');
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([]);
  const [gpsDetails, setGpsDetails] = useState<{
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    altitude: number | null;
    lastUpdate: Date | null;
  }>({ accuracy: null, speed: null, heading: null, altitude: null, lastUpdate: null });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gpsSendStatus, setGpsSendStatus] = useState<'ok' | 'error' | 'idle'>('idle');
  const watchIdRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingUpdatesRef = useRef<{ lat: number; lng: number; speed: number | null; heading: number | null }[]>([]);

  const isActionPending = confirmarRetiro.isPending || confirmarEntrega.isPending || registrarIncidente.isPending;

  // Default center (Mendoza, Argentina)
  const defaultCenter: [number, number] = [-32.9287, -68.8535];

  // FIX 3B: Restore pause state from localStorage on mount
  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`viaje_status_${id}`);
      if (saved === 'PAUSADO') setViajeStatus('PAUSADO');
    }
  }, [id]);

  // C2: Restore pending GPS updates from localStorage on mount and flush them
  useEffect(() => {
    if (!id) return;
    const savedPending = localStorage.getItem(`gps_pending_${id}`);
    if (savedPending) {
      try {
        const parsed = JSON.parse(savedPending);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Flush saved pending updates to backend
          Promise.all(
            parsed.map((p: any) =>
              manifiestoService.actualizarUbicacion(id, p.lat, p.lng, p.speed, p.heading).catch(() => null)
            )
          ).then((results) => {
            const allSent = results.every(r => r !== null);
            if (allSent) {
              localStorage.removeItem(`gps_pending_${id}`);
            }
          });
        }
      } catch {
        localStorage.removeItem(`gps_pending_${id}`);
      }
    }
  }, [id]);

  // FIX 1A: Check GPS permission on mount
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
        setGpsStatus('checking'); // permissions API not supported, proceed anyway
      });
    } else {
      setGpsStatus('checking');
    }
  }, []);

  // FIX 6: Timer persistence from server timestamp (fechaRetiro)
  useEffect(() => {
    if (m.estado === EstadoManifiesto.EN_TRANSITO && m.fechaRetiro) {
      const start = new Date(m.fechaRetiro).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setElapsedTime(elapsed > 0 ? elapsed : 0);
    }
  }, [m.estado, m.fechaRetiro]);

  // A2: Robust cleanup function — clears watcher + flushes pending to localStorage
  const cleanupGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    // C2: Flush pending to localStorage on cleanup so they survive PWA close
    if (id && pendingUpdatesRef.current.length > 0) {
      localStorage.setItem(`gps_pending_${id}`, JSON.stringify(pendingUpdatesRef.current));
    }
  }, [id]);

  // Start GPS tracking when EN_TRANSITO and ACTIVO
  useEffect(() => {
    if (m.estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
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
        // FIX 1E: Error callback with user feedback
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
        if (!currentPosition) setCurrentPosition(defaultCenter);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    // FIX 7: Send full GPS data (speed, heading) to backend every 30s
    // Strategy: collect current position, try to send it along with any
    // previously failed points. On success, clear all pending. On failure,
    // keep only the latest point in pending (backend only needs current pos).
    sendIntervalRef.current = setInterval(async () => {
      if (!currentPosition || !id) return;

      const point = {
        lat: currentPosition[0],
        lng: currentPosition[1],
        speed: gpsDetails.speed,
        heading: gpsDetails.heading,
      };

      try {
        // Send current position to backend
        await manifiestoService.actualizarUbicacion(id, point.lat, point.lng, point.speed, point.heading);
        // Success: clear any pending failures
        pendingUpdatesRef.current = [];
        localStorage.removeItem(`gps_pending_${id}`);
        setGpsSendStatus('ok');
      } catch {
        // Failure: save current point for offline recovery
        // Only keep the latest position (avoids unbounded growth + duplicates on flush)
        pendingUpdatesRef.current = [point];
        localStorage.setItem(`gps_pending_${id}`, JSON.stringify(pendingUpdatesRef.current));
        setGpsSendStatus('error');
        toast.warning('No se pudo enviar la ubicación. Se reintentará.');
      }
    }, 30000);

    // A2: beforeunload listener to flush GPS data when PWA closes
    const handleBeforeUnload = () => cleanupGps();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cleanupGps();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [m.estado, viajeStatus, id, gpsStatus, cleanupGps]);

  // Timer tick
  useEffect(() => {
    if (m.estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
    timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [m.estado, viajeStatus]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const min = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${min}:${s}`;
  };

  // FIX 5: Confirmar Retiro with GPS coordinates
  const handleConfirmarRetiro = async () => {
    try {
      await confirmarRetiro.mutateAsync({
        id: id!,
        latitud: currentPosition?.[0],
        longitud: currentPosition?.[1],
        observaciones: 'Retiro confirmado desde app móvil',
      });
      toast.success('Retiro confirmado — viaje iniciado');
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo confirmar el retiro');
    }
  };

  // FIX 5: Confirmar Entrega with GPS coordinates
  const handleConfirmarEntrega = async () => {
    try {
      await confirmarEntrega.mutateAsync({
        id: id!,
        latitud: currentPosition?.[0],
        longitud: currentPosition?.[1],
        observaciones: 'Entrega confirmada desde app móvil',
      });
      toast.success('Entrega confirmada exitosamente');
      // Stop GPS — use robust cleanup
      cleanupGps();
      // Clean localStorage
      if (id) {
        localStorage.removeItem(`viaje_snapshot_${id}`);
        localStorage.removeItem(`viaje_status_${id}`);
        localStorage.removeItem(`gps_pending_${id}`);
        localStorage.removeItem('sitrep_active_trip_id');
      }
      setShowFinalizarModal(false);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo confirmar la entrega');
    }
  };

  // FIX 4: Incident saving with description fallback + GPS coords
  const handleRegistrarIncidente = async () => {
    if (!incidenteTipo) {
      toast.warning('Selecciona un tipo de incidente');
      return;
    }
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
      await registrarIncidente.mutateAsync({
        id: id!,
        tipo: incidenteTipo,
        descripcion: descripcionFinal,
        latitud: currentPosition?.[0],
        longitud: currentPosition?.[1],
      });
      toast.success('Incidente registrado');
      setShowIncidenteModal(false);
      setIncidenteTipo('');
      setIncidenteDescripcion('');
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo registrar el incidente');
    }
  };

  // FIX 3: Pause/resume persisted via backend incident events
  const handlePausar = async () => {
    const newStatus = viajeStatus === 'ACTIVO' ? 'PAUSADO' : 'ACTIVO';
    try {
      await registrarIncidente.mutateAsync({
        id: id!,
        tipo: newStatus === 'PAUSADO' ? 'PAUSA' : 'REANUDACION',
        descripcion: newStatus === 'PAUSADO' ? 'Viaje pausado por el transportista' : 'Viaje reanudado',
        latitud: currentPosition?.[0],
        longitud: currentPosition?.[1],
      });
      setViajeStatus(newStatus);
      localStorage.setItem(`viaje_status_${id}`, newStatus);
      toast.info(newStatus === 'PAUSADO' ? 'Viaje pausado' : 'Viaje reanudado');
    } catch {
      toast.error('No se pudo registrar la pausa');
    }
  };

  const mapCenter = currentPosition || defaultCenter;

  if (isLoading && !m.id) {
    // Show cached snapshot header while API loads (stale-while-revalidate)
    if (cachedSnapshot) {
      return (
        <div className="min-h-screen bg-neutral-50 pb-24">
          <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
            <div className="flex items-center justify-between h-14 px-4">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <p className="text-xs text-neutral-500 font-medium">{cachedSnapshot.numero || id}</p>
                  <h1 className="text-lg font-bold text-neutral-900">Viaje en Curso</h1>
                </div>
              </div>
            </div>
          </header>
          <div className="p-4 space-y-4">
            <Card variant="elevated">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {cachedSnapshot.generador && <p className="text-sm text-neutral-600">Generador: <span className="font-semibold">{cachedSnapshot.generador}</span></p>}
                  {cachedSnapshot.transportista && <p className="text-sm text-neutral-600">Transportista: <span className="font-semibold">{cachedSnapshot.transportista}</span></p>}
                  {cachedSnapshot.operador && <p className="text-sm text-neutral-600">Destino: <span className="font-semibold">{cachedSnapshot.operador}</span></p>}
                </div>
              </CardContent>
            </Card>
            <div className="flex items-center justify-center py-8">
              <Loader2 size={32} className="animate-spin text-primary-600" />
              <span className="ml-3 text-neutral-500">Cargando datos del viaje...</span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if ((!manifiesto || isError) && cachedSnapshot) {
    // Show cached snapshot with reconnecting banner when API fails
    return (
      <div className="min-h-screen bg-neutral-50 pb-24">
        <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
                <ArrowLeft size={20} />
              </button>
              <div>
                <p className="text-xs text-neutral-500 font-medium">{cachedSnapshot.numero || id}</p>
                <h1 className="text-lg font-bold text-neutral-900">Viaje en Curso</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-warning-50 border border-warning-200 rounded-lg">
            <WifiOff size={16} className="text-warning-600 flex-shrink-0" />
            <p className="text-xs text-warning-700">Datos de la última sesión — reconectando...</p>
          </div>
          <Card variant="elevated">
            <CardContent className="p-4">
              <div className="space-y-2">
                {cachedSnapshot.generador && <p className="text-sm text-neutral-600">Generador: <span className="font-semibold">{cachedSnapshot.generador}</span></p>}
                {cachedSnapshot.transportista && <p className="text-sm text-neutral-600">Transportista: <span className="font-semibold">{cachedSnapshot.transportista}</span></p>}
                {cachedSnapshot.operador && <p className="text-sm text-neutral-600">Destino: <span className="font-semibold">{cachedSnapshot.operador}</span></p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!manifiesto || isError) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">Manifiesto no encontrado</h1>
        </div>
        <Card><CardContent className="py-8 text-center text-neutral-500">No se pudo cargar el manifiesto</CardContent></Card>
      </div>
    );
  }

  const totalPeso = Array.isArray(m.residuos) ? m.residuos.reduce((sum: number, r: any) => sum + (r.cantidad || 0), 0) : 0;
  const eventos = Array.isArray(m.eventos) ? m.eventos : [];

  // FIX 1D: GPS Status Panel component
  const GpsStatusPanel = () => {
    if (m.estado !== EstadoManifiesto.EN_TRANSITO) return null;

    const statusConfig: Record<GpsStatus, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
      checking: { color: 'text-neutral-500', bgColor: 'bg-neutral-100', label: 'Verificando GPS...', icon: <Loader2 size={14} className="animate-spin" /> },
      acquiring: { color: 'text-warning-600', bgColor: 'bg-warning-50', label: 'Adquiriendo señal GPS...', icon: <LocateFixed size={14} className="animate-pulse" /> },
      active: { color: 'text-success-600', bgColor: 'bg-success-50', label: 'GPS Activo', icon: <div className="w-2.5 h-2.5 rounded-full bg-success-500 animate-pulse" /> },
      denied: { color: 'text-error-600', bgColor: 'bg-error-50', label: 'Permiso GPS Denegado', icon: <WifiOff size={14} /> },
      unavailable: { color: 'text-error-600', bgColor: 'bg-error-50', label: 'GPS No Disponible', icon: <WifiOff size={14} /> },
      error: { color: 'text-error-600', bgColor: 'bg-error-50', label: 'Error GPS', icon: <AlertTriangle size={14} /> },
    };

    const cfg = statusConfig[gpsStatus];

    return (
      <Card className={`${cfg.bgColor} border-none`}>
        <CardContent className="p-3">
          {/* Status row */}
          <div className="flex items-center justify-between mb-2">
            <div className={`flex items-center gap-2 ${cfg.color}`}>
              {cfg.icon}
              <span className="text-sm font-semibold">{cfg.label}</span>
            </div>
            {gpsSendStatus === 'error' && gpsStatus === 'active' && (
              <span className="text-xs text-error-500 flex items-center gap-1">
                <WifiOff size={12} /> Sin conexión
              </span>
            )}
          </div>

          {/* GPS denied help */}
          {gpsStatus === 'denied' && (
            <p className="text-xs text-error-500 mt-1">
              Ve a Ajustes &gt; Privacidad &gt; Ubicación y permite el acceso para esta app. Luego recarga la página.
            </p>
          )}

          {/* GPS data when active */}
          {gpsStatus === 'active' && currentPosition && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex items-center gap-1.5">
                <Crosshair size={13} className="text-neutral-400" />
                <span className="text-xs text-neutral-600">
                  {currentPosition[0].toFixed(5)}, {currentPosition[1].toFixed(5)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-neutral-400" />
                <span className="text-xs text-neutral-600">
                  ±{gpsDetails.accuracy != null ? Math.round(gpsDetails.accuracy) : '-'}m
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge size={13} className="text-neutral-400" />
                <span className="text-xs text-neutral-600">
                  {gpsDetails.speed != null ? `${Math.round(gpsDetails.speed * 3.6)} km/h` : '- km/h'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Compass size={13} className="text-neutral-400" />
                <span className="text-xs text-neutral-600">
                  {headingToCompass(gpsDetails.heading)} {gpsDetails.heading != null ? `(${Math.round(gpsDetails.heading)}°)` : ''}
                </span>
              </div>
            </div>
          )}

          {/* Acquiring animation */}
          {gpsStatus === 'acquiring' && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-warning-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-warning-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-warning-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-warning-500">Buscando satélites...</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-xs text-neutral-500 font-medium">{m.numero || id}</p>
              <h1 className="text-lg font-bold text-neutral-900">
                {m.estado === EstadoManifiesto.APROBADO ? 'Confirmar Retiro' :
                 m.estado === EstadoManifiesto.EN_TRANSITO ? 'Viaje en Curso' :
                 m.estado === EstadoManifiesto.ENTREGADO ? 'Entrega Completada' : 'Viaje'}
              </h1>
            </div>
          </div>
          {m.estado === EstadoManifiesto.EN_TRANSITO && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${viajeStatus === 'ACTIVO' ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-warning-50 text-warning-700 border border-warning-200'}`}>
              <Radio size={14} className={viajeStatus === 'ACTIVO' ? 'animate-pulse' : ''} />
              <span className="text-xs font-semibold">{viajeStatus === 'ACTIVO' ? 'Activo' : 'Pausado'}</span>
            </div>
          )}
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* APROBADO state: Show confirm pickup */}
        {m.estado === EstadoManifiesto.APROBADO && (
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
                  <p className="text-sm text-neutral-600">Residuos: <span className="font-semibold">{m.residuos?.length || 0} items</span> — {formatWeight(totalPeso)}</p>
                </div>
              </CardContent>
            </Card>
            <Button
              fullWidth
              size="lg"
              onClick={handleConfirmarRetiro}
              disabled={isActionPending}
              leftIcon={confirmarRetiro.isPending ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
            >
              Confirmar Retiro
            </Button>
          </>
        )}

        {/* EN_TRANSITO state: Active trip */}
        {m.estado === EstadoManifiesto.EN_TRANSITO && (
          <>
            {/* GPS Status Panel — FIX 1D: Always visible */}
            <GpsStatusPanel />

            {/* Timer */}
            <Card variant="elevated" className="bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="text-white/80" size={20} />
                  <span className="text-4xl font-bold tabular-nums text-white drop-shadow-sm">{formatTimer(elapsedTime)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/30">
                  <div className="text-center">
                    <p className="text-xs text-white/90 mb-1 font-medium tracking-wide">DESTINO</p>
                    <p className="text-sm font-bold text-white drop-shadow-sm">{m.operador?.razonSocial || '-'}</p>
                  </div>
                  <div className="text-center border-l border-white/30">
                    <p className="text-xs text-white/90 mb-1 font-medium tracking-wide">PESO TOTAL</p>
                    <p className="text-lg font-bold text-white drop-shadow-sm">{formatWeight(totalPeso)}</p>
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

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePausar}
                disabled={registrarIncidente.isPending}
                className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold border-2 transition-all disabled:opacity-50 ${viajeStatus === 'ACTIVO' ? 'bg-warning-50 text-warning-700 border-warning-200' : 'bg-success-50 text-success-700 border-success-200'}`}
              >
                {registrarIncidente.isPending ? <Loader2 size={20} className="animate-spin" /> : viajeStatus === 'ACTIVO' ? <Pause size={20} /> : <Play size={20} />}
                {viajeStatus === 'ACTIVO' ? 'Pausar' : 'Reanudar'}
              </button>
              <button onClick={() => setShowIncidenteModal(true)} className="flex items-center justify-center gap-2 py-4 rounded-xl font-semibold bg-error-50 text-error-700 border-2 border-error-200 hover:bg-error-100">
                <AlertTriangle size={20} /> Incidente
              </button>
            </div>

            <Button fullWidth onClick={() => setShowFinalizarModal(true)} disabled={isActionPending}>
              <CheckCircle2 size={20} className="mr-2 flex-shrink-0" />
              <span>Confirmar Entrega</span>
            </Button>

            {/* Toggle map/events */}
            <div className="flex bg-neutral-100 rounded-xl p-1">
              <button onClick={() => setVistaMapa(false)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${!vistaMapa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}>
                <List size={16} /> Eventos
              </button>
              <button onClick={() => setVistaMapa(true)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${vistaMapa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}>
                <MapIcon size={16} /> Mapa
              </button>
            </div>

            {/* Map or events */}
            {vistaMapa ? (
              <div className="relative z-0">
                <Card className="overflow-hidden p-0 border-2 border-neutral-200">
                  <div className="h-64 relative isolate">
                    <MapContainer
                      center={mapCenter}
                      zoom={13}
                      style={{ height: '100%', width: '100%', zIndex: 0 }}
                      className="z-0"
                    >
                      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {trackPoints.length > 1 && <Polyline positions={trackPoints} color="#0D8A4F" weight={4} opacity={0.8} />}
                      {currentPosition && <Marker position={currentPosition} icon={ACTOR_ICONS.enTransito}><Popup>Tu posición actual</Popup></Marker>}
                      <RecenterMap position={currentPosition} />
                    </MapContainer>
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
              {(m.residuos || []).map((r: any) => (
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
      {showFinalizarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-success-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Confirmar Entrega?</h3>
              <p className="text-neutral-600 text-sm mb-4">Se confirmará la entrega en {m.operador?.razonSocial || 'destino'}</p>
              {currentPosition && (
                <p className="text-xs text-neutral-400 mb-4">
                  Ubicación: {currentPosition[0].toFixed(4)}, {currentPosition[1].toFixed(4)}
                </p>
              )}
              <div className="space-y-3">
                <Button fullWidth onClick={handleConfirmarEntrega} disabled={confirmarEntrega.isPending}>
                  {confirmarEntrega.isPending ? 'Confirmando...' : 'Sí, Confirmar Entrega'}
                </Button>
                <Button variant="outline" fullWidth onClick={() => setShowFinalizarModal(false)} disabled={confirmarEntrega.isPending}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Incidente — FIX 4B: proper select + description handling */}
      {showIncidenteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-error-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Reportar Incidente</h3>
              </div>
              <div className="space-y-3 mb-4">
                {/* Incident type buttons instead of native select */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Tipo de incidente</label>
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
                        onClick={() => setIncidenteTipo(opt.value)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-medium border-2 transition-all ${
                          incidenteTipo === opt.value
                            ? 'border-error-500 bg-error-50 text-error-700'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción (opcional)</label>
                  <textarea
                    value={incidenteDescripcion}
                    onChange={(e) => setIncidenteDescripcion(e.target.value)}
                    placeholder="Describe el incidente..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none text-sm"
                  />
                </div>
                {currentPosition && gpsStatus === 'active' && (
                  <p className="text-xs text-neutral-400 flex items-center gap-1">
                    <MapPin size={12} /> Se adjuntará la ubicación actual al incidente
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Button fullWidth onClick={handleRegistrarIncidente} disabled={registrarIncidente.isPending}>
                  {registrarIncidente.isPending ? 'Registrando...' : 'Registrar Incidente'}
                </Button>
                <Button variant="outline" fullWidth onClick={() => { setShowIncidenteModal(false); setIncidenteTipo(''); setIncidenteDescripcion(''); }} disabled={registrarIncidente.isPending}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ViajeEnCursoTransportista;
