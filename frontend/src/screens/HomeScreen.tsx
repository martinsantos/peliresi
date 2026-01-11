/**
 * HomeScreen - INDUSTRIAL COMMAND CENTER
 *
 * Dashboard principal adaptado por rol:
 * - GENERADOR: Crear manifiestos, historial, estadísticas
 * - TRANSPORTISTA: Viajes activos, manifiestos asignados, rutas
 * - ADMIN: Overview global, aprobaciones pendientes, monitoreo
 *
 * Estética: Control panel industrial, datos en vivo, badges técnicos
 */

import React from 'react';
import {
    FileText, TruckIcon, Clock, AlertTriangle,
    CheckCircle, Package, Navigation,
    Radio, Activity, ChevronRight, Archive
} from 'lucide-react';

export type UserRole = 'GENERADOR' | 'TRANSPORTISTA' | 'ADMIN';

export interface HomeScreenStats {
    // GENERADOR
    manifestosActivos?: number;
    manifestosBorrador?: number;
    manifestosEntregados?: number;

    // TRANSPORTISTA
    viajesEnCurso?: number;
    manifestosAsignados?: number;
    kmRecorridos?: number;

    // ADMIN
    totalManifiestos?: number;
    pendientesAprobacion?: number;
    viajesActivos?: number;
    alertasActivas?: number;
}

export interface QuickAction {
    id: string;
    label: string;
    sublabel?: string;
    icon: React.ReactNode;
    variant: 'primary' | 'success' | 'warning' | 'danger';
    onClick: () => void;
}

export interface AlertItem {
    id: string;
    tipo: 'warning' | 'error' | 'info';
    mensaje: string;
    timestamp: string;
}

