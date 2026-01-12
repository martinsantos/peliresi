/**
 * ActividadGlobal - Timeline de Actividad del Sistema
 * Muestra eventos de manifiestos y actividad de auditoría en un timeline unificado
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity, Calendar, Filter, RefreshCw, FileText, User, Settings,
    Truck, CheckCircle, XCircle, AlertTriangle, Clock, MapPin,
    ChevronDown, ChevronUp, Users, Shield, Package
} from 'lucide-react';
import { usuarioService } from '../services/admin.service';
import type { Actividad, ActividadResponse } from '../services/admin.service';
import './ActividadGlobal.css';

type FilterTipo = 'TODOS' | 'MANIFIESTO' | 'SISTEMA';
type FilterPeriodo = 'HOY' | 'SEMANA' | 'MES' | 'CUSTOM';

const TIPO_ICONS: Record<string, React.ReactNode> = {
    'CREACION': <FileText size={16} />,
    'APROBACION': <CheckCircle size={16} />,
    'RECHAZO': <XCircle size={16} />,
    'TRANSITO': <Truck size={16} />,
    'ENTREGA': <MapPin size={16} />,
    'RECEPCION': <Package size={16} />,
    'LOGIN': <User size={16} />,
    'UPDATE_USER': <Users size={16} />,
    'APPROVE_USER': <CheckCircle size={16} />,
    'REJECT_USER': <XCircle size={16} />,
    'CONFIG': <Settings size={16} />,
};

const TIPO_COLORS: Record<string, string> = {
    'CREACION': 'var(--color-primary)',
    'APROBACION': 'var(--color-success)',
    'RECHAZO': 'var(--color-danger)',
    'TRANSITO': 'var(--color-warning)',
    'ENTREGA': 'var(--color-info)',
    'RECEPCION': 'var(--color-accent)',
    'LOGIN': 'var(--color-text-secondary)',
    'UPDATE_USER': 'var(--color-info)',
    'APPROVE_USER': 'var(--color-success)',
    'REJECT_USER': 'var(--color-danger)',
    'CONFIG': 'var(--color-text-muted)',
};

const ActividadGlobal: React.FC = () => {
    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [stats, setStats] = useState<ActividadResponse['stats'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [filterTipo, setFilterTipo] = useState<FilterTipo>('TODOS');
    const [filterPeriodo, setFilterPeriodo] = useState<FilterPeriodo>('HOY');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const getDateRange = useCallback(() => {
        const now = new Date();
        let desde: string | undefined;
        let hasta: string | undefined;

        switch (filterPeriodo) {
            case 'HOY':
                desde = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                break;
            case 'SEMANA':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                desde = weekAgo.toISOString();
                break;
            case 'MES':
                const monthAgo = new Date(now);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                desde = monthAgo.toISOString();
                break;
            case 'CUSTOM':
                desde = fechaDesde ? new Date(fechaDesde).toISOString() : undefined;
                hasta = fechaHasta ? new Date(fechaHasta).toISOString() : undefined;
                break;
        }

        return { desde, hasta };
    }, [filterPeriodo, fechaDesde, fechaHasta]);

    const loadActividad = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { desde, hasta } = getDateRange();
            const params: any = { limit: 100 };
            if (filterTipo !== 'TODOS') params.tipo = filterTipo;
            if (desde) params.desde = desde;
            if (hasta) params.hasta = hasta;

            const data = await usuarioService.getActividad(params);
            setActividades(data.actividades);
            setStats(data.stats);
        } catch (err) {
            console.error('Error loading actividad:', err);
            setError('Error al cargar actividad del sistema');
        } finally {
            setLoading(false);
        }
    }, [filterTipo, getDateRange]);

    useEffect(() => {
        loadActividad();
    }, [loadActividad]);

    const toggleExpand = (id: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
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
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        if (diffDays < 7) return `Hace ${diffDays} días`;
        return formatDate(dateStr);
    };

    const getIcon = (actividad: Actividad) => {
        const icon = TIPO_ICONS[actividad.accion] || <Activity size={16} />;
        const color = TIPO_COLORS[actividad.accion] || 'var(--color-text-secondary)';
        return { icon, color };
    };

    const groupByDate = (items: Actividad[]) => {
        const groups: Record<string, Actividad[]> = {};

        items.forEach(item => {
            const date = new Date(item.fecha).toLocaleDateString('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            if (!groups[date]) groups[date] = [];
            groups[date].push(item);
        });

        return groups;
    };

    const groupedActividades = groupByDate(actividades);

    return (
        <div className="actividad-global-page">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <h1><Activity size={28} /> Actividad del Sistema</h1>
                    <p>Timeline de eventos y actividad en tiempo real</p>
                </div>
                <div className="header-actions">
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
                        onClick={loadActividad}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="stats-row">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ color: 'var(--color-primary)' }}>
                            <Activity size={24} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{stats.eventosHoy}</span>
                            <span className="stat-label">Eventos Hoy</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ color: 'var(--color-warning)' }}>
                            <Truck size={24} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{stats.manifestosActivos}</span>
                            <span className="stat-label">Manifiestos Activos</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ color: 'var(--color-success)' }}>
                            <Users size={24} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{stats.usuariosActivos}</span>
                            <span className="stat-label">Usuarios Activos</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters Panel */}
            {showFilters && (
                <div className="filters-panel">
                    <div className="filter-group">
                        <label>Tipo de Evento</label>
                        <select
                            value={filterTipo}
                            onChange={(e) => setFilterTipo(e.target.value as FilterTipo)}
                        >
                            <option value="TODOS">Todos los eventos</option>
                            <option value="MANIFIESTO">Eventos de Manifiestos</option>
                            <option value="SISTEMA">Eventos del Sistema</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Período</label>
                        <select
                            value={filterPeriodo}
                            onChange={(e) => setFilterPeriodo(e.target.value as FilterPeriodo)}
                        >
                            <option value="HOY">Hoy</option>
                            <option value="SEMANA">Última semana</option>
                            <option value="MES">Último mes</option>
                            <option value="CUSTOM">Personalizado</option>
                        </select>
                    </div>
                    {filterPeriodo === 'CUSTOM' && (
                        <>
                            <div className="filter-group">
                                <label>Desde</label>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={(e) => setFechaDesde(e.target.value)}
                                />
                            </div>
                            <div className="filter-group">
                                <label>Hasta</label>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={(e) => setFechaHasta(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="error-banner">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Timeline */}
            <div className="timeline-container">
                {loading ? (
                    <div className="loading-state">
                        <RefreshCw size={32} className="spinning" />
                        <p>Cargando actividad...</p>
                    </div>
                ) : actividades.length === 0 ? (
                    <div className="empty-state">
                        <Activity size={48} />
                        <h3>Sin actividad</h3>
                        <p>No hay eventos registrados en el período seleccionado</p>
                    </div>
                ) : (
                    Object.entries(groupedActividades).map(([fecha, items]) => (
                        <div key={fecha} className="timeline-group">
                            <div className="timeline-date">
                                <Calendar size={16} />
                                <span>{fecha}</span>
                            </div>
                            <div className="timeline-items">
                                {items.map(actividad => {
                                    const { icon, color } = getIcon(actividad);
                                    const isExpanded = expandedItems.has(actividad.id);

                                    return (
                                        <div
                                            key={actividad.id}
                                            className={`timeline-item ${actividad.tipo.toLowerCase()}`}
                                            onClick={() => toggleExpand(actividad.id)}
                                        >
                                            <div className="timeline-marker" style={{ borderColor: color }}>
                                                <span style={{ color }}>{icon}</span>
                                            </div>
                                            <div className="timeline-content">
                                                <div className="timeline-header">
                                                    <span className="timeline-action" style={{ color }}>
                                                        {actividad.accion.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="timeline-time">
                                                        <Clock size={12} />
                                                        {formatRelativeTime(actividad.fecha)}
                                                    </span>
                                                </div>
                                                <p className="timeline-description">{actividad.descripcion}</p>

                                                {actividad.usuario && (
                                                    <div className="timeline-user">
                                                        <User size={12} />
                                                        <span>
                                                            {actividad.usuario.nombre} {actividad.usuario.apellido}
                                                        </span>
                                                        <span className="user-rol">{actividad.usuario.rol}</span>
                                                    </div>
                                                )}

                                                {actividad.manifiesto && (
                                                    <div className="timeline-manifiesto">
                                                        <FileText size={12} />
                                                        <span>#{actividad.manifiesto.numero}</span>
                                                        <span className={`estado-badge ${actividad.manifiesto.estado.toLowerCase()}`}>
                                                            {actividad.manifiesto.estado}
                                                        </span>
                                                    </div>
                                                )}

                                                {isExpanded && actividad.metadata && (
                                                    <div className="timeline-metadata">
                                                        {actividad.metadata.ubicacion && (
                                                            <div className="metadata-item">
                                                                <MapPin size={12} />
                                                                <span>{actividad.metadata.ubicacion}</span>
                                                            </div>
                                                        )}
                                                        {actividad.metadata.ip && (
                                                            <div className="metadata-item">
                                                                <Shield size={12} />
                                                                <span>IP: {actividad.metadata.ip}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="timeline-expand">
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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

export default ActividadGlobal;
