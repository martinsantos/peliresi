/**
 * useTripTracking - Hook for GPS trip tracking
 * Extracted from MobileApp.tsx (lines 47-211, 379-534)
 * Handles trip state, GPS tracking, events, and route recording
 *
 * Enhanced features:
 * - Persistent trip state (survives page reload)
 * - Adaptive GPS frequency (15s moving, 60s stationary)
 * - Server sync for GPS positions
 * - Movement detection for battery optimization
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { GPSPosition, RoutePoint, TripEvent, SavedTrip } from '../types/mobile.types';
import { analyticsService } from '../services/analytics.service';

const TRIPS_STORAGE_KEY = 'sitrep_trips';
const ACTIVE_TRIP_KEY = 'sitrep_active_trip';
const GPS_INTERVAL_MOVING_MS = 15000; // 15 seconds when moving
const GPS_INTERVAL_STATIONARY_MS = 60000; // 60 seconds when stationary
const MOVEMENT_THRESHOLD_M = 10; // 10 meters to detect movement
const BATCH_SYNC_THRESHOLD = 10; // Sync after 10 GPS points

interface UseTripTrackingOptions {
    role?: string;
    manifiestoId?: string;
    onToast?: (message: string) => void;
    apiBaseUrl?: string;
}

interface ActiveTripState {
    viajeActivo: boolean;
    viajePausado: boolean;
    tiempoViaje: number;
    viajeInicio: string | null;
    viajeEventos: TripEvent[];
    viajeRuta: RoutePoint[];
    manifiestoId?: string;
    role?: string;
}

// Haversine formula to calculate distance between two GPS points in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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
    isMoving: boolean;
    pendingSyncCount: number;

    // Saved trips
    savedTrips: SavedTrip[];

    // Actions
    iniciarViaje: (manifiestoId?: string) => void;
    finalizarViaje: () => void;
    registrarIncidente: (descripcion: string) => void;
    registrarParada: (descripcion?: string) => void;
    reanudarViaje: () => void;
    loadSavedTrips: () => void;
    syncPendingPositions: () => Promise<void>;
    hasActiveTrip: () => boolean;
    recoverActiveTrip: () => boolean;

    // Utilities
    formatTime: (seconds: number) => string;
}

export function useTripTracking({ role, manifiestoId, onToast, apiBaseUrl }: UseTripTrackingOptions = {}): UseTripTrackingReturn {
    // Trip state
    const [viajeActivo, setViajeActivo] = useState(false);
    const [viajePausado, setViajePausado] = useState(false);
    const [tiempoViaje, setTiempoViaje] = useState(0);
    const [viajeInicio, setViajeInicio] = useState<Date | null>(null);
    const [viajeEventos, setViajeEventos] = useState<TripEvent[]>([]);
    const [viajeRuta, setViajeRuta] = useState<RoutePoint[]>([]);
    const [currentManifiestoId, setCurrentManifiestoId] = useState<string | undefined>(manifiestoId);

    // GPS state
    const [gpsPosition, setGpsPosition] = useState<GPSPosition | null>(null);
    const [gpsAvailable, setGpsAvailable] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    // Saved trips
    const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);

    // Refs for reliable tracking
    const viajeRutaRef = useRef<RoutePoint[]>([]);
    const intervalRef = useRef<number | null>(null);
    const gpsRouteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastPositionRef = useRef<GPSPosition | null>(null);
    const pendingPositionsRef = useRef<RoutePoint[]>([]);

    const showToast = useCallback((msg: string) => {
        onToast?.(msg);
    }, [onToast]);

    // Persist active trip state to localStorage
    const persistActiveTrip = useCallback(() => {
        if (viajeActivo) {
            const state: ActiveTripState = {
                viajeActivo,
                viajePausado,
                tiempoViaje,
                viajeInicio: viajeInicio?.toISOString() || null,
                viajeEventos,
                viajeRuta: viajeRutaRef.current,
                manifiestoId: currentManifiestoId,
                role
            };
            localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(state));
        } else {
            localStorage.removeItem(ACTIVE_TRIP_KEY);
        }
    }, [viajeActivo, viajePausado, tiempoViaje, viajeInicio, viajeEventos, currentManifiestoId, role]);

    // Persist on state changes
    useEffect(() => {
        persistActiveTrip();
    }, [persistActiveTrip]);

    // Check for active trip on mount
    const hasActiveTrip = useCallback((): boolean => {
        const saved = localStorage.getItem(ACTIVE_TRIP_KEY);
        return saved !== null;
    }, []);

    // Recover active trip from localStorage
    const recoverActiveTrip = useCallback((): boolean => {
        const saved = localStorage.getItem(ACTIVE_TRIP_KEY);
        if (saved) {
            try {
                const state: ActiveTripState = JSON.parse(saved);
                if (state.viajeActivo) {
                    setViajeActivo(true);
                    setViajePausado(state.viajePausado);
                    setViajeInicio(state.viajeInicio ? new Date(state.viajeInicio) : null);
                    setViajeEventos(state.viajeEventos);
                    viajeRutaRef.current = state.viajeRuta;
                    setViajeRuta(state.viajeRuta);
                    setCurrentManifiestoId(state.manifiestoId);

                    // Calculate elapsed time since last save
                    if (state.viajeInicio && !state.viajePausado) {
                        const elapsed = Math.floor((Date.now() - new Date(state.viajeInicio).getTime()) / 1000);
                        setTiempoViaje(elapsed);
                    } else {
                        setTiempoViaje(state.tiempoViaje);
                    }

                    showToast('🔄 Viaje activo recuperado');
                    return true;
                }
            } catch (e) {
                console.error('Error recovering active trip:', e);
                localStorage.removeItem(ACTIVE_TRIP_KEY);
            }
        }
        return false;
    }, [showToast]);

    // Sync pending GPS positions to server
    const syncPendingPositions = useCallback(async (): Promise<void> => {
        if (!navigator.onLine || pendingPositionsRef.current.length === 0) return;

        const positions = [...pendingPositionsRef.current];
        const manifId = currentManifiestoId;

        if (!manifId) {
            // No manifiesto, just clear pending
            pendingPositionsRef.current = [];
            setPendingSyncCount(0);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const baseUrl = apiBaseUrl || import.meta.env.VITE_API_URL || '';

            const response = await fetch(`${baseUrl}/api/sync/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    operations: positions.map(pos => ({
                        type: 'UPDATE_LOCATION',
                        timestamp: pos.timestamp,
                        data: {
                            manifiestoId: manifId,
                            latitud: pos.lat,
                            longitud: pos.lng,
                            velocidad: (pos as any).velocidad || null
                        }
                    }))
                })
            });

            if (response.ok) {
                // Clear synced positions
                pendingPositionsRef.current = [];
                setPendingSyncCount(0);
                console.log(`Synced ${positions.length} GPS positions`);
            }
        } catch (error) {
            console.warn('Error syncing GPS positions:', error);
            // Keep positions for retry
        }
    }, [currentManifiestoId, apiBaseUrl]);

    // Add position to pending sync queue
    const queuePositionForSync = useCallback((point: RoutePoint) => {
        pendingPositionsRef.current.push(point);
        setPendingSyncCount(pendingPositionsRef.current.length);

        // Auto-sync when threshold reached
        if (pendingPositionsRef.current.length >= BATCH_SYNC_THRESHOLD && navigator.onLine) {
            syncPendingPositions();
        }
    }, [syncPendingPositions]);

    // Listen for online event to sync
    useEffect(() => {
        const handleOnline = () => {
            if (pendingPositionsRef.current.length > 0) {
                syncPendingPositions();
            }
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [syncPendingPositions]);

    // Format time helper
    const formatTime = useCallback((seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Check GPS availability on mount
    useEffect(() => {
        if ('geolocation' in navigator) {
            setGpsAvailable(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGpsPosition({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => console.warn('GPS no accesible:', error.message),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, []);

    // Load saved trips from localStorage
    const loadSavedTrips = useCallback(() => {
        const trips = JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '[]');
        setSavedTrips(trips);
    }, []);

    // Load on mount
    useEffect(() => {
        loadSavedTrips();
    }, [loadSavedTrips]);

    // Timer for active trip
    useEffect(() => {
        if (viajeActivo && !viajePausado) {
            intervalRef.current = window.setInterval(() => {
                setTiempoViaje(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [viajeActivo, viajePausado]);

    // GPS Route Tracking with adaptive intervals
    useEffect(() => {
        if (viajeActivo && !viajePausado && 'geolocation' in navigator) {
            let currentInterval = GPS_INTERVAL_MOVING_MS;

            // Get initial position
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const point: RoutePoint = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        timestamp: new Date().toISOString()
                    };
                    setGpsPosition({ lat: point.lat, lng: point.lng });
                    lastPositionRef.current = { lat: point.lat, lng: point.lng };
                    viajeRutaRef.current = [point];
                    setViajeRuta([point]);
                    queuePositionForSync(point);
                },
                (err) => console.warn('GPS inicial error:', err.message),
                { enableHighAccuracy: true, timeout: 10000 }
            );

            // Adaptive GPS tracking function
            const trackPosition = () => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const newLat = pos.coords.latitude;
                        const newLng = pos.coords.longitude;
                        const point: RoutePoint = {
                            lat: newLat,
                            lng: newLng,
                            timestamp: new Date().toISOString()
                        };

                        // Detect movement
                        const lastPos = lastPositionRef.current;
                        let moving = false;
                        if (lastPos) {
                            const distance = calculateDistance(lastPos.lat, lastPos.lng, newLat, newLng);
                            moving = distance > MOVEMENT_THRESHOLD_M;
                        }

                        setIsMoving(moving);
                        setGpsPosition({ lat: newLat, lng: newLng });
                        lastPositionRef.current = { lat: newLat, lng: newLng };

                        // Only add point if moved significantly or every 5th stationary reading
                        if (moving || viajeRutaRef.current.length % 5 === 0) {
                            viajeRutaRef.current = [...viajeRutaRef.current, point];
                            setViajeRuta([...viajeRutaRef.current]);
                            queuePositionForSync(point);
                        }

                        // Adjust interval based on movement
                        const newInterval = moving ? GPS_INTERVAL_MOVING_MS : GPS_INTERVAL_STATIONARY_MS;
                        if (newInterval !== currentInterval) {
                            currentInterval = newInterval;
                            // Restart interval with new timing
                            if (gpsRouteIntervalRef.current) {
                                clearInterval(gpsRouteIntervalRef.current);
                            }
                            gpsRouteIntervalRef.current = setInterval(trackPosition, currentInterval);
                        }
                    },
                    (err) => console.warn('GPS tracking error:', err.message),
                    { enableHighAccuracy: true, timeout: 4000, maximumAge: 2000 }
                );
            };

            // Start periodic tracking
            gpsRouteIntervalRef.current = setInterval(trackPosition, currentInterval);
        }

        return () => {
            if (gpsRouteIntervalRef.current !== null) {
                clearInterval(gpsRouteIntervalRef.current);
                gpsRouteIntervalRef.current = null;
            }
        };
    }, [viajeActivo, viajePausado, queuePositionForSync]);

    // Actions
    const iniciarViaje = useCallback((tripManifiestoId?: string) => {
        const inicio = new Date();
        setViajeActivo(true);
        setViajePausado(false);
        setViajeInicio(inicio);
        viajeRutaRef.current = [];
        setViajeRuta([]);
        setTiempoViaje(0);
        setIsMoving(false);
        pendingPositionsRef.current = [];
        setPendingSyncCount(0);

        // Set manifiesto ID if provided
        if (tripManifiestoId) {
            setCurrentManifiestoId(tripManifiestoId);
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setGpsPosition(gps);
                lastPositionRef.current = gps;
                setViajeEventos([{
                    tipo: 'INICIO',
                    descripcion: tripManifiestoId ? `Viaje iniciado - Manifiesto ${tripManifiestoId}` : 'Viaje iniciado',
                    timestamp: inicio.toISOString(),
                    gps
                }]);
                showToast('🚛 Viaje iniciado - GPS activo');
            },
            () => {
                setViajeEventos([{
                    tipo: 'INICIO',
                    descripcion: tripManifiestoId ? `Viaje iniciado (sin GPS) - Manifiesto ${tripManifiestoId}` : 'Viaje iniciado (sin GPS)',
                    timestamp: inicio.toISOString(),
                    gps: null
                }]);
                showToast('🚛 Viaje iniciado - GPS no disponible');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );

        analyticsService.trackAction('iniciar_viaje', 'viaje', role, { manifiestoId: tripManifiestoId });
    }, [role, showToast]);

    const finalizarViaje = useCallback(() => {
        const finEvento: TripEvent = {
            tipo: 'FIN',
            descripcion: 'Viaje finalizado',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        
        const eventosFinales = [...viajeEventos, finEvento];
        const rutaFinal = viajeRutaRef.current.length > 0 ? viajeRutaRef.current : viajeRuta;
        
        const tripData: SavedTrip = {
            id: Date.now().toString(),
            inicio: viajeInicio?.toISOString() || '',
            fin: finEvento.timestamp,
            duracion: tiempoViaje,
            eventos: eventosFinales,
            ruta: rutaFinal,
            role: role || ''
        };
        
        const existingTrips = JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '[]');
        existingTrips.push(tripData);
        localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(existingTrips));
        setSavedTrips(existingTrips);
        
        // Reset state
        setViajeActivo(false);
        setViajePausado(false);
        setTiempoViaje(0);
        setViajeEventos([]);
        viajeRutaRef.current = [];
        setViajeRuta([]);
        setViajeInicio(null);
        
        showToast(`✅ Viaje guardado - ${eventosFinales.length} eventos, ${rutaFinal.length} puntos GPS`);
        analyticsService.trackAction('finalizar_viaje', 'viaje', role, tripData);
    }, [gpsPosition, viajeEventos, viajeInicio, tiempoViaje, viajeRuta, role, showToast]);

    const registrarIncidente = useCallback((descripcion: string) => {
        const incidentEvento: TripEvent = {
            tipo: 'INCIDENTE',
            descripcion,
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        setViajeEventos(prev => [...prev, incidentEvento]);
        showToast('⚠️ INCIDENTE REGISTRADO');
        analyticsService.trackAction('registrar_incidente', 'viaje', role, incidentEvento);
    }, [gpsPosition, role, showToast]);

    const registrarParada = useCallback((descripcion?: string) => {
        const paradaEvento: TripEvent = {
            tipo: 'PARADA',
            descripcion: descripcion || 'Parada programada',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        setViajeEventos(prev => [...prev, paradaEvento]);
        setViajePausado(true);
        showToast('⏸️ VIAJE EN PAUSA');
        analyticsService.trackAction('registrar_parada', 'viaje', role, paradaEvento);
    }, [gpsPosition, role, showToast]);

    const reanudarViaje = useCallback(() => {
        const reanudacionEvento: TripEvent = {
            tipo: 'REANUDACION',
            descripcion: 'Viaje reanudado',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        setViajeEventos(prev => [...prev, reanudacionEvento]);
        setViajePausado(false);
        showToast('▶️ VIAJE REANUDADO');
        analyticsService.trackAction('reanudar_viaje', 'viaje', role, reanudacionEvento);
    }, [gpsPosition, role, showToast]);

    return {
        // Trip state
        viajeActivo,
        viajePausado,
        tiempoViaje,
        viajeInicio,
        viajeEventos,
        viajeRuta,

        // GPS state
        gpsPosition,
        gpsAvailable,
        isMoving,
        pendingSyncCount,

        // Saved trips
        savedTrips,

        // Actions
        iniciarViaje,
        finalizarViaje,
        registrarIncidente,
        registrarParada,
        reanudarViaje,
        loadSavedTrips,
        syncPendingPositions,
        hasActiveTrip,
        recoverActiveTrip,

        // Utilities
        formatTime,
    };
}
