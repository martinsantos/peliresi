/**
 * RoleSelector - Role selection screen for mobile app
 * Industrial Control Room aesthetic with theme support
 * The first screen users see when accessing the demo app
 */

import React from 'react';
import { Shield, Factory, Truck, Building2, Download, ChevronRight, Wifi, WifiOff, Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import type { UserRole } from '../../types/mobile.types';
import { analyticsService } from '../../services/analytics.service';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import './RoleSelector.css';

interface RoleSelectorProps {
    onSelectRole: (role: UserRole) => void;
    isOnline: boolean;
    canInstall: boolean;
    isIOS: boolean;
    onInstall: () => void;
}

interface RoleOption {
    role: UserRole;
    icon: React.ReactNode;
    title: string;
    colorClass: string;
}

// Role options using CSS classes for theming
const ROLE_OPTIONS: RoleOption[] = [
    {
        role: 'ADMIN',
        icon: <Shield size={28} strokeWidth={2} />,
        title: 'Administrador',
        colorClass: 'role-admin'
    },
    {
        role: 'GENERADOR',
        icon: <Factory size={28} strokeWidth={2} />,
        title: 'Generador',
        colorClass: 'role-generador'
    },
    {
        role: 'TRANSPORTISTA',
        icon: <Truck size={28} strokeWidth={2} />,
        title: 'Transportista',
        colorClass: 'role-transportista'
    },
    {
        role: 'OPERADOR',
        icon: <Building2 size={28} strokeWidth={2} />,
        title: 'Operador',
        colorClass: 'role-operador'
    },
];

const RoleSelector: React.FC<RoleSelectorProps> = ({
    onSelectRole,
    isOnline,
    canInstall,
    isIOS,
    onInstall,
}) => {
    const push = usePushNotifications();

    const handleRoleClick = (role: UserRole) => {
        analyticsService.trackRoleSelection(role);
        analyticsService.trackPageView('home', role);
        onSelectRole(role);
    };

    const handlePushToggle = async () => {
        if (push.isSubscribed) {
            await push.unsubscribe();
        } else {
            const success = await push.subscribe();
            if (success) {
                analyticsService.trackAction('push_enabled', 'notifications', 'system');
            }
        }
    };

    return (
        <div className="app-container role-selector-container">
            {/* Connectivity indicator - floating badge */}
            <div className="connectivity-float">
                <div className={`conn-badge ${isOnline ? 'online' : 'offline'}`}>
                    {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
            </div>

            <div className="role-selection">
                {/* Logo */}
                <div className="role-logo">
                    <Shield size={36} strokeWidth={2} />
                </div>

                {/* Title */}
                <h1 className="role-title">SITREP</h1>
                <p className="role-subtitle">Sistema de Trazabilidad</p>

                {/* Role buttons */}
                <div className="role-list">
                    {ROLE_OPTIONS.map((item, index) => (
                        <button
                            key={item.role}
                            className={`role-btn ${item.colorClass}`}
                            onClick={() => handleRoleClick(item.role)}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <span className="role-icon">
                                {item.icon}
                            </span>
                            <span className="role-name">
                                {item.title}
                            </span>
                            <ChevronRight size={20} className="role-chevron" />
                        </button>
                    ))}
                </div>

                {/* Action buttons */}
                <div className="role-actions">
                    {/* Install App button */}
                    <button
                        className="action-btn action-btn-primary"
                        onClick={onInstall}
                    >
                        <Download size={18} />
                        <span>
                            {canInstall ? 'Instalar App' : isIOS ? 'Agregar a Inicio' : 'Instalar App'}
                        </span>
                    </button>

                    {/* Push Notifications button */}
                    {push.isSupported && (
                        <button
                            className={`action-btn ${push.isSubscribed ? 'action-btn-success' : 'action-btn-secondary'}`}
                            onClick={handlePushToggle}
                            disabled={push.loading}
                        >
                            {push.loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : push.isSubscribed ? (
                                <Bell size={18} />
                            ) : (
                                <BellOff size={18} />
                            )}
                            <span>
                                {push.loading
                                    ? 'Procesando...'
                                    : push.isSubscribed
                                        ? 'Notificaciones Activas'
                                        : 'Activar Notificaciones'
                                }
                            </span>
                        </button>
                    )}
                </div>

                {/* Error message with proper styling */}
                {push.error && (
                    <div className="error-banner">
                        <AlertCircle size={16} />
                        <span>{push.error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoleSelector;
