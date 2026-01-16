/**
 * AdminDashboard - FASE 5
 * Dashboard completo para rol ADMIN
 * Features:
 * - Ver TODOS los manifiestos (sin filtrar por transportista)
 * - Cola de aprobacion
 * - Estadisticas globales
 * - Ver todos los viajes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText, Clock, CheckCircle, AlertTriangle,
    TrendingUp, ChevronRight, Activity, Users, Truck, Navigation, Radio
} from 'lucide-react';
import type { Screen } from '../types/mobile.types';
import { ESTADO_CONFIG } from '../types/mobile.types';
import type { DisplayManifiesto } from '../utils/manifiestoUtils';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { manifiestoService } from '../services/manifiesto.service';
import { viajesService } from '../services/viajes.service';

// Tipo para estadísticas del backend (sincronizado con DashboardStats)
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

interface AdminDashboardProps {
    manifiestos: DisplayManifiesto[];
    onSelectManifiesto: (m: DisplayManifiesto) => void;
    onNavigate: (screen: Screen) => void;
    onAprobar?: (id: string) => void;
    onRechazar?: (id: string) => void;
    // Stats del backend para sincronización con WEB
    backendStats?: BackendStats;
}

type AdminTab = 'resumen' | 'pendientes' | 'todos' | 'mapa';

// Icono de camión para el mapa
const truckIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#10b981">
            <circle cx="16" cy="16" r="14" fill="#10b981" stroke="#fff" stroke-width="2"/>
            <path d="M10 11h8v6h4l-2 4h-2v-2h-6v2h-2l-2-4h2v-6z" fill="#fff"/>
        </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});

// Icono de origen (Generador)
const generadorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
            <text x="12" y="16" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">G</text>
        </svg>
    `),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

// Icono de destino (Operador)
const operadorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="#dc2626" stroke="#fff" stroke-width="2"/>
            <text x="12" y="16" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">O</text>
        </svg>
    `),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

// Interfaz para viajes activos en el mapa
interface ViajeEnMapa {
    id: string;
    manifiestoNumero: string;
    transportista: string;
    generador: string;
    operador: string;
    lat: number;
    lng: number;
    origenLat?: number;
    origenLng?: number;
    destinoLat?: number;
    destinoLng?: number;
    tiempoEnRuta: string;
    estado: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
    manifiestos,
    onSelectManifiesto,
    onNavigate,
    onAprobar,
    onRechazar,
    backendStats
}) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('resumen');
    const [viajesEnMapa, setViajesEnMapa] = useState<ViajeEnMapa[]>([]);
    const [loadingMapa, setLoadingMapa] = useState(false);

    // Cargar viajes activos para el mapa
    const loadViajesActivos = useCallback(async () => {
        if (activeTab !== 'mapa') return;

        setLoadingMapa(true);
        try {
            const response = await manifiestoService.getManifiestos({
                estado: 'EN_TRANSITO',
                limit: 50
            });

            const manifiestos = response.manifiestos || [];

            const viajesPromises = manifiestos.map(async (m: any) => {
                try {
                    const viaje = await viajesService.getViajeEnCurso(m.id);
                    return {
                        id: m.id,
                        manifiestoNumero: m.numero,
                        transportista: m.transportista?.razonSocial || 'Transportista',
                        generador: m.generador?.razonSocial || 'Generador',
                        operador: m.operador?.razonSocial || 'Operador',
                        lat: viaje?.ultimaUbicacion?.lat || (m.generador?.latitud || -32.8908) + (Math.random() - 0.5) * 0.05,
                        lng: viaje?.ultimaUbicacion?.lng || (m.generador?.longitud || -68.8272) + (Math.random() - 0.5) * 0.05,
                        origenLat: m.generador?.latitud || null,
                        origenLng: m.generador?.longitud || null,
                        destinoLat: m.operador?.latitud || null,
                        destinoLng: m.operador?.longitud || null,
                        tiempoEnRuta: viaje
                            ? `${Math.floor(viaje.elapsedSeconds / 3600)}h ${Math.floor((viaje.elapsedSeconds % 3600) / 60)}m`
                            : '--',
                        estado: viaje?.estado || 'EN_CURSO'
                    };
                } catch {
                    return null;
                }
            });

            const viajes = (await Promise.all(viajesPromises)).filter(Boolean) as ViajeEnMapa[];
            setViajesEnMapa(viajes);
        } catch (err) {
            console.error('[AdminDashboard] Error cargando viajes:', err);
        } finally {
            setLoadingMapa(false);
        }
    }, [activeTab]);

    // Cargar viajes cuando se activa la tab mapa
    useEffect(() => {
        if (activeTab === 'mapa') {
            loadViajesActivos();
            const interval = setInterval(loadViajesActivos, 15000); // Actualizar cada 15s
            return () => clearInterval(interval);
        }
    }, [activeTab, loadViajesActivos]);

    // Estadisticas SINCRONIZADAS con WEB (Dashboard.tsx)
    // Usa backendStats cuando está disponible (desde /api/manifiestos/dashboard)
    const stats = backendStats ? {
        total: backendStats.total,
        pendientesDGFA: backendStats.pendientesAprobacion ?? 0,
        enProceso: (backendStats.aprobados ?? 0) + (backendStats.enTransito ?? 0) +
                   (backendStats.entregados ?? 0) + (backendStats.recibidos ?? 0) +
                   (backendStats.enTratamiento ?? 0),
        completados: backendStats.tratados ?? 0,
        // Para gráfico de distribución
        borradores: backendStats.borradores ?? 0,
        aprobados: backendStats.aprobados ?? 0,
        enTransito: backendStats.enTransito ?? 0,
        entregados: (backendStats.entregados ?? 0) + (backendStats.recibidos ?? 0) + (backendStats.enTratamiento ?? 0)
    } : {
        // Fallback: calcular desde manifiestos (solo para offline/cache)
        total: manifiestos.length,
        pendientesDGFA: manifiestos.filter(m => m.estado === 'PENDIENTE_APROBACION').length,
        enProceso: manifiestos.filter(m => ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'].includes(m.estado)).length,
        completados: manifiestos.filter(m => m.estado === 'TRATADO').length,
        // Para gráfico de distribución
        borradores: manifiestos.filter(m => m.estado === 'BORRADOR').length,
        aprobados: manifiestos.filter(m => m.estado === 'APROBADO').length,
        enTransito: manifiestos.filter(m => m.estado === 'EN_TRANSITO').length,
        entregados: manifiestos.filter(m => ['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'].includes(m.estado)).length
    };

    const getEstadoBadge = (estado: string) => {
        const s = ESTADO_CONFIG[estado] || { bg: '#334155', color: '#94a3b8', label: estado };
        return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
    };

    // Manifiestos pendientes de aprobacion
    const pendientesAprobacion = manifiestos.filter(m => m.estado === 'PENDIENTE_APROBACION');

    return (
        <div className="admin-dashboard">
            {/* Tabs */}
            <div className="admin-tabs">
                <button
                    className={`admin-tab ${activeTab === 'resumen' ? 'active' : ''}`}
                    onClick={() => setActiveTab('resumen')}
                >
                    <TrendingUp size={16} />
                    <span>Resumen</span>
                </button>
                <button
                    className={`admin-tab ${activeTab === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendientes')}
                >
                    <Clock size={16} />
                    <span>Aprobar ({stats.pendientesDGFA})</span>
                </button>
                <button
                    className={`admin-tab ${activeTab === 'todos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('todos')}
                >
                    <FileText size={16} />
                    <span>Todos</span>
                </button>
                <button
                    className={`admin-tab ${activeTab === 'mapa' ? 'active' : ''}`}
                    onClick={() => setActiveTab('mapa')}
                >
                    <Navigation size={16} />
                    <span>Mapa</span>
                    {stats.enTransito > 0 && (
                        <span className="tab-live-badge">
                            <Radio size={10} />
                        </span>
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="admin-content">
                {activeTab === 'resumen' && (
                    <div className="admin-resumen">
                        {/* Stats Grid - SINCRONIZADO con WEB Dashboard */}
                        <div className="admin-stats-grid">
                            <div className="admin-stat-card primary">
                                <div className="stat-icon"><FileText size={24} /></div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.total}</span>
                                    <span className="stat-label">TOTAL SISTEMA</span>
                                </div>
                            </div>
                            <div className="admin-stat-card warning">
                                <div className="stat-icon"><Clock size={24} /></div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.pendientesDGFA}</span>
                                    <span className="stat-label">PENDIENTES DGFA</span>
                                </div>
                            </div>
                            <div className="admin-stat-card info">
                                <div className="stat-icon"><TrendingUp size={24} /></div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.enProceso}</span>
                                    <span className="stat-label">EN PROCESO</span>
                                </div>
                            </div>
                            <div className="admin-stat-card success">
                                <div className="stat-icon"><CheckCircle size={24} /></div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.completados}</span>
                                    <span className="stat-label">COMPLETADOS</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions - SINCRONIZADO con WEB Dashboard */}
                        <div className="admin-section">
                            <h3>Acciones Rápidas</h3>
                            <div className="admin-actions">
                                <button
                                    className="admin-action-btn"
                                    onClick={() => setActiveTab('pendientes')}
                                >
                                    <Clock size={20} />
                                    <span>Cola de Aprobación</span>
                                    {stats.pendientesDGFA > 0 && (
                                        <span className="action-badge">{stats.pendientesDGFA}</span>
                                    )}
                                    <ChevronRight size={16} />
                                </button>
                                <button
                                    className="admin-action-btn"
                                    onClick={() => onNavigate('control')}
                                >
                                    <Activity size={20} />
                                    <span>Centro de Control</span>
                                    <ChevronRight size={16} />
                                </button>
                                <button
                                    className="admin-action-btn"
                                    onClick={() => onNavigate('usuarios')}
                                >
                                    <Users size={20} />
                                    <span>Gestión Usuarios</span>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Estado Distribution */}
                        <div className="admin-section">
                            <h3>Distribución por Estado</h3>
                            <div className="estado-bars">
                                {[
                                    { label: 'Borradores', count: stats.borradores, color: '#64748b' },
                                    { label: 'Pendientes DGFA', count: stats.pendientesDGFA, color: '#f59e0b' },
                                    { label: 'Aprobados', count: stats.aprobados, color: '#10b981' },
                                    { label: 'En Tránsito', count: stats.enTransito, color: '#06b6d4' },
                                    { label: 'Completados', count: stats.completados, color: '#22c55e' }
                                ].map(item => (
                                    <div key={item.label} className="estado-bar-item">
                                        <div className="estado-bar-header">
                                            <span>{item.label}</span>
                                            <span>{item.count}</span>
                                        </div>
                                        <div className="estado-bar-track">
                                            <div
                                                className="estado-bar-fill"
                                                style={{
                                                    width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%`,
                                                    background: item.color
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'pendientes' && (
                    <div className="admin-pendientes">
                        <div className="section-header">
                            <h3>Cola de Aprobacion</h3>
                            <span className="count-badge">{pendientesAprobacion.length} pendientes</span>
                        </div>

                        {pendientesAprobacion.length > 0 ? (
                            <div className="approval-list">
                                {pendientesAprobacion.map(m => (
                                    <div key={m.id} className="approval-card">
                                        <div className="approval-header">
                                            <span className="manifiesto-numero">#{m.numero}</span>
                                            {getEstadoBadge(m.estado)}
                                        </div>
                                        <div className="approval-body">
                                            <div className="approval-row">
                                                <span className="label">Generador:</span>
                                                <span className="value">{m.generador}</span>
                                            </div>
                                            <div className="approval-row">
                                                <span className="label">Transportista:</span>
                                                <span className="value">{m.transportista}</span>
                                            </div>
                                            <div className="approval-row">
                                                <span className="label">Operador:</span>
                                                <span className="value">{m.operador}</span>
                                            </div>
                                            <div className="approval-row">
                                                <span className="label">Residuo:</span>
                                                <span className="value">{m.residuo} - {m.cantidad}</span>
                                            </div>
                                        </div>
                                        <div className="approval-actions">
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => onSelectManifiesto(m)}
                                            >
                                                Ver Detalle
                                            </button>
                                            {onAprobar && (
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => onAprobar(m.id)}
                                                >
                                                    <CheckCircle size={14} />
                                                    Aprobar
                                                </button>
                                            )}
                                            {onRechazar && (
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => onRechazar(m.id)}
                                                >
                                                    <AlertTriangle size={14} />
                                                    Rechazar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <CheckCircle size={48} />
                                <h3>Sin pendientes</h3>
                                <p>No hay manifiestos esperando aprobacion</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'todos' && (
                    <div className="admin-todos">
                        <div className="section-header">
                            <h3>Todos los Manifiestos</h3>
                            <span className="count-badge">{manifiestos.length} total</span>
                        </div>

                        <div className="list">
                            {manifiestos.map(m => (
                                <div
                                    key={m.id}
                                    className="list-item"
                                    onClick={() => onSelectManifiesto(m)}
                                >
                                    <div className="list-icon"><FileText size={18} /></div>
                                    <div className="list-body">
                                        <div className="list-title">#{m.numero}</div>
                                        <div className="list-sub">{m.generador} → {m.operador}</div>
                                        <div className="list-meta" style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--ind-text-mid)' }}>
                                            <span style={{ color: 'var(--ind-cyan)' }}>{m.residuo}</span>
                                            <span style={{ color: 'var(--ind-orange)' }}>{m.cantidad}</span>
                                            <span>{m.fecha}</span>
                                        </div>
                                    </div>
                                    <div className="list-badge">{getEstadoBadge(m.estado)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'mapa' && (
                    <div className="admin-mapa">
                        <div className="section-header">
                            <h3>
                                <Navigation size={16} />
                                Tracking en Vivo
                            </h3>
                            <span className="count-badge live">
                                <Radio size={10} className="live-pulse" />
                                {viajesEnMapa.length} vehículos
                            </span>
                        </div>

                        {loadingMapa && viajesEnMapa.length === 0 ? (
                            <div className="mapa-loading">
                                <div className="spinner" />
                                <span>Cargando viajes...</span>
                            </div>
                        ) : viajesEnMapa.length === 0 ? (
                            <div className="empty-state">
                                <Truck size={48} />
                                <h3>Sin viajes activos</h3>
                                <p>No hay vehículos en ruta en este momento</p>
                            </div>
                        ) : (
                            <>
                                <div className="mapa-container">
                                    <MapContainer
                                        center={[-32.8908, -68.8272]}
                                        zoom={11}
                                        className="admin-map"
                                        zoomControl={true}
                                        style={{ height: '300px', width: '100%', borderRadius: '10px' }}
                                    >
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; OSM'
                                        />
                                        {viajesEnMapa.map(viaje => (
                                            <React.Fragment key={viaje.id}>
                                                {/* Línea origen → transporte */}
                                                {viaje.origenLat && viaje.origenLng && (
                                                    <Polyline
                                                        positions={[[viaje.origenLat, viaje.origenLng], [viaje.lat, viaje.lng]]}
                                                        pathOptions={{ color: '#059669', weight: 2, opacity: 0.6, dashArray: '5, 5' }}
                                                    />
                                                )}
                                                {/* Línea transporte → destino */}
                                                {viaje.destinoLat && viaje.destinoLng && (
                                                    <Polyline
                                                        positions={[[viaje.lat, viaje.lng], [viaje.destinoLat, viaje.destinoLng]]}
                                                        pathOptions={{ color: '#dc2626', weight: 2, opacity: 0.4, dashArray: '5, 5' }}
                                                    />
                                                )}
                                                {/* Marker origen */}
                                                {viaje.origenLat && viaje.origenLng && (
                                                    <Marker position={[viaje.origenLat, viaje.origenLng]} icon={generadorIcon}>
                                                        <Popup>
                                                            <div style={{ color: '#059669', fontWeight: 600 }}>ORIGEN</div>
                                                            <div>{viaje.generador}</div>
                                                        </Popup>
                                                    </Marker>
                                                )}
                                                {/* Marker destino */}
                                                {viaje.destinoLat && viaje.destinoLng && (
                                                    <Marker position={[viaje.destinoLat, viaje.destinoLng]} icon={operadorIcon}>
                                                        <Popup>
                                                            <div style={{ color: '#dc2626', fontWeight: 600 }}>DESTINO</div>
                                                            <div>{viaje.operador}</div>
                                                        </Popup>
                                                    </Marker>
                                                )}
                                                {/* Marker transporte */}
                                                <Marker position={[viaje.lat, viaje.lng]} icon={truckIcon}>
                                                    <Popup>
                                                        <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                                                            {viaje.manifiestoNumero}
                                                        </div>
                                                        <div style={{ fontSize: 12 }}>{viaje.transportista}</div>
                                                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                                            ⏱️ {viaje.tiempoEnRuta}
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            </React.Fragment>
                                        ))}
                                    </MapContainer>
                                </div>

                                {/* Lista de viajes activos */}
                                <div className="viajes-lista">
                                    <h4>Viajes Activos</h4>
                                    {viajesEnMapa.map(viaje => (
                                        <div key={viaje.id} className="viaje-card">
                                            <div className="viaje-header">
                                                <Truck size={16} />
                                                <span className="viaje-numero">{viaje.manifiestoNumero}</span>
                                                <span className="viaje-tiempo">{viaje.tiempoEnRuta}</span>
                                            </div>
                                            <div className="viaje-ruta">
                                                <span className="origen">{viaje.generador}</span>
                                                <ChevronRight size={14} />
                                                <span className="destino">{viaje.operador}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .admin-dashboard {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                    font-family: var(--font-sans);
                }

                .admin-tabs {
                    display: flex;
                    gap: var(--space-1, 4px);
                    padding: var(--space-2, 8px) var(--space-3, 12px);
                    background: var(--color-bg-elevated, #0f1419);
                    border-bottom: 1px solid var(--color-border-default);
                    overflow-x: auto;
                    overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    flex-shrink: 0;
                }

                .admin-tabs::-webkit-scrollbar {
                    display: none;
                }

                .admin-tab {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1, 4px);
                    padding: var(--space-2, 8px) var(--space-3, 12px);
                    background: transparent;
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-sm, 6px);
                    color: var(--color-text-secondary);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: var(--font-medium);
                    cursor: pointer;
                    white-space: nowrap;
                    flex-shrink: 0;
                    transition: all var(--duration-fast) var(--ease-out);
                }

                .admin-tab:hover {
                    background: var(--color-bg-hover);
                    border-color: var(--color-primary-dim);
                }

                .admin-tab.active {
                    background: var(--color-primary);
                    border-color: var(--color-primary);
                    color: white;
                    box-shadow: var(--shadow-glow-primary);
                }

                .admin-content {
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: var(--space-3, 12px);
                    max-width: 100%;
                }

                .admin-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: var(--space-2, 8px);
                    margin-bottom: var(--space-4, 16px);
                }

                .admin-stat-card {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3, 12px);
                    padding: var(--space-3, 12px);
                    background: var(--color-bg-surface);
                    border-radius: var(--radius-md, 10px);
                    border: 1px solid var(--color-border-default);
                    transition: all var(--duration-fast) var(--ease-out);
                    min-width: 0;
                }

                .admin-stat-card:hover {
                    border-color: var(--color-border-strong);
                }

                .admin-stat-card .stat-icon {
                    flex-shrink: 0;
                }

                .admin-stat-card.primary .stat-icon { color: var(--color-primary); }
                .admin-stat-card.warning .stat-icon { color: var(--color-warning); }
                .admin-stat-card.success .stat-icon { color: var(--color-success); }
                .admin-stat-card.info .stat-icon { color: var(--color-primary-bright); }

                .stat-info {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }

                .stat-value {
                    font-size: var(--text-2xl, 1.5rem);
                    font-weight: var(--font-bold);
                    color: var(--color-text-bright);
                    line-height: 1;
                    font-family: var(--font-mono);
                }

                .stat-label {
                    font-size: var(--text-2xs, 0.625rem);
                    color: var(--color-text-muted);
                    margin-top: var(--space-1, 4px);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .admin-section {
                    margin-bottom: var(--space-5, 20px);
                }

                .admin-section h3 {
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--space-3, 12px);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    font-weight: var(--font-semibold);
                }

                .admin-actions {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 8px);
                }

                .admin-action-btn {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3, 12px);
                    padding: var(--space-3, 12px) var(--space-4, 16px);
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-md, 10px);
                    color: var(--color-text-primary);
                    cursor: pointer;
                    transition: all var(--duration-fast) var(--ease-out);
                }

                .admin-action-btn:hover {
                    background: var(--color-bg-hover);
                    border-color: var(--color-primary-dim);
                }

                .admin-action-btn:active {
                    transform: scale(0.98);
                }

                .admin-action-btn span {
                    flex: 1;
                    text-align: left;
                    font-size: var(--text-sm, 0.875rem);
                }

                .action-badge {
                    background: var(--color-warning);
                    color: var(--color-bg-void);
                    padding: 2px var(--space-2, 8px);
                    border-radius: var(--radius-full);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: var(--font-bold);
                    font-family: var(--font-mono);
                }

                .estado-bars {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3, 12px);
                }

                .estado-bar-item {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1, 4px);
                }

                .estado-bar-header {
                    display: flex;
                    justify-content: space-between;
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-secondary);
                }

                .estado-bar-header span:last-child {
                    font-family: var(--font-mono);
                    font-weight: var(--font-semibold);
                }

                .estado-bar-track {
                    height: 6px;
                    background: var(--color-bg-void);
                    border-radius: var(--radius-full);
                    overflow: hidden;
                }

                .estado-bar-fill {
                    height: 100%;
                    border-radius: var(--radius-full);
                    transition: width var(--duration-slow) var(--ease-out);
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-3, 12px);
                    flex-wrap: wrap;
                    gap: var(--space-2, 8px);
                }

                .section-header h3 {
                    margin: 0;
                    font-size: var(--text-base, 1rem);
                    color: var(--color-text-bright);
                    font-weight: var(--font-semibold);
                }

                .count-badge {
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-muted);
                    background: var(--color-bg-surface);
                    padding: var(--space-1, 4px) var(--space-3, 12px);
                    border-radius: var(--radius-full);
                    border: 1px solid var(--color-border-subtle);
                    font-family: var(--font-mono);
                    white-space: nowrap;
                }

                .approval-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3, 12px);
                }

                .approval-card {
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-md, 10px);
                    padding: var(--space-4, 16px);
                    transition: all var(--duration-fast) var(--ease-out);
                }

                .approval-card:hover {
                    border-color: var(--color-warning-dim);
                }

                .approval-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-3, 12px);
                    flex-wrap: wrap;
                    gap: var(--space-2, 8px);
                }

                .manifiesto-numero {
                    font-size: var(--text-base, 1rem);
                    font-weight: var(--font-bold);
                    color: var(--color-primary);
                    font-family: var(--font-mono);
                }

                .approval-body {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 8px);
                    margin-bottom: var(--space-3, 12px);
                }

                .approval-row {
                    display: flex;
                    font-size: var(--text-sm, 0.875rem);
                    flex-wrap: wrap;
                    gap: var(--space-1, 4px);
                }

                .approval-row .label {
                    width: 90px;
                    flex-shrink: 0;
                    color: var(--color-text-muted);
                    font-size: var(--text-xs, 0.75rem);
                }

                .approval-row .value {
                    flex: 1;
                    color: var(--color-text-primary);
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .approval-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-2, 8px);
                    padding-top: var(--space-3, 12px);
                    border-top: 1px solid var(--color-border-subtle);
                }

                .approval-actions .btn {
                    flex: 1;
                    min-width: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-1, 4px);
                    padding: var(--space-2, 8px) var(--space-3, 12px);
                    border-radius: var(--radius-sm, 6px);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: var(--font-semibold);
                    cursor: pointer;
                    transition: all var(--duration-fast) var(--ease-out);
                    border: none;
                }

                .btn-secondary {
                    background: var(--color-bg-hover);
                    color: var(--color-text-primary);
                    border: 1px solid var(--color-border-default);
                }

                .btn-secondary:hover {
                    background: var(--color-bg-active);
                }

                .btn-success {
                    background: var(--color-success);
                    color: white;
                }

                .btn-success:hover {
                    background: var(--color-success-bright);
                    box-shadow: var(--shadow-glow-success);
                }

                .btn-danger {
                    background: var(--color-danger);
                    color: white;
                }

                .btn-danger:hover {
                    background: var(--color-danger-bright);
                    box-shadow: var(--shadow-glow-danger);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-12, 48px) var(--space-6, 24px);
                    text-align: center;
                }

                .empty-state svg {
                    color: var(--color-success);
                    margin-bottom: var(--space-4, 16px);
                    opacity: 0.7;
                }

                .empty-state h3 {
                    margin: 0 0 var(--space-2, 8px);
                    color: var(--color-text-bright);
                    font-weight: var(--font-semibold);
                }

                .empty-state p {
                    margin: 0;
                    color: var(--color-text-muted);
                    font-size: var(--text-sm, 0.875rem);
                }

                /* Lista de manifiestos */
                .list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 8px);
                }

                .list-item {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--space-3, 12px);
                    padding: var(--space-3, 12px);
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-md, 10px);
                    cursor: pointer;
                    transition: all var(--duration-fast) var(--ease-out);
                }

                .list-item:hover {
                    border-color: var(--color-primary-dim);
                    background: var(--color-bg-hover);
                }

                .list-icon {
                    flex-shrink: 0;
                    color: var(--color-primary);
                }

                .list-body {
                    flex: 1;
                    min-width: 0;
                }

                .list-title {
                    font-weight: var(--font-semibold);
                    color: var(--color-text-bright);
                    font-family: var(--font-mono);
                    font-size: var(--text-sm, 0.875rem);
                }

                .list-sub {
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-secondary);
                    margin-top: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .list-badge {
                    flex-shrink: 0;
                }

                .badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 3px var(--space-2, 8px);
                    border-radius: var(--radius-sm, 6px);
                    font-size: var(--text-2xs, 0.625rem);
                    font-weight: var(--font-semibold);
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                    white-space: nowrap;
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.2;
                }

                /* Tab Live Badge */
                .tab-live-badge {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                    background: rgba(16, 185, 129, 0.2);
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                .tab-live-badge svg {
                    color: #10b981;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.9); }
                }

                /* Mapa Tab Styles */
                .admin-mapa {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3, 12px);
                }

                .admin-mapa .section-header h3 {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                }

                .count-badge.live {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1, 4px);
                    background: rgba(16, 185, 129, 0.15);
                    border-color: rgba(16, 185, 129, 0.3);
                    color: #10b981;
                }

                .live-pulse {
                    animation: pulse 1.5s infinite;
                }

                .mapa-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-10, 40px);
                    gap: var(--space-3, 12px);
                    color: var(--color-text-muted);
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid rgba(16, 185, 129, 0.2);
                    border-top-color: #10b981;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .mapa-container {
                    border-radius: var(--radius-md, 10px);
                    overflow: hidden;
                    border: 1px solid var(--color-border-default);
                }

                .admin-map {
                    background: var(--color-bg-surface);
                }

                .viajes-lista {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 8px);
                }

                .viajes-lista h4 {
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-muted);
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .viaje-card {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1, 4px);
                    padding: var(--space-3, 12px);
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-md, 10px);
                    border-left: 3px solid #10b981;
                }

                .viaje-header {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                }

                .viaje-header svg {
                    color: #10b981;
                }

                .viaje-numero {
                    font-family: var(--font-mono);
                    font-weight: var(--font-bold);
                    color: var(--color-text-bright);
                    font-size: var(--text-sm, 0.875rem);
                }

                .viaje-tiempo {
                    margin-left: auto;
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-muted);
                    font-family: var(--font-mono);
                }

                .viaje-ruta {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1, 4px);
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-secondary);
                    overflow: hidden;
                }

                .viaje-ruta .origen {
                    color: #059669;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                }

                .viaje-ruta svg {
                    flex-shrink: 0;
                    color: var(--color-text-muted);
                }

                .viaje-ruta .destino {
                    color: #dc2626;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                    text-align: right;
                }

                /* Leaflet popup customization for mobile */
                .admin-map .leaflet-popup-content-wrapper {
                    background: rgba(15, 23, 42, 0.95);
                    color: #f8fafc;
                    border-radius: 8px;
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    font-size: 12px;
                }

                .admin-map .leaflet-popup-tip {
                    background: rgba(15, 23, 42, 0.95);
                }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
