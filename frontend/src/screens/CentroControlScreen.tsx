/**
 * CentroControlScreen - Centro de Control para App Móvil
 * Vista unificada optimizada para dispositivos móviles
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity, Users, FileText, Truck, Bell, AlertTriangle,
    MapPin, RefreshCw, Eye, Shield, Factory,
    Building2, Zap, ChevronDown, ChevronUp, ChevronRight, Navigation, Radio
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { usuarioService } from '../services/admin.service';
import type { Actividad } from '../services/admin.service';
import { manifiestoService } from '../services/manifiesto.service';
import { viajesService } from '../services/viajes.service';

// Icono de camión para el mapa
const truckIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#10b981" stroke="#fff" stroke-width="2"/>
            <path d="M10 11h8v6h4l-2 4h-2v-2h-6v2h-2l-2-4h2v-6z" fill="#fff"/>
        </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});

// Interfaz para vehículos en el mapa
interface VehiculoEnMapa {
    id: string;
    numero: string;
    transportista: string;
    lat: number;
    lng: number;
    tiempo: string;
}

interface CentroControlScreenProps {
    onNavigate?: (screen: string) => void;
}

interface SystemStats {
    manifiestos: {
        total: number;
        enTransito: number;
        pendientes: number;
    };
    usuarios: {
        total: number;
        activos: number;
        pendientes: number;
        porRol: Record<string, number>;
    };
    alertasActivas: number;
    eventosHoy: number;
}

const ROL_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
    ADMIN: { color: '#10b981', icon: <Shield size={14} /> },
    GENERADOR: { color: '#3b82f6', icon: <Factory size={14} /> },
    TRANSPORTISTA: { color: '#f59e0b', icon: <Truck size={14} /> },
    OPERADOR: { color: '#8b5cf6', icon: <Building2 size={14} /> }
};

const CentroControlScreen: React.FC<CentroControlScreenProps> = ({ onNavigate }) => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [vehiculos, setVehiculos] = useState<VehiculoEnMapa[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSection, setExpandedSection] = useState<string | null>('mapa');
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Cargar vehículos en tránsito para el mapa
    const loadVehiculos = useCallback(async () => {
        try {
            const response = await manifiestoService.getManifiestos({
                estado: 'EN_TRANSITO',
                limit: 20
            });

            const manifiestos = response.manifiestos || [];
            const vehiculosData: VehiculoEnMapa[] = [];

            for (const m of manifiestos) {
                try {
                    const viaje = await viajesService.getViajeEnCurso(m.id);
                    vehiculosData.push({
                        id: m.id,
                        numero: m.numero,
                        transportista: m.transportista?.razonSocial || 'Transportista',
                        lat: viaje?.ultimaUbicacion?.lat || (m.generador?.latitud || -32.8908) + (Math.random() - 0.5) * 0.05,
                        lng: viaje?.ultimaUbicacion?.lng || (m.generador?.longitud || -68.8272) + (Math.random() - 0.5) * 0.05,
                        tiempo: viaje
                            ? `${Math.floor(viaje.elapsedSeconds / 3600)}h ${Math.floor((viaje.elapsedSeconds % 3600) / 60)}m`
                            : '--'
                    });
                } catch {
                    // Si falla, agregar con ubicación simulada
                    vehiculosData.push({
                        id: m.id,
                        numero: m.numero,
                        transportista: m.transportista?.razonSocial || 'Transportista',
                        lat: -32.8908 + (Math.random() - 0.5) * 0.1,
                        lng: -68.8272 + (Math.random() - 0.5) * 0.1,
                        tiempo: '--'
                    });
                }
            }

            setVehiculos(vehiculosData);
        } catch (err) {
            console.error('Error loading vehiculos:', err);
        }
    }, []);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [statsData, actividadData] = await Promise.all([
                usuarioService.getEstadisticas(),
                usuarioService.getActividad({ limit: 20 })
            ]);

            const combinedStats: SystemStats = {
                manifiestos: {
                    total: statsData.manifiestos.total,
                    enTransito: statsData.manifiestos.porEstado['EN_TRANSITO'] || 0,
                    pendientes: statsData.manifiestos.porEstado['APROBADO'] || 0
                },
                usuarios: statsData.usuarios,
                alertasActivas: 3,
                eventosHoy: actividadData.stats.eventosHoy
            };

            setStats(combinedStats);
            setActividades(actividadData.actividades);
            setLastUpdate(new Date());

            // Cargar vehículos para el mapa
            await loadVehiculos();
        } catch (err) {
            console.error('Error loading centro control:', err);
        } finally {
            setLoading(false);
        }
    }, [loadVehiculos]);

    useEffect(() => {
        loadData();

        // POLLING: Actualizar datos cada 30 segundos
        const pollInterval = setInterval(() => {
            loadData();
        }, 30000);

        return () => clearInterval(pollInterval);
    }, [loadData]);

    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    };

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    return (
        <div className="centro-control-screen">
            {/* Header */}
            <div className="cc-header">
                <div className="cc-header-content">
                    <h2><Activity size={20} /> Centro de Control</h2>
                    <div className="cc-header-right">
                        {lastUpdate && (
                            <span className="last-update">
                                {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <button className="refresh-btn" onClick={loadData} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <RefreshCw size={32} className="spinning" />
                    <p>Cargando...</p>
                </div>
            ) : (
                <div className="cc-content">
                    {/* KPIs */}
                    {stats && (
                        <div className="kpi-grid">
                            <div className="kpi-card manifiestos">
                                <FileText size={20} />
                                <div className="kpi-data">
                                    <span className="kpi-value">{stats.manifiestos.total}</span>
                                    <span className="kpi-label">Manifiestos</span>
                                </div>
                                <div className="kpi-sub">
                                    <span><Truck size={10} /> {stats.manifiestos.enTransito}</span>
                                </div>
                            </div>

                            <div className="kpi-card usuarios">
                                <Users size={20} />
                                <div className="kpi-data">
                                    <span className="kpi-value">{stats.usuarios.total}</span>
                                    <span className="kpi-label">Usuarios</span>
                                </div>
                                {stats.usuarios.pendientes > 0 && (
                                    <div className="kpi-badge">{stats.usuarios.pendientes}</div>
                                )}
                            </div>

                            <div className="kpi-card alertas">
                                <Bell size={20} />
                                <div className="kpi-data">
                                    <span className="kpi-value">{stats.alertasActivas}</span>
                                    <span className="kpi-label">Alertas</span>
                                </div>
                            </div>

                            <div className="kpi-card eventos">
                                <Zap size={20} />
                                <div className="kpi-data">
                                    <span className="kpi-value">{stats.eventosHoy}</span>
                                    <span className="kpi-label">Hoy</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Secciones colapsables */}
                    <div className="cc-sections">
                        {/* Mapa en Vivo */}
                        <div className="cc-section mapa-section">
                            <button
                                className="section-header"
                                onClick={() => toggleSection('mapa')}
                            >
                                <Navigation size={16} />
                                <span>Tracking en Vivo</span>
                                {vehiculos.length > 0 && (
                                    <span className="section-badge live">
                                        <Radio size={10} className="pulse" /> {vehiculos.length} activos
                                    </span>
                                )}
                                {expandedSection === 'mapa' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {expandedSection === 'mapa' && (
                                <div className="section-content mapa-content">
                                    {vehiculos.length === 0 ? (
                                        <div className="empty-mapa">
                                            <Truck size={32} />
                                            <span>Sin vehículos en ruta</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mapa-container">
                                                <MapContainer
                                                    center={[-32.8908, -68.8272]}
                                                    zoom={11}
                                                    className="mini-map"
                                                    zoomControl={true}
                                                    style={{ height: '200px', width: '100%', borderRadius: '10px' }}
                                                >
                                                    <TileLayer
                                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                        attribution='&copy; OSM'
                                                    />
                                                    {vehiculos.map(v => (
                                                        <Marker key={v.id} position={[v.lat, v.lng]} icon={truckIcon}>
                                                            <Popup>
                                                                <div style={{ fontWeight: 700, color: '#10b981' }}>{v.numero}</div>
                                                                <div style={{ fontSize: 11 }}>{v.transportista}</div>
                                                                <div style={{ fontSize: 10, color: '#94a3b8' }}>⏱️ {v.tiempo}</div>
                                                            </Popup>
                                                        </Marker>
                                                    ))}
                                                </MapContainer>
                                            </div>
                                            <div className="vehiculos-lista">
                                                {vehiculos.slice(0, 5).map(v => (
                                                    <div key={v.id} className="vehiculo-item">
                                                        <Truck size={14} />
                                                        <span className="vehiculo-numero">{v.numero}</span>
                                                        <span className="vehiculo-tiempo">{v.tiempo}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Timeline */}
                        <div className="cc-section">
                            <button
                                className="section-header"
                                onClick={() => toggleSection('timeline')}
                            >
                                <Activity size={16} />
                                <span>Actividad Reciente</span>
                                {expandedSection === 'timeline' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {expandedSection === 'timeline' && (
                                <div className="section-content">
                                    {actividades.slice(0, 10).map(act => (
                                        <div key={act.id} className="activity-item">
                                            <div className="activity-marker">
                                                {act.tipo === 'MANIFIESTO' ? <FileText size={12} /> : <Eye size={12} />}
                                            </div>
                                            <div className="activity-info">
                                                <span className="activity-action">{act.accion.replace(/_/g, ' ')}</span>
                                                <span className="activity-desc">{act.descripcion}</span>
                                            </div>
                                            <span className="activity-time">{formatRelativeTime(act.fecha)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Usuarios por Rol */}
                        {stats && (
                            <div className="cc-section">
                                <button
                                    className="section-header"
                                    onClick={() => toggleSection('usuarios')}
                                >
                                    <Users size={16} />
                                    <span>Usuarios por Rol</span>
                                    {stats.usuarios.pendientes > 0 && (
                                        <span className="section-badge">{stats.usuarios.pendientes} pendientes</span>
                                    )}
                                    {expandedSection === 'usuarios' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                {expandedSection === 'usuarios' && (
                                    <div className="section-content">
                                        <div className="rol-grid">
                                            {Object.entries(stats.usuarios.porRol).map(([rol, count]) => {
                                                const config = ROL_CONFIG[rol];
                                                return (
                                                    <div key={rol} className="rol-item" style={{ borderColor: config?.color }}>
                                                        <span className="rol-icon" style={{ color: config?.color }}>
                                                            {config?.icon}
                                                        </span>
                                                        <span className="rol-count">{count}</span>
                                                        <span className="rol-name">{rol}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {stats.usuarios.pendientes > 0 && (
                                            <div className="pending-alert" onClick={() => onNavigate?.('usuarios')}>
                                                <AlertTriangle size={16} />
                                                <span>{stats.usuarios.pendientes} usuarios esperan aprobación</span>
                                                <ChevronRight size={14} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Alertas Activas */}
                        <div className="cc-section">
                            <button
                                className="section-header"
                                onClick={() => toggleSection('alertas')}
                            >
                                <Bell size={16} />
                                <span>Alertas Activas</span>
                                {expandedSection === 'alertas' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {expandedSection === 'alertas' && (
                                <div className="section-content">
                                    <div className="alert-item">
                                        <Eye size={14} className="alert-active" />
                                        <div className="alert-info">
                                            <strong>Tiempo Excesivo</strong>
                                            <span>Notifica transporte &gt; 24h</span>
                                        </div>
                                        <span className="alert-count warning">2</span>
                                    </div>
                                    <div className="alert-item">
                                        <Eye size={14} className="alert-active" />
                                        <div className="alert-info">
                                            <strong>Desvío de Ruta</strong>
                                            <span>Fuera de corredor</span>
                                        </div>
                                        <span className="alert-count success">0</span>
                                    </div>
                                    <div className="alert-item">
                                        <Eye size={14} className="alert-active" />
                                        <div className="alert-info">
                                            <strong>Diferencia de Peso</strong>
                                            <span>Discrepancia &gt; 5%</span>
                                        </div>
                                        <span className="alert-count warning">1</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="quick-actions">
                        <button className="quick-action" onClick={() => onNavigate?.('manifiestos')}>
                            <FileText size={18} />
                            <span>Ver Manifiestos</span>
                        </button>
                        <button className="quick-action" onClick={() => onNavigate?.('usuarios')}>
                            <Users size={18} />
                            <span>Gestionar Usuarios</span>
                        </button>
                        <button className="quick-action" onClick={() => onNavigate?.('tracking')}>
                            <MapPin size={18} />
                            <span>Monitoreo GPS</span>
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .centro-control-screen {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--color-bg-base, #0a0e14);
                }

                .cc-header {
                    padding: 16px;
                    background: var(--color-bg-elevated, #0f1419);
                    border-bottom: 1px solid var(--color-border-default);
                }

                .cc-header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .cc-header h2 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0;
                    font-size: 1.1rem;
                    color: var(--color-text-bright, #f8fafc);
                }

                .refresh-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: 10px;
                    color: var(--color-text-secondary);
                }

                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 48px;
                    color: var(--color-primary);
                }

                .loading-state p {
                    margin-top: 12px;
                    color: var(--color-text-muted);
                }

                .spinning {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .cc-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                }

                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .kpi-card {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px;
                    background: var(--color-bg-surface);
                    border-radius: 12px;
                    border-left: 3px solid var(--color-border-default);
                    position: relative;
                }

                .kpi-card.manifiestos { border-left-color: #10b981; color: #10b981; }
                .kpi-card.usuarios { border-left-color: #3b82f6; color: #3b82f6; }
                .kpi-card.alertas { border-left-color: #f59e0b; color: #f59e0b; }
                .kpi-card.eventos { border-left-color: #8b5cf6; color: #8b5cf6; }

                .kpi-data {
                    display: flex;
                    flex-direction: column;
                }

                .kpi-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--color-text-bright);
                    font-family: var(--font-mono);
                }

                .kpi-label {
                    font-size: 0.65rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                }

                .kpi-sub {
                    margin-left: auto;
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .kpi-badge {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    min-width: 18px;
                    height: 18px;
                    padding: 0 5px;
                    background: #f59e0b;
                    color: #000;
                    border-radius: 9px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .cc-sections {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .cc-section {
                    background: var(--color-bg-surface);
                    border-radius: 12px;
                    overflow: hidden;
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 14px 16px;
                    background: transparent;
                    border: none;
                    color: var(--color-text-primary);
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                }

                .section-header span:first-of-type {
                    flex: 1;
                    text-align: left;
                }

                .section-badge {
                    padding: 2px 8px;
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border-radius: 6px;
                    font-size: 0.7rem;
                }

                .section-content {
                    padding: 0 16px 16px;
                }

                .activity-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 0;
                    border-bottom: 1px solid var(--color-border-subtle);
                }

                .activity-item:last-child {
                    border-bottom: none;
                }

                .activity-marker {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-bg-hover);
                    border-radius: 50%;
                    color: var(--color-text-muted);
                }

                .activity-info {
                    flex: 1;
                    min-width: 0;
                }

                .activity-action {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-text-primary);
                    text-transform: uppercase;
                }

                .activity-desc {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .activity-time {
                    font-size: 0.65rem;
                    color: var(--color-text-muted);
                }

                .rol-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-bottom: 12px;
                }

                .rol-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 12px;
                    background: var(--color-bg-hover);
                    border-radius: 8px;
                    border-left: 2px solid;
                }

                .rol-icon {
                    display: flex;
                }

                .rol-count {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--color-text-bright);
                    font-family: var(--font-mono);
                }

                .rol-name {
                    font-size: 0.6rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                }

                .pending-alert {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 12px;
                    background: rgba(245, 158, 11, 0.1);
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    border-radius: 8px;
                    color: #f59e0b;
                    font-size: 0.8rem;
                    cursor: pointer;
                }

                .pending-alert span {
                    flex: 1;
                }

                .alert-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 0;
                    border-bottom: 1px solid var(--color-border-subtle);
                }

                .alert-item:last-child {
                    border-bottom: none;
                }

                .alert-active {
                    color: #10b981;
                }

                .alert-info {
                    flex: 1;
                }

                .alert-info strong {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--color-text-primary);
                }

                .alert-info span {
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                }

                .alert-count {
                    min-width: 24px;
                    height: 20px;
                    padding: 0 6px;
                    border-radius: 10px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .alert-count.warning {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }

                .alert-count.success {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .quick-actions {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }

                .quick-action {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 14px 8px;
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: 12px;
                    color: var(--color-text-secondary);
                    font-size: 0.7rem;
                    cursor: pointer;
                }

                .quick-action:hover {
                    background: var(--color-bg-hover);
                    color: var(--color-primary);
                    border-color: var(--color-primary-dim);
                }

                /* Mapa en Vivo Styles */
                .mapa-section .section-header {
                    border-left: 3px solid #10b981;
                }

                .section-badge.live {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .pulse {
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .mapa-content {
                    padding-top: 0 !important;
                }

                .mapa-container {
                    border-radius: 10px;
                    overflow: hidden;
                    border: 1px solid var(--color-border-default);
                    margin-bottom: 12px;
                }

                .mini-map {
                    background: var(--color-bg-surface);
                }

                .mini-map .leaflet-popup-content-wrapper {
                    background: rgba(15, 23, 42, 0.95);
                    color: #f8fafc;
                    border-radius: 8px;
                    font-size: 11px;
                }

                .mini-map .leaflet-popup-tip {
                    background: rgba(15, 23, 42, 0.95);
                }

                .empty-mapa {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 24px;
                    color: var(--color-text-muted);
                }

                .empty-mapa svg {
                    opacity: 0.5;
                }

                .vehiculos-lista {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .vehiculo-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 10px;
                    background: var(--color-bg-hover);
                    border-radius: 8px;
                    border-left: 2px solid #10b981;
                }

                .vehiculo-item svg {
                    color: #10b981;
                }

                .vehiculo-numero {
                    flex: 1;
                    font-family: var(--font-mono);
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--color-text-bright);
                }

                .vehiculo-tiempo {
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                    font-family: var(--font-mono);
                }

                .cc-header-right {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .last-update {
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                }
            `}</style>
        </div>
    );
};

export default CentroControlScreen;
