/**
 * BottomNavigation - INDUSTRIAL NAV SYSTEM
 *
 * Navegación inferior con diseño industrial premium:
 * - Iconografía clara y técnica
 * - Indicadores de estado activo con glow
 * - Badge counters para notificaciones
 * - Animaciones de transición suaves
 * - Haptic feedback visual
 */

import React from 'react';
import {
    Home, FileText, TruckIcon, User,
    Bell, MapPin, LayoutDashboard
} from 'lucide-react';

export type NavItemId = 'home' | 'manifiestos' | 'viaje' | 'historial' | 'perfil' | 'admin' | 'alertas';

export interface NavItem {
    id: NavItemId;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    isActive?: boolean;
}

interface BottomNavigationProps {
    items: NavItem[];
    activeId: NavItemId;
    onNavigate: (id: NavItemId) => void;
    hasActiveTrip?: boolean;
}

const ICON_MAP: Record<NavItemId, React.ReactNode> = {
    home: <Home size={22} />,
    manifiestos: <FileText size={22} />,
    viaje: <TruckIcon size={22} />,
    historial: <MapPin size={22} />,
    perfil: <User size={22} />,
    admin: <LayoutDashboard size={22} />,
    alertas: <Bell size={22} />
};

const BottomNavigation: React.FC<BottomNavigationProps> = ({
    items,
    activeId,
    onNavigate,
    hasActiveTrip = false
}) => {
    return (
        <>
            <nav className="bottom-navigation">
                {/* Glow line superior */}
                <div className="nav-glow-line">
                    <div className="glow-indicator" style={{
                        '--active-index': items.findIndex(item => item.id === activeId)
                    } as React.CSSProperties} />
                </div>

                {/* Nav items */}
                <div className="nav-items">
                    {items.map((item) => {
                        const isActive = item.id === activeId;
                        const Icon = ICON_MAP[item.id] || item.icon;

                        return (
                            <button
                                key={item.id}
                                className={`nav-item ${isActive ? 'active' : ''} ${item.id === 'viaje' && hasActiveTrip ? 'trip-active' : ''}`}
                                onClick={() => onNavigate(item.id)}
                                aria-label={item.label}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <div className="nav-icon-wrapper">
                                    <div className="nav-icon">
                                        {Icon}
                                    </div>
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <div className="nav-badge">
                                            <span className="badge-count">{item.badge > 99 ? '99+' : item.badge}</span>
                                        </div>
                                    )}
                                    {item.id === 'viaje' && hasActiveTrip && (
                                        <div className="trip-pulse" />
                                    )}
                                </div>
                                <span className="nav-label">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            <style>{`
                .bottom-navigation {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: var(--z-bottom-nav, 100);
                    background: var(--color-bg-elevated, #0f1318);
                    border-top: 1px solid var(--color-border-default, rgba(148, 163, 184, 0.15));
                    padding: 0;
                    padding-bottom: env(safe-area-inset-bottom, 0);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }

                /* ========== GLOW LINE ========== */
                .nav-glow-line {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: var(--color-bg-void, #050709);
                    overflow: hidden;
                }

                .glow-indicator {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    width: calc(100% / var(--nav-item-count, 4));
                    background: linear-gradient(90deg, transparent, var(--color-primary, #06b6d4), transparent);
                    transform: translateX(calc(var(--active-index, 0) * 100%));
                    transition: transform var(--duration-normal, 250ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
                    box-shadow: 0 0 12px var(--color-primary-glow, rgba(6, 182, 212, 0.5));
                }

                /* ========== NAV ITEMS ========== */
                .nav-items {
                    display: flex;
                    justify-content: space-around;
                    align-items: stretch;
                    padding: var(--space-2, 8px) 0;
                    min-height: 64px;
                }

                .nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    flex: 1;
                    background: transparent;
                    border: none;
                    padding: var(--space-2, 8px);
                    cursor: pointer;
                    position: relative;
                    transition: all var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
                    -webkit-tap-highlight-color: transparent;
                }

                .nav-item:active {
                    transform: scale(0.95);
                }

                /* ========== ICON WRAPPER ========== */
                .nav-icon-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .nav-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: var(--radius-md, 8px);
                    color: var(--color-text-muted, #64748b);
                    transition: all var(--duration-normal, 250ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
                    position: relative;
                }

                /* Estado inactivo */
                .nav-item:not(.active) .nav-icon {
                    background: transparent;
                }

                /* Estado activo */
                .nav-item.active .nav-icon {
                    background: var(--color-bg-surface, #151a21);
                    color: var(--color-primary, #06b6d4);
                    box-shadow: 0 0 16px var(--color-primary-glow, rgba(6, 182, 212, 0.3));
                }

                /* Viaje activo - pulso especial */
                .nav-item.trip-active .nav-icon {
                    background: rgba(6, 182, 212, 0.15);
                    color: var(--color-primary-bright, #22d3ee);
                    animation: trip-icon-pulse 2s infinite;
                }

                @keyframes trip-icon-pulse {
                    0%, 100% {
                        box-shadow: 0 0 16px var(--color-primary-glow, rgba(6, 182, 212, 0.4));
                    }
                    50% {
                        box-shadow: 0 0 24px var(--color-primary-glow, rgba(6, 182, 212, 0.6));
                    }
                }

                /* ========== BADGE ========== */
                .nav-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    min-width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-danger, #ef4444);
                    border: 2px solid var(--color-bg-elevated, #0f1318);
                    border-radius: var(--radius-full, 9999px);
                    animation: badge-appear 0.3s var(--ease-bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
                }

                @keyframes badge-appear {
                    from {
                        opacity: 0;
                        transform: scale(0);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .badge-count {
                    font-family: var(--font-mono, monospace);
                    font-size: 9px;
                    font-weight: 700;
                    color: #ffffff;
                    padding: 0 4px;
                    letter-spacing: -0.02em;
                }

                /* ========== TRIP PULSE ========== */
                .trip-pulse {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 12px;
                    height: 12px;
                    background: var(--color-primary-bright, #22d3ee);
                    border: 2px solid var(--color-bg-elevated, #0f1318);
                    border-radius: 50%;
                    animation: pulse-ring 2s infinite;
                }

                @keyframes pulse-ring {
                    0% {
                        box-shadow: 0 0 0 0 var(--color-primary-glow, rgba(6, 182, 212, 0.7));
                    }
                    50% {
                        box-shadow: 0 0 0 8px var(--color-primary-glow, rgba(6, 182, 212, 0));
                    }
                    100% {
                        box-shadow: 0 0 0 0 var(--color-primary-glow, rgba(6, 182, 212, 0));
                    }
                }

                /* ========== LABEL ========== */
                .nav-label {
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                    color: var(--color-text-dim, #475569);
                    transition: color var(--duration-normal, 250ms);
                    text-transform: uppercase;
                }

                .nav-item.active .nav-label {
                    color: var(--color-primary, #06b6d4);
                }

                .nav-item.trip-active .nav-label {
                    color: var(--color-primary-bright, #22d3ee);
                }

                /* ========== RESPONSIVE ========== */
                @media (max-width: 340px) {
                    .nav-label {
                        font-size: 9px;
                    }

                    .nav-icon {
                        width: 36px;
                        height: 36px;
                    }

                    .nav-icon svg {
                        width: 20px;
                        height: 20px;
                    }
                }

                @media (min-width: 500px) {
                    .bottom-navigation {
                        max-width: var(--mobile-frame-width, 420px);
                        margin: 0 auto;
                        left: 50%;
                        transform: translateX(-50%);
                    }
                }
            `}</style>
        </>
    );
};

export default BottomNavigation;
