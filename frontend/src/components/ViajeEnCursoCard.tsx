/**
 * ViajeEnCursoCard - Card sincronizada con servidor para viaje en curso
 * Muestra timer sincronizado, estado de pausa, y controles
 * Usado en Dashboard WEB para monitorear viajes en tiempo real
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Clock,
    Pause,
    Play,
    AlertTriangle,
    MapPin,
    Truck,
    RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { useWebSocket, WS_EVENTS } from '../hooks/useWebSocket';
import './ViajeEnCursoCard.css';

interface ViajeEnCursoData {
    id: string;
    manifiestoId: string;
    manifiestoNumero: string;
    inicio: string;
    estado: string;
    isPaused: boolean;
    elapsedSeconds: number;
    pausasTotales: number;
    ruta: Array<{ lat: number; lng: number; timestamp: string }>;
    eventos: Array<{ tipo: string; timestamp: string; descripcion?: string }>;
    ultimaUbicacion: { lat: number; lng: number; timestamp: string } | null;
}

interface ViajeEnCursoCardProps {
    manifiestoId: string;
    onClose?: () => void;
}

// Formatear segundos a HH:MM:SS
const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const ViajeEnCursoCard: React.FC<ViajeEnCursoCardProps> = ({
    manifiestoId,
    onClose: _onClose // Unused but kept for future use
}) => {
    const [viaje, setViaje] = useState<ViajeEnCursoData | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showIncidenteModal, setShowIncidenteModal] = useState(false);
    const [incidenteDesc, setIncidenteDesc] = useState('');

    const { subscribeToManifiesto, unsubscribeFromManifiesto, on, isConnected } = useWebSocket();

    // Cargar estado inicial del viaje
    const fetchViaje = useCallback(async () => {
        try {
            const { data } = await api.get(`/manifiestos/${manifiestoId}/viaje-actual`);
            if (data.data) {
                setViaje(data.data);
                setElapsedSeconds(data.data.elapsedSeconds);
                setError(null);
            } else {
                setViaje(null);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al cargar viaje');
        } finally {
            setLoading(false);
        }
    }, [manifiestoId]);

    // Cargar viaje inicial
    useEffect(() => {
        fetchViaje();
    }, [fetchViaje]);

    // Suscribirse a WebSocket cuando se monta
    useEffect(() => {
        if (manifiestoId) {
            subscribeToManifiesto(manifiestoId);
        }
        return () => {
            if (manifiestoId) {
                unsubscribeFromManifiesto(manifiestoId);
            }
        };
    }, [manifiestoId, subscribeToManifiesto, unsubscribeFromManifiesto]);

    // Escuchar eventos WebSocket
    useEffect(() => {
        const unsubPausado = on(WS_EVENTS.VIAJE_PAUSADO, (data: any) => {
            if (data.manifiestoId === manifiestoId) {
                setViaje(v => v ? { ...v, isPaused: true, estado: 'PAUSADO' } : v);
            }
        });

        const unsubReanudado = on(WS_EVENTS.VIAJE_REANUDADO, (data: any) => {
            if (data.manifiestoId === manifiestoId) {
                setViaje(v => v ? {
                    ...v,
                    isPaused: false,
                    estado: 'EN_CURSO',
                    pausasTotales: data.pausasTotales || v.pausasTotales
                } : v);
            }
        });

        const unsubGps = on(WS_EVENTS.GPS_UPDATE, (data: any) => {
            if (data.manifiestoId === manifiestoId) {
                setViaje(v => v ? {
                    ...v,
                    ultimaUbicacion: { lat: data.lat, lng: data.lng, timestamp: data.timestamp }
                } : v);
            }
        });

        const unsubIncidente = on(WS_EVENTS.VIAJE_INCIDENTE, (data: any) => {
            if (data.manifiestoId === manifiestoId) {
                setViaje(v => v ? { ...v, estado: 'INCIDENTE' } : v);
            }
        });

        return () => {
            unsubPausado();
            unsubReanudado();
            unsubGps();
            unsubIncidente();
        };
    }, [manifiestoId, on]);

    // Timer local que incrementa cada segundo (si no está pausado)
    useEffect(() => {
        if (!viaje || viaje.isPaused) return;

        const interval = setInterval(() => {
            setElapsedSeconds(s => s + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [viaje?.isPaused, viaje?.id]);

    // Re-sync con servidor cada 30 segundos
    useEffect(() => {
        const syncInterval = setInterval(() => {
            fetchViaje();
        }, 30000);

        return () => clearInterval(syncInterval);
    }, [fetchViaje]);

    // Acciones
    const handlePausar = async () => {
        if (!viaje) return;
        setActionLoading(true);
        try {
            await api.post(`/viajes/${viaje.id}/pausar`);
            setViaje(v => v ? { ...v, isPaused: true, estado: 'PAUSADO' } : v);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al pausar viaje');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReanudar = async () => {
        if (!viaje) return;
        setActionLoading(true);
        try {
            const { data } = await api.post(`/viajes/${viaje.id}/reanudar`);
            setViaje(v => v ? {
                ...v,
                isPaused: false,
                estado: 'EN_CURSO',
                pausasTotales: data.data?.viaje?.pausas || v.pausasTotales
            } : v);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al reanudar viaje');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRegistrarIncidente = async () => {
        if (!viaje || !incidenteDesc.trim()) return;
        setActionLoading(true);
        try {
            await api.post(`/viajes/${viaje.id}/incidente`, {
                tipo: 'INCIDENTE_MANUAL',
                descripcion: incidenteDesc,
                latitud: viaje.ultimaUbicacion?.lat,
                longitud: viaje.ultimaUbicacion?.lng
            });
            setShowIncidenteModal(false);
            setIncidenteDesc('');
            setViaje(v => v ? { ...v, estado: 'INCIDENTE' } : v);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al registrar incidente');
        } finally {
            setActionLoading(false);
        }
    };

    // Estados de carga
    if (loading) {
        return (
            <div className="viaje-card viaje-card-loading">
                <RefreshCw className="spin" size={24} />
                <span>Cargando viaje...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="viaje-card viaje-card-error">
                <AlertTriangle size={24} />
                <span>{error}</span>
                <button onClick={fetchViaje}>Reintentar</button>
            </div>
        );
    }

    if (!viaje) {
        return null;
    }

    return (
        <div className={`viaje-card ${viaje.isPaused ? 'viaje-pausado' : ''} ${viaje.estado === 'INCIDENTE' ? 'viaje-incidente' : ''}`}>
            {/* Header */}
            <div className="viaje-header">
                <div className="viaje-icon">
                    <Truck size={24} />
                    {!viaje.isPaused && <div className="viaje-pulse" />}
                </div>
                <div className="viaje-info">
                    <span className="viaje-numero">#{viaje.manifiestoNumero}</span>
                    <span className={`viaje-estado viaje-estado-${viaje.estado.toLowerCase()}`}>
                        {viaje.estado === 'PAUSADO' ? 'PAUSADO' :
                         viaje.estado === 'INCIDENTE' ? 'INCIDENTE' : 'EN CURSO'}
                    </span>
                </div>
                <div className="viaje-ws-status">
                    <span className={`ws-dot ${isConnected ? 'connected' : ''}`} />
                    {isConnected ? 'Sincronizado' : 'Sin conexion'}
                </div>
            </div>

            {/* Timer principal */}
            <div className="viaje-timer">
                <Clock size={28} />
                <span className="timer-value">{formatDuration(elapsedSeconds)}</span>
                {viaje.pausasTotales > 0 && (
                    <span className="pausas-total">
                        (pausas: {formatDuration(viaje.pausasTotales)})
                    </span>
                )}
            </div>

            {/* Ubicacion */}
            {viaje.ultimaUbicacion && (
                <div className="viaje-ubicacion">
                    <MapPin size={16} />
                    <span>
                        {viaje.ultimaUbicacion.lat.toFixed(6)}, {viaje.ultimaUbicacion.lng.toFixed(6)}
                    </span>
                    <span className="ubicacion-time">
                        {new Date(viaje.ultimaUbicacion.timestamp).toLocaleTimeString('es-AR')}
                    </span>
                </div>
            )}

            {/* Controles */}
            <div className="viaje-controles">
                {viaje.isPaused ? (
                    <button
                        className="btn-reanudar"
                        onClick={handleReanudar}
                        disabled={actionLoading}
                    >
                        <Play size={18} />
                        <span>Reanudar</span>
                    </button>
                ) : (
                    <button
                        className="btn-pausar"
                        onClick={handlePausar}
                        disabled={actionLoading || viaje.estado === 'INCIDENTE'}
                    >
                        <Pause size={18} />
                        <span>Pausar</span>
                    </button>
                )}

                <button
                    className="btn-incidente"
                    onClick={() => setShowIncidenteModal(true)}
                    disabled={actionLoading}
                >
                    <AlertTriangle size={18} />
                    <span>Incidente</span>
                </button>
            </div>

            {/* Estadisticas */}
            <div className="viaje-stats">
                <div className="stat">
                    <span className="stat-label">Puntos GPS</span>
                    <span className="stat-value">{viaje.ruta.length}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">Eventos</span>
                    <span className="stat-value">{viaje.eventos.length}</span>
                </div>
            </div>

            {/* Modal incidente */}
            {showIncidenteModal && (
                <div className="modal-overlay">
                    <div className="modal-incidente">
                        <h3>
                            <AlertTriangle size={24} />
                            Registrar Incidente
                        </h3>
                        <textarea
                            value={incidenteDesc}
                            onChange={(e) => setIncidenteDesc(e.target.value)}
                            placeholder="Describa el incidente..."
                            rows={4}
                        />
                        <div className="modal-actions">
                            <button onClick={() => setShowIncidenteModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={handleRegistrarIncidente}
                                disabled={!incidenteDesc.trim() || actionLoading}
                            >
                                Registrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViajeEnCursoCard;
