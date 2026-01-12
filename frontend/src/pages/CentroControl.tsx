import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity, Users, FileText, Truck, Bell, AlertTriangle,
    CheckCircle, Clock, XCircle, MapPin, RefreshCw,
    ChevronRight, Eye, UserCheck, Package,
    Shield, Factory, Building2, Zap, BarChart3,
    ArrowRight, Settings, Play, Pause, AlertCircle
} from 'lucide-react';
import { usuarioService } from '../services/admin.service';
import type { Actividad } from '../services/admin.service';
import { manifiestoService } from '../services/manifiesto.service';
import { alertaService } from '../services/alerta.service';
import AdvertenciasGlobales from '../components/AdvertenciasGlobales';
import './CentroControl.css';

interface ManifiestoResumen {
    id: string;
    numero: string;
    estado: string;
    generador?: { razonSocial: string };
    transportista?: { razonSocial: string };
    operador?: { razonSocial: string };
    updatedAt: string;
}

interface AlertaActiva {
    id: string;
    tipo: string;
    nombre: string;
    descripcion: string;
    activa: boolean;
    manifestosAfectados: number;
    severidad?: 'INFO' | 'WARNING' | 'CRITICAL';
}

interface SystemStats {
    manifiestos: {
        total: number;
        borradores: number;
        aprobados: number;
        enTransito: number;
        entregados: number;
        recibidos: number;
        tratados: number;
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

const ESTADO_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    BORRADOR: { color: '#64748b', icon: <FileText size={14} />, label: 'Borrador' },
    PENDIENTE: { color: '#f59e0b', icon: <Clock size={14} />, label: 'Pendiente' },
    APROBADO: { color: '#10b981', icon: <CheckCircle size={14} />, label: 'Aprobado' },
    EN_TRANSITO: { color: '#3b82f6', icon: <Truck size={14} />, label: 'En Tránsito' },
    ENTREGADO: { color: '#06b6d4', icon: <MapPin size={14} />, label: 'Entregado' },
    RECIBIDO: { color: '#8b5cf6', icon: <Package size={14} />, label: 'Recibido' },
    TRATADO: { color: '#22c55e', icon: <CheckCircle size={14} />, label: 'Tratado' },
    RECHAZADO: { color: '#ef4444', icon: <XCircle size={14} />, label: 'Rechazado' },
    CANCELADO: { color: '#6b7280', icon: <XCircle size={14} />, label: 'Cancelado' }
};

const ROL_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
    ADMIN: { color: '#10b981', icon: <Shield size={14} /> },
    GENERADOR: { color: '#3b82f6', icon: <Factory size={14} /> },
    TRANSPORTISTA: { color: '#f59e0b', icon: <Truck size={14} /> },
    OPERADOR: { color: '#8b5cf6', icon: <Building2 size={14} /> }
};

