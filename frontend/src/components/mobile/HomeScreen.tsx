/**
 * HomeScreen - Pantalla principal de la app movil
 * Extraido de MobileApp.tsx para mejorar legibilidad
 * SINCRONIZADO con Dashboard.tsx (WEB) - Usa mismo endpoint /api/manifiestos/dashboard
 */

import React from 'react';
import {
    FileText, QrCode, Navigation, Play, Clock,
    Wifi, WifiOff, RefreshCw, Edit, Truck, Award,
    Package, Recycle, TrendingUp, CheckCircle, MapPin, BarChart3,
    Plus
} from 'lucide-react';
import type { UserRole, Screen } from '../../types/mobile.types';
import { ESTADO_CONFIG } from '../../types/mobile.types';
import {
    type BackendManifiesto,
    type DisplayManifiesto,
    formatManifiestoForDisplay,
    filterManifiestosByTab
} from '../../utils/manifiestoUtils';

type TabType = 'pendientes' | 'en-curso' | 'realizados';

// ============================================
// CONFIGURACIÓN UNIFICADA CON WEB (Dashboard.tsx)
// Usa stats del backend para garantizar sincronización
// ============================================

interface StatCardConfig {
    label: string;
    value: number;
    icon: React.ComponentType<{ size: number }>;
    color: string;
}

// Tipo para estadísticas del backend (mismo que DashboardStats.estadisticas)
interface BackendStats {
    total: number;
    borradores: number;
    pendientesAprobacion?: number;
    aprobados: number;
    enTransito: number;
    entregados: number;
    recibidos: number;
    enTratamiento?: number;
    tratados: number;
}

// Función para obtener estadísticas por rol usando datos del BACKEND
// SINCRONIZADO EXACTAMENTE con Dashboard.tsx getStatCardsByRole()
const getStatsByRoleFromBackend = (role: UserRole, stats: BackendStats): StatCardConfig[] => {
    const s = stats;

    switch (role) {
        case 'GENERADOR':
            return [
                { label: 'MIS MANIFIESTOS', value: s.total ?? 0, icon: FileText, color: '#3b82f6' },
                { label: 'POR FIRMAR', value: s.borradores ?? 0, icon: Edit, color: '#f59e0b' },
                // Sincronizado con WEB: incluye pendientesAprobacion y enTratamiento
                { label: 'EN PROCESO', value: (s.pendientesAprobacion ?? 0) + (s.aprobados ?? 0) + (s.enTransito ?? 0) + (s.entregados ?? 0) + (s.recibidos ?? 0) + (s.enTratamiento ?? 0), icon: Truck, color: '#f97316' },
                { label: 'COMPLETADOS', value: s.tratados ?? 0, icon: Award, color: '#22c55e' }
            ];

        case 'TRANSPORTISTA':
            return [
                { label: 'ASIGNADOS', value: s.total ?? 0, icon: FileText, color: '#06b6d4' },
                { label: 'POR RETIRAR', value: s.aprobados ?? 0, icon: Clock, color: '#f59e0b' },
                { label: 'EN RUTA', value: s.enTransito ?? 0, icon: Truck, color: '#f97316' },
                // Sincronizado con WEB: incluye enTratamiento
                { label: 'ENTREGADOS', value: (s.entregados ?? 0) + (s.recibidos ?? 0) + (s.enTratamiento ?? 0) + (s.tratados ?? 0), icon: CheckCircle, color: '#22c55e' }
            ];

        case 'OPERADOR':
            return [
                { label: 'ENTRANTES', value: s.total ?? 0, icon: FileText, color: '#8b5cf6' },
                { label: 'POR RECIBIR', value: s.entregados ?? 0, icon: Package, color: '#f59e0b' },
                { label: 'EN TRATAMIENTO', value: (s.recibidos ?? 0) + (s.enTratamiento ?? 0), icon: Recycle, color: '#f97316' },
                { label: 'PROCESADOS', value: s.tratados ?? 0, icon: Award, color: '#22c55e' }
            ];

        default:
            return [
                { label: 'TOTAL', value: s.total ?? 0, icon: FileText, color: '#10b981' },
                { label: 'PENDIENTES', value: (s.borradores ?? 0) + (s.pendientesAprobacion ?? 0), icon: Clock, color: '#f59e0b' },
                { label: 'EN CURSO', value: (s.aprobados ?? 0) + (s.enTransito ?? 0) + (s.entregados ?? 0) + (s.recibidos ?? 0) + (s.enTratamiento ?? 0), icon: TrendingUp, color: '#3b82f6' },
                { label: 'COMPLETADOS', value: s.tratados ?? 0, icon: CheckCircle, color: '#22c55e' }
            ];
    }
};

