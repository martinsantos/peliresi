/**
 * HomeScreen - Pantalla principal de la app movil
 * Extraido de MobileApp.tsx para mejorar legibilidad
 * SINCRONIZADO con Dashboard.tsx (WEB) - Usa mismo endpoint /api/manifiestos/dashboard
 * Control Room 2077 Design System - Neon Mobile Edition
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

// Neon color mappings for glow effects
const neonColors: Record<GlowVariant, { glow: string; gradient: string }> = {
    cyan: { glow: 'rgba(0, 255, 242, 0.4)', gradient: 'linear-gradient(135deg, rgba(0, 255, 242, 0.2), rgba(0, 255, 242, 0.05))' },
    green: { glow: 'rgba(34, 255, 102, 0.4)', gradient: 'linear-gradient(135deg, rgba(34, 255, 102, 0.2), rgba(34, 255, 102, 0.05))' },
    amber: { glow: 'rgba(255, 184, 0, 0.4)', gradient: 'linear-gradient(135deg, rgba(255, 184, 0, 0.2), rgba(255, 184, 0, 0.05))' },
    red: { glow: 'rgba(255, 51, 102, 0.4)', gradient: 'linear-gradient(135deg, rgba(255, 51, 102, 0.2), rgba(255, 51, 102, 0.05))' },
    purple: { glow: 'rgba(168, 85, 247, 0.4)', gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.05))' },
    blue: { glow: 'rgba(59, 130, 246, 0.4)', gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))' },
    default: { glow: 'rgba(16, 185, 129, 0.4)', gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))' },
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

            {/* Stats Grid - Premium Neon Cards (Control Room 2077 Mobile) */}
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
                    const neonStyle = neonColors[stat.glowVariant];
                    return (
                        <motion.div
                            key={index}
                            className="stat-card neon-stat-card"
                            variants={{
                                hidden: { y: 15, opacity: 0, scale: 0.95 },
                                show: { y: 0, opacity: 1, scale: 1, transition: { duration: 0.35 } }
                            }}
                            whileTap={{ scale: 0.97 }}
                            style={{
                                background: neonStyle.gradient,
                                borderColor: stat.color,
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderRadius: '12px',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Neon glow border effect */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '2px',
                                background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)`,
                                opacity: 0.8
                            }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
                                <motion.span
                                    style={{
                                        color: stat.color,
                                        filter: `drop-shadow(0 0 6px ${neonStyle.glow})`
                                    }}
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                >
                                    <IconComponent size={18} />
                                </motion.span>
                                <div
                                    className="stat-value"
                                    style={{
                                        color: stat.color,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontWeight: 700,
                                        fontSize: '1.5rem',
                                        textShadow: `0 0 10px ${neonStyle.glow}`
                                    }}
                                >
                                    {stat.value.toLocaleString()}
                                </div>
                            </div>
                            <div
                                className="stat-label"
                                style={{
                                    fontSize: '9px',
                                    marginTop: '4px',
                                    fontWeight: 600,
                                    letterSpacing: '0.08em',
                                    color: 'rgba(255,255,255,0.7)',
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
                                    whileHover={{ x: 4, backgroundColor: 'rgba(0, 255, 242, 0.05)' }}
                                >
                                    <div className="list-icon" style={{
                                        background: 'rgba(0, 255, 242, 0.1)',
                                        borderRadius: '8px',
                                        padding: '8px'
                                    }}>
                                        <FileText size={18} style={{ color: 'var(--neon-cyan, #00fff2)' }} />
                                    </div>
                                    <div className="list-body">
                                        <div className="list-title" style={{
                                            fontFamily: "'JetBrains Mono', monospace",
                                            fontWeight: 600
                                        }}>
                                            #{display.numero}
                                        </div>
                                        <div className="list-sub">{display.generador} → {display.operador}</div>
                                        <div className="list-meta" style={{
                                            display: 'flex',
                                            gap: '8px',
                                            marginTop: '4px',
                                            fontSize: '11px',
                                            color: 'var(--ind-text-mid)'
                                        }}>
                                            <span style={{ color: 'var(--neon-cyan, #00fff2)' }}>{display.residuo}</span>
                                            <span style={{ color: 'var(--neon-amber, #ffb800)' }}>{display.cantidad}</span>
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
                        >
                            <FileText size={32} style={{ color: 'var(--neon-cyan, #00fff2)', opacity: 0.5 }} />
                            <p>No hay manifiestos {
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
