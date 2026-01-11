/**
 * TripBanner - Banner colapsable para viaje activo
 *
 * CARACTERISTICAS:
 * - NO bloquea navegacion (se muestra como banner sticky)
 * - Colapsable (minimizar/expandir)
 * - Muestra: duracion, km, estado GPS
 * - Click expande a pantalla completa del viaje
 * - Indicador de GPS pulsante
 */

import React, { useState, useEffect } from 'react';
import { Navigation, Clock, Minimize2, Maximize2, Radio, AlertTriangle, ChevronRight } from 'lucide-react';

interface TripBannerProps {
    isActive: boolean;
    duration: number; // segundos
    distance: number; // km
    gpsStatus: 'active' | 'weak' | 'lost';
    manifiestoNumero?: string;
    onExpand: () => void;
    onMinimize?: () => void;
}

const TripBanner: React.FC<TripBannerProps> = ({
    isActive,
    duration,
    distance,
    gpsStatus,
    manifiestoNumero,
    onExpand,
    onMinimize
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [pulse, setPulse] = useState(false);

    // Pulse animation cada 2 segundos cuando activo
    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => {
            setPulse(true);
            setTimeout(() => setPulse(false), 500);
        }, 2000);
        return () => clearInterval(interval);
    }, [isActive]);

    // Format duration: HH:MM:SS o MM:SS
    const formatDuration = (secs: number): string => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getStatusColor = (): string => {
        switch (gpsStatus) {
            case 'active': return '#10b981';
            case 'weak': return '#f59e0b';
            case 'lost': return '#ef4444';
            default: return '#10b981';
        }
    };

    const getStatusLabel = (): string => {
        switch (gpsStatus) {
            case 'active': return 'GPS Activo';
            case 'weak': return 'Senal Debil';
            case 'lost': return 'Sin GPS';
            default: return 'GPS';
        }
    };

    const handleToggleMinimize = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMinimized(!isMinimized);
        if (onMinimize) onMinimize();
    };

    if (!isActive) return null;

    return (
        <>
            <div
                className={`trip-banner ${isMinimized ? 'minimized' : ''}`}
                onClick={onExpand}
            >
                {/* Barra de estado superior */}
                <div className="status-bar" style={{ background: getStatusColor() }}>
                    <div className={`status-pulse ${pulse ? 'active' : ''}`} />
                </div>

                <div className="banner-content">
                    {/* Indicador GPS */}
                    <div className="gps-indicator">
                        <div
                            className={`gps-dot ${gpsStatus}`}
                            style={{ background: getStatusColor() }}
                        />
                        <Radio size={14} style={{ color: getStatusColor() }} />
                    </div>

                    {/* Info del viaje (estado expandido) */}
                    {!isMinimized && (
                        <div className="trip-info">
                            <div className="trip-label">
                                <span className="label-text">VIAJE ACTIVO</span>
                                {manifiestoNumero && (
                                    <span className="manifiesto-num">#{manifiestoNumero}</span>
                                )}
                            </div>
                            <div className="trip-stats">
                                <div className="stat">
                                    <Clock size={14} />
                                    <span className="stat-value">{formatDuration(duration)}</span>
                                </div>
                                <div className="stat-divider" />
                                <div className="stat">
                                    <Navigation size={14} />
                                    <span className="stat-value">{distance.toFixed(1)} km</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Info minimizada */}
                    {isMinimized && (
                        <div className="minimized-info">
                            <span className="mini-time">{formatDuration(duration)}</span>
                            <span className="mini-label">EN CURSO</span>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="banner-actions">
                        {gpsStatus !== 'active' && (
                            <div className="warning-badge" title={getStatusLabel()}>
                                <AlertTriangle size={14} />
                            </div>
                        )}
                        <button
                            className="toggle-btn"
                            onClick={handleToggleMinimize}
                            aria-label={isMinimized ? 'Expandir' : 'Minimizar'}
                        >
                            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                        </button>
                        <div className="expand-hint">
                            <ChevronRight size={16} />
                        </div>
                    </div>
                </div>

                {/* Linea de progreso animada */}
                <div className="progress-line">
                    <div className="progress-glow" />
                </div>
            </div>

            <style>{`
                .trip-banner {
                    position: relative;
                    z-index: 50;
                    background: linear-gradient(180deg, #064e3b 0%, #047857 100%);
                    cursor: pointer;
                    overflow: hidden;
                    transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
                }

                .trip-banner:active {
                    background: #065f46;
                }

                .trip-banner.minimized {
                    background: #064e3b;
                }

                .status-bar {
                    height: 3px;
                    position: relative;
                    overflow: hidden;
                }

                .status-pulse {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
                    transform: translateX(-100%);
                }

                .status-pulse.active {
                    animation: pulse-sweep 0.5s ease-out;
                }

                @keyframes pulse-sweep {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }

                .banner-content {
                    display: flex;
                    align-items: center;
                    padding: 10px 16px;
                    gap: 12px;
                }

                .gps-indicator {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .gps-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    box-shadow: 0 0 8px currentColor;
                }

                .gps-dot.active { animation: gps-blink 2s infinite; }
                .gps-dot.weak { animation: gps-blink 1s infinite; }
                .gps-dot.lost { animation: gps-blink 0.5s infinite; }

                @keyframes gps-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }

                .trip-info {
                    flex: 1;
                    min-width: 0;
                }

                .trip-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 2px;
                }

                .label-text {
                    font-family: monospace;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.15em;
                    color: #a7f3d0;
                    text-transform: uppercase;
                }

                .manifiesto-num {
                    font-family: monospace;
                    font-size: 12px;
                    font-weight: 600;
                    color: #ffffff;
                    background: rgba(255, 255, 255, 0.2);
                    padding: 2px 8px;
                    border-radius: 4px;
                }

                .trip-stats {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .stat {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .stat svg {
                    color: #a7f3d0;
                }

                .stat-value {
                    font-family: monospace;
                    font-size: 16px;
                    font-weight: 700;
                    color: #ffffff;
                    letter-spacing: -0.02em;
                }

                .stat-divider {
                    width: 1px;
                    height: 16px;
                    background: rgba(255, 255, 255, 0.3);
                }

                .minimized-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .mini-time {
                    font-family: monospace;
                    font-size: 14px;
                    font-weight: 700;
                    color: #ffffff;
                }

                .mini-label {
                    font-family: monospace;
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    color: #ffffff;
                    padding: 3px 8px;
                    background: rgba(255, 255, 255, 0.25);
                    border-radius: 4px;
                }

                .banner-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .warning-badge {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    background: rgba(251, 191, 36, 0.3);
                    border-radius: 6px;
                    color: #fbbf24;
                    animation: warning-pulse 1.5s infinite;
                }

                @keyframes warning-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }

                .toggle-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    border-radius: 6px;
                    color: #ffffff;
                    cursor: pointer;
                    transition: all 150ms;
                }

                .toggle-btn:active {
                    background: rgba(255, 255, 255, 0.25);
                    transform: scale(0.95);
                }

                .expand-hint {
                    display: flex;
                    align-items: center;
                    color: rgba(255, 255, 255, 0.7);
                }

                .progress-line {
                    height: 3px;
                    background: rgba(0, 0, 0, 0.3);
                    position: relative;
                    overflow: hidden;
                }

                .progress-glow {
                    position: absolute;
                    width: 40%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, #34d399, transparent);
                    animation: progress-slide 2s infinite linear;
                }

                @keyframes progress-slide {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(350%); }
                }
            `}</style>
        </>
    );
};

export default TripBanner;