interface HomeScreenProps {
    role: UserRole;
    manifiestos: BackendManifiesto[];
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    onSelectManifiesto: (m: DisplayManifiesto) => void;
    onNavigate: (screen: Screen) => void;
    // Estado de conectividad
    isOnline: boolean;
    syncPending: boolean;
    // Estado del viaje
    viajeActivo: boolean;
    // Handlers de acciones
    onIniciarViajeAutomatico: () => void;
    // Stats del backend (opcional, para sincronización con WEB)
    backendStats?: BackendStats;
}

function getEstadoBadge(estado: string): React.ReactElement {
    const config = ESTADO_CONFIG[estado] || { bg: '#334155', color: '#94a3b8', label: estado };
    return (
        <span className="badge" style={{ background: config.bg, color: config.color }}>
            {config.label}
        </span>
    );
}

export default function HomeScreen({
    role,
    manifiestos,
    activeTab,
    onTabChange,
    onSelectManifiesto,
    onNavigate,
    isOnline,
    syncPending,
    viajeActivo,
    onIniciarViajeAutomatico,
    backendStats
}: HomeScreenProps): React.ReactElement {
    const manifiestosFiltrados = filterManifiestosByTab(manifiestos, role, activeTab);

    // Usar stats del backend si están disponibles (sincronización con WEB)
    const statsCards = backendStats
        ? getStatsByRoleFromBackend(role, backendStats)
        : getStatsByRoleFromBackend(role, {
            // Fallback: calcular desde manifiestos (solo para offline/cache)
            total: manifiestos.length,
            borradores: manifiestos.filter(m => m.estado === 'BORRADOR').length,
            pendientesAprobacion: manifiestos.filter(m => m.estado === 'PENDIENTE_APROBACION').length,
            aprobados: manifiestos.filter(m => m.estado === 'APROBADO').length,
            enTransito: manifiestos.filter(m => m.estado === 'EN_TRANSITO').length,
            entregados: manifiestos.filter(m => m.estado === 'ENTREGADO').length,
            recibidos: manifiestos.filter(m => m.estado === 'RECIBIDO').length,
            enTratamiento: manifiestos.filter(m => m.estado === 'EN_TRATAMIENTO').length,
            tratados: manifiestos.filter(m => m.estado === 'TRATADO').length
        });

    // Para transportista: verificar si puede iniciar viaje
    const manifiestosPendientes = manifiestos.filter(m => m.estado === 'APROBADO');
    const hayViajeActivoGlobal = manifiestos.some(m => m.estado === 'EN_TRANSITO') || viajeActivo;
    const puedeIniciarViaje = manifiestosPendientes.length > 0 && !hayViajeActivoGlobal;

    function getBotonViajeLabel(): string {
        if (viajeActivo) return 'Ver Viaje';
        if (hayViajeActivoGlobal) return 'Viaje en Curso';
        return 'Iniciar Viaje'; // Siempre "Iniciar Viaje", el disabled controla si está activo
    }

    return (
        <>
            {/* Connectivity Status */}
            <div className={`connectivity-bar ${isOnline ? 'online' : 'offline'}`}>
                {syncPending ? (
                    <>
                        <RefreshCw size={14} className="spinning" />
                        <span>Sincronizando...</span>
                    </>
                ) : (
                    <>
                        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                        <span>{isOnline ? 'Conectado' : 'Modo Offline'}</span>
                    </>
                )}
            </div>

            {/* Stats Grid - 4 cards específicas por rol (sincronizado con WEB via /api/manifiestos/dashboard) */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {statsCards.map((stat, index) => {
                    const IconComponent = stat.icon;
                    return (
                        <div
                            key={index}
                            className="stat-card"
                            style={{
                                background: `linear-gradient(135deg, ${stat.color}20 0%, ${stat.color}10 100%)`,
                                borderColor: `${stat.color}40`,
                                borderWidth: '1px',
                                borderStyle: 'solid'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: stat.color }}><IconComponent size={18} /></span>
                                <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
                            </div>
                            <div className="stat-label" style={{ fontSize: '10px', marginTop: '4px' }}>{stat.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* Acciones Rápidas - Específicas por rol */}
            <div className="section">
                <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>ACCIONES RÁPIDAS</h3>
                <div className="actions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {role === 'GENERADOR' && (
                        <>
                            <button className="action-card primary" onClick={() => onNavigate('nuevo')}>
                                <Plus size={24} />
                                <span>Nuevo</span>
                            </button>
                            <button className="action-card" onClick={() => onNavigate('manifiestos')}>
                                <FileText size={24} />
                                <span>Manifiestos</span>
                            </button>
                            <button className="action-card" onClick={() => onNavigate('alertas')}>
                                <MapPin size={24} />
                                <span>Seguimiento</span>
                            </button>
                        </>
                    )}
                    {role === 'TRANSPORTISTA' && (
                        <>
                            <button
                                className={`action-card ${viajeActivo ? 'active' : ''} ${!puedeIniciarViaje && !viajeActivo ? 'disabled' : ''}`}
                                onClick={viajeActivo
                                    ? () => onNavigate('viaje')
                                    : puedeIniciarViaje
                                        ? onIniciarViajeAutomatico
                                        : undefined}
                                disabled={!viajeActivo && !puedeIniciarViaje}
                                style={{ background: viajeActivo ? 'linear-gradient(135deg, #f59e0b30, #f59e0b20)' : undefined }}
                            >
                                {viajeActivo ? <Navigation size={24} /> : <Play size={24} />}
                                <span>{getBotonViajeLabel()}</span>
                            </button>
                            <button className="action-card primary" onClick={() => onNavigate('escanear')}>
                                <QrCode size={24} />
                                <span>Escanear QR</span>
                            </button>
                            <button className="action-card" onClick={() => onNavigate('historial-viajes')}
                                style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--ind-panel) 100%)' }}>
                                <Clock size={24} style={{ color: 'var(--ind-cyan)' }} />
                                <span style={{ color: 'var(--ind-cyan)' }}>Historial</span>
                            </button>
                        </>
                    )}
                    {role === 'OPERADOR' && (
                        <>
                            <button className="action-card primary" onClick={() => onNavigate('manifiestos')}>
                                <Package size={24} />
                                <span>Llegadas</span>
                            </button>
                            <button className="action-card" onClick={() => onNavigate('escanear')}>
                                <QrCode size={24} />
                                <span>Escanear QR</span>
                            </button>
                            <button className="action-card" onClick={() => onNavigate('alertas')}>
                                <BarChart3 size={24} />
                                <span>Reportes</span>
                            </button>
                        </>
                    )}
                </div>
                {role === 'TRANSPORTISTA' && !viajeActivo && manifiestosPendientes.length === 0 && !hayViajeActivoGlobal && (
                    <p className="info-text" style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '8px',
                        textAlign: 'center'
                    }}>
                        No hay manifiestos pendientes de transporte
                    </p>
                )}
            </div>

            {/* Tabs de historial */}
            <div className="section">
                <div className="tabs-container">
                    <button
                        className={`tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
                        onClick={() => onTabChange('pendientes')}
                    >
                        Pendientes
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'en-curso' ? 'active' : ''}`}
                        onClick={() => onTabChange('en-curso')}
                    >
                        En Curso
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'realizados' ? 'active' : ''}`}
                        onClick={() => onTabChange('realizados')}
                    >
                        Realizados
                    </button>
                </div>
                <div className="list">
                    {manifiestosFiltrados.length > 0 ? (
                        manifiestosFiltrados.map(m => {
                            const display = formatManifiestoForDisplay(m);
                            return (
                                <div
                                    key={display.id}
                                    className="list-item"
                                    onClick={() => onSelectManifiesto(display)}
                                >
                                    <div className="list-icon"><FileText size={18} /></div>
                                    <div className="list-body">
                                        <div className="list-title">#{display.numero}</div>
                                        <div className="list-sub">{display.generador} → {display.operador}</div>
                                        <div className="list-meta" style={{
                                            display: 'flex',
                                            gap: '8px',
                                            marginTop: '4px',
                                            fontSize: '11px',
                                            color: 'var(--ind-text-mid)'
                                        }}>
                                            <span style={{ color: 'var(--ind-cyan)' }}>{display.residuo}</span>
                                            <span style={{ color: 'var(--ind-orange)' }}>{display.cantidad}</span>
                                            {display.fecha && <span>{display.fecha}</span>}
                                        </div>
                                    </div>
                                    <div className="list-badge">{getEstadoBadge(display.estado)}</div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state">
                            <FileText size={32} />
                            <p>No hay manifiestos {
                                activeTab === 'pendientes' ? 'pendientes' :
                                activeTab === 'en-curso' ? 'en curso' :
                                'realizados'
                            }</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
