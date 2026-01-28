/**
 * MobileShell - Mobile App Layout
 * SITREP Design System v5.0 - Versión Humanista
 *
 * Shell unificado para la app móvil:
 * - Header con título dinámico y navegación
 * - TripBanner colapsable (solo si hay viaje activo)
 * - Contenido principal (children)
 * - BottomNavigation con badges
 * - Side menu hamburger
 * - Toast notifications
 */

import React, { useState } from 'react';
import { Menu, ChevronLeft, LogOut, X } from 'lucide-react';
import TripBanner from './TripBanner';
import BottomNavigation, { type NavItem, type NavItemId } from './BottomNavigation';

export interface MobileShellProps {
    // Header
    title: string;
    showBack?: boolean;
    onBack?: () => void;

    // Trip Banner
    showTripBanner?: boolean;
    tripDuration?: number;
    tripDistance?: number;
    tripGpsStatus?: 'active' | 'weak' | 'lost';
    tripManifiestoNumero?: string;
    onTripExpand?: () => void;

    // Bottom Navigation
    navItems: NavItem[];
    activeNavId: NavItemId;
    onNavigate: (id: NavItemId) => void;
    hasActiveTrip?: boolean;

    // Side Menu
    menuItems?: Array<{
        id: string;
        label: string;
        icon: React.ReactNode;
        onClick: () => void;
    }>;
    roleName?: string;
    onChangeRole?: () => void;

    // Toast
    toastVisible?: boolean;
    toastMessage?: string;

    // Content
    children: React.ReactNode;
}

