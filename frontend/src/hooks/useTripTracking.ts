/**
 * useTripTracking - Hook for GPS trip tracking
 * Extracted from MobileApp.tsx (lines 47-211, 379-534)
 * Handles trip state, GPS tracking, events, and route recording
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { GPSPosition, RoutePoint, TripEvent, SavedTrip } from '../types/mobile.types';
import { analyticsService } from '../services/analytics.service';
import { manifiestoService } from '../services/manifiesto.service';
import { offlineStorage } from '../services/offlineStorage';
import { viajesService } from '../services/viajes.service';

const TRIPS_STORAGE_KEY = 'sitrep_trips';
const GPS_INTERVAL_MS = 30000; // 30 seconds

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

    return Math.round(total * 100) / 100; // Redondear a 2 decimales
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
    
    // Saved trips
    savedTrips: SavedTrip[];
    
    // Actions
    iniciarViaje: () => void;
    finalizarViaje: () => void;
    registrarIncidente: (descripcion: string) => void;
    registrarParada: (descripcion?: string) => void;
    reanudarViaje: () => void;
    loadSavedTrips: () => void;
    
    // Utilities
    formatTime: (seconds: number) => string;
}

// Helper: Register background sync for GPS data
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
    // Trip state
    const [viajeActivo, setViajeActivo] = useState(false);
    const [viajePausado, setViajePausado] = useState(false);
    const [tiempoViaje, setTiempoViaje] = useState(0);
    const [viajeInicio, setViajeInicio] = useState<Date | null>(null);
    const [viajeEventos, setViajeEventos] = useState<TripEvent[]>([]);
    const [viajeRuta, setViajeRuta] = useState<RoutePoint[]>([]);
    
    // GPS state
    const [gpsPosition, setGpsPosition] = useState<GPSPosition | null>(null);
    const [gpsAvailable, setGpsAvailable] = useState(false);
    
    // Saved trips
    const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
    
    // Refs for reliable tracking
    const viajeRutaRef = useRef<RoutePoint[]>([]);
    const intervalRef = useRef<number | null>(null);
    const gpsRouteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    const showToast = useCallback((msg: string) => {
        onToast?.(msg);
    }, [onToast]);

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

    // GPS Route Tracking
    useEffect(() => {
        if (viajeActivo && !viajePausado && 'geolocation' in navigator) {
            // Get initial position
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const point: RoutePoint = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        timestamp: new Date().toISOString()
                    };
                    setGpsPosition({ lat: point.lat, lng: point.lng });
                    viajeRutaRef.current = [point];
                    setViajeRuta([point]);
                },
                (err) => console.warn('GPS inicial error:', err.message),
                { enableHighAccuracy: true, timeout: 10000 }
            );
            
            // Periodic GPS tracking (Offline-First)
            gpsRouteIntervalRef.current = setInterval(() => {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const point: RoutePoint = {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            timestamp: new Date().toISOString()
                        };
                        setGpsPosition({ lat: point.lat, lng: point.lng });
                        viajeRutaRef.current = [...viajeRutaRef.current, point];
                        setViajeRuta([...viajeRutaRef.current]);

                        // OFFLINE-FIRST: Siempre guardar en IndexedDB primero
                        if (manifiestoId) {
                            try {
                                await offlineStorage.saveGPSPoint({
                                    manifiestoId,
                                    latitud: point.lat,
                                    longitud: point.lng,
                                    velocidad: pos.coords.speed || undefined,
                                    precision: pos.coords.accuracy || undefined
                                });
                                console.log('[GPS] Punto guardado en IndexedDB');

                                // Si estamos online, intentar enviar al backend
                                if (navigator.onLine) {
                                    try {
                                        await manifiestoService.actualizarUbicacion(manifiestoId, {
                                            latitud: point.lat,
                                            longitud: point.lng
                                        });
                                        console.log('[GPS] Punto enviado al backend');
                                    } catch (err) {
                                        console.warn('[GPS] Error enviando al backend, se sincronizará después:', err);
                                        // El Service Worker sincronizará cuando haya conexión
                                        registerBackgroundSync();
                                    }
                                } else {
                                    console.log('[GPS] Offline - se sincronizará cuando haya conexión');
                                    registerBackgroundSync();
                                }
                            } catch (err) {
                                console.error('[GPS] Error guardando en IndexedDB:', err);
                            }
                        }
                    },
                    (err) => console.warn('GPS tracking error:', err.message),
                    { enableHighAccuracy: true, timeout: 4000, maximumAge: 2000 }
                );
            }, GPS_INTERVAL_MS);
        }
        
        return () => {
            if (gpsRouteIntervalRef.current !== null) {
                clearInterval(gpsRouteIntervalRef.current);
                gpsRouteIntervalRef.current = null;
            }
        };
    }, [viajeActivo, viajePausado, manifiestoId]);

    // Actions
    const iniciarViaje = useCallback(() => {
        const inicio = new Date();
        setViajeActivo(true);
        setViajePausado(false);
        setViajeInicio(inicio);
        viajeRutaRef.current = [];
        setViajeRuta([]);
        setTiempoViaje(0);
        
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setGpsPosition(gps);
                setViajeEventos([{
                    tipo: 'INICIO',
                    descripcion: 'Viaje iniciado',
                    timestamp: inicio.toISOString(),
                    gps
                }]);
                showToast('🚛 Viaje iniciado - GPS activo');
            },
            () => {
                setViajeEventos([{
                    tipo: 'INICIO',
                    descripcion: 'Viaje iniciado (sin GPS)',
                    timestamp: inicio.toISOString(),
                    gps: null
                }]);
                showToast('🚛 Viaje iniciado - GPS no disponible');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
        
        analyticsService.trackAction('iniciar_viaje', 'viaje', role);
    }, [role, showToast]);

    const finalizarViaje = useCallback(async () => {
        const finEvento: TripEvent = {
            tipo: 'FIN',
            descripcion: 'Viaje finalizado',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };

        const eventosFinales = [...viajeEventos, finEvento];
        const rutaFinal = viajeRutaRef.current.length > 0 ? viajeRutaRef.current : viajeRuta;
        const distanciaKm = calcularDistanciaTotal(rutaFinal);

        const tripData: SavedTrip = {
            id: Date.now().toString(),
            inicio: viajeInicio?.toISOString() || '',
            fin: finEvento.timestamp,
            duracion: tiempoViaje,
            eventos: eventosFinales,
            ruta: rutaFinal,
            role: role || ''
        };

        // Guardar localmente primero (offline-first)
        const existingTrips = JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '[]');
        existingTrips.push(tripData);
        localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(existingTrips));
        setSavedTrips(existingTrips);

        // ===== SINCRONIZAR CON BACKEND =====
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
                appVersion: '2.0.0'
            };

            if (navigator.onLine) {
                try {
                    await viajesService.syncViaje(syncData);
                    console.log('[Viaje] Sincronizado con backend');
                    showToast(`✅ Viaje sincronizado - ${distanciaKm} km, ${rutaFinal.length} puntos GPS`);
                } catch (err) {
                    console.warn('[Viaje] Error al sincronizar, guardando para después:', err);
                    // Encolar para sync posterior
                    await offlineStorage.queueOperation({
                        tipo: 'CREATE',
                        method: 'POST',
                        endpoint: '/api/viajes/sync',
                        datos: syncData
                    });
                    showToast(`✅ Viaje guardado offline - se sincronizará cuando haya conexión`);
                    registerBackgroundSync();
                }
            } else {
                // Offline: encolar para sync
                await offlineStorage.queueOperation({
                    tipo: 'CREATE',
                    method: 'POST',
                    endpoint: '/api/viajes/sync',
                    datos: syncData
                });
                console.log('[Viaje] Guardado offline para sincronización posterior');
                showToast(`✅ Viaje guardado offline - ${distanciaKm} km`);
                registerBackgroundSync();
            }
        } else {
            showToast(`✅ Viaje guardado - ${eventosFinales.length} eventos, ${rutaFinal.length} puntos GPS`);
        }

        // Reset state
        setViajeActivo(false);
        setViajePausado(false);
        setTiempoViaje(0);
        setViajeEventos([]);
        viajeRutaRef.current = [];
        setViajeRuta([]);
        setViajeInicio(null);

        analyticsService.trackAction('finalizar_viaje', 'viaje', role, tripData);
    }, [gpsPosition, viajeEventos, viajeInicio, tiempoViaje, viajeRuta, role, manifiestoId, showToast]);

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
        viajeActivo,
        viajePausado,
        tiempoViaje,
        viajeInicio,
        viajeEventos,
        viajeRuta,
        gpsPosition,
        gpsAvailable,
        savedTrips,
        iniciarViaje,
        finalizarViaje,
        registrarIncidente,
        registrarParada,
        reanudarViaje,
        loadSavedTrips,
        formatTime,
    };
}
