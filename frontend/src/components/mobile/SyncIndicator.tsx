/**
 * SyncIndicator - FASE 5 UI/UX
 * Badge que muestra el estado de sincronización en el header
 *
 * Estados:
 * - syncing: Sincronizando activamente (azul con spin)
 * - pending: Datos pendientes de sincronizar (amarillo con contador)
 * - synced: Todo sincronizado (verde)
 * - offline: Sin conexión (gris)
 */

import React, { useEffect, useState } from 'react';
import { RefreshCw, Cloud, CloudOff, Check } from 'lucide-react';
import { offlineStorage } from '../../services/offlineStorage';

type SyncStatus = 'syncing' | 'pending' | 'synced' | 'offline';

interface SyncIndicatorProps {
    isOnline: boolean;
    isSyncing?: boolean;
    onManualSync?: () => void;
    compact?: boolean;
}

const SyncIndicator: React.FC<SyncIndicatorProps> = ({
    isOnline,
    isSyncing = false,
    onManualSync,
    compact = false
}) => {
    const [pendingCount, setPendingCount] = useState(0);

    // Verificar datos pendientes
    useEffect(() => {
        const checkPending = async () => {
            try {
                const counts = await offlineStorage.getPendingCounts();
                setPendingCount(counts.operations + counts.gpsPoints);
            } catch (err) {
                console.error('[SyncIndicator] Error checking pending:', err);
            }
        };

        checkPending();
        const interval = setInterval(checkPending, 5000); // Check cada 5s
        return () => clearInterval(interval);
    }, []);

    // Determinar estado
    const getStatus = (): SyncStatus => {
        if (!isOnline) return 'offline';
        if (isSyncing) return 'syncing';
        if (pendingCount > 0) return 'pending';
        return 'synced';
    };

    const status = getStatus();

    const statusConfig: Record<SyncStatus, {
        color: string;
        bgColor: string;
        icon: React.ReactNode;
        label: string;
    }> = {
        syncing: {
            color: '#3b82f6',
            bgColor: 'rgba(59, 130, 246, 0.15)',
            icon: <RefreshCw size={compact ? 14 : 16} className="spin-icon" />,
            label: 'Sincronizando'
        },
        pending: {
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.15)',
            icon: <Cloud size={compact ? 14 : 16} />,
            label: `${pendingCount} pendientes`
        },
        synced: {
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.15)',
            icon: <Check size={compact ? 14 : 16} />,
            label: 'Sincronizado'
        },
        offline: {
            color: '#64748b',
            bgColor: 'rgba(100, 116, 139, 0.15)',
            icon: <CloudOff size={compact ? 14 : 16} />,
            label: 'Sin conexión'
        }
    };

    const config = statusConfig[status];
    const canSync = !isSyncing && isOnline && pendingCount > 0 && onManualSync;

    const handleClick = () => {
        if (canSync) {
            onManualSync?.();
        }
    };

    if (compact) {
        return (
            <>
                <button
                    className={`sync-indicator-compact sync-${status}`}
                    onClick={handleClick}
                    disabled={!canSync}
                    style={{
                        '--sync-color': config.color,
                        '--sync-bg': config.bgColor
                    } as React.CSSProperties}
                    title={config.label}
                >
                    {config.icon}
                    {pendingCount > 0 && status !== 'syncing' && (
                        <span className="pending-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
                    )}
                </button>

                <style>{`
                    .sync-indicator-compact {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        width: 32px;
                        height: 32px;
                        background: var(--sync-bg);
                        border: 1.5px solid var(--sync-color);
                        border-radius: 8px;
                        color: var(--sync-color);
                        cursor: default;
                        transition: all 0.2s ease;
                    }

                    .sync-indicator-compact:not(:disabled) {
                        cursor: pointer;
                    }

                    .sync-indicator-compact:not(:disabled):active {
                        transform: scale(0.95);
                    }

                    .sync-indicator-compact .spin-icon {
                        animation: spinSync 1s linear infinite;
                    }

                    @keyframes spinSync {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }

                    .sync-indicator-compact .pending-badge {
                        position: absolute;
                        top: -6px;
                        right: -6px;
                        min-width: 18px;
                        height: 18px;
                        padding: 0 5px;
                        background: var(--sync-color);
                        border-radius: 9px;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 10px;
                        font-weight: 700;
                        color: #0f172a;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                `}</style>
            </>
        );
    }

    return (
        <>
            <button
                className={`sync-indicator sync-${status}`}
                onClick={handleClick}
                disabled={!canSync}
                style={{
                    '--sync-color': config.color,
                    '--sync-bg': config.bgColor
                } as React.CSSProperties}
            >
                <span className="sync-icon">{config.icon}</span>
                <span className="sync-label">{config.label}</span>
                {pendingCount > 0 && status !== 'syncing' && (
                    <span className="sync-badge">{pendingCount}</span>
                )}
            </button>

            <style>{`
                .sync-indicator {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 14px;
                    background: var(--sync-bg);
                    border: 1.5px solid var(--sync-color);
                    border-radius: 20px;
                    cursor: default;
                    transition: all 0.2s ease;
                }

                .sync-indicator:not(:disabled) {
                    cursor: pointer;
                }

                .sync-indicator:not(:disabled):hover {
                    background: var(--sync-color);
                }

                .sync-indicator:not(:disabled):hover .sync-label,
                .sync-indicator:not(:disabled):hover .sync-icon {
                    color: #0f172a;
                }

                .sync-indicator:not(:disabled):active {
                    transform: scale(0.97);
                }

                .sync-icon {
                    display: flex;
                    align-items: center;
                    color: var(--sync-color);
                }

                .sync-icon .spin-icon {
                    animation: spinSync 1s linear infinite;
                }

                @keyframes spinSync {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .sync-label {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--sync-color);
                }

                .sync-badge {
                    min-width: 20px;
                    height: 20px;
                    padding: 0 6px;
                    background: var(--sync-color);
                    border-radius: 10px;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f172a;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            `}</style>
        </>
    );
};

export default SyncIndicator;