const MobileShell: React.FC<MobileShellProps> = ({
    title,
    showBack,
    onBack,
    showTripBanner,
    tripDuration = 0,
    tripDistance = 0,
    tripGpsStatus = 'lost',
    tripManifiestoNumero,
    onTripExpand,
    navItems,
    activeNavId,
    onNavigate,
    hasActiveTrip,
    menuItems = [],
    roleName,
    onChangeRole,
    toastVisible,
    toastMessage,
    children
}) => {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>
            <div className="mobile-shell">
                {/* Header */}
                <header className="app-header">
                    <div className="header-content">
                        {showBack ? (
                            <button className="header-btn" onClick={onBack} aria-label="Volver">
                                <ChevronLeft size={24} />
                            </button>
                        ) : (
                            <button className="header-btn" onClick={() => setMenuOpen(true)} aria-label="Menú">
                                <Menu size={24} />
                            </button>
                        )}
                        <h1 className="header-title">{title}</h1>
                        <div className="header-actions">
                            {/* Placeholder para acciones futuras */}
                        </div>
                    </div>
                </header>

                {/* TripBanner (si hay viaje activo) */}
                {showTripBanner && (
                    <TripBanner
                        isActive={showTripBanner}
                        duration={tripDuration}
                        distance={tripDistance}
                        gpsStatus={tripGpsStatus}
                        manifiestoNumero={tripManifiestoNumero}
                        onExpand={onTripExpand || (() => {})}
                    />
                )}

                {/* Main Content */}
                <main className="app-content">
                    {children}
                </main>

                {/* Bottom Navigation */}
                <BottomNavigation
                    items={navItems}
                    activeId={activeNavId}
                    onNavigate={onNavigate}
                    hasActiveTrip={hasActiveTrip}
                />

                {/* Side Menu */}
                {menuOpen && (
                    <>
                        <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
                        <nav className="side-menu">
                            <div className="menu-header">
                                <div className="menu-title">
                                    <h2>SITREP</h2>
                                    {roleName && <span className="menu-role">{roleName}</span>}
                                </div>
                                <button className="menu-close-btn" onClick={() => setMenuOpen(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="menu-items">
                                {menuItems.map((item) => (
                                    <button
                                        key={item.id}
                                        className="menu-item"
                                        onClick={() => {
                                            item.onClick();
                                            setMenuOpen(false);
                                        }}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                            {onChangeRole && (
                                <div className="menu-footer">
                                    <button
                                        className="menu-item logout"
                                        onClick={() => {
                                            onChangeRole();
                                            setMenuOpen(false);
                                        }}
                                    >
                                        <LogOut size={20} />
                                        <span>Cambiar Rol</span>
                                    </button>
                                </div>
                            )}
                        </nav>
                    </>
                )}

                {/* Toast */}
                {toastVisible && (
                    <div className="toast-notification">
                        <span>{toastMessage}</span>
                    </div>
                )}
            </div>

            <style>{`
                .mobile-shell {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    background: var(--color-bg-base, #F8F8F6);
                    color: var(--color-text-primary, #1A1A1A);
                    position: relative;
                    overflow: hidden;
                }

                /* ========== HEADER - Humanist Theme ========== */
                .app-header {
                    position: sticky;
                    top: 0;
                    z-index: var(--z-header, 200);
                    background: var(--color-bg-card, #FFFFFF);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
                    border-bottom: 1px solid var(--color-border-light, #E8E8E8);
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    height: var(--header-height, 60px);
                    padding: 0 var(--space-4, 16px);
                }

                .header-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: transparent;
                    border: none;
                    border-radius: var(--radius-md, 8px);
                    color: var(--color-text-secondary, #404040);
                    cursor: pointer;
                    transition: all var(--duration-fast, 150ms);
                }

                .header-btn:active {
                    background: var(--color-bg-hover, #F5F5F3);
                    transform: scale(0.95);
                }

                .header-title {
                    font-family: var(--font-sans, 'Inter', sans-serif);
                    font-size: var(--text-lg, 1.125rem);
                    font-weight: var(--font-bold, 700);
                    color: var(--color-text-primary, #1A1A1A);
                    margin: 0;
                    flex: 1;
                    text-align: center;
                    letter-spacing: -0.02em;
                }

                .header-actions {
                    width: 40px; /* Balance para centrar título */
                }

                /* ========== MAIN CONTENT ========== */
                .app-content {
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    -webkit-overflow-scrolling: touch;
                    background: var(--color-bg-base, #F8F8F6);
                }

                /* ========== SIDE MENU - Humanist Theme ========== */
                .menu-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    z-index: var(--z-sidebar, 300);
                    animation: fadeIn var(--duration-fast, 150ms) ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .side-menu {
                    position: fixed;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    width: min(80%, var(--sidebar-width, 280px));
                    background: var(--color-bg-card, #FFFFFF);
                    border-right: 1px solid var(--color-border-light, #E8E8E8);
                    z-index: calc(var(--z-sidebar, 300) + 1);
                    display: flex;
                    flex-direction: column;
                    animation: slideInLeft var(--duration-normal, 250ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
                }

                @keyframes slideInLeft {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }

                .menu-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-4, 16px);
                    border-bottom: 1px solid var(--color-border-light, #E8E8E8);
                    background: var(--color-bg-elevated, #FAFAF8);
                }

                .menu-title h2 {
                    font-family: var(--font-sans, 'Inter', sans-serif);
                    font-size: var(--text-xl, 1.25rem);
                    font-weight: var(--font-extrabold, 800);
                    color: var(--color-primary, #1B5E3C);
                    margin: 0 0 4px 0;
                    letter-spacing: 0.02em;
                }

                .menu-role {
                    font-family: var(--font-body, 'Lato', sans-serif);
                    font-size: 10px;
                    font-weight: 600;
                    color: var(--color-text-muted, #606060);
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }

                .menu-close-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: var(--color-bg-hover, #F5F5F3);
                    border: 1px solid var(--color-border-light, #E8E8E8);
                    border-radius: var(--radius-md, 8px);
                    color: var(--color-text-secondary, #404040);
                    cursor: pointer;
                }

                .menu-items {
                    flex: 1;
                    padding: var(--space-2, 8px);
                    overflow-y: auto;
                }

                .menu-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3, 12px);
                    width: 100%;
                    padding: var(--space-3, 12px) var(--space-4, 16px);
                    background: transparent;
                    border: none;
                    border-radius: var(--radius-md, 8px);
                    color: var(--color-text-secondary, #404040);
                    font-family: var(--font-sans, 'Inter', sans-serif);
                    font-size: var(--text-base, 1rem);
                    font-weight: var(--font-medium, 500);
                    text-align: left;
                    cursor: pointer;
                    transition: all var(--duration-fast, 150ms);
                }

                .menu-item:active {
                    background: var(--color-primary-lightest, #E8F5E9);
                    color: var(--color-primary, #1B5E3C);
                }

                .menu-footer {
                    padding: var(--space-2, 8px);
                    border-top: 1px solid var(--color-border-light, #E8E8E8);
                }

                .menu-item.logout {
                    color: var(--color-danger, #DC2626);
                }

                /* ========== TOAST ========== */
                .toast-notification {
                    position: fixed;
                    bottom: calc(var(--nav-height, 72px) + var(--space-4, 16px));
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--color-bg-card, #FFFFFF);
                    border: 1px solid var(--color-border-light, #E8E8E8);
                    border-radius: var(--radius-lg, 12px);
                    padding: var(--space-3, 12px) var(--space-5, 20px);
                    box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.12));
                    z-index: var(--z-toast, 600);
                    max-width: calc(100% - 32px);
                    animation: slideUp var(--duration-normal, 250ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
                }

                .toast-notification span {
                    font-family: var(--font-sans, 'Inter', sans-serif);
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: var(--font-medium, 500);
                    color: var(--color-text-primary, #1A1A1A);
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(16px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }

                /* ========== RESPONSIVE ========== */
                @media (min-width: 500px) {
                    .mobile-shell {
                        max-width: var(--mobile-frame-width, 420px);
                        margin: 0 auto;
                    }
                }
            `}</style>
        </>
    );
};

export default MobileShell;
