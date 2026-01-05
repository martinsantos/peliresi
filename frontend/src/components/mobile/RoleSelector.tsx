/**
 * RoleSelector - Role selection screen for mobile app
 * Extracted from MobileApp.tsx (lines 537-604)
 * The first screen users see when accessing the demo app
 */

import React from 'react';
import { Shield, Factory, Truck, Building2, Download, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import type { UserRole } from '../../types/mobile.types';
import { analyticsService } from '../../services/analytics.service';

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
    gradient: string;
}

const ROLE_OPTIONS: RoleOption[] = [
    { 
        role: 'ADMIN', 
        icon: <Shield size={30} strokeWidth={2.5} />, 
        title: 'Administrador', 
        gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' 
    },
    { 
        role: 'GENERADOR', 
        icon: <Factory size={30} strokeWidth={2.5} />, 
        title: 'Generador', 
        gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)' 
    },
    { 
        role: 'TRANSPORTISTA', 
        icon: <Truck size={30} strokeWidth={2.5} />, 
        title: 'Transportista', 
        gradient: 'linear-gradient(135deg, #f59e0b, #ea580c)' 
    },
    { 
        role: 'OPERADOR', 
        icon: <Building2 size={30} strokeWidth={2.5} />, 
        title: 'Operador', 
        gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' 
    },
];

const RoleSelector: React.FC<RoleSelectorProps> = ({
    onSelectRole,
    isOnline,
    canInstall,
    isIOS,
    onInstall,
}) => {
    const handleRoleClick = (role: UserRole) => {
        analyticsService.trackRoleSelection(role);
        analyticsService.trackPageView('home', role);
        onSelectRole(role);
    };

    return (
        <div className="app-container">
            {/* Connectivity indicator */}
            <div className="connectivity-float">
                <div className={`conn-badge ${isOnline ? 'online' : 'offline'}`}>
                    {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
            </div>

            <div className="role-selection">
                <div className="role-logo" style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)'
                }}>
                    <Shield size={36} strokeWidth={2} />
                </div>
                <h1 style={{ color: '#ffffff' }}>SITREP</h1>
                <p style={{ color: '#94a3b8' }}>Sistema de Trazabilidad</p>

                <div className="role-list">
                    {ROLE_OPTIONS.map((item) => (
                        <button
                            key={item.role}
                            className="role-btn"
                            onClick={() => handleRoleClick(item.role)}
                        >
                            <span className="role-icon" style={{
                                background: item.gradient,
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                            }}>
                                <span style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                                }}>
                                    {item.icon}
                                </span>
                            </span>
                            <span className="role-name" style={{ color: '#ffffff', fontWeight: 600 }}>
                                {item.title}
                            </span>
                            <ChevronRight size={22} style={{ color: '#94a3b8' }} />
                        </button>
                    ))}
                </div>

                <button 
                    className="install-hint" 
                    onClick={onInstall} 
                    style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#10b981'
                    }}
                >
                    <Download size={18} />
                    <span>
                        {canInstall ? 'Instalar App' : isIOS ? 'Agregar a Inicio' : 'Instalar App'}
                    </span>
                </button>
            </div>
        </div>
    );
};

export default RoleSelector;
