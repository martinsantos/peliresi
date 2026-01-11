/**
 * ManifiestoContext - FASE 3
 * Context para manifiestos cacheados
 * Centraliza carga, filtrado y seleccion de manifiestos
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { manifiestoService } from '../services/manifiesto.service';
import { authService } from '../services/auth.service';
import type { UserRole } from '../types/mobile.types';
import { DEMO_MANIFIESTOS } from '../data/demoMobile';

interface ProcessedManifiesto {
    id: string;
    numero: string;
    estado: string;
    generador: string;
    operador: string;
    transportista: string;
    residuo: string;
    cantidad: string;
    fecha: string;
    eta?: string | null;
    _original: any;
}

interface ManifiestoContextValue {
    // Data
    manifiestos: any[];
    processedManifiestos: ProcessedManifiesto[];
    loading: boolean;
    error: string | null;

    // Seleccion
    selectedManifiesto: ProcessedManifiesto | null;
    setSelectedManifiesto: (m: ProcessedManifiesto | null) => void;
    activeManifiestoId: string | null;
    setActiveManifiestoId: (id: string | null) => void;

    // Filtros
    filteredByTab: (tab: 'pendientes' | 'en-curso' | 'realizados') => ProcessedManifiesto[];

    // Acciones
    loadManifiestos: (role: UserRole) => Promise<void>;
    refreshManifiestos: () => Promise<void>;

    // Contadores
    countByEstado: (estados: string[]) => number;
}

const ManifiestoContext = createContext<ManifiestoContextValue | null>(null);

interface ManifiestoProviderProps {
    children: React.ReactNode;
    isOnline: boolean;
    role: UserRole | null;
}

export const ManifiestoProvider: React.FC<ManifiestoProviderProps> = ({
    children,
    isOnline,
    role
}) => {
    const [manifiestos, setManifiestos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedManifiesto, setSelectedManifiesto] = useState<ProcessedManifiesto | null>(null);
    const [activeManifiestoId, setActiveManifiestoId] = useState<string | null>(null);

    // Formatear manifiesto para display
    const formatManifiesto = useCallback((m: any): ProcessedManifiesto => ({
        id: m.id,
        numero: m.numero || `MAN-${m.id?.slice(-6)}`,
        estado: m.estado,
        generador: m.generador?.razonSocial || m.generador || 'Generador',
        operador: m.operador?.razonSocial || m.operador || 'Operador',
        transportista: m.transportista?.razonSocial || m.transportista || 'Transportista',
        residuo: m.residuos?.[0]?.tipoResiduo?.nombre || m.residuo || 'Residuos',
        cantidad: m.residuos?.[0] ? `${m.residuos[0].cantidad} ${m.residuos[0].unidad}` : m.cantidad || '-',
        fecha: m.fechaCreacion
            ? new Date(m.fechaCreacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
            : m.fecha || '-',
        eta: m.eta || null,
        _original: m
    }), []);

    // Cargar manifiestos
    const loadManifiestos = useCallback(async (userRole: UserRole) => {
        if (!userRole) return;

        setLoading(true);
        setError(null);

        try {
            const currentUser = authService.getStoredUser();
            let estados: string[] = [];
            let filterParams: { transportistaId?: string; generadorId?: string; operadorId?: string } = {};

            switch (userRole) {
                case 'TRANSPORTISTA':
                    estados = ['APROBADO', 'EN_TRANSITO'];
                    if (currentUser?.transportista?.id) {
                        filterParams.transportistaId = currentUser.transportista.id;
                    }
                    break;
                case 'OPERADOR':
                    estados = ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO'];
                    if (currentUser?.operador?.id) {
                        filterParams.operadorId = currentUser.operador.id;
                    }
                    break;
                case 'GENERADOR':
                    estados = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO'];
                    if (currentUser?.generador?.id) {
                        filterParams.generadorId = currentUser.generador.id;
                    }
                    break;
                case 'ADMIN':
                    estados = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'];
                    break;
                default:
                    estados = ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO'];
            }

            const allManifiestos: any[] = [];
            for (const estado of estados) {
                try {
                    const data = await manifiestoService.getManifiestos({
                        estado,
                        limit: 50,
                        ...filterParams
                    });
                    allManifiestos.push(...(data.manifiestos || []));
                } catch (e) {
                    console.warn(`Error loading ${estado}:`, e);
                }
            }

            setManifiestos(allManifiestos);
        } catch (err: any) {
            console.error('[ManifiestoContext] Error:', err);
            setError(err.message || 'Error cargando manifiestos');
            setManifiestos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Refresh
    const refreshManifiestos = useCallback(async () => {
        if (role) {
            await loadManifiestos(role);
        }
    }, [role, loadManifiestos]);

    // Cargar al cambiar rol o conectividad
    useEffect(() => {
        if (role && isOnline) {
            loadManifiestos(role);
        }
    }, [role, isOnline, loadManifiestos]);

    // Manifiestos procesados
    const processedManifiestos = manifiestos.length > 0
        ? manifiestos.map(formatManifiesto)
        : DEMO_MANIFIESTOS.map(formatManifiesto);

    // Filtrar por tab
    const filteredByTab = useCallback((tab: 'pendientes' | 'en-curso' | 'realizados') => {
        switch (tab) {
            case 'pendientes':
                return processedManifiestos.filter(m => m.estado === 'APROBADO');
            case 'en-curso':
                return processedManifiestos.filter(m => m.estado === 'EN_TRANSITO');
            case 'realizados':
                return processedManifiestos.filter(m =>
                    ['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(m.estado)
                );
            default:
                return processedManifiestos;
        }
    }, [processedManifiestos]);

    // Contar por estado
    const countByEstado = useCallback((estados: string[]) => {
        return processedManifiestos.filter(m => estados.includes(m.estado)).length;
    }, [processedManifiestos]);

    const value: ManifiestoContextValue = {
        manifiestos,
        processedManifiestos,
        loading,
        error,
        selectedManifiesto,
        setSelectedManifiesto,
        activeManifiestoId,
        setActiveManifiestoId,
        filteredByTab,
        loadManifiestos,
        refreshManifiestos,
        countByEstado
    };

    return (
        <ManifiestoContext.Provider value={value}>
            {children}
        </ManifiestoContext.Provider>
    );
};

export const useManifiestoContext = (): ManifiestoContextValue => {
    const context = useContext(ManifiestoContext);
    if (!context) {
        throw new Error('useManifiestoContext must be used within a ManifiestoProvider');
    }
    return context;
};

export default ManifiestoContext;
