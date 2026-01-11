/**
 * TripContext - FASE 3
 * Context para estado del viaje activo
 * Elimina props drilling de trip state en toda la app
 */

import React, { createContext, useContext, useCallback, useState } from 'react';
import { useTripTracking } from '../hooks/useTripTracking';
import type { GPSPosition, RoutePoint, TripEvent, SavedTrip } from '../types/mobile.types';

interface TripContextValue {
    // Estado del viaje
    viajeActivo: boolean;
    viajePausado: boolean;
    tiempoViaje: number;
    viajeInicio: Date | null;
    viajeEventos: TripEvent[];
    viajeRuta: RoutePoint[];

    // Estado GPS
    gpsPosition: GPSPosition | null;
    gpsAvailable: boolean;

    // Viajes guardados
    savedTrips: SavedTrip[];

    // Acciones
    iniciarViaje: () => void;
    finalizarViaje: () => void;
    registrarIncidente: (descripcion: string) => void;
    registrarParada: (descripcion?: string) => void;
    reanudarViaje: () => void;
    loadSavedTrips: () => void;

    // Configuracion
    setManifiestoId: (id: string | null) => void;
    setRole: (role: string | undefined) => void;

    // Utilidades
    formatTime: (seconds: number) => string;
    calcularDistancia: () => number;
    getGpsStatus: () => 'active' | 'weak' | 'lost';
}

const TripContext = createContext<TripContextValue | null>(null);

interface TripProviderProps {
    children: React.ReactNode;
    onToast?: (message: string) => void;
}

export const TripProvider: React.FC<TripProviderProps> = ({ children, onToast }) => {
    const [manifiestoId, setManifiestoId] = useState<string | null>(null);
    const [role, setRole] = useState<string | undefined>(undefined);

    const trip = useTripTracking({
        role,
        manifiestoId: manifiestoId || undefined,
        onToast
    });

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

    // Helper para estado GPS
    const getGpsStatus = useCallback((): 'active' | 'weak' | 'lost' => {
        if (!trip.gpsPosition) return 'lost';
        return trip.gpsAvailable ? 'active' : 'weak';
    }, [trip.gpsPosition, trip.gpsAvailable]);

    const value: TripContextValue = {
        ...trip,
        setManifiestoId,
        setRole,
        calcularDistancia,
        getGpsStatus
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
