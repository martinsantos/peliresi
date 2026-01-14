/**
 * useTripTracking - Hook para tracking de viajes con GPS
 *
 * REFACTORIZADO - FASE 1, 2, 3:
 * - Timer basado en timestamp (persiste al cerrar app)
 * - GPS con watchPosition (tracking continuo)
 * - Persistencia en IndexedDB (activeTrip)
 * - Restauración automática de viaje interrumpido
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { GPSPosition, RoutePoint, TripEvent, SavedTrip } from '../types/mobile.types';
import { analyticsService } from '../services/analytics.service';
import { manifiestoService } from '../services/manifiesto.service';
import { offlineStorage, type ActiveTrip } from '../services/offlineStorage';
import { viajesService } from '../services/viajes.service';

const TRIPS_STORAGE_KEY = 'sitrep_trips';
const AUTO_SAVE_INTERVAL_MS = 10000; // Auto-guardar cada 10 segundos
const MIN_DISTANCE_METERS = 10; // Distancia mínima entre puntos GPS

// GPS Status types
export type GPSStatus = 'active' | 'acquiring' | 'permission_denied' | 'unavailable' | 'timeout' | 'weak' | 'lost';

// Helper: Calcular distancia total de la ruta en km (fórmula Haversine)
function calcularDistanciaTotal(ruta: RoutePoint[]): number {
    if (ruta.length < 2) return 0;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    let total = 0;

    for (let i = 1; i < ruta.length; i++) {
        const lat1 = ruta[i - 1].lat;
        const lon1 = ruta[i - 1].lng;
        const lat2 = ruta[i].lat;
        const lon2 = ruta[i].lng;

        const R = 6371; // Radio de la Tierra en km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        total += R * c;
    }

    return Math.round(total * 100) / 100;
}

// Helper: Calcular distancia entre dos puntos en metros
function distanceBetween(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000; // Radio en metros
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lng - p1.lng);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

interface UseTripTrackingOptions {
    role?: string;
    manifiestoId?: string;
    onToast?: (message: string) => void;
}

interface UseTripTrackingReturn {
    // Trip state
    viajeActivo: boolean;
    viajePausado: boolean;
    tiempoViaje: number;
    viajeInicio: Date | null;
    viajeEventos: TripEvent[];
    viajeRuta: RoutePoint[];

    // GPS state
    gpsPosition: GPSPosition | null;
    gpsAvailable: boolean;
    gpsStatus: GPSStatus;
    gpsAccuracy: number | null;
    lastGPSUpdate: Date | null;

    // Saved trips
    savedTrips: SavedTrip[];

    // Actions
    iniciarViaje: () => Promise<boolean>;
    finalizarViaje: () => Promise<void>;
    registrarIncidente: (descripcion: string) => void;
    registrarParada: (descripcion?: string) => void;
    reanudarViaje: () => void;
    loadSavedTrips: () => void;
    restoreFromSaved: (savedTrip: ActiveTrip) => void;
    requestGPSPermission: () => Promise<boolean>;
    sincronizarConBackend: (manifiesto: any) => void;

    // Utilities
    formatTime: (seconds: number) => string;
}

// Helper: Register background sync
async function registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const reg = await navigator.serviceWorker.ready;
            await (reg as any).sync.register('sitrep-gps-sync');
            console.log('[GPS] Background sync registered');
        } catch (e) {
            console.warn('[GPS] Background sync registration failed:', e);
        }
    }
}

export function useTripTracking({ role, manifiestoId, onToast }: UseTripTrackingOptions = {}): UseTripTrackingReturn {
    // ============ TIMESTAMP-BASED TIMER (FASE 1) ============
    const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
    const [pausedAt, setPausedAt] = useState<number | null>(null);
    const [totalPausedMs, setTotalPausedMs] = useState(0);
    const [tick, setTick] = useState(0); // Tick para forzar recálculo del timer

    // Trip state
    const [viajeActivo, setViajeActivo] = useState(false);
    const [viajePausado, setViajePausado] = useState(false);
    const [viajeInicio, setViajeInicio] = useState<Date | null>(null);
    const [viajeEventos, setViajeEventos] = useState<TripEvent[]>([]);
    const [viajeRuta, setViajeRuta] = useState<RoutePoint[]>([]);

    // GPS state (FASE 2 mejorado)
    const [gpsPosition, setGpsPosition] = useState<GPSPosition | null>(null);
    const [gpsAvailable, setGpsAvailable] = useState(false);
    const [gpsStatus, setGpsStatus] = useState<GPSStatus>('acquiring');
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [lastGPSUpdate, setLastGPSUpdate] = useState<Date | null>(null);

    // Saved trips
    const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);

    // Refs
    const viajeRutaRef = useRef<RoutePoint[]>([]);
    const viajeEventosRef = useRef<TripEvent[]>([]);
    const watchIdRef = useRef<number | null>(null);
    const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastPointRef = useRef<RoutePoint | null>(null);
    const tripIdRef = useRef<string | null>(null);
    const gpsRetryCountRef = useRef(0); // Contador de reintentos GPS
    const gpsRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const MAX_GPS_RETRIES = 5;

    const showToast = useCallback((msg: string) => {
        onToast?.(msg);
    }, [onToast]);

    // ============ TIMER CALCULADO (no contador) ============
    // tick se incluye en dependencias para forzar recálculo cada segundo
    const tiempoViaje = useMemo(() => {
        if (!startTimestamp) return 0;
        const now = pausedAt || Date.now();
        return Math.floor((now - startTimestamp - totalPausedMs) / 1000);
    }, [startTimestamp, pausedAt, totalPausedMs, tick]);

    // Format time helper
    const formatTime = useCallback((seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // ============ GPS PERMISSION REQUEST (FASE 2) ============
    const requestGPSPermission = useCallback(async (): Promise<boolean> => {
        if (!('geolocation' in navigator)) {
            showToast('GPS no disponible en este dispositivo');
            setGpsStatus('unavailable');
            return false;
        }

        // Check permission state if available
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                if (permission.state === 'denied') {
                    showToast('GPS denegado. Active en Configuración > Ubicación');
                    setGpsStatus('permission_denied');
                    return false;
                }
            } catch (e) {
                // Some browsers don't support permissions API
                console.warn('[GPS] Permissions API not supported');
            }
        }

        return new Promise((resolve) => {
            setGpsStatus('acquiring');
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setGpsAvailable(true);
                    setGpsStatus('active');
                    setGpsPosition({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                    setGpsAccuracy(pos.coords.accuracy);
                    setLastGPSUpdate(new Date());
                    resolve(true);
                },
                (error) => {
                    console.warn('[GPS] Permission request failed:', error.message);
                    switch (error.code) {
                        case 1: // PERMISSION_DENIED
                            setGpsStatus('permission_denied');
                            showToast('GPS: Permiso denegado. Active ubicación.');
                            break;
                        case 2: // POSITION_UNAVAILABLE
                            setGpsStatus('unavailable');
                            showToast('GPS: Posición no disponible');
                            break;
                        case 3: // TIMEOUT
                            setGpsStatus('timeout');
                            showToast('GPS: Tiempo de espera agotado');
                            break;
                    }
                    resolve(false);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }, [showToast]);

    // ============ RESTART GPS WATCH (para reintentos) ============
    const restartGPSWatch = useCallback((highAccuracy: boolean = true) => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        if (!('geolocation' in navigator)) {
            setGpsStatus('unavailable');
            return;
        }

        console.log(`[GPS] Reiniciando watch (highAccuracy: ${highAccuracy}, retry: ${gpsRetryCountRef.current}/${MAX_GPS_RETRIES})`);
        setGpsStatus('acquiring');

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                // Reset retry counter on success
                gpsRetryCountRef.current = 0;

                const point: RoutePoint = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    timestamp: new Date().toISOString()
                };

                setGpsPosition({ lat: point.lat, lng: point.lng });
                setGpsAccuracy(pos.coords.accuracy);
                setGpsStatus(pos.coords.accuracy < 50 ? 'active' : 'weak');
                setLastGPSUpdate(new Date());
            },
            (error) => {
                // Esta función se define después, pero se llamará correctamente
                console.warn('[GPS] Error en watch reiniciado:', error.code, error.message);
            },
            {
                enableHighAccuracy: highAccuracy,
                timeout: highAccuracy ? 10000 : 20000,
                maximumAge: 0
            }
        );
    }, []);

    // ============ GPS ERROR HANDLER (FASE 2 - CON REINTENTOS) ============
    const handleGPSError = useCallback((error: GeolocationPositionError) => {
        console.warn('[GPS] Error:', error.code, error.message);

        // Limpiar timeout previo si existe
        if (gpsRetryTimeoutRef.current) {
            clearTimeout(gpsRetryTimeoutRef.current);
            gpsRetryTimeoutRef.current = null;
        }

        switch (error.code) {
            case 1: // PERMISSION_DENIED
                setGpsStatus('permission_denied');
                showToast('GPS: Permiso denegado. Active ubicación en Configuración.');
                gpsRetryCountRef.current = MAX_GPS_RETRIES; // No reintentar
                break;
            case 2: // POSITION_UNAVAILABLE
            case 3: // TIMEOUT
                gpsRetryCountRef.current++;
                if (gpsRetryCountRef.current < MAX_GPS_RETRIES) {
                    setGpsStatus('acquiring');
                    console.log(`[GPS] Reintentando (${gpsRetryCountRef.current}/${MAX_GPS_RETRIES})...`);
                    // Reintentar después de 3 segundos con menor precisión
                    gpsRetryTimeoutRef.current = setTimeout(() => {
                        restartGPSWatch(gpsRetryCountRef.current < 2); // Primeros 2 con alta precisión
                    }, 3000);
                } else {
                    setGpsStatus('lost');
                    showToast('GPS: Sin señal. Verifique que la ubicación está activa.');
                }
                break;
        }
    }, [showToast, restartGPSWatch]);

    // ============ CHECK GPS ON MOUNT ============
    useEffect(() => {
        if ('geolocation' in navigator) {
            setGpsAvailable(true);
            setGpsStatus('acquiring');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGpsPosition({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setGpsAccuracy(position.coords.accuracy);
                    setGpsStatus('active');
                    setLastGPSUpdate(new Date());
                },
                (error) => {
                    if (error.code === 1) {
                        setGpsStatus('permission_denied');
                    } else {
                        setGpsStatus('weak');
                    }
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setGpsStatus('unavailable');
        }
    }, []);

    // ============ LOAD SAVED TRIPS ============
    const loadSavedTrips = useCallback(() => {
        const trips = JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '[]');
        setSavedTrips(trips);
    }, []);

    useEffect(() => {
        loadSavedTrips();
    }, [loadSavedTrips]);

    // ============ TIMER UPDATE (cada segundo para UI) ============
    useEffect(() => {
        console.log('[Trip] Timer useEffect ejecutado:', { viajeActivo, viajePausado, startTimestamp });

        if (viajeActivo && !viajePausado) {
            console.log('[Trip] INICIANDO TIMER INTERVAL');
            timerIntervalRef.current = setInterval(() => {
                setTick(t => {
                    if (t % 5 === 0) { // Log cada 5 segundos para no saturar
                        console.log('[Trip] Timer tick:', t + 1);
                    }
                    return t + 1;
                });
            }, 1000);
        }
        return () => {
            if (timerIntervalRef.current) {
                console.log('[Trip] Timer CLEANUP - limpiando interval');
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [viajeActivo, viajePausado, startTimestamp]);

    // ============ watchPosition GPS TRACKING (FASE 2) ============
    // CORRECCIÓN v7.3: Solo activar GPS para TRANSPORTISTA
    useEffect(() => {
        // Solo TRANSPORTISTA necesita GPS tracking activo
        if (role !== 'TRANSPORTISTA') {
            return;
        }

        if (!viajeActivo || viajePausado) {
            // Limpiar watch y timeouts cuando no hay viaje activo o está pausado
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
                console.log('[GPS] Watch cleared (viaje pausado o inactivo)');
            }
            if (gpsRetryTimeoutRef.current) {
                clearTimeout(gpsRetryTimeoutRef.current);
                gpsRetryTimeoutRef.current = null;
            }
            return;
        }

        if (!('geolocation' in navigator)) {
            setGpsStatus('unavailable');
            return;
        }

        console.log('[GPS] Iniciando watchPosition...');
        setGpsStatus('acquiring');
        gpsRetryCountRef.current = 0; // Resetear contador al iniciar nuevo watch

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (pos) => {
                // Resetear contador de reintentos en éxito
                gpsRetryCountRef.current = 0;

                const point: RoutePoint = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    timestamp: new Date().toISOString()
                };

                setGpsPosition({ lat: point.lat, lng: point.lng });
                setGpsAccuracy(pos.coords.accuracy);
                setGpsStatus(pos.coords.accuracy < 50 ? 'active' : 'weak');
                setLastGPSUpdate(new Date());

                // Filtrar por distancia mínima para evitar ruido GPS
                const shouldAdd = !lastPointRef.current ||
                    distanceBetween(lastPointRef.current, point) >= MIN_DISTANCE_METERS;

                if (shouldAdd) {
                    lastPointRef.current = point;
                    viajeRutaRef.current = [...viajeRutaRef.current, point];
                    setViajeRuta([...viajeRutaRef.current]);

                    // Guardar en IndexedDB (offline-first)
                    if (manifiestoId) {
                        try {
                            await offlineStorage.saveGPSPoint({
                                manifiestoId,
                                latitud: point.lat,
                                longitud: point.lng,
                                velocidad: pos.coords.speed || undefined,
                                precision: pos.coords.accuracy || undefined
                            });

                            // Si online, intentar enviar al backend
                            if (navigator.onLine) {
                                try {
                                    await manifiestoService.actualizarUbicacion(manifiestoId, {
                                        latitud: point.lat,
                                        longitud: point.lng
                                    });
                                } catch (err) {
                                    console.warn('[GPS] Error enviando al backend:', err);
                                    registerBackgroundSync();
                                }
                            }
                        } catch (err) {
                            console.error('[GPS] Error guardando punto:', err);
                        }
                    }
                }
            },
            handleGPSError,
            {
                enableHighAccuracy: true,
                timeout: 15000,      // Timeout más largo
                maximumAge: 5000     // Cache de 5s para batería
            }
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
                console.log('[GPS] Watch cleanup');
            }
            if (gpsRetryTimeoutRef.current) {
                clearTimeout(gpsRetryTimeoutRef.current);
                gpsRetryTimeoutRef.current = null;
            }
        };
    }, [viajeActivo, viajePausado, manifiestoId, handleGPSError, role]);

    // ============ AUTO-SAVE TO IndexedDB (FASE 1) ============
    // CORRECCIÓN v7.3: Solo auto-save para TRANSPORTISTA
    useEffect(() => {
        // Solo TRANSPORTISTA guarda datos de viaje
        if (role !== 'TRANSPORTISTA') {
            return;
        }

        if (!viajeActivo) {
            if (autoSaveIntervalRef.current) {
                clearInterval(autoSaveIntervalRef.current);
                autoSaveIntervalRef.current = null;
            }
            return;
        }

        // Guardar inmediatamente al iniciar
        const saveTrip = async () => {
            if (!tripIdRef.current || !startTimestamp) return;

            try {
                await offlineStorage.updateActiveTrip({
                    routePoints: viajeRutaRef.current,
                    events: viajeEventosRef.current,
                    isPaused: viajePausado,
                    pausedAt: pausedAt,
                    totalPausedMs: totalPausedMs
                });
                console.log('[Trip] Auto-saved to IndexedDB');
            } catch (err) {
                console.error('[Trip] Error auto-saving:', err);
            }
        };

        // Auto-guardar cada 10 segundos
        autoSaveIntervalRef.current = setInterval(saveTrip, AUTO_SAVE_INTERVAL_MS);

        return () => {
            if (autoSaveIntervalRef.current) {
                clearInterval(autoSaveIntervalRef.current);
                autoSaveIntervalRef.current = null;
            }
        };
    }, [viajeActivo, viajePausado, pausedAt, totalPausedMs, startTimestamp, role]);

    // ============ RESTORE FROM SAVED (FASE 3) ============
    const restoreFromSaved = useCallback((savedTrip: ActiveTrip) => {
        console.log('[Trip] Restaurando viaje:', savedTrip.id);

        tripIdRef.current = savedTrip.id;
        setStartTimestamp(savedTrip.startTimestamp);
        setPausedAt(savedTrip.pausedAt);
        setTotalPausedMs(savedTrip.totalPausedMs);
        setViajeActivo(true);
        setViajePausado(savedTrip.isPaused);
        setViajeInicio(new Date(savedTrip.startTimestamp));
        setViajeEventos(savedTrip.events);
        viajeEventosRef.current = savedTrip.events;
        setViajeRuta(savedTrip.routePoints);
        viajeRutaRef.current = savedTrip.routePoints;

        if (savedTrip.routePoints.length > 0) {
            lastPointRef.current = savedTrip.routePoints[savedTrip.routePoints.length - 1];
        }

        showToast('Viaje restaurado correctamente');
    }, [showToast]);

    // ============ SINCRONIZAR CON BACKEND (v7.7) ============
    // Cuando hay un manifiesto EN_TRANSITO en el backend pero no hay viaje local activo,
    // este método inicializa el hook usando la fecha de inicio de transporte del manifiesto
    const sincronizarConBackend = useCallback((manifiesto: any) => {
        console.log('[Trip] v7.7 SYNC INICIO - manifiesto:', manifiesto.id);
        console.log('[Trip] v7.7 Datos manifiesto:', {
            inicioTransporte: manifiesto.inicioTransporte,
            fechaRetiro: manifiesto.fechaRetiro,
            updatedAt: manifiesto.updatedAt,
            createdAt: manifiesto.createdAt,
            estado: manifiesto.estado
        });

        // CORRECCIÓN v7.7: Usar inicioTransporte como campo prioritario
        const fechaInicio = manifiesto.inicioTransporte || manifiesto.fechaRetiro || manifiesto.updatedAt || manifiesto.createdAt;
        let inicio = fechaInicio ? new Date(fechaInicio).getTime() : Date.now();

        // FIX v7.7: Limitar el timestamp de inicio a máximo 8 horas atrás
        // Si el manifiesto tiene una fecha muy antigua, el timer mostraría 650+ horas
        const MAX_TRIP_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas máximo
        const ahora = Date.now();
        if (ahora - inicio > MAX_TRIP_DURATION_MS) {
            console.log('[Trip] v7.7 FIX: Timestamp muy antiguo, usando máximo 8h atrás');
            inicio = ahora - MAX_TRIP_DURATION_MS;
        }

        console.log('[Trip] v7.7 Timestamp calculado:', {
            fechaInicio,
            inicioOriginal: fechaInicio ? new Date(fechaInicio).getTime() : 'N/A',
            inicio,
            inicioDate: new Date(inicio).toISOString(),
            ahora,
            diferencia: Math.floor((ahora - inicio) / 1000) + ' segundos (máx 8h)'
        });

        const tripId = `trip_backend_${manifiesto.id}`;
        tripIdRef.current = tripId;

        setStartTimestamp(inicio);
        setPausedAt(null);
        setTotalPausedMs(0);
        setViajeActivo(true);  // CRÍTICO: Esto activa el timer useEffect
        setViajePausado(false);
        setViajeInicio(new Date(inicio));
        viajeRutaRef.current = [];
        setViajeRuta([]);
        lastPointRef.current = null;

        const syncEvento: TripEvent = {
            tipo: 'INICIO',
            descripcion: 'Viaje sincronizado desde servidor',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };

        setViajeEventos([syncEvento]);
        viajeEventosRef.current = [syncEvento];

        // CORRECCIÓN v7.3: Solo guardar en IndexedDB para TRANSPORTISTA
        if (role === 'TRANSPORTISTA') {
            offlineStorage.saveActiveTrip({
                id: tripId,
                manifiestoId: manifiesto.id,
                startTimestamp: inicio,
                pausedAt: null,
                totalPausedMs: 0,
                events: [syncEvento],
                routePoints: [],
                isPaused: false,
                role: role
            }).catch(err => console.error('[Trip] Error guardando sync:', err));
        }

        console.log('[Trip] v5.1 SYNC COMPLETO - Estados establecidos:', {
            viajeActivo: true,
            startTimestamp: inicio,
            tiempoEsperado: Math.floor((Date.now() - inicio) / 1000) + ' segundos'
        });

        showToast('🔄 Viaje sincronizado');
    }, [gpsPosition, role, showToast]);

    // ============ INICIAR VIAJE ============
    const iniciarViaje = useCallback(async (): Promise<boolean> => {
        // Verificar GPS primero
        const hasGPS = await requestGPSPermission();
        if (!hasGPS) {
            // Permitir iniciar sin GPS pero advertir
            const continueWithoutGPS = window.confirm(
                'GPS no disponible. ¿Desea iniciar el viaje sin tracking GPS?'
            );
            if (!continueWithoutGPS) {
                return false;
            }
        }

        const inicio = Date.now();
        const tripId = `trip_${inicio}`;
        tripIdRef.current = tripId;

        setStartTimestamp(inicio);
        setPausedAt(null);
        setTotalPausedMs(0);
        setViajeActivo(true);
        setViajePausado(false);
        setViajeInicio(new Date(inicio));
        viajeRutaRef.current = [];
        setViajeRuta([]);
        lastPointRef.current = null;

        const inicioEvento: TripEvent = {
            tipo: 'INICIO',
            descripcion: 'Viaje iniciado',
            timestamp: new Date(inicio).toISOString(),
            gps: gpsPosition
        };

        setViajeEventos([inicioEvento]);
        viajeEventosRef.current = [inicioEvento];

        // Guardar en IndexedDB inmediatamente
        try {
            await offlineStorage.saveActiveTrip({
                id: tripId,
                manifiestoId: manifiestoId || '',
                startTimestamp: inicio,
                pausedAt: null,
                totalPausedMs: 0,
                events: [inicioEvento],
                routePoints: [],
                isPaused: false,
                role: role
            });
            console.log('[Trip] Viaje guardado en IndexedDB');
        } catch (err) {
            console.error('[Trip] Error guardando viaje:', err);
        }

        showToast(hasGPS ? '🚛 Viaje iniciado - GPS activo' : '🚛 Viaje iniciado - Sin GPS');
        analyticsService.trackAction('iniciar_viaje', 'viaje', role);

        return true;
    }, [gpsPosition, manifiestoId, role, showToast, requestGPSPermission]);

    // ============ FINALIZAR VIAJE ============
    const finalizarViaje = useCallback(async () => {
        const finEvento: TripEvent = {
            tipo: 'FIN',
            descripcion: 'Viaje finalizado',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };

        const eventosFinales = [...viajeEventosRef.current, finEvento];
        const rutaFinal = viajeRutaRef.current;
        const distanciaKm = calcularDistanciaTotal(rutaFinal);

        const tripData: SavedTrip = {
            id: tripIdRef.current || Date.now().toString(),
            inicio: viajeInicio?.toISOString() || '',
            fin: finEvento.timestamp,
            duracion: tiempoViaje,
            eventos: eventosFinales,
            ruta: rutaFinal,
            role: role || ''
        };

        // Guardar localmente
        const existingTrips = JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '[]');
        existingTrips.push(tripData);
        localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(existingTrips));
        setSavedTrips(existingTrips);

        // Sincronizar con backend
        if (manifiestoId) {
            const syncData = {
                manifiestoId,
                inicio: viajeInicio?.toISOString() || new Date().toISOString(),
                fin: finEvento.timestamp,
                duracion: tiempoViaje,
                distancia: distanciaKm,
                ruta: rutaFinal.map(p => ({
                    lat: p.lat,
                    lng: p.lng,
                    timestamp: p.timestamp
                })),
                eventos: eventosFinales.map(e => ({
                    tipo: e.tipo,
                    descripcion: e.descripcion,
                    timestamp: e.timestamp,
                    lat: e.gps?.lat,
                    lng: e.gps?.lng
                })),
                appVersion: '2.1.0'
            };

            if (navigator.onLine) {
                try {
                    await viajesService.syncViaje(syncData);
                    showToast(`✅ Viaje sincronizado - ${distanciaKm} km, ${rutaFinal.length} puntos GPS`);
                } catch (err) {
                    await offlineStorage.queueOperation({
                        tipo: 'CREATE',
                        method: 'POST',
                        endpoint: '/api/viajes/sync',
                        datos: syncData
                    });
                    showToast(`✅ Viaje guardado offline - se sincronizará después`);
                    registerBackgroundSync();
                }
            } else {
                await offlineStorage.queueOperation({
                    tipo: 'CREATE',
                    method: 'POST',
                    endpoint: '/api/viajes/sync',
                    datos: syncData
                });
                showToast(`✅ Viaje guardado offline - ${distanciaKm} km`);
                registerBackgroundSync();
            }
        } else {
            showToast(`✅ Viaje guardado - ${eventosFinales.length} eventos, ${rutaFinal.length} puntos GPS`);
        }

        // Limpiar viaje activo de IndexedDB
        try {
            await offlineStorage.clearActiveTrip();
        } catch (err) {
            console.error('[Trip] Error limpiando viaje activo:', err);
        }

        // Reset state
        tripIdRef.current = null;
        setStartTimestamp(null);
        setPausedAt(null);
        setTotalPausedMs(0);
        setViajeActivo(false);
        setViajePausado(false);
        setViajeEventos([]);
        viajeEventosRef.current = [];
        viajeRutaRef.current = [];
        setViajeRuta([]);
        setViajeInicio(null);
        lastPointRef.current = null;

        analyticsService.trackAction('finalizar_viaje', 'viaje', role, tripData);
    }, [gpsPosition, viajeInicio, tiempoViaje, role, manifiestoId, showToast]);

    // ============ REGISTRAR INCIDENTE ============
    const registrarIncidente = useCallback((descripcion: string) => {
        const incidentEvento: TripEvent = {
            tipo: 'INCIDENTE',
            descripcion,
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        setViajeEventos(prev => [...prev, incidentEvento]);
        viajeEventosRef.current = [...viajeEventosRef.current, incidentEvento];
        showToast('⚠️ INCIDENTE REGISTRADO');
        analyticsService.trackAction('registrar_incidente', 'viaje', role, incidentEvento);
    }, [gpsPosition, role, showToast]);

    // ============ REGISTRAR PARADA (PAUSA) ============
    const registrarParada = useCallback((descripcion?: string) => {
        const now = Date.now();
        const paradaEvento: TripEvent = {
            tipo: 'PARADA',
            descripcion: descripcion || 'Parada programada',
            timestamp: new Date(now).toISOString(),
            gps: gpsPosition
        };

        setViajeEventos(prev => [...prev, paradaEvento]);
        viajeEventosRef.current = [...viajeEventosRef.current, paradaEvento];
        setViajePausado(true);
        setPausedAt(now);

        // Actualizar en IndexedDB
        offlineStorage.updateActiveTrip({
            events: viajeEventosRef.current,
            isPaused: true,
            pausedAt: now
        }).catch(console.error);

        showToast('⏸️ VIAJE EN PAUSA');
        analyticsService.trackAction('registrar_parada', 'viaje', role, paradaEvento);
    }, [gpsPosition, role, showToast]);

    // ============ REANUDAR VIAJE ============
    const reanudarViaje = useCallback(() => {
        const now = Date.now();
        const reanudacionEvento: TripEvent = {
            tipo: 'REANUDACION',
            descripcion: 'Viaje reanudado',
            timestamp: new Date(now).toISOString(),
            gps: gpsPosition
        };

        // Calcular tiempo pausado
        const pauseDuration = pausedAt ? now - pausedAt : 0;
        const newTotalPaused = totalPausedMs + pauseDuration;

        setViajeEventos(prev => [...prev, reanudacionEvento]);
        viajeEventosRef.current = [...viajeEventosRef.current, reanudacionEvento];
        setViajePausado(false);
        setPausedAt(null);
        setTotalPausedMs(newTotalPaused);

        // Actualizar en IndexedDB
        offlineStorage.updateActiveTrip({
            events: viajeEventosRef.current,
            isPaused: false,
            pausedAt: null,
            totalPausedMs: newTotalPaused
        }).catch(console.error);

        showToast('▶️ VIAJE REANUDADO');
        analyticsService.trackAction('reanudar_viaje', 'viaje', role, reanudacionEvento);
    }, [gpsPosition, pausedAt, totalPausedMs, role, showToast]);

    return {
        viajeActivo,
        viajePausado,
        tiempoViaje,
        viajeInicio,
        viajeEventos,
        viajeRuta,
        gpsPosition,
        gpsAvailable,
        gpsStatus,
        gpsAccuracy,
        lastGPSUpdate,
        savedTrips,
        iniciarViaje,
        finalizarViaje,
        registrarIncidente,
        registrarParada,
        reanudarViaje,
        loadSavedTrips,
        restoreFromSaved,
        requestGPSPermission,
        sincronizarConBackend,
        formatTime,
    };
}
