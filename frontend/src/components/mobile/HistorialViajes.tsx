/**
 * HistorialViajes - FASE 2 (P2)
 * Pantalla para ver el historial de viajes realizados con mapa de ruta
 */

import React from 'react';
import { ChevronLeft, Clock, Navigation, MapPin, Calendar, AlertTriangle } from 'lucide-react';
import type { SavedTrip } from '../../types/mobile.types';

interface HistorialViajesProps {
    viajes: SavedTrip[];
    onSelectViaje: (viaje: SavedTrip) => void;
    onBack: () => void;
}

// Helper: Format duration in seconds to HH:MM:SS or MM:SS
const formatDuracion = (segundos: number): string => {
    const hrs = Math.floor(segundos / 3600);
    const mins = Math.floor((segundos % 3600) / 60);
    const secs = segundos % 60;

    if (hrs > 0) {
        return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

// Helper: Format date
const formatFecha = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

// Helper: Format time
const formatHora = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Helper: Get event icon
const getEventIcon = (tipo: string) => {
    switch (tipo) {
        case 'INICIO': return '🚛';
        case 'FIN': return '✅';
        case 'PARADA': return '⏸️';
        case 'INCIDENTE': return '⚠️';
        case 'REANUDACION': return '▶️';
        default: return '📍';
    }
};

const HistorialViajes: React.FC<HistorialViajesProps> = ({ viajes, onSelectViaje, onBack }) => {
    // Sort viajes by date (most recent first)
    const viajesOrdenados = [...viajes].sort((a, b) =>
        new Date(b.inicio).getTime() - new Date(a.inicio).getTime()
    );

    // Count stats
    const totalViajes = viajes.length;
    const totalDuracion = viajes.reduce((acc, v) => acc + v.duracion, 0);
    const totalPuntos = viajes.reduce((acc, v) => acc + (v.ruta?.length || 0), 0);
    const totalIncidentes = viajes.reduce((acc, v) =>
        acc + v.eventos.filter(e => e.tipo === 'INCIDENTE').length, 0
    );

    return (
        <div className="historial-viajes-container">
            {/* Header */}
            <div className="historial-header">
                <button className="back-btn" onClick={onBack}>
                    <ChevronLeft size={20} />
                </button>
                <div className="header-title">
                    <h2>Historial de Viajes</h2>
                    <span className="header-count">{totalViajes} viajes registrados</span>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="historial-stats">
                <div className="stat-item">
                    <Clock size={16} />
                    <span className="stat-value">{formatDuracion(totalDuracion)}</span>
                    <span className="stat-label">Total</span>
                </div>
                <div className="stat-item">
                    <Navigation size={16} />
                    <span className="stat-value">{totalPuntos}</span>
                    <span className="stat-label">Puntos GPS</span>
                </div>
                <div className="stat-item">
                    <AlertTriangle size={16} />
                    <span className="stat-value">{totalIncidentes}</span>
                    <span className="stat-label">Incidentes</span>
                </div>
            </div>

            {/* Viajes List */}
            {viajesOrdenados.length === 0 ? (
                <div className="empty-state">
                    <Navigation size={48} />
                    <h3>Sin viajes registrados</h3>
                    <p>Los viajes que realices apareceran aqui</p>
                </div>
            ) : (
                <div className="viajes-list">
                    {viajesOrdenados.map(viaje => (
                        <div
                            key={viaje.id}
                            className="viaje-card"
                            onClick={() => onSelectViaje(viaje)}
                        >
                            <div className="viaje-date">
                                <Calendar size={14} />
                                <span>{formatFecha(viaje.inicio)}</span>
                            </div>

                            <div className="viaje-main">
                                <div className="viaje-time-range">
                                    <span className="time-start">{formatHora(viaje.inicio)}</span>
                                    <span className="time-arrow">→</span>
                                    <span className="time-end">{formatHora(viaje.fin)}</span>
                                </div>
                                <div className="viaje-duration">
                                    <Clock size={14} />
                                    <span>{formatDuracion(viaje.duracion)}</span>
                                </div>
                            </div>

                            <div className="viaje-stats-row">
                                <div className="viaje-stat">
                                    <MapPin size={12} />
                                    <span>{viaje.ruta?.length || 0} puntos</span>
                                </div>
                                <div className="viaje-stat">
                                    <span>{viaje.eventos.length} eventos</span>
                                </div>
                                {viaje.eventos.some(e => e.tipo === 'INCIDENTE') && (
                                    <div className="viaje-stat warning">
                                        <AlertTriangle size={12} />
                                        <span>Incidente</span>
                                    </div>
                                )}
                            </div>

                            {/* Mini timeline */}
                            <div className="viaje-mini-timeline">
                                {viaje.eventos.slice(0, 5).map((evento, idx) => (
                                    <span key={idx} className={`event-dot ${evento.tipo.toLowerCase()}`} title={evento.tipo}>
                                        {getEventIcon(evento.tipo)}
                                    </span>
                                ))}
                                {viaje.eventos.length > 5 && (
                                    <span className="event-more">+{viaje.eventos.length - 5}</span>
                                )}
                            </div>

                            <div className="viaje-action">
                                <span>Ver detalles</span>
                                <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .historial-viajes-container {
                    /* ABSOLUTE within .app-container (which has position:relative) */
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    width: 100%;
                    height: 100%;
                    background: var(--color-bg-base, #0a0f14);
                    z-index: 500; /* Higher than header (100), lower than modals */
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    font-family: var(--font-sans);
                }

                /* Light theme support */
                [data-theme="light"] .historial-viajes-container {
                    background: #f8fafc;
                }

                .historial-header {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3, 12px);
                    padding: var(--space-4, 16px);
                    background: var(--color-bg-elevated, #0f1419);
                    border-bottom: 1px solid var(--color-border-default);
                    flex-shrink: 0;
                }

                .back-btn {
                    background: var(--color-bg-hover);
                    border: 1px solid var(--color-border-default);
                    color: var(--color-text-bright);
                    padding: var(--space-2, 8px);
                    border-radius: var(--radius-sm, 6px);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all var(--duration-fast) var(--ease-out);
                }

                .back-btn:hover {
                    background: var(--color-bg-active);
                    border-color: var(--color-primary);
                }

                .back-btn:active {
                    transform: scale(0.95);
                }

                .header-title h2 {
                    margin: 0;
                    font-size: var(--text-lg, 1.125rem);
                    font-weight: var(--font-semibold);
                    color: var(--color-text-bright);
                }

                .header-count {
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-secondary);
                    display: block;
                    margin-top: 2px;
                }

                .historial-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--space-3, 12px);
                    padding: var(--space-4, 16px);
                    background: var(--color-bg-elevated, #0f1419);
                    border-bottom: 1px solid var(--color-border-default);
                    flex-shrink: 0;
                }

                .stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: var(--space-1, 4px);
                    padding: var(--space-2, 8px);
                    background: var(--color-bg-surface);
                    border-radius: var(--radius-sm, 6px);
                    border: 1px solid var(--color-border-subtle);
                }

                .stat-item svg {
                    color: var(--color-primary);
                }

                .stat-value {
                    font-size: var(--text-lg, 1.125rem);
                    font-weight: var(--font-bold);
                    color: var(--color-text-bright);
                    font-family: var(--font-mono);
                }

                .stat-label {
                    font-size: var(--text-2xs, 0.625rem);
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-12, 48px) var(--space-6, 24px);
                    text-align: center;
                    flex: 1;
                }

                .empty-state svg {
                    color: var(--color-text-muted);
                    margin-bottom: var(--space-4, 16px);
                    opacity: 0.5;
                }

                .empty-state h3 {
                    margin: 0 0 var(--space-2, 8px);
                    color: var(--color-text-bright);
                    font-weight: var(--font-semibold);
                }

                .empty-state p {
                    margin: 0;
                    color: var(--color-text-muted);
                    font-size: var(--text-sm, 0.875rem);
                }

                .viajes-list {
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: var(--space-3, 12px);
                    padding-bottom: var(--space-6, 24px);
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3, 12px);
                    -webkit-overflow-scrolling: touch;
                }

                .viaje-card {
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-md, 10px);
                    padding: var(--space-4, 16px);
                    cursor: pointer;
                    transition: all var(--duration-fast) var(--ease-out);
                    flex-shrink: 0;
                }

                .viaje-card:hover {
                    border-color: var(--color-primary-dim);
                    box-shadow: var(--shadow-glow-primary);
                }

                .viaje-card:active {
                    transform: scale(0.98);
                    background: var(--color-bg-hover);
                }

                .viaje-date {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-primary);
                    margin-bottom: var(--space-2, 8px);
                    font-weight: var(--font-medium);
                }

                .viaje-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-3, 12px);
                    flex-wrap: wrap;
                    gap: var(--space-2, 8px);
                }

                .viaje-time-range {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                }

                .time-start, .time-end {
                    font-size: var(--text-base, 1rem);
                    font-weight: var(--font-semibold);
                    color: var(--color-text-bright);
                    font-family: var(--font-mono);
                }

                .time-arrow {
                    color: var(--color-text-muted);
                }

                .viaje-duration {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1, 4px);
                    color: var(--color-warning-bright);
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: var(--font-semibold);
                    font-family: var(--font-mono);
                }

                .viaje-stats-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-3, 12px);
                    margin-bottom: var(--space-3, 12px);
                }

                .viaje-stat {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1, 4px);
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-secondary);
                }

                .viaje-stat.warning {
                    color: var(--color-warning);
                }

                .viaje-mini-timeline {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-2, 8px);
                    margin-bottom: var(--space-3, 12px);
                    padding: var(--space-2, 8px) 0;
                    border-top: 1px solid var(--color-border-subtle);
                }

                .event-dot {
                    font-size: var(--text-xs, 0.75rem);
                }

                .event-more {
                    font-size: var(--text-2xs, 0.625rem);
                    color: var(--color-text-muted);
                    padding: 2px 6px;
                    background: var(--color-bg-hover);
                    border-radius: var(--radius-full);
                }

                .viaje-action {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: var(--space-1, 4px);
                    color: var(--color-primary);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: var(--font-medium);
                }

                /* LIGHT THEME STYLES */
                [data-theme="light"] .historial-header {
                    background: #ffffff;
                    border-bottom-color: #e2e8f0;
                }

                [data-theme="light"] .back-btn {
                    background: #f1f5f9;
                    border-color: #e2e8f0;
                    color: #475569;
                }

                [data-theme="light"] .back-btn:hover {
                    background: #e2e8f0;
                    border-color: #0891b2;
                    color: #0891b2;
                }

                [data-theme="light"] .header-title h2 {
                    color: #0f172a;
                }

                [data-theme="light"] .header-count {
                    color: #64748b;
                }

                [data-theme="light"] .historial-stats {
                    background: #ffffff;
                    border-bottom-color: #e2e8f0;
                }

                [data-theme="light"] .stat-item {
                    background: #f8fafc;
                    border-color: #e2e8f0;
                }

                [data-theme="light"] .stat-item svg {
                    color: #0891b2;
                }

                [data-theme="light"] .stat-value {
                    color: #0f172a;
                }

                [data-theme="light"] .stat-label {
                    color: #64748b;
                }

                [data-theme="light"] .empty-state svg {
                    color: #94a3b8;
                }

                [data-theme="light"] .empty-state h3 {
                    color: #475569;
                }

                [data-theme="light"] .empty-state p {
                    color: #64748b;
                }

                [data-theme="light"] .viaje-card {
                    background: #ffffff;
                    border-color: #e2e8f0;
                }

                [data-theme="light"] .viaje-card:hover {
                    border-color: #0891b2;
                    box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
                }

                [data-theme="light"] .viaje-date {
                    color: #0891b2;
                }

                [data-theme="light"] .time-start,
                [data-theme="light"] .time-end {
                    color: #0f172a;
                }

                [data-theme="light"] .time-arrow {
                    color: #94a3b8;
                }

                [data-theme="light"] .viaje-duration {
                    color: #d97706;
                }

                [data-theme="light"] .viaje-stat {
                    color: #64748b;
                }

                [data-theme="light"] .viaje-stat.warning {
                    color: #d97706;
                }

                [data-theme="light"] .viaje-mini-timeline {
                    border-top-color: #e2e8f0;
                }

                [data-theme="light"] .event-more {
                    background: #f1f5f9;
                    color: #64748b;
                }

                [data-theme="light"] .viaje-action {
                    color: #0891b2;
                }
            `}</style>
        </div>
    );
};

export default HistorialViajes;