const CentroControl: React.FC = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [manifiestos, setManifiestos] = useState<ManifiestoResumen[]>([]);
    const [alertas, setAlertas] = useState<AlertaActiva[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [selectedTab, setSelectedTab] = useState<'timeline' | 'manifiestos' | 'usuarios' | 'alertas'>('timeline');
    const [filterEstado, setFilterEstado] = useState<string>('TODOS');

    const loadData = useCallback(async () => {
        try {
            const [statsData, actividadData, manifestosData, advertenciasData, tiemposData, vencimientosData] = await Promise.all([
                usuarioService.getEstadisticas(),
                usuarioService.getActividad({ limit: 50 }),
                manifiestoService.getManifiestos({ limit: 20 }),
                alertaService.getAdvertenciasActivas(),
                alertaService.evaluarTiemposExcesivos(),
                alertaService.evaluarVencimientos()
            ]);

            const todasLasAlertas = [...advertenciasData, ...tiemposData, ...vencimientosData];

            const combinedStats: SystemStats = {
                manifiestos: {
                    total: statsData.manifiestos.total,
                    borradores: statsData.manifiestos.porEstado['BORRADOR'] || 0,
                    aprobados: statsData.manifiestos.porEstado['APROBADO'] || 0,
                    enTransito: statsData.manifiestos.porEstado['EN_TRANSITO'] || 0,
                    entregados: statsData.manifiestos.porEstado['ENTREGADO'] || 0,
                    recibidos: statsData.manifiestos.porEstado['RECIBIDO'] || 0,
                    tratados: statsData.manifiestos.porEstado['TRATADO'] || 0
                },
                usuarios: statsData.usuarios,
                alertasActivas: todasLasAlertas.length,
                eventosHoy: actividadData.stats.eventosHoy
            };

            setStats(combinedStats);
            setActividades(actividadData.actividades);
            setManifiestos(manifestosData.manifiestos || []);

            const alertasFormateadas: AlertaActiva[] = todasLasAlertas.slice(0, 10).map((alerta, index) => ({
                id: `${alerta.reglaId}-${index}`,
                tipo: alerta.evento,
                nombre: alerta.reglaNombre,
                descripcion: alerta.descripcion,
                activa: true,
                manifestosAfectados: alerta.detalles?.manifiestoNumero ? 1 : 0,
                severidad: alerta.severidad
            }));

            const defaultAlertas: AlertaActiva[] = [
                { id: '1', tipo: 'TIEMPO_EXCESIVO', nombre: 'Tiempo Excesivo', descripcion: 'Transporte > 24h', activa: true, manifestosAfectados: 0, severidad: 'INFO' },
                { id: '2', tipo: 'DESVIO_RUTA', nombre: 'Desvio de Ruta', descripcion: 'Fuera de ruta planificada', activa: true, manifestosAfectados: 0, severidad: 'INFO' },
                { id: '3', tipo: 'DIFERENCIA_PESO', nombre: 'Diferencia de Peso', descripcion: 'Discrepancia > 5%', activa: true, manifestosAfectados: 0, severidad: 'INFO' }
            ];

            setAlertas(alertasFormateadas.length > 0 ? alertasFormateadas : defaultAlertas);
        } catch (err) {
            console.error('Error loading control center data:', err);
            try {
                const actividadData = await usuarioService.getActividad({ limit: 50 });
                setActividades(actividadData?.actividades || []);
            } catch {
                // Fallback failed silently
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-refresh cada 30 segundos
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, loadData]);

    const formatRelativeTime = (dateStr: string): string => {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    };

    const getEstadoBadge = (estado: string) => {
        const config = ESTADO_CONFIG[estado] || ESTADO_CONFIG.BORRADOR;
        return (
            <span className="estado-badge" style={{ background: `${config.color}20`, color: config.color }}>
                {config.icon}
                {config.label}
            </span>
        );
    };

    const renderSeveridadIndicator = (severidad?: 'INFO' | 'WARNING' | 'CRITICAL') => {
        switch (severidad) {
            case 'CRITICAL':
                return <span className="status-indicator critical" title="Critica"><AlertCircle size={14} /></span>;
            case 'WARNING':
                return <span className="status-indicator warning" title="Advertencia"><AlertTriangle size={14} /></span>;
            default:
                return <span className="status-indicator active" title="Activa"><Eye size={14} /></span>;
        }
    };

    const renderImpactBadge = (alerta: AlertaActiva) => {
        if (alerta.severidad === 'CRITICAL') {
            return <span className="impact-badge critical"><AlertCircle size={12} /> Critica</span>;
        }
        if (alerta.manifestosAfectados > 0) {
            return <span className="impact-badge warning"><AlertTriangle size={12} /> {alerta.manifestosAfectados} afectados</span>;
        }
        return <span className="impact-badge success"><CheckCircle size={12} /> Sin incidencias</span>;
    };

    const filteredManifiestos = filterEstado === 'TODOS'
        ? manifiestos
        : manifiestos.filter(m => m.estado === filterEstado);

    if (loading) {
        return (
            <div className="centro-control-loading">
                <RefreshCw size={32} className="spinning" />
                <p>Cargando Centro de Control...</p>
            </div>
        );
    }

    return (
        <div className="centro-control">
            {/* Header con stats globales */}
            <header className="cc-header">
                <div className="cc-header-content">
                    <h1><Activity size={28} /> Centro de Control</h1>
                    <p>Vista unificada del sistema SITREP</p>
                </div>
                <div className="cc-header-actions">
                    <button
                        className={`auto-refresh-btn ${autoRefresh ? 'active' : ''}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        title={autoRefresh ? 'Pausar auto-actualización' : 'Activar auto-actualización'}
                    >
                        {autoRefresh ? <Pause size={16} /> : <Play size={16} />}
                        {autoRefresh ? 'Auto' : 'Manual'}
                    </button>
                    <button className="refresh-btn" onClick={loadData}>
                        <RefreshCw size={16} />
                        Actualizar
                    </button>
                </div>
            </header>

            {/* KPIs principales */}
            {stats && (
                <div className="cc-kpis">
                    <div className="kpi-card manifiestos">
                        <div className="kpi-icon"><FileText size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-value">{stats.manifiestos.total}</span>
                            <span className="kpi-label">Manifiestos</span>
                        </div>
                        <div className="kpi-breakdown">
                            <span title="En tránsito"><Truck size={12} /> {stats.manifiestos.enTransito}</span>
                            <span title="Pendientes"><Clock size={12} /> {stats.manifiestos.aprobados}</span>
                        </div>
                    </div>

                    <div className="kpi-card usuarios">
                        <div className="kpi-icon"><Users size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-value">{stats.usuarios.total}</span>
                            <span className="kpi-label">Usuarios</span>
                        </div>
                        <div className="kpi-breakdown">
                            <span title="Activos"><UserCheck size={12} /> {stats.usuarios.activos}</span>
                            <span title="Pendientes" className={stats.usuarios.pendientes > 0 ? 'highlight' : ''}>
                                <Clock size={12} /> {stats.usuarios.pendientes}
                            </span>
                        </div>
                    </div>

                    <div className="kpi-card alertas">
                        <div className="kpi-icon"><Bell size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-value">{stats.alertasActivas}</span>
                            <span className="kpi-label">Alertas Activas</span>
                        </div>
                        <div className="kpi-breakdown">
                            <span><AlertTriangle size={12} /> Monitoreando</span>
                        </div>
                    </div>

                    <div className="kpi-card eventos">
                        <div className="kpi-icon"><Zap size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-value">{stats.eventosHoy}</span>
                            <span className="kpi-label">Eventos Hoy</span>
                        </div>
                        <div className="kpi-breakdown">
                            <span><Activity size={12} /> Tiempo real</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs de navegación */}
            <nav className="cc-tabs">
                <button
                    className={`cc-tab ${selectedTab === 'timeline' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('timeline')}
                >
                    <Activity size={16} />
                    Timeline
                </button>
                <button
                    className={`cc-tab ${selectedTab === 'manifiestos' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('manifiestos')}
                >
                    <FileText size={16} />
                    Manifiestos
                </button>
                <button
                    className={`cc-tab ${selectedTab === 'usuarios' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('usuarios')}
                >
                    <Users size={16} />
                    Usuarios
                    {stats && stats.usuarios.pendientes > 0 && (
                        <span className="tab-badge">{stats.usuarios.pendientes}</span>
                    )}
                </button>
                <button
                    className={`cc-tab ${selectedTab === 'alertas' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('alertas')}
                >
                    <Bell size={16} />
                    Alertas
                </button>
            </nav>

            {/* Contenido principal */}
            <main className="cc-main">
                {/* Panel izquierdo - Contenido del tab seleccionado */}
                <div className="cc-panel-main">
                    {selectedTab === 'timeline' && (
                        <div className="timeline-panel">
                            <div className="panel-header">
                                <h3>Actividad en Tiempo Real</h3>
                                <Link to="/admin/actividad" className="view-all-link">
                                    Ver completo <ChevronRight size={16} />
                                </Link>
                            </div>
                            <div className="timeline-list">
                                {actividades.length > 0 ? (
                                    actividades.slice(0, 15).map(act => (
                                        <div key={act.id} className={`timeline-item ${act.tipo.toLowerCase()}`}>
                                            <div className="timeline-marker">
                                                {act.tipo === 'MANIFIESTO' ? <FileText size={14} /> : <Settings size={14} />}
                                            </div>
                                            <div className="timeline-content">
                                                <div className="timeline-header">
                                                    <span className="timeline-action">{act.accion.replace(/_/g, ' ')}</span>
                                                    <span className="timeline-time">{formatRelativeTime(act.fecha)}</span>
                                                </div>
                                                <p className="timeline-desc">{act.descripcion}</p>
                                                {act.usuario && (
                                                    <span className="timeline-user">
                                                        {act.usuario.nombre} {act.usuario.apellido}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <Activity size={32} />
                                        <p>Sin actividad reciente</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedTab === 'manifiestos' && (
                        <div className="manifiestos-panel">
                            <div className="panel-header">
                                <h3>Manifiestos del Sistema</h3>
                                <div className="panel-actions">
                                    <select
                                        value={filterEstado}
                                        onChange={(e) => setFilterEstado(e.target.value)}
                                        className="filter-select"
                                    >
                                        <option value="TODOS">Todos los estados</option>
                                        <option value="BORRADOR">Borradores</option>
                                        <option value="APROBADO">Aprobados</option>
                                        <option value="EN_TRANSITO">En Tránsito</option>
                                        <option value="ENTREGADO">Entregados</option>
                                        <option value="RECIBIDO">Recibidos</option>
                                        <option value="TRATADO">Tratados</option>
                                    </select>
                                    <Link to="/manifiestos" className="view-all-link">
                                        Ver todos <ChevronRight size={16} />
                                    </Link>
                                </div>
                            </div>

                            {/* Pipeline visual de estados */}
                            {stats && (
                                <div className="estado-pipeline">
                                    <div className="pipeline-item" style={{ '--color': '#64748b' } as React.CSSProperties}>
                                        <span className="pipeline-count">{stats.manifiestos.borradores}</span>
                                        <span className="pipeline-label">Borrador</span>
                                    </div>
                                    <div className="pipeline-arrow">→</div>
                                    <div className="pipeline-item" style={{ '--color': '#10b981' } as React.CSSProperties}>
                                        <span className="pipeline-count">{stats.manifiestos.aprobados}</span>
                                        <span className="pipeline-label">Aprobado</span>
                                    </div>
                                    <div className="pipeline-arrow">→</div>
                                    <div className="pipeline-item" style={{ '--color': '#3b82f6' } as React.CSSProperties}>
                                        <span className="pipeline-count">{stats.manifiestos.enTransito}</span>
                                        <span className="pipeline-label">Tránsito</span>
                                    </div>
                                    <div className="pipeline-arrow">→</div>
                                    <div className="pipeline-item" style={{ '--color': '#8b5cf6' } as React.CSSProperties}>
                                        <span className="pipeline-count">{stats.manifiestos.recibidos}</span>
                                        <span className="pipeline-label">Recibido</span>
                                    </div>
                                    <div className="pipeline-arrow">→</div>
                                    <div className="pipeline-item" style={{ '--color': '#22c55e' } as React.CSSProperties}>
                                        <span className="pipeline-count">{stats.manifiestos.tratados}</span>
                                        <span className="pipeline-label">Tratado</span>
                                    </div>
                                </div>
                            )}

                            <div className="manifiestos-list">
                                {filteredManifiestos.length > 0 ? (
                                    filteredManifiestos.map(m => (
                                        <Link key={m.id} to={`/manifiestos/${m.id}`} className="manifiesto-item">
                                            <div className="manifiesto-info">
                                                <strong>{m.numero}</strong>
                                                <span>{m.generador?.razonSocial || 'Sin generador'}</span>
                                            </div>
                                            {getEstadoBadge(m.estado)}
                                            <span className="manifiesto-time">{formatRelativeTime(m.updatedAt)}</span>
                                            <ChevronRight size={16} className="item-arrow" />
                                        </Link>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <FileText size={32} />
                                        <p>No hay manifiestos con este filtro</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedTab === 'usuarios' && (
                        <div className="usuarios-panel">
                            <div className="panel-header">
                                <h3>Gestión de Usuarios</h3>
                                <Link to="/admin/usuarios-panel" className="view-all-link">
                                    Gestionar <ChevronRight size={16} />
                                </Link>
                            </div>

                            {stats && (
                                <>
                                    {/* Distribución por rol */}
                                    <div className="rol-distribution">
                                        {Object.entries(stats.usuarios.porRol).map(([rol, count]) => {
                                            const config = ROL_CONFIG[rol] || { color: '#64748b', icon: <Users size={14} /> };
                                            return (
                                                <div key={rol} className="rol-item" style={{ '--color': config.color } as React.CSSProperties}>
                                                    <div className="rol-icon">{config.icon}</div>
                                                    <div className="rol-info">
                                                        <span className="rol-count">{count}</span>
                                                        <span className="rol-name">{rol}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Usuarios pendientes */}
                                    {stats.usuarios.pendientes > 0 && (
                                        <div className="pending-users-alert">
                                            <AlertCircle size={20} />
                                            <div className="alert-content">
                                                <strong>{stats.usuarios.pendientes} usuarios esperan aprobación</strong>
                                                <p>Revisa las solicitudes pendientes para habilitar el acceso</p>
                                            </div>
                                            <Link to="/admin/usuarios" className="btn btn-warning">
                                                Aprobar
                                            </Link>
                                        </div>
                                    )}

                                    {/* Acciones rápidas */}
                                    <div className="quick-actions">
                                        <Link to="/admin/usuarios-panel" className="quick-action">
                                            <Users size={20} />
                                            <span>Ver todos los usuarios</span>
                                            <ArrowRight size={16} />
                                        </Link>
                                        <Link to="/admin/usuarios" className="quick-action">
                                            <UserCheck size={20} />
                                            <span>Aprobar pendientes</span>
                                            <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {selectedTab === 'alertas' && (
                        <div className="alertas-panel">
                            <div className="panel-header">
                                <h3>Alertas del Sistema</h3>
                                <Link to="/alertas" className="view-all-link">
                                    Configurar <ChevronRight size={16} />
                                </Link>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <AdvertenciasGlobales
                                    autoRefresh={autoRefresh}
                                    refreshInterval={30000}
                                    maxVisible={5}
                                />
                            </div>

                            <div className="alertas-info">
                                <p>Las alertas activas monitorean automaticamente los manifiestos y generan notificaciones segun las reglas definidas.</p>
                            </div>

                            <div className="alertas-list">
                                {alertas.map(alerta => (
                                    <div key={alerta.id} className={`alerta-item ${alerta.activa ? 'active' : 'inactive'} ${alerta.severidad?.toLowerCase() || ''}`}>
                                        <div className="alerta-status">
                                            {renderSeveridadIndicator(alerta.severidad)}
                                        </div>
                                        <div className="alerta-content">
                                            <strong>{alerta.nombre}</strong>
                                            <span>{alerta.descripcion}</span>
                                        </div>
                                        <div className="alerta-impact">
                                            {renderImpactBadge(alerta)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="alertas-summary">
                                <h4>Impacto de Alertas</h4>
                                <p>Las alertas activas estan monitoreando {manifiestos.length} manifiestos en el sistema.</p>
                                <ul>
                                    <li><strong>Tiempo Excesivo:</strong> Notifica si un transporte supera las 24 horas</li>
                                    <li><strong>Desvio de Ruta:</strong> Detecta vehiculos fuera del corredor establecido</li>
                                    <li><strong>Diferencia de Peso:</strong> Compara peso origen vs destino (&gt;5%)</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Panel derecho - Resumen rápido */}
                <aside className="cc-sidebar">
                    <div className="sidebar-section">
                        <h4>Accesos Rápidos</h4>
                        <div className="quick-links">
                            <Link to="/manifiestos/nuevo" className="quick-link primary">
                                <FileText size={18} />
                                <span>Nuevo Manifiesto</span>
                            </Link>
                            <Link to="/tracking" className="quick-link">
                                <MapPin size={18} />
                                <span>Monitoreo GPS</span>
                            </Link>
                            <Link to="/reportes" className="quick-link">
                                <BarChart3 size={18} />
                                <span>Reportes</span>
                            </Link>
                            <Link to="/actores" className="quick-link">
                                <Building2 size={18} />
                                <span>Gestión Actores</span>
                            </Link>
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <h4>Flujo de Trabajo</h4>
                        <div className="workflow-diagram">
                            <div className="workflow-step">
                                <Factory size={16} />
                                <span>Generador crea</span>
                            </div>
                            <div className="workflow-arrow">↓</div>
                            <div className="workflow-step">
                                <Shield size={16} />
                                <span>Admin aprueba</span>
                            </div>
                            <div className="workflow-arrow">↓</div>
                            <div className="workflow-step">
                                <Truck size={16} />
                                <span>Transportista retira</span>
                            </div>
                            <div className="workflow-arrow">↓</div>
                            <div className="workflow-step">
                                <Building2 size={16} />
                                <span>Operador recibe</span>
                            </div>
                            <div className="workflow-arrow">↓</div>
                            <div className="workflow-step complete">
                                <CheckCircle size={16} />
                                <span>Tratamiento</span>
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <h4>Última Actividad</h4>
                        <div className="recent-activity">
                            {actividades.slice(0, 5).map(act => (
                                <div key={act.id} className="recent-item">
                                    <span className="recent-action">{act.accion.replace(/_/g, ' ')}</span>
                                    <span className="recent-time">{formatRelativeTime(act.fecha)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default CentroControl;
