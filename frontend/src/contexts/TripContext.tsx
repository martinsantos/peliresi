/**
 * TripContext - FASE 3 REFACTORIZADO
 * Context para estado del viaje activo
 * Incluye: persistencia, restauración, GPS mejorado
 */

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useTripTracking, type GPSStatus } from '../hooks/useTripTracking';
import { offlineStorage, type ActiveTrip } from '../services/offlineStorage';
import type { GPSPosition, RoutePoint, TripEvent, SavedTrip } from '../types/mobile.types';

interface TripContextValue {
    // Estado del viaje
    viajeActivo: boolean;
    viajePausado: boolean;
    tiempoViaje: number;
    viajeInicio: Date | null;
    viajeEventos: TripEvent[];
    viajeRuta: RoutePoint[];

    // Estado GPS (mejorado FASE 2)
    gpsPosition: GPSPosition | null;
    gpsAvailable: boolean;
    gpsStatus: GPSStatus;
    gpsAccuracy: number | null;
    lastGPSUpdate: Date | null;

    // Viajes guardados
    savedTrips: SavedTrip[];

    // Acciones (actualizadas)
    iniciarViaje: () => Promise<boolean>;
    finalizarViaje: () => Promise<void>;
    registrarIncidente: (descripcion: string) => void;
    registrarParada: (descripcion?: string) => void;
    reanudarViaje: () => void;
    loadSavedTrips: () => void;
    restoreFromSaved: (savedTrip: ActiveTrip) => void;
    requestGPSPermission: () => Promise<boolean>;

    // Configuracion
    setManifiestoId: (id: string | null) => void;
    setRole: (role: string | undefined) => void;

    // Utilidades
    formatTime: (seconds: number) => string;
    calcularDistancia: () => number;
    getGpsStatusSimple: () => 'active' | 'weak' | 'lost';

    // Estado de restauración (FASE 3)
    pendingRestore: ActiveTrip | null;
    clearPendingRestore: () => void;
    checkForActiveTrip: () => Promise<ActiveTrip | null>;
}

const TripContext = createContext<TripContextValue | null>(null);

interface TripProviderProps {
    children: React.ReactNode;
    onToast?: (message: string) => void;
}

export const TripProvider: React.FC<TripProviderProps> = ({ children, onToast }) => {
    const [manifiestoId, setManifiestoId] = useState<string | null>(null);
    const [role, setRole] = useState<string | undefined>(undefined);
    const [pendingRestore, setPendingRestore] = useState<ActiveTrip | null>(null);

    const trip = useTripTracking({
        role,
        manifiestoId: manifiestoId || undefined,
        onToast
    });

    // Verificar si hay viaje activo guardado al iniciar
    const checkForActiveTrip = useCallback(async (): Promise<ActiveTrip | null> => {
        try {
            const savedTrip = await offlineStorage.getActiveTrip();
            if (savedTrip && !trip.viajeActivo) {
                console.log('[TripContext] Viaje activo encontrado:', savedTrip.id);
                setPendingRestore(savedTrip);
                return savedTrip;
            }
            return null;
        } catch (err) {
            console.error('[TripContext] Error verificando viaje activo:', err);
            return null;
        }
    }, [trip.viajeActivo]);

    // Limpiar pending restore
    const clearPendingRestore = useCallback(() => {
        setPendingRestore(null);
    }, []);

    // Helper para calcular distancia total (Haversine)
    const calcularDistancia = useCallback((): number => {
        if (trip.viajeRuta.length < 2) return 0;
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        let total = 0;
        for (let i = 1; i < trip.viajeRuta.length; i++) {
            const lat1 = trip.viajeRuta[i - 1].lat;
            const lon1 = trip.viajeRuta[i - 1].lng;
            const lat2 = trip.viajeRuta[i].lat;
            const lon2 = trip.viajeRuta[i].lng;
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        return Math.round(total * 100) / 100;
    }, [trip.viajeRuta]);

    // Helper simplificado para estado GPS (compatibilidad)
    const getGpsStatusSimple = useCallback((): 'active' | 'weak' | 'lost' => {
        switch (trip.gpsStatus) {
            case 'active':
                return 'active';
            case 'weak':
            case 'acquiring':
            case 'timeout':
                return 'weak';
            case 'permission_denied':
            case 'unavailable':
            case 'lost':
            default:
                return 'lost';
        }
    }, [trip.gpsStatus]);

    // Check for active trip on mount
    useEffect(() => {
        checkForActiveTrip();
    }, []);

    const value: TripContextValue = {
        // Trip state
        viajeActivo: trip.viajeActivo,
        viajePausado: trip.viajePausado,
        tiempoViaje: trip.tiempoViaje,
        viajeInicio: trip.viajeInicio,
        viajeEventos: trip.viajeEventos,
        viajeRuta: trip.viajeRuta,

        // GPS state (mejorado)
        gpsPosition: trip.gpsPosition,
        gpsAvailable: trip.gpsAvailable,
        gpsStatus: trip.gpsStatus,
        gpsAccuracy: trip.gpsAccuracy,
        lastGPSUpdate: trip.lastGPSUpdate,

        // Saved trips
        savedTrips: trip.savedTrips,

        // Actions
        iniciarViaje: trip.iniciarViaje,
        finalizarViaje: trip.finalizarViaje,
        registrarIncidente: trip.registrarIncidente,
        registrarParada: trip.registrarParada,
        reanudarViaje: trip.reanudarViaje,
        loadSavedTrips: trip.loadSavedTrips,
        restoreFromSaved: trip.restoreFromSaved,
        requestGPSPermission: trip.requestGPSPermission,

        // Configuration
        setManifiestoId,
        setRole,

        // Utilities
        formatTime: trip.formatTime,
        calcularDistancia,
        getGpsStatusSimple,

        // Restore state
        pendingRestore,
        clearPendingRestore,
        checkForActiveTrip
    };

    return (
        <TripContext.Provider value={value}>
            {children}
        </TripContext.Provider>
    );
};

export const useTripContext = (): TripContextValue => {
    const context = useContext(TripContext);
    if (!context) {
        throw new Error('useTripContext must be used within a TripProvider');
    }
    return context;
};

export default TripContext;
