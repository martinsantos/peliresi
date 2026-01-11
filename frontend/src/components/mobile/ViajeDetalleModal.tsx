/**
 * ViajeDetalleModal - FASE 2 (P2)
 * Modal para ver detalles de un viaje completado con mapa de ruta
 */

import React from 'react';
import { X, Clock, Navigation, MapPin, AlertTriangle, Play, Pause, CheckCircle } from 'lucide-react';
import TripMap from './TripMap';
import type { SavedTrip } from '../../types/mobile.types';

interface ViajeDetalleModalProps {
    viaje: SavedTrip;
    onClose: () => void;
}

// Helper: Format duration
const formatDuracion = (segundos: number): string => {
    const hrs = Math.floor(segundos / 3600);
    const mins = Math.floor((segundos % 3600) / 60);
    const secs = segundos % 60;

    if (hrs > 0) {
        return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

// Helper: Format date and time
const formatFechaCompleta = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

const formatHora = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// Helper: Get event style
const getEventStyle = (tipo: string) => {
    switch (tipo) {
        case 'INICIO':
            return { icon: <Play size={14} />, color: 'var(--ind-green)', bg: 'rgba(34, 197, 94, 0.1)' };
        case 'FIN':
            return { icon: <CheckCircle size={14} />, color: 'var(--ind-cyan)', bg: 'rgba(6, 182, 212, 0.1)' };
        case 'PARADA':
            return { icon: <Pause size={14} />, color: 'var(--ind-yellow)', bg: 'rgba(234, 179, 8, 0.1)' };
        case 'INCIDENTE':
            return { icon: <AlertTriangle size={14} />, color: 'var(--ind-red-bright)', bg: 'rgba(239, 68, 68, 0.1)' };
        case 'REANUDACION':
            return { icon: <Play size={14} />, color: 'var(--ind-orange)', bg: 'rgba(249, 115, 22, 0.1)' };
        default:
            return { icon: <MapPin size={14} />, color: 'var(--ind-text-mid)', bg: 'rgba(100, 116, 139, 0.1)' };
    }
};

// Helper: Calculate distance from route (Haversine)
const calcularDistancia = (ruta: { lat: number; lng: number }[]): number => {
    if (ruta.length < 2) return 0;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    let total = 0;

    for (let i = 1; i < ruta.length; i++) {
        const lat1 = ruta[i - 1].lat;
        const lon1 = ruta[i - 1].lng;
        const lat2 = ruta[i].lat;
        const lon2 = ruta[i].lng;

        const R = 6371; // Earth radius in km
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
};

const ViajeDetalleModal: React.FC<ViajeDetalleModalProps> = ({ viaje, onClose }) => {
    const distancia = viaje.ruta ? calcularDistancia(viaje.ruta) : 0;
    const velocidadMedia = viaje.duracion > 0 && distancia > 0
        ? ((distancia / viaje.duracion) * 3600).toFixed(1)
        : '0';

    return (
        <div className="viaje-modal-overlay" onClick={onClose}>
            <div className="viaje-modal-content" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="viaje-modal-header">
                    <div className="header-info">
                        <h3>Detalle del Viaje</h3>
                        <span className="header-date">{formatFechaCompleta(viaje.inicio)}</span>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Map */}
                <div className="viaje-map-section">
                    {viaje.ruta && viaje.ruta.length > 0 ? (
                        <TripMap
                            ruta={viaje.ruta}
                            posicionActual={null}
                            altura="220px"
                            showStartMarker={true}
                            autoCenter={false}
                        />
                    ) : (
                        <div className="no-map-data">
                            <MapPin size={32} />
                            <span>Sin datos de ruta GPS</span>
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="viaje-stats-grid">
                    <div className="stat-card">
                        <Clock size={18} />
                        <div className="stat-info">
                            <span className="stat-value">{formatDuracion(viaje.duracion)}</span>
                            <span className="stat-label">Duracion</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <Navigation size={18} />
                        <div className="stat-info">
                            <span className="stat-value">{distancia.toFixed(2)} km</span>
                            <span className="stat-label">Distancia</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <MapPin size={18} />
                        <div className="stat-info">
                            <span className="stat-value">{viaje.ruta?.length || 0}</span>
                            <span className="stat-label">Puntos GPS</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-icon-text">km/h</span>
                        <div className="stat-info">
                            <span className="stat-value">{velocidadMedia}</span>
                            <span className="stat-label">Vel. Media</span>
                        </div>
                    </div>
                </div>

                {/* Time Info */}
                <div className="viaje-time-info">
                    <div className="time-row">
                        <span className="time-label">Inicio:</span>
                        <span className="time-value">{formatHora(viaje.inicio)}</span>
                    </div>
                    <div className="time-row">
                        <span className="time-label">Fin:</span>
                        <span className="time-value">{formatHora(viaje.fin)}</span>
                    </div>
                </div>

                {/* Events Timeline */}
                <div className="viaje-events-section">
                    <h4>Timeline de Eventos ({viaje.eventos.length})</h4>
                    <div className="events-timeline">
                        {viaje.eventos.map((evento, idx) => {
                            const style = getEventStyle(evento.tipo);
                            return (
                                <div key={idx} className="event-item" style={{ borderLeftColor: style.color }}>
                                    <div className="event-icon" style={{ background: style.bg, color: style.color }}>
                                        {style.icon}
                                    </div>
                                    <div className="event-content">
                                        <div className="event-header">
                                            <span className="event-tipo" style={{ color: style.color }}>{evento.tipo}</span>
                                            <span className="event-time">{formatHora(evento.timestamp)}</span>
                                        </div>
                                        <p className="event-desc">{evento.descripcion}</p>
                                        {evento.gps && (
                                            <span className="event-coords">
                                                <MapPin size={10} />
                                                {evento.gps.lat.toFixed(5)}, {evento.gps.lng.toFixed(5)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Close Button */}
                <div className="viaje-modal-footer">
                    <button className="btn-close-modal" onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            </div>

            <style>{`
                .viaje-modal-overlay {
                    /* FIXED: Use absolute to stay within mobile container on desktop */
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    z-index: var(--z-modal, 500);
                    padding: 0;
                }

                .viaje-modal-content {
                    background: var(--color-bg-base, #0a0f14);
                    border-radius: 20px 20px 0 0;
                    width: 100%;
                    max-width: 100%;
                    max-height: 90%;
                    overflow-y: auto;
                    animation: slideUp 0.3s ease;
                    -webkit-overflow-scrolling: touch;
                }

                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .viaje-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 16px;
                    border-bottom: 1px solid var(--ind-border);
                    position: sticky;
                    top: 0;
                    background: var(--ind-bg-base);
                    z-index: 10;
                }

                .header-info h3 {
                    margin: 0 0 4px;
                    font-size: 1.1rem;
                    color: var(--ind-text-bright);
                }

                .header-date {
                    font-size: 0.75rem;
                    color: var(--ind-cyan);
                    text-transform: capitalize;
                }

                .close-btn {
                    background: var(--ind-bg-lighter);
                    border: none;
                    border-radius: 50%;
                    padding: 8px;
                    color: var(--ind-text-mid);
                    cursor: pointer;
                }

                .viaje-map-section {
                    height: 220px;
                    background: var(--ind-bg-lighter);
                }

                .no-map-data {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    color: var(--ind-text-mid);
                }

                .viaje-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    padding: 16px;
                }

                .stat-card {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: var(--ind-bg-lighter);
                    padding: 12px;
                    border-radius: 10px;
                }

                .stat-card svg {
                    color: var(--ind-cyan);
                }

                .stat-icon-text {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--ind-cyan);
                    min-width: 18px;
                }

                .stat-info {
                    display: flex;
                    flex-direction: column;
                }

                .stat-value {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--ind-text-bright);
                }

                .stat-label {
                    font-size: 0.7rem;
                    color: var(--ind-text-mid);
                }

                .viaje-time-info {
                    display: flex;
                    justify-content: space-around;
                    padding: 0 16px 16px;
                }

                .time-row {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .time-label {
                    font-size: 0.75rem;
                    color: var(--ind-text-mid);
                }

                .time-value {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--ind-text-bright);
                }

                .viaje-events-section {
                    padding: 16px;
                    border-top: 1px solid var(--ind-border);
                }

                .viaje-events-section h4 {
                    margin: 0 0 12px;
                    font-size: 0.9rem;
                    color: var(--ind-text-bright);
                }

                .events-timeline {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .event-item {
                    display: flex;
                    gap: 10px;
                    padding-left: 10px;
                    border-left: 2px solid var(--ind-border);
                }

                .event-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .event-content {
                    flex: 1;
                    min-width: 0;
                }

                .event-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2px;
                }

                .event-tipo {
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .event-time {
                    font-size: 0.7rem;
                    color: var(--ind-text-mid);
                }

                .event-desc {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--ind-text-mid);
                }

                .event-coords {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.65rem;
                    color: var(--ind-text-dim);
                    margin-top: 4px;
                }

                .viaje-modal-footer {
                    padding: 16px;
                    border-top: 1px solid var(--ind-border);
                    position: sticky;
                    bottom: 0;
                    background: var(--ind-bg-base);
                }

                .btn-close-modal {
                    width: 100%;
                    padding: 14px;
                    background: var(--ind-cyan);
                    border: none;
                    border-radius: 10px;
                    color: var(--ind-black);
                    font-weight: 700;
                    font-size: 1rem;
                    cursor: pointer;
                }

                /* LIGHT THEME STYLES */
                [data-theme="light"] .viaje-modal-overlay {
                    background: rgba(15, 23, 42, 0.6);
                }

                [data-theme="light"] .viaje-modal-content {
                    background: #ffffff;
                }

                [data-theme="light"] .viaje-modal-header {
                    background: #ffffff;
                    border-bottom-color: #e2e8f0;
                }

                [data-theme="light"] .header-info h3 {
                    color: #0f172a;
                }

                [data-theme="light"] .header-date {
                    color: #0891b2;
                }

                [data-theme="light"] .close-btn {
                    background: #f1f5f9;
                    color: #64748b;
                }

                [data-theme="light"] .close-btn:hover {
                    background: #e2e8f0;
                    color: #0891b2;
                }

                [data-theme="light"] .viaje-map-section {
                    background: #f8fafc;
                }

                [data-theme="light"] .no-map-data {
                    color: #64748b;
                }

                [data-theme="light"] .stat-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                }

                [data-theme="light"] .stat-card svg {
                    color: #0891b2;
                }

                [data-theme="light"] .stat-icon-text {
                    color: #0891b2;
                }

                [data-theme="light"] .stat-value {
                    color: #0f172a;
                }

                [data-theme="light"] .stat-label {
                    color: #64748b;
                }

                [data-theme="light"] .time-label {
                    color: #64748b;
                }

                [data-theme="light"] .time-value {
                    color: #0f172a;
                }

                [data-theme="light"] .viaje-events-section {
                    border-top-color: #e2e8f0;
                }

                [data-theme="light"] .viaje-events-section h4 {
                    color: #0f172a;
                }

                [data-theme="light"] .event-item {
                    border-left-color: #e2e8f0;
                }

                [data-theme="light"] .event-time {
                    color: #64748b;
                }

                [data-theme="light"] .event-desc {
                    color: #475569;
                }

                [data-theme="light"] .event-coords {
                    color: #94a3b8;
                }

                [data-theme="light"] .viaje-modal-footer {
                    border-top-color: #e2e8f0;
                    background: #ffffff;
                }

                [data-theme="light"] .btn-close-modal {
                    background: #0891b2;
                    color: #ffffff;
                }

                [data-theme="light"] .btn-close-modal:hover {
                    background: #0e7490;
                }
            `}</style>
        </div>
    );
};

export default ViajeDetalleModal;