interface HomeScreenProps {
    role: UserRole;
    userName: string;
    stats: HomeScreenStats;
    quickActions: QuickAction[];
    recentAlerts?: AlertItem[];
    isOnline: boolean;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
    role,
    userName,
    stats,
    quickActions,
    recentAlerts = [],
    isOnline
}) => {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 20) return 'Buenas tardes';
        return 'Buenas noches';
    };

    const getRoleLabel = () => {
        switch (role) {
            case 'GENERADOR': return 'GENERADOR';
            case 'TRANSPORTISTA': return 'TRANSPORTISTA';
            case 'ADMIN': return 'ADMINISTRADOR';
        }
    };

    const getRoleColor = () => {
        switch (role) {
            case 'GENERADOR': return 'var(--color-accent, #8b5cf6)';
            case 'TRANSPORTISTA': return 'var(--color-primary, #06b6d4)';
            case 'ADMIN': return 'var(--color-warning, #f59e0b)';
        }
    };

    const renderStatsGrid = () => {
        if (role === 'GENERADOR') {
            return (
                <div className="stats-grid">
                    <StatCard
                        icon={<FileText size={20} />}
                        label="Activos"
                        value={stats.manifestosActivos || 0}
                        sublabel="manifiestos"
                        color="var(--color-primary)"
                    />
                    <StatCard
                        icon={<Archive size={20} />}
                        label="Borradores"
                        value={stats.manifestosBorrador || 0}
                        sublabel="pendientes"
                        color="var(--color-text-muted)"
                    />
                    <StatCard
                        icon={<CheckCircle size={20} />}
                        label="Entregados"
                        value={stats.manifestosEntregados || 0}
                        sublabel="completados"
                        color="var(--color-success)"
                    />
                </div>
            );
        }

        if (role === 'TRANSPORTISTA') {
            return (
                <div className="stats-grid">
                    <StatCard
                        icon={<TruckIcon size={20} />}
                        label="Viajes"
                        value={stats.viajesEnCurso || 0}
                        sublabel="en curso"
                        color="var(--color-primary)"
                        pulse={stats.viajesEnCurso ? true : false}
                    />
                    <StatCard
                        icon={<Package size={20} />}
                        label="Manifiestos"
                        value={stats.manifestosAsignados || 0}
                        sublabel="asignados"
                        color="var(--color-warning)"
                    />
                    <StatCard
                        icon={<Navigation size={20} />}
                        label="Distancia"
                        value={stats.kmRecorridos || 0}
                        sublabel="km totales"
                        color="var(--color-success)"
                    />
                </div>
            );
        }

        // ADMIN
        return (
            <div className="stats-grid admin">
                <StatCard
                    icon={<FileText size={20} />}
                    label="Total"
                    value={stats.totalManifiestos || 0}
                    sublabel="manifiestos"
                    color="var(--color-primary)"
                />
                <StatCard
                    icon={<Clock size={20} />}
                    label="Pendientes"
                    value={stats.pendientesAprobacion || 0}
                    sublabel="aprobación"
                    color="var(--color-warning)"
                    pulse={stats.pendientesAprobacion ? true : false}
                />
                <StatCard
                    icon={<Activity size={20} />}
                    label="Viajes"
                    value={stats.viajesActivos || 0}
                    sublabel="activos ahora"
                    color="var(--color-success)"
                />
                <StatCard
                    icon={<AlertTriangle size={20} />}
                    label="Alertas"
                    value={stats.alertasActivas || 0}
                    sublabel="activas"
                    color="var(--color-danger)"
                    pulse={stats.alertasActivas ? true : false}
                />
            </div>
        );
    };

    const getVariantColor = (variant: string) => {
        switch (variant) {
            case 'primary': return 'var(--color-primary)';
            case 'success': return 'var(--color-success)';
            case 'warning': return 'var(--color-warning)';
            case 'danger': return 'var(--color-danger)';
            default: return 'var(--color-primary)';
        }
    };

    return (
        <>
            <div className="home-screen">
                {/* Header con rol y estado */}
                <div className="home-header">
                    <div className="header-top">
                        <div className="greeting">
                            <h1 className="greeting-text">{getGreeting()}</h1>
                            <p className="user-name">{userName}</p>
                        </div>
                        <div className="status-indicators">
                            <div className={`connection-badge ${isOnline ? 'online' : 'offline'}`}>
                                <Radio size={12} />
                                <span>{isOnline ? 'EN LÍNEA' : 'OFFLINE'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="role-badge" style={{ borderColor: getRoleColor() }}>
                        <div className="role-dot" style={{ background: getRoleColor() }} />
                        <span className="role-label">{getRoleLabel()}</span>
                    </div>
                </div>

                {/* Stats Grid */}
                {renderStatsGrid()}

                {/* Quick Actions */}
                <div className="quick-actions-section">
                    <h2 className="section-title">
                        <span className="title-accent">//</span> ACCIONES RÁPIDAS
                    </h2>
                    <div className="quick-actions-grid">
                        {quickActions.map((action) => (
                            <button
                                key={action.id}
                                className="quick-action-btn"
                                onClick={action.onClick}
                                style={{
                                    borderColor: getVariantColor(action.variant),
                                    '--glow-color': getVariantColor(action.variant)
                                } as React.CSSProperties}
                            >
                                <div className="action-icon" style={{ color: getVariantColor(action.variant) }}>
                                    {action.icon}
                                </div>
                                <div className="action-content">
                                    <span className="action-label">{action.label}</span>
                                    {action.sublabel && (
                                        <span className="action-sublabel">{action.sublabel}</span>
                                    )}
                                </div>
                                <ChevronRight size={18} className="action-arrow" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent Alerts (si hay) */}
                {recentAlerts.length > 0 && (
                    <div className="alerts-section">
                        <h2 className="section-title">
                            <span className="title-accent">//</span> ALERTAS RECIENTES
                        </h2>
                        <div className="alerts-list">
                            {recentAlerts.slice(0, 3).map((alert) => (
                                <div key={alert.id} className={`alert-item ${alert.tipo}`}>
                                    <div className="alert-indicator" />
                                    <div className="alert-content">
                                        <p className="alert-message">{alert.mensaje}</p>
                                        <span className="alert-time">{alert.timestamp}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .home-screen {
                    padding: var(--space-4, 16px);
                    padding-bottom: calc(var(--nav-height, 72px) + var(--space-6, 24px));
                    min-height: 100%;
                }

                /* ========== HEADER ========== */
                .home-header {
                    margin-bottom: var(--space-6, 24px);
                }

                .header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: var(--space-3, 12px);
                }

                .greeting {
                    flex: 1;
                }

                .greeting-text {
                    font-family: var(--font-sans);
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: var(--font-medium, 500);
                    color: var(--color-text-muted, #64748b);
                    margin: 0 0 2px 0;
                    letter-spacing: 0.02em;
                }

                .user-name {
                    font-family: var(--font-sans);
                    font-size: var(--text-2xl, 1.5rem);
                    font-weight: var(--font-bold, 700);
                    color: var(--color-text-bright, #f8fafc);
                    margin: 0;
                    letter-spacing: -0.02em;
                }

                .status-indicators {
                    display: flex;
                    gap: var(--space-2, 8px);
                }

                .connection-badge {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1, 4px);
                    padding: var(--space-1, 4px) var(--space-2, 8px);
                    background: var(--color-bg-surface, #151a21);
                    border: 1px solid var(--color-border-default, rgba(148, 163, 184, 0.15));
                    border-radius: var(--radius-full, 9999px);
                    font-family: var(--font-mono, monospace);
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.05em;
                }

                .connection-badge.online {
                    border-color: var(--color-success, #10b981);
                    color: var(--color-success, #10b981);
                }

                .connection-badge.offline {
                    border-color: var(--color-text-dim, #475569);
                    color: var(--color-text-dim, #475569);
                }

                .connection-badge.online svg {
                    animation: pulse-dot 2s infinite;
                }

                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }

                .role-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    padding: var(--space-2, 8px) var(--space-4, 16px);
                    background: var(--color-bg-surface, #151a21);
                    border: 1.5px solid;
                    border-radius: var(--radius-lg, 12px);
                    position: relative;
                    overflow: hidden;
                }

                .role-badge::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: currentColor;
                    opacity: 0.05;
                }

                .role-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    animation: glow-pulse 2s infinite;
                }

                @keyframes glow-pulse {
                    0%, 100% {
                        box-shadow: 0 0 8px currentColor;
                        opacity: 1;
                    }
                    50% {
                        box-shadow: 0 0 16px currentColor;
                        opacity: 0.8;
                    }
                }

                .role-label {
                    font-family: var(--font-mono, monospace);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    color: var(--color-text-bright, #f8fafc);
                }

                /* ========== STATS GRID ========== */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--space-3, 12px);
                    margin-bottom: var(--space-6, 24px);
                }

                .stats-grid.admin {
                    grid-template-columns: repeat(2, 1fr);
                }

                /* ========== SECTION TITLES ========== */
                .section-title {
                    font-family: var(--font-mono, monospace);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.15em;
                    color: var(--color-text-muted, #64748b);
                    margin: 0 0 var(--space-3, 12px) 0;
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                }

                .title-accent {
                    color: var(--color-primary, #06b6d4);
                    font-weight: 700;
                }

                /* ========== QUICK ACTIONS ========== */
                .quick-actions-section {
                    margin-bottom: var(--space-6, 24px);
                }

                .quick-actions-grid {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3, 12px);
                }

                .quick-action-btn {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3, 12px);
                    padding: var(--space-4, 16px);
                    background: var(--color-bg-elevated, #0f1318);
                    border: 1.5px solid;
                    border-radius: var(--radius-lg, 12px);
                    cursor: pointer;
                    transition: all var(--duration-normal, 250ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
                    position: relative;
                    overflow: hidden;
                }

                .quick-action-btn::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: var(--glow-color);
                    opacity: 0;
                    transition: opacity var(--duration-normal, 250ms);
                }

                .quick-action-btn:active {
                    transform: scale(0.98);
                    border-color: var(--glow-color);
                }

                .quick-action-btn:active::before {
                    opacity: 0.1;
                }

                .action-icon {
                    flex-shrink: 0;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-bg-surface, #151a21);
                    border-radius: var(--radius-md, 8px);
                    position: relative;
                    z-index: 1;
                }

                .action-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                    position: relative;
                    z-index: 1;
                }

                .action-label {
                    font-family: var(--font-sans);
                    font-size: var(--text-base, 1rem);
                    font-weight: var(--font-semibold, 600);
                    color: var(--color-text-bright, #f8fafc);
                    letter-spacing: -0.01em;
                }

                .action-sublabel {
                    font-family: var(--font-mono, monospace);
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--color-text-muted, #64748b);
                    letter-spacing: 0.02em;
                }

                .action-arrow {
                    flex-shrink: 0;
                    color: var(--color-text-dim, #475569);
                    position: relative;
                    z-index: 1;
                }

                /* ========== ALERTS ========== */
                .alerts-section {
                    margin-bottom: var(--space-6, 24px);
                }

                .alerts-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 8px);
                }

                .alert-item {
                    display: flex;
                    gap: var(--space-3, 12px);
                    padding: var(--space-3, 12px);
                    background: var(--color-bg-elevated, #0f1318);
                    border-left: 3px solid;
                    border-radius: var(--radius-md, 8px);
                }

                .alert-item.warning { border-color: var(--color-warning, #f59e0b); }
                .alert-item.error { border-color: var(--color-danger, #ef4444); }
                .alert-item.info { border-color: var(--color-primary, #06b6d4); }

                .alert-indicator {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    margin-top: 6px;
                    flex-shrink: 0;
                }

                .alert-item.warning .alert-indicator { background: var(--color-warning, #f59e0b); }
                .alert-item.error .alert-indicator { background: var(--color-danger, #ef4444); }
                .alert-item.info .alert-indicator { background: var(--color-primary, #06b6d4); }

                .alert-content {
                    flex: 1;
                    min-width: 0;
                }

                .alert-message {
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: var(--font-medium, 500);
                    color: var(--color-text-primary, #e2e8f0);
                    margin: 0 0 4px 0;
                    line-height: 1.4;
                }

                .alert-time {
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    font-weight: 500;
                    color: var(--color-text-dim, #475569);
                    letter-spacing: 0.02em;
                }
            `}</style>
        </>
    );
};

// ========== STAT CARD COMPONENT ==========
interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    sublabel: string;
    color: string;
    pulse?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, sublabel, color, pulse }) => {
    return (
        <>
            <div className="stat-card" style={{ '--stat-color': color } as React.CSSProperties}>
                <div className="stat-icon-wrapper">
                    <div className={`stat-icon ${pulse ? 'pulse' : ''}`} style={{ color }}>
                        {icon}
                    </div>
                </div>
                <div className="stat-content">
                    <div className="stat-label">{label}</div>
                    <div className="stat-value">{value}</div>
                    <div className="stat-sublabel">{sublabel}</div>
                </div>
            </div>

            <style>{`
                .stat-card {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 8px);
                    padding: var(--space-3, 12px);
                    background: var(--color-bg-elevated, #0f1318);
                    border: 1px solid var(--color-border-default, rgba(148, 163, 184, 0.15));
                    border-radius: var(--radius-lg, 12px);
                    position: relative;
                    overflow: hidden;
                }

                .stat-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: var(--stat-color);
                    opacity: 0.6;
                }

                .stat-icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                }

                .stat-icon {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: var(--radius-md, 8px);
                }

                .stat-icon.pulse {
                    animation: icon-pulse 2s infinite;
                }

                @keyframes icon-pulse {
                    0%, 100% {
                        box-shadow: 0 0 8px currentColor;
                        opacity: 1;
                    }
                    50% {
                        box-shadow: 0 0 16px currentColor;
                        opacity: 0.8;
                    }
                }

                .stat-content {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .stat-label {
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted, #64748b);
                    text-transform: uppercase;
                }

                .stat-value {
                    font-family: var(--font-sans);
                    font-size: var(--text-2xl, 1.5rem);
                    font-weight: var(--font-bold, 700);
                    color: var(--color-text-bright, #f8fafc);
                    line-height: 1;
                    letter-spacing: -0.03em;
                }

                .stat-sublabel {
                    font-family: var(--font-mono, monospace);
                    font-size: 9px;
                    font-weight: 500;
                    color: var(--color-text-dim, #475569);
                    letter-spacing: 0.02em;
                }
            `}</style>
        </>
    );
};

export default HomeScreen;
