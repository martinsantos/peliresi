/**
 * useTripTracking - Hook for GPS trip tracking
 * Extracted from MobileApp.tsx (lines 47-211, 379-534)
 * Handles trip state, GPS tracking, events, and route recording
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { GPSPosition, RoutePoint, TripEvent, SavedTrip } from '../types/mobile.types';
import { analyticsService } from '../services/analytics.service';

const TRIPS_STORAGE_KEY = 'sitrep_trips';
const GPS_INTERVAL_MS = 30000; // 30 seconds

interface UseTripTrackingOptions {
    role?: string;
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

export function useTripTracking({ role, onToast }: UseTripTrackingOptions = {}): UseTripTrackingReturn {
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
            
            // Periodic GPS tracking
            gpsRouteIntervalRef.current = setInterval(() => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const point: RoutePoint = {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            timestamp: new Date().toISOString()
                        };
                        setGpsPosition({ lat: point.lat, lng: point.lng });
                        viajeRutaRef.current = [...viajeRutaRef.current, point];
                        setViajeRuta([...viajeRutaRef.current]);
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
    }, [viajeActivo, viajePausado]);

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
