/**
 * ManifiestoCard - INDUSTRIAL HAZMAT CARD
 *
 * Tarjeta de manifiesto con diseño industrial premium:
 * - Badge de estado con códigos de color HAZMAT
 * - Tipografía dual (Sans + Mono)
 * - Iconografía técnica
 * - Micro-animaciones sutiles
 * - Indicadores de peligrosidad
 */

import React from 'react';
import {
    FileText, MapPin, TruckIcon, User, Package,
    AlertTriangle, Clock, ChevronRight, CheckCircle,
    Radio, Archive
} from 'lucide-react';

export interface ManifiestoCardData {
    id: string;
    numero: string;
    estado: EstadoManifiesto;
    generador: string;
    transportista?: string;
    operador: string;
    residuo: string;
    cantidad: string;
    unidad?: string;
    categoria?: string; // Y1, Y2, etc.
    fechaCreacion: string;
    fechaModificacion?: string;
    ubicacionActual?: string;
    peligrosidad?: 1 | 2 | 3; // Nivel de peligro
}

export type EstadoManifiesto =
    | 'BORRADOR'
    | 'PENDIENTE_APROBACION'
    | 'APROBADO'
    | 'EN_TRANSITO'
    | 'ENTREGADO'
    | 'RECIBIDO'
    | 'TRATADO'
    | 'RECHAZADO';

interface ManifiestoCardProps {
    manifiesto: ManifiestoCardData;
    onClick?: () => void;
    showLocation?: boolean;
    compact?: boolean;
}

const ESTADO_CONFIG: Record<EstadoManifiesto, {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
}> = {
    BORRADOR: {
        label: 'BORRADOR',
        color: '#94a3b8',
        bgColor: 'rgba(148, 163, 184, 0.15)',
        icon: <Archive size={12} />
    },
    PENDIENTE_APROBACION: {
        label: 'PEND. APROBACIÓN',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        icon: <Clock size={12} />
    },
    APROBADO: {
        label: 'APROBADO',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        icon: <CheckCircle size={12} />
    },
    EN_TRANSITO: {
        label: 'EN TRÁNSITO',
        color: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.15)',
        icon: <Radio size={12} />
    },
    ENTREGADO: {
        label: 'ENTREGADO',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
        icon: <CheckCircle size={12} />
    },
    RECIBIDO: {
        label: 'RECIBIDO',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        icon: <CheckCircle size={12} />
    },
    TRATADO: {
        label: 'TRATADO',
        color: '#059669',
        bgColor: 'rgba(5, 150, 105, 0.15)',
        icon: <CheckCircle size={12} />
    },
    RECHAZADO: {
        label: 'RECHAZADO',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        icon: <AlertTriangle size={12} />
    }
};

