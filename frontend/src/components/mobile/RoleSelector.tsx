/**
 * RoleSelector - Role selection screen for mobile app
 * Industrial Control Room aesthetic with theme support
 * The first screen users see when accessing the demo app
 *
 * Updated: Now shows actor selection when clicking on a role
 */

import React, { useState, useEffect } from 'react';
import { Shield, Factory, Truck, Building2, Download, ChevronRight, ChevronLeft, Wifi, WifiOff, Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import type { UserRole } from '../../types/mobile.types';
import { analyticsService } from '../../services/analytics.service';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { demoService, type DemoRole, type DemoActor } from '../../services/demo.service';
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

    // State for actor selection
    const [availableRoles, setAvailableRoles] = useState<DemoRole[]>([]);
    const [selectedRoleData, setSelectedRoleData] = useState<DemoRole | null>(null);
    const [loadingActors, setLoadingActors] = useState(false);
    const [actorError, setActorError] = useState<string | null>(null);

    // Load available profiles on mount
    useEffect(() => {
        const loadProfiles = async () => {
            try {
                const data = await demoService.getAvailableProfiles();
                setAvailableRoles(data.availableRoles);
            } catch (err) {
                console.log('Demo profiles not available:', err);
                // Si falla, funciona sin selección de actores (modo legacy)
            }
        };
        if (isOnline) {
            loadProfiles();
        }
    }, [isOnline]);

    const handleRoleClick = (role: UserRole) => {
        // Find role data to check if it has actors
        const roleData = availableRoles.find(r => r.role === role);

        if (roleData && roleData.actors.length > 0) {
            // Show actor selection
            setSelectedRoleData(roleData);
            setActorError(null);
        } else {
            // No actors, proceed directly (ADMIN or fallback)
            proceedWithRole(role);
        }
    };

    const handleActorSelect = async (actor: DemoActor) => {
        if (!selectedRoleData) return;

        setLoadingActors(true);
        setActorError(null);

        try {
            // Validate and apply demo profile
            await demoService.validateProfile(selectedRoleData.role, actor.id);
            demoService.setActiveProfile({
                role: selectedRoleData.role,
                actorId: actor.id
            });

            // Proceed with the selected role
            proceedWithRole(selectedRoleData.role as UserRole);
        } catch (err: any) {
            console.error('Error selecting actor:', err);
            setActorError(err.response?.data?.error?.message || 'Error al seleccionar actor');
        } finally {
            setLoadingActors(false);
        }
    };

    const proceedWithRole = (role: UserRole) => {
        analyticsService.trackRoleSelection(role);
        analyticsService.trackPageView('home', role);
        onSelectRole(role);
    };

    const handleBackFromActors = () => {
        setSelectedRoleData(null);
        setActorError(null);
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

    // Actor selection view
    if (selectedRoleData) {
        const roleOption = ROLE_OPTIONS.find(r => r.role === selectedRoleData.role);
        return (
            <div className="app-container role-selector-container">
                <div className="connectivity-float">
                    <div className={`conn-badge ${isOnline ? 'online' : 'offline'}`}>
                        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                        <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                </div>

                <div className="role-selection actor-selection">
                    {/* Back button */}
                    <button className="actor-back-btn" onClick={handleBackFromActors}>
                        <ChevronLeft size={24} />
                        <span>Volver</span>
                    </button>

                    {/* Header with role info */}
                    <div className={`actor-header ${roleOption?.colorClass || ''}`}>
                        <div className="actor-header-icon">
                            {roleOption?.icon}
                        </div>
                        <h2>{selectedRoleData.name}</h2>
                        <p>{selectedRoleData.description}</p>
                    </div>

                    {/* Actor list */}
                    <div className="actor-list">
                        <p className="actor-list-hint">Selecciona un {selectedRoleData.name.toLowerCase()}:</p>

                        {selectedRoleData.actors.map((actor, index) => (
                            <button
                                key={actor.id}
                                className="actor-btn"
                                onClick={() => handleActorSelect(actor)}
                                disabled={loadingActors}
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <div className="actor-btn-info">
                                    <span className="actor-btn-name">{actor.name}</span>
                                    <span className="actor-btn-detail">{actor.cuit} · {actor.detail}</span>
                                </div>
                                {loadingActors ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <ChevronRight size={18} />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Error */}
                    {actorError && (
                        <div className="error-banner">
                            <AlertCircle size={16} />
                            <span>{actorError}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

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
