/**
 * GPSStatusIndicator - FASE 5 UI/UX
 * Indicador visual de estado GPS con acción para solicitar permisos
 *
 * Estados:
 * - active: GPS funcionando correctamente (verde pulsante)
 * - acquiring: Adquiriendo señal (amarillo animado)
 * - weak: Señal débil (amarillo)
 * - permission_denied: Permiso denegado (rojo con acción)
 * - unavailable: Hardware no soportado (gris)
 * - timeout: Timeout de GPS (amarillo)
 * - lost: Sin señal (rojo)
 */

import React from 'react';
import { Navigation, Loader, AlertTriangle, MapPinOff, Wifi, WifiOff } from 'lucide-react';
import type { GPSStatus } from '../../hooks/useTripTracking';

interface GPSStatusIndicatorProps {
    status: GPSStatus;
    accuracy?: number | null;
    lastUpdate?: Date | null;
    onRequestPermission?: () => void;
    compact?: boolean;
}

const GPSStatusIndicator: React.FC<GPSStatusIndicatorProps> = ({
    status,
    accuracy,
    lastUpdate,
    onRequestPermission,
    compact = false
}) => {
    const statusConfig: Record<GPSStatus, {
        color: string;
        bgColor: string;
        icon: React.ReactNode;
        label: string;
        showAction: boolean;
    }> = {
        active: {
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.15)',
            icon: <Navigation size={compact ? 14 : 18} />,
            label: 'GPS Activo',
            showAction: false
        },
        acquiring: {
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.15)',
            icon: <Loader size={compact ? 14 : 18} className="spin-icon" />,
            label: 'Buscando...',
            showAction: false
        },
        weak: {
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.15)',
            icon: <Wifi size={compact ? 14 : 18} />,
            label: 'Señal Débil',
            showAction: false
        },
        permission_denied: {
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.15)',
            icon: <AlertTriangle size={compact ? 14 : 18} />,
            label: 'GPS Denegado',
            showAction: true
        },
        unavailable: {
            color: '#64748b',
            bgColor: 'rgba(100, 116, 139, 0.15)',
            icon: <MapPinOff size={compact ? 14 : 18} />,
            label: 'No Disponible',
            showAction: false
        },
        timeout: {
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.15)',
            icon: <WifiOff size={compact ? 14 : 18} />,
            label: 'Sin Respuesta',
            showAction: false
        },
        lost: {
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.15)',
            icon: <WifiOff size={compact ? 14 : 18} />,
            label: 'Sin Señal',
            showAction: false
        }
    };

    const config = statusConfig[status];
    const isClickable = config.showAction && onRequestPermission;

    const formatLastUpdate = (): string => {
        if (!lastUpdate) return '';
        const diff = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
        if (diff < 5) return 'Ahora';
        if (diff < 60) return `Hace ${diff}s`;
        return `Hace ${Math.floor(diff / 60)}m`;
    };

    const handleClick = () => {
        if (isClickable) {
            onRequestPermission?.();
        }
    };

    if (compact) {
        return (
            <>
                <button
                    className={`gps-indicator-compact gps-${status}`}
                    onClick={handleClick}
                    disabled={!isClickable}
                    style={{
                        '--indicator-color': config.color,
                        '--indicator-bg': config.bgColor
                    } as React.CSSProperties}
                    title={config.label}
                >
                    {config.icon}
                    {status === 'active' && <span className="pulse-dot" />}
                </button>

                <style>{`
                    .gps-indicator-compact {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        width: 32px;
                        height: 32px;
                        background: var(--indicator-bg);
                        border: 1.5px solid var(--indicator-color);
                        border-radius: 8px;
                        color: var(--indicator-color);
                        cursor: default;
                        transition: all 0.2s ease;
                    }

                    .gps-indicator-compact:not(:disabled) {
                        cursor: pointer;
                    }

                    .gps-indicator-compact:not(:disabled):active {
                        transform: scale(0.95);
                    }

                    .gps-indicator-compact .pulse-dot {
                        position: absolute;
                        top: 4px;
                        right: 4px;
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: var(--indicator-color);
                        animation: pulseDot 1.5s ease-in-out infinite;
                    }

                    @keyframes pulseDot {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(0.8); }
                    }

                    .gps-indicator-compact .spin-icon {
                        animation: spin 1s linear infinite;
                    }

                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </>
        );
    }

    return (
        <>
            <button
                className={`gps-indicator gps-${status}`}
                onClick={handleClick}
                disabled={!isClickable}
                style={{
                    '--indicator-color': config.color,
                    '--indicator-bg': config.bgColor
                } as React.CSSProperties}
            >
                <div className="indicator-icon">
                    {config.icon}
                </div>
                <div className="indicator-content">
                    <span className="indicator-label">{config.label}</span>
                    {accuracy && status === 'active' && (
                        <span className="indicator-detail">±{Math.round(accuracy)}m</span>
                    )}
                    {lastUpdate && status === 'active' && (
                        <span className="indicator-time">{formatLastUpdate()}</span>
                    )}
                    {config.showAction && (
                        <span className="indicator-action">Tap para permitir</span>
                    )}
                </div>
                {status === 'active' && <span className="pulse-indicator" />}
            </button>

            <style>{`
                .gps-indicator {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                    padding: 14px 16px;
                    background: var(--indicator-bg);
                    border: 2px solid var(--indicator-color);
                    border-radius: 12px;
                    cursor: default;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }

                .gps-indicator:not(:disabled) {
                    cursor: pointer;
                }

                .gps-indicator:not(:disabled):active {
                    transform: scale(0.98);
                }

                .indicator-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: var(--indicator-bg);
                    border-radius: 10px;
                    color: var(--indicator-color);
                    flex-shrink: 0;
                }

                .indicator-icon .spin-icon {
                    animation: spin 1s linear infinite;
                }

                .indicator-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 2px;
                }

                .indicator-label {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--indicator-color);
                }

                .indicator-detail {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 11px;
                    color: #94a3b8;
                }

                .indicator-time {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 11px;
                    color: #64748b;
                }

                .indicator-action {
                    font-size: 11px;
                    color: var(--indicator-color);
                    font-weight: 600;
                    text-decoration: underline;
                }

                .pulse-indicator {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: var(--indicator-color);
                    animation: pulseGlow 2s ease-in-out infinite;
                }

                @keyframes pulseGlow {
                    0%, 100% {
                        opacity: 1;
                        box-shadow: 0 0 0 0 var(--indicator-color);
                    }
                    50% {
                        opacity: 0.8;
                        box-shadow: 0 0 0 8px transparent;
                    }
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
};

export default GPSStatusIndicator;
