/**
 * TripTracker - Active trip tracking component for Transportista
 * WITH INLINE STYLES to bypass PWA cache issues
 */

import React from 'react';
import { 
    Navigation, MapPin, AlertTriangle, Clock, Pause, Play, 
    CheckCircle, ChevronLeft 
} from 'lucide-react';
import type { GPSPosition, TripEvent } from '../../types/mobile.types';

// Inline styles - guaranteed to apply regardless of cache
const styles = {
    screen: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
        padding: '0',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 20px',
    },
    backBtn: {
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        borderRadius: '12px',
        color: 'white',
        cursor: 'pointer',
    },
    statusIndicator: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        background: 'rgba(34, 197, 94, 0.2)',
        color: '#22c55e',
    },
    statusPaused: {
        background: 'rgba(245, 158, 11, 0.2)',
        color: '#f59e0b',
    },
    timerContainer: {
        textAlign: 'center' as const,
        padding: '24px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '16px',
    },
    timerDisplay: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: '#f8fafc',
    },
    timerText: {
        fontSize: '36px',
        fontWeight: 800,
        fontFamily: 'SF Mono, monospace',
        letterSpacing: '2px',
    },
    gpsStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 18px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '12px',
        fontSize: '14px',
        color: '#94a3b8',
    },
    controls: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '24px',
    },
    controlBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '14px 12px',
        border: 'none',
        borderRadius: '14px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        minHeight: '48px',
    },
    pauseBtn: {
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))',
        color: '#f59e0b',
        border: '1px solid rgba(245, 158, 11, 0.3)',
    },
    resumeBtn: {
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))',
        color: '#22c55e',
        border: '1px solid rgba(34, 197, 94, 0.3)',
    },
    incidentBtn: {
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.3)',
    },
    finishBtn: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        border: 'none',
        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
        gridColumn: 'span 2',
    },
    events: {
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '16px',
        padding: '20px',
    },
    eventsTitle: {
        fontSize: '14px',
        fontWeight: 700,
        color: '#94a3b8',
        margin: '0 0 16px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
    },
    eventsList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    noEvents: {
        textAlign: 'center' as const,
        padding: '24px',
        color: '#64748b',
        fontSize: '14px',
    },
    eventItem: {
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        borderLeft: '3px solid #64748b',
    },
    eventIcon: {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.1)',
        color: '#94a3b8',
        flexShrink: 0,
    },
    eventContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '2px',
    },
    eventTipo: {
        fontSize: '12px',
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    eventDesc: {
        fontSize: '14px',
        color: '#f8fafc',
    },
    eventTime: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        color: '#64748b',
    },
};

interface TripTrackerProps {
    viajePausado: boolean;
    tiempoViaje: number;
    gpsPosition: GPSPosition | null;
    viajeEventos: TripEvent[];
    viajeRutaCount: number;
    onFinalizar: () => void;
    onOpenIncidentModal: () => void;
    onOpenParadaModal: () => void;
    onReanudar: () => void;
    onBack: () => void;
    formatTime: (seconds: number) => string;
}

const TripTracker: React.FC<TripTrackerProps> = ({
    viajePausado,
    tiempoViaje,
    gpsPosition,
    viajeEventos,
    viajeRutaCount,
    onFinalizar,
    onOpenIncidentModal,
    onOpenParadaModal,
    onReanudar,
    onBack,
    formatTime,
}) => {
    return (
        <div style={styles.screen}>
            {/* Header */}
            <div style={styles.header}>
                <button style={styles.backBtn} onClick={onBack}>
                    <ChevronLeft size={24} />
                </button>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
                    Viaje en Curso
                </h2>
                <div style={{
                    ...styles.statusIndicator,
                    ...(viajePausado ? styles.statusPaused : {}),
                }}>
                    {viajePausado ? <Pause size={16} /> : <Navigation size={16} />}
                    {viajePausado ? 'Pausado' : 'Activo'}
                </div>
            </div>

            {/* Timer */}
            <div style={styles.timerContainer}>
                <div style={styles.timerDisplay}>
                    <Clock size={24} style={{ color: '#64748b' }} />
                    <span style={styles.timerText}>{formatTime(tiempoViaje)}</span>
                </div>
            </div>

            {/* GPS Status */}
            <div style={styles.gpsStatus}>
                <MapPin size={18} style={{ color: '#10b981' }} />
                {gpsPosition ? (
                    <span>GPS: {gpsPosition.lat.toFixed(6)}, {gpsPosition.lng.toFixed(6)}</span>
                ) : (
                    <span style={{ color: '#ef4444' }}>GPS no disponible</span>
                )}
                {viajeRutaCount > 0 && (
                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                        ({viajeRutaCount} puntos)
                    </span>
                )}
            </div>

            {/* Control Buttons */}
            <div style={styles.controls}>
                {viajePausado ? (
                    <button 
                        style={{ ...styles.controlBtn, ...styles.resumeBtn }} 
                        onClick={onReanudar}
                    >
                        <Play size={20} />
                        <span>Reanudar</span>
                    </button>
                ) : (
                    <button 
                        style={{ ...styles.controlBtn, ...styles.pauseBtn }} 
                        onClick={onOpenParadaModal}
                    >
                        <Pause size={20} />
                        <span>Parada</span>
                    </button>
                )}
                
                <button 
                    style={{ ...styles.controlBtn, ...styles.incidentBtn }} 
                    onClick={onOpenIncidentModal}
                >
                    <AlertTriangle size={20} />
                    <span>Incidente</span>
                </button>
                
                <button 
                    style={{ ...styles.controlBtn, ...styles.finishBtn }} 
                    onClick={onFinalizar}
                >
                    <CheckCircle size={20} />
                    <span>Finalizar</span>
                </button>
            </div>

            {/* Events */}
            <div style={styles.events}>
                <h3 style={styles.eventsTitle}>Eventos del Viaje ({viajeEventos.length})</h3>
                <div style={styles.eventsList}>
                    {viajeEventos.length === 0 ? (
                        <div style={styles.noEvents}>Sin eventos registrados</div>
                    ) : (
                        viajeEventos.map((evento, idx) => (
                            <div key={idx} style={styles.eventItem}>
                                <div style={styles.eventIcon}>
                                    {evento.tipo === 'INICIO' && <Play size={14} />}
                                    {evento.tipo === 'FIN' && <CheckCircle size={14} />}
                                    {evento.tipo === 'INCIDENTE' && <AlertTriangle size={14} />}
                                    {evento.tipo === 'PARADA' && <Pause size={14} />}
                                    {evento.tipo === 'REANUDACION' && <Play size={14} />}
                                </div>
                                <div style={styles.eventContent}>
                                    <div style={styles.eventTipo}>{evento.tipo}</div>
                                    <div style={styles.eventDesc}>{evento.descripcion}</div>
                                    <div style={styles.eventTime}>
                                        {new Date(evento.timestamp).toLocaleTimeString()}
                                        {evento.gps && (
                                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={10} /> GPS registrado
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default TripTracker;
