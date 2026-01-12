import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, Calendar, Filter, RefreshCw, FileText,
    Truck, CheckCircle, XCircle, AlertTriangle, Clock,
    ChevronDown, ChevronUp, Check, CheckCheck, Trash2,
    MapPin, UserCheck, Package, Info, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationService, type Notificacion } from '../services/notification.service';
import './Notificaciones.css';

type FilterEstado = 'TODAS' | 'NO_LEIDAS' | 'LEIDAS';
type FilterPrioridad = 'TODAS' | 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAJA';

const TIPO_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
    'MANIFIESTO_FIRMADO': { icon: <FileText size={16} />, color: 'var(--color-success)' },
    'MANIFIESTO_TRATADO': { icon: <CheckCircle size={16} />, color: 'var(--color-success)' },
    'RECEPCION': { icon: <Package size={16} />, color: 'var(--color-accent)' },
    'MANIFIESTO_EN_TRANSITO': { icon: <Truck size={16} />, color: 'var(--color-info)' },
    'EN_TRANSITO': { icon: <Truck size={16} />, color: 'var(--color-info)' },
    'MANIFIESTO_ENTREGADO': { icon: <MapPin size={16} />, color: 'var(--color-info)' },
    'ENTREGADO': { icon: <MapPin size={16} />, color: 'var(--color-info)' },
    'MANIFIESTO_RECHAZADO': { icon: <XCircle size={16} />, color: 'var(--color-danger)' },
    'INCIDENTE_REPORTADO': { icon: <AlertTriangle size={16} />, color: 'var(--color-warning)' },
    'ANOMALIA_DETECTADA': { icon: <AlertTriangle size={16} />, color: 'var(--color-warning)' },
    'RECHAZO': { icon: <XCircle size={16} />, color: 'var(--color-danger)' },
    'ASIGNACION': { icon: <UserCheck size={16} />, color: 'var(--color-primary)' },
    'VIAJE_ASIGNADO': { icon: <UserCheck size={16} />, color: 'var(--color-primary)' },
    'EN_CAMINO': { icon: <Truck size={16} />, color: 'var(--color-warning)' },
    'LLEGADA_INMINENTE': { icon: <MapPin size={16} />, color: 'var(--color-accent)' },
    'ESTADO': { icon: <Package size={16} />, color: 'var(--color-info)' },
    'CAMBIO_ESTADO': { icon: <Package size={16} />, color: 'var(--color-info)' },
};

const PRIORIDAD_CONFIG: Record<string, { label: string; color: string }> = {
    'URGENTE': { label: 'Urgente', color: '#dc2626' },
    'ALTA': { label: 'Alta', color: '#f59e0b' },
    'NORMAL': { label: 'Normal', color: '#3b82f6' },
    'BAJA': { label: 'Baja', color: '#6b7280' },
};