const ManifiestoCard: React.FC<ManifiestoCardProps> = ({
    manifiesto,
    onClick,
    showLocation = false,
    compact = false
}) => {
    const estadoConfig = ESTADO_CONFIG[manifiesto.estado];

    const getPeligrosidadColor = (nivel?: number) => {
        if (!nivel) return 'var(--color-text-dim, #475569)';
        switch (nivel) {
            case 3: return 'var(--color-danger, #ef4444)';
            case 2: return 'var(--color-warning, #f59e0b)';
            case 1: return 'var(--color-success, #10b981)';
            default: return 'var(--color-text-dim, #475569)';
        }
    };

    const formatFecha = (fecha: string) => {
        try {
            const date = new Date(fecha);
            return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch {
            return fecha;
        }
    };

    return (
        <>
            <div
                className={`manifiesto-card ${compact ? 'compact' : ''}`}
                onClick={onClick}
                style={{
                    '--estado-color': estadoConfig.color,
                    '--estado-bg': estadoConfig.bgColor
                } as React.CSSProperties}
            >
                {/* Header: Número + Estado */}
                <div className="card-header">
                    <div className="card-numero">
                        <FileText size={16} className="numero-icon" />
                        <span className="numero-text">#{manifiesto.numero}</span>
                    </div>
                    <div className="estado-badge" style={{ background: estadoConfig.bgColor, color: estadoConfig.color }}>
                        {estadoConfig.icon}
                        <span>{estadoConfig.label}</span>
                    </div>
                </div>

                {/* Residuo Info */}
                <div className="residuo-section">
                    <div className="residuo-header">
                        <Package size={14} className="section-icon" />
                        <span className="residuo-nombre">{manifiesto.residuo || 'Residuo no especificado'}</span>
                    </div>
                    <div className="residuo-meta">
                        {manifiesto.categoria && (
                            <span className="categoria-badge">{manifiesto.categoria}</span>
                        )}
                        <span className="cantidad-text">
                            {manifiesto.cantidad} {manifiesto.unidad || 'kg'}
                        </span>
                        {manifiesto.peligrosidad && (
                            <div className="peligro-indicator" style={{ color: getPeligrosidadColor(manifiesto.peligrosidad) }}>
                                <AlertTriangle size={12} />
                                <span>P{manifiesto.peligrosidad}</span>
                            </div>
                        )}
                    </div>
                </div>

                {!compact && (
                    <>
                        {/* Actors: Generador → Transportista → Operador */}
                        <div className="actors-section">
                            <div className="actor-row">
                                <User size={12} className="actor-icon" />
                                <span className="actor-label">GEN:</span>
                                <span className="actor-name">{manifiesto.generador}</span>
                            </div>
                            {manifiesto.transportista && (
                                <div className="actor-row">
                                    <TruckIcon size={12} className="actor-icon" />
                                    <span className="actor-label">TRA:</span>
                                    <span className="actor-name">{manifiesto.transportista}</span>
                                </div>
                            )}
                            <div className="actor-row">
                                <MapPin size={12} className="actor-icon" />
                                <span className="actor-label">OPE:</span>
                                <span className="actor-name">{manifiesto.operador}</span>
                            </div>
                        </div>

                        {/* Location (si está en tránsito) */}
                        {showLocation && manifiesto.ubicacionActual && (
                            <div className="location-bar">
                                <Radio size={12} className="location-icon pulse" />
                                <span className="location-text">{manifiesto.ubicacionActual}</span>
                            </div>
                        )}

                        {/* Footer: Fecha */}
                        <div className="card-footer">
                            <span className="footer-date">{formatFecha(manifiesto.fechaCreacion)}</span>
                            {onClick && <ChevronRight size={16} className="footer-arrow" />}
                        </div>
                    </>
                )}

                {compact && (
                    <div className="compact-footer">
                        <span className="compact-actor">{manifiesto.generador}</span>
                        <ChevronRight size={14} className="footer-arrow" />
                    </div>
                )}
            </div>

            <style>{`
                .manifiesto-card {
                    background: var(--color-bg-elevated, #0f1318);
                    border: 1px solid var(--color-border-default, rgba(148, 163, 184, 0.15));
                    border-radius: var(--radius-lg, 12px);
                    padding: var(--space-4, 16px);
                    cursor: pointer;
                    transition: all var(--duration-normal, 250ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
                    position: relative;
                    overflow: hidden;
                }

                .manifiesto-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: var(--estado-color);
                    opacity: 0.8;
                }

                .manifiesto-card:active {
                    transform: scale(0.98);
                    border-color: var(--estado-color);
                    background: var(--color-bg-hover, #1f2633);
                }

                .manifiesto-card.compact {
                    padding: var(--space-3, 12px);
                }

                /* ========== HEADER ========== */
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-3, 12px);
                }

                .card-numero {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                }

                .numero-icon {
                    color: var(--color-primary, #06b6d4);
                }

                .numero-text {
                    font-family: var(--font-mono, monospace);
                    font-size: var(--text-base, 1rem);
                    font-weight: var(--font-bold, 700);
                    color: var(--color-text-bright, #f8fafc);
                    letter-spacing: -0.02em;
                }

                .estado-badge {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1, 4px);
                    padding: 4px var(--space-2, 8px);
                    border-radius: var(--radius-sm, 6px);
                    font-family: var(--font-mono, monospace);
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                }

                /* ========== RESIDUO SECTION ========== */
                .residuo-section {
                    margin-bottom: var(--space-3, 12px);
                    padding: var(--space-3, 12px);
                    background: var(--color-bg-surface, #151a21);
                    border-radius: var(--radius-md, 8px);
                    border-left: 3px solid var(--color-warning, #f59e0b);
                }

                .residuo-header {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    margin-bottom: var(--space-2, 8px);
                }

                .section-icon {
                    color: var(--color-warning, #f59e0b);
                }

                .residuo-nombre {
                    font-family: var(--font-sans);
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: var(--font-semibold, 600);
                    color: var(--color-text-primary, #e2e8f0);
                    line-height: 1.3;
                }

                .residuo-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    flex-wrap: wrap;
                }

                .categoria-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 2px 6px;
                    background: rgba(245, 158, 11, 0.2);
                    border: 1px solid var(--color-warning, #f59e0b);
                    border-radius: 4px;
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--color-warning, #f59e0b);
                    letter-spacing: 0.05em;
                }

                .cantidad-text {
                    font-family: var(--font-mono, monospace);
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--color-text-secondary, #94a3b8);
                    letter-spacing: -0.01em;
                }

                .peligro-indicator {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                }

                /* ========== ACTORS SECTION ========== */
                .actors-section {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 8px);
                    margin-bottom: var(--space-3, 12px);
                }

                .actor-row {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                }

                .actor-icon {
                    color: var(--color-text-dim, #475569);
                    flex-shrink: 0;
                }

                .actor-label {
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--color-text-muted, #64748b);
                    letter-spacing: 0.05em;
                    min-width: 32px;
                }

                .actor-name {
                    font-family: var(--font-sans);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: var(--font-medium, 500);
                    color: var(--color-text-secondary, #94a3b8);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                /* ========== LOCATION BAR ========== */
                .location-bar {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    padding: var(--space-2, 8px);
                    background: rgba(6, 182, 212, 0.1);
                    border-radius: var(--radius-md, 8px);
                    margin-bottom: var(--space-3, 12px);
                }

                .location-icon {
                    color: var(--color-primary, #06b6d4);
                    flex-shrink: 0;
                }

                .location-icon.pulse {
                    animation: location-pulse 2s infinite;
                }

                @keyframes location-pulse {
                    0%, 100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.6;
                        transform: scale(0.9);
                    }
                }

                .location-text {
                    font-family: var(--font-mono, monospace);
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--color-primary, #06b6d4);
                    letter-spacing: 0.02em;
                }

                /* ========== FOOTER ========== */
                .card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: var(--space-3, 12px);
                    border-top: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.06));
                }

                .footer-date {
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    font-weight: 500;
                    color: var(--color-text-dim, #475569);
                    letter-spacing: 0.02em;
                }

                .footer-arrow {
                    color: var(--color-text-dim, #475569);
                }

                /* ========== COMPACT MODE ========== */
                .compact-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: var(--space-2, 8px);
                }

                .compact-actor {
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: var(--font-medium, 500);
                    color: var(--color-text-secondary, #94a3b8);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
            `}</style>
        </>
    );
};

export default ManifiestoCard;
