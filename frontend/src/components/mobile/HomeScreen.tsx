/**
 * HomeScreen - Pantalla principal de la app movil
 * Extraido de MobileApp.tsx para mejorar legibilidad
 * SINCRONIZADO con Dashboard.tsx (WEB) - Usa mismo endpoint /api/manifiestos/dashboard
 * SITREP Design System v5.0 - Versión Humanista Mobile
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    FileText, QrCode, Navigation, Play, Clock,
    Wifi, WifiOff, RefreshCw, Edit, Truck, Award,
    Package, Recycle, TrendingUp, CheckCircle, MapPin, BarChart3,
    Plus
} from 'lucide-react';
import type { GlowVariant } from '../ui';
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
    glowVariant: GlowVariant;
}

// Humanist color mappings for stat cards (light theme)
const humanistColors: Record<GlowVariant, { bg: string; border: string; iconBg: string }> = {
    cyan: { bg: '#FFFFFF', border: '#2563EB', iconBg: 'rgba(37, 99, 235, 0.1)' },
    green: { bg: '#FFFFFF', border: '#059669', iconBg: 'rgba(5, 150, 105, 0.1)' },
    amber: { bg: '#FFFFFF', border: '#D97706', iconBg: 'rgba(217, 119, 6, 0.1)' },
    red: { bg: '#FFFFFF', border: '#DC2626', iconBg: 'rgba(220, 38, 38, 0.1)' },
    purple: { bg: '#FFFFFF', border: '#7C3AED', iconBg: 'rgba(124, 58, 237, 0.1)' },
    blue: { bg: '#FFFFFF', border: '#2563EB', iconBg: 'rgba(37, 99, 235, 0.1)' },
    default: { bg: '#FFFFFF', border: '#1B5E3C', iconBg: 'rgba(27, 94, 60, 0.1)' },
};

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
                { label: 'MIS MANIFIESTOS', value: s.total ?? 0, icon: FileText, color: '#3b82f6', glowVariant: 'blue' },
                { label: 'POR FIRMAR', value: s.borradores ?? 0, icon: Edit, color: '#ffb800', glowVariant: 'amber' },
                // Sincronizado con WEB: incluye pendientesAprobacion y enTratamiento
                { label: 'EN PROCESO', value: (s.pendientesAprobacion ?? 0) + (s.aprobados ?? 0) + (s.enTransito ?? 0) + (s.entregados ?? 0) + (s.recibidos ?? 0) + (s.enTratamiento ?? 0), icon: Truck, color: '#ffb800', glowVariant: 'amber' },
                { label: 'COMPLETADOS', value: s.tratados ?? 0, icon: Award, color: '#22ff66', glowVariant: 'green' }
            ];

        case 'TRANSPORTISTA':
            return [
                { label: 'ASIGNADOS', value: s.total ?? 0, icon: FileText, color: '#00fff2', glowVariant: 'cyan' },
                { label: 'POR RETIRAR', value: s.aprobados ?? 0, icon: Clock, color: '#ffb800', glowVariant: 'amber' },
                { label: 'EN RUTA', value: s.enTransito ?? 0, icon: Truck, color: '#ffb800', glowVariant: 'amber' },
                // Sincronizado con WEB: incluye enTratamiento
                { label: 'ENTREGADOS', value: (s.entregados ?? 0) + (s.recibidos ?? 0) + (s.enTratamiento ?? 0) + (s.tratados ?? 0), icon: CheckCircle, color: '#22ff66', glowVariant: 'green' }
            ];

        case 'OPERADOR':
            return [
                { label: 'ENTRANTES', value: s.total ?? 0, icon: FileText, color: '#a855f7', glowVariant: 'purple' },
                { label: 'POR RECIBIR', value: s.entregados ?? 0, icon: Package, color: '#ffb800', glowVariant: 'amber' },
                { label: 'EN TRATAMIENTO', value: (s.recibidos ?? 0) + (s.enTratamiento ?? 0), icon: Recycle, color: '#ffb800', glowVariant: 'amber' },
                { label: 'PROCESADOS', value: s.tratados ?? 0, icon: Award, color: '#22ff66', glowVariant: 'green' }
            ];

        default:
            return [
                { label: 'TOTAL', value: s.total ?? 0, icon: FileText, color: '#22ff66', glowVariant: 'green' },
                { label: 'PENDIENTES', value: (s.borradores ?? 0) + (s.pendientesAprobacion ?? 0), icon: Clock, color: '#ffb800', glowVariant: 'amber' },
                { label: 'EN CURSO', value: (s.aprobados ?? 0) + (s.enTransito ?? 0) + (s.entregados ?? 0) + (s.recibidos ?? 0) + (s.enTratamiento ?? 0), icon: TrendingUp, color: '#00fff2', glowVariant: 'cyan' },
                { label: 'COMPLETADOS', value: s.tratados ?? 0, icon: CheckCircle, color: '#22ff66', glowVariant: 'green' }
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

            {/* Stats Grid - Humanist Theme Cards v5.0 */}
            <motion.div
                className="stats-grid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}
                initial="hidden"
                animate="show"
                variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
                }}
            >
                {statsCards.map((stat, index) => {
                    const IconComponent = stat.icon;
                    const humanistStyle = humanistColors[stat.glowVariant];
                    return (
                        <motion.div
                            key={index}
                            className="stat-card humanist-stat-card"
                            variants={{
                                hidden: { y: 15, opacity: 0, scale: 0.95 },
                                show: { y: 0, opacity: 1, scale: 1, transition: { duration: 0.35 } }
                            }}
                            whileTap={{ scale: 0.97 }}
                            style={{
                                background: humanistStyle.bg,
                                borderColor: '#E8E8E8',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderRadius: '12px',
                                position: 'relative',
                                overflow: 'hidden',
                                borderLeft: `3px solid ${stat.color}`,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 1 }}>
                                <span
                                    style={{
                                        color: stat.color,
                                        background: humanistStyle.iconBg,
                                        padding: '8px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <IconComponent size={18} />
                                </span>
                                <div
                                    className="stat-value"
                                    style={{
                                        color: '#1A1A1A',
                                        fontFamily: "'Inter', sans-serif",
                                        fontWeight: 700,
                                        fontSize: '1.5rem'
                                    }}
                                >
                                    {stat.value.toLocaleString()}
                                </div>
                            </div>
                            <div
                                className="stat-label"
                                style={{
                                    fontSize: '10px',
                                    marginTop: '6px',
                                    fontWeight: 600,
                                    letterSpacing: '0.04em',
                                    color: '#606060',
                                    textTransform: 'uppercase',
                                    position: 'relative',
                                    zIndex: 1
                                }}
                            >
                                {stat.label}
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

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
                                style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                                <Clock size={24} style={{ color: '#2563EB' }} />
                                <span style={{ color: '#2563EB' }}>Historial</span>
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
                <motion.div
                    className="list"
                    initial="hidden"
                    animate="show"
                    variants={{
                        hidden: { opacity: 0 },
                        show: { opacity: 1, transition: { staggerChildren: 0.06 } }
                    }}
                >
                    {manifiestosFiltrados.length > 0 ? (
                        manifiestosFiltrados.map(m => {
                            const display = formatManifiestoForDisplay(m);
                            return (
                                <motion.div
                                    key={display.id}
                                    className="list-item"
                                    onClick={() => onSelectManifiesto(display)}
                                    variants={{
                                        hidden: { x: -15, opacity: 0 },
                                        show: { x: 0, opacity: 1, transition: { duration: 0.3 } }
                                    }}
                                    whileTap={{ scale: 0.98 }}
                                    whileHover={{ x: 4, backgroundColor: 'rgba(27, 94, 60, 0.04)' }}
                                    style={{
                                        background: '#FFFFFF',
                                        border: '1px solid #E8E8E8',
                                        borderRadius: '12px',
                                        marginBottom: '8px'
                                    }}
                                >
                                    <div className="list-icon" style={{
                                        background: 'rgba(27, 94, 60, 0.1)',
                                        borderRadius: '8px',
                                        padding: '8px'
                                    }}>
                                        <FileText size={18} style={{ color: '#1B5E3C' }} />
                                    </div>
                                    <div className="list-body">
                                        <div className="list-title" style={{
                                            fontFamily: "'Inter', sans-serif",
                                            fontWeight: 600,
                                            color: '#1A1A1A'
                                        }}>
                                            #{display.numero}
                                        </div>
                                        <div className="list-sub" style={{ color: '#404040' }}>{display.generador} → {display.operador}</div>
                                        <div className="list-meta" style={{
                                            display: 'flex',
                                            gap: '8px',
                                            marginTop: '4px',
                                            fontSize: '11px',
                                            color: '#606060'
                                        }}>
                                            <span style={{ color: '#1B5E3C', fontWeight: 500 }}>{display.residuo}</span>
                                            <span style={{ color: '#D97706', fontWeight: 500 }}>{display.cantidad}</span>
                                            {display.fecha && <span>{display.fecha}</span>}
                                        </div>
                                    </div>
                                    <div className="list-badge">{getEstadoBadge(display.estado)}</div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <motion.div
                            className="empty-state"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4 }}
                            style={{
                                background: '#FFFFFF',
                                border: '1px solid #E8E8E8',
                                borderRadius: '12px',
                                padding: '32px 16px',
                                textAlign: 'center'
                            }}
                        >
                            <FileText size={32} style={{ color: '#1B5E3C', opacity: 0.5 }} />
                            <p style={{ color: '#606060', marginTop: '8px' }}>No hay manifiestos {
                                activeTab === 'pendientes' ? 'pendientes' :
                                activeTab === 'en-curso' ? 'en curso' :
                                'realizados'
                            }</p>
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </>
    );
}