const Notificaciones: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
    const [noLeidas, setNoLeidas] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [filterEstado, setFilterEstado] = useState<FilterEstado>('TODAS');
    const [filterPrioridad, setFilterPrioridad] = useState<FilterPrioridad>('TODAS');
    const [showFilters, setShowFilters] = useState(false);

    const getActorId = useCallback(() => {
        if (!user) return undefined;
        switch (user.rol) {
            case 'GENERADOR': return (user as any).generadorId;
            case 'TRANSPORTISTA': return (user as any).transportistaId;
            case 'OPERADOR': return (user as any).operadorId;
            default: return undefined;
        }
    }, [user]);

    const loadNotificaciones = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            setError(null);

            const data = await notificationService.getMisAlertas({
                rol: user.rol,
                actorId: getActorId(),
                limit: 100
            });

            let filtered = data.notificaciones || [];

            if (filterEstado === 'NO_LEIDAS') {
                filtered = filtered.filter(n => !n.leida);
            } else if (filterEstado === 'LEIDAS') {
                filtered = filtered.filter(n => n.leida);
            }

            if (filterPrioridad !== 'TODAS') {
                filtered = filtered.filter(n => n.prioridad === filterPrioridad);
            }

            setNotificaciones(filtered);
            setNoLeidas(data.noLeidas || 0);
        } catch (err) {
            console.error('Error loading notificaciones:', err);
            setError('Error al cargar notificaciones');
        } finally {
            setLoading(false);
        }
    }, [user, getActorId, filterEstado, filterPrioridad]);

    useEffect(() => {
        loadNotificaciones();
    }, [loadNotificaciones]);

    const marcarLeida = async (id: string) => {
        try {
            await notificationService.marcarLeida(id);
            setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
            setNoLeidas(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error:', err);
        }
    };

    const marcarTodasLeidas = async () => {
        try {
            await notificationService.marcarTodasLeidas();
            setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
            setNoLeidas(0);
        } catch (err) {
            console.error('Error:', err);
        }
    };

    const eliminarNotificacion = async (id: string) => {
        try {
            await notificationService.eliminar(id);
            setNotificaciones(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error('Error:', err);
        }
    };

    const handleNotificacionClick = (notif: Notificacion) => {
        if (!notif.leida) marcarLeida(notif.id);
        if (notif.manifiestoId) {
            navigate(`/manifiestos/${notif.manifiestoId}`);
        }
    };

    const getConfig = (tipo: string) => {
        return TIPO_CONFIG[tipo] || { icon: <Info size={16} />, color: 'var(--color-text-secondary)' };
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        if (diffDays < 7) return `Hace ${diffDays} días`;
        return formatDate(dateStr);
    };

    const groupByDate = (items: Notificacion[]) => {
        const groups: Record<string, Notificacion[]> = {};
        items.forEach(item => {
            const date = new Date(item.createdAt).toLocaleDateString('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            if (!groups[date]) groups[date] = [];
            groups[date].push(item);
        });
        return groups;
    };

    const groupedNotificaciones = groupByDate(notificaciones);

    return (
        <div className="notificaciones-page">
            <div className="page-header">
                <div className="header-content">
                    <h1><Bell size={28} /> Notificaciones</h1>
                    <p>Centro de notificaciones y alertas del sistema</p>
                </div>
                <div className="header-actions">
                    {noLeidas > 0 && (
                        <button className="btn btn-secondary" onClick={marcarTodasLeidas}>
                            <CheckCheck size={16} />
                            Marcar todas leídas ({noLeidas})
                        </button>
                    )}
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter size={16} />
                        Filtros
                        {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={loadNotificaciones}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Actualizar
                    </button>
                </div>
            </div>

            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-icon" style={{ color: 'var(--color-primary)' }}>
                        <Bell size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{notificaciones.length}</span>
                        <span className="stat-label">Total</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ color: 'var(--color-warning)' }}>
                        <Eye size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{noLeidas}</span>
                        <span className="stat-label">No Leídas</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ color: 'var(--color-danger)' }}>
                        <AlertTriangle size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {notificaciones.filter(n => n.prioridad === 'URGENTE' || n.prioridad === 'ALTA').length}
                        </span>
                        <span className="stat-label">Prioritarias</span>
                    </div>
                </div>
            </div>

            {showFilters && (
                <div className="filters-panel">
                    <div className="filter-group">
                        <label>Estado</label>
                        <select
                            value={filterEstado}
                            onChange={(e) => setFilterEstado(e.target.value as FilterEstado)}
                        >
                            <option value="TODAS">Todas</option>
                            <option value="NO_LEIDAS">No leídas</option>
                            <option value="LEIDAS">Leídas</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Prioridad</label>
                        <select
                            value={filterPrioridad}
                            onChange={(e) => setFilterPrioridad(e.target.value as FilterPrioridad)}
                        >
                            <option value="TODAS">Todas</option>
                            <option value="URGENTE">Urgente</option>
                            <option value="ALTA">Alta</option>
                            <option value="NORMAL">Normal</option>
                            <option value="BAJA">Baja</option>
                        </select>
                    </div>
                </div>
            )}

            {error && (
                <div className="error-banner">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            <div className="notificaciones-container">
                {loading ? (
                    <div className="loading-state">
                        <RefreshCw size={32} className="spinning" />
                        <p>Cargando notificaciones...</p>
                    </div>
                ) : notificaciones.length === 0 ? (
                    <div className="empty-state">
                        <Bell size={48} />
                        <h3>Sin notificaciones</h3>
                        <p>No tienes notificaciones en este momento</p>
                    </div>
                ) : (
                    Object.entries(groupedNotificaciones).map(([fecha, items]) => (
                        <div key={fecha} className="notif-group">
                            <div className="notif-date">
                                <Calendar size={16} />
                                <span>{fecha}</span>
                            </div>
                            <div className="notif-items">
                                {items.map(notif => {
                                    const { icon, color } = getConfig(notif.tipo);
                                    const prioridadConfig = PRIORIDAD_CONFIG[notif.prioridad] || PRIORIDAD_CONFIG.NORMAL;

                                    return (
                                        <div
                                            key={notif.id}
                                            className={`notif-item ${!notif.leida ? 'unread' : ''} ${notif.prioridad?.toLowerCase() || ''}`}
                                            onClick={() => handleNotificacionClick(notif)}
                                        >
                                            <div className="notif-marker" style={{ borderColor: color }}>
                                                <span style={{ color }}>{icon}</span>
                                            </div>
                                            <div className="notif-content">
                                                <div className="notif-header">
                                                    <span className="notif-titulo">{notif.titulo}</span>
                                                    <div className="notif-meta">
                                                        <span
                                                            className="prioridad-badge"
                                                            style={{
                                                                background: `${prioridadConfig.color}20`,
                                                                color: prioridadConfig.color
                                                            }}
                                                        >
                                                            {prioridadConfig.label}
                                                        </span>
                                                        <span className="notif-time">
                                                            <Clock size={12} />
                                                            {formatRelativeTime(notif.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="notif-mensaje">{notif.mensaje}</p>
                                                {notif.manifiesto && (
                                                    <div className="notif-manifiesto">
                                                        <FileText size={12} />
                                                        <span>#{notif.manifiesto.numero}</span>
                                                        <span className={`estado-badge ${notif.manifiesto.estado?.toLowerCase()}`}>
                                                            {notif.manifiesto.estado}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="notif-actions">
                                                {!notif.leida && (
                                                    <button
                                                        className="action-btn"
                                                        onClick={(e) => { e.stopPropagation(); marcarLeida(notif.id); }}
                                                        title="Marcar como leída"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    className="action-btn delete"
                                                    onClick={(e) => { e.stopPropagation(); eliminarNotificacion(notif.id); }}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Notificaciones;
