/**
 * AdminUsuariosScreen - Gestión de Usuarios para App Móvil
 * Features:
 * - Lista completa de usuarios
 * - Filtros por rol y estado
 * - Aprobar/Rechazar usuarios pendientes
 * - Activar/Desactivar usuarios
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, Search, Filter, CheckCircle, XCircle,
    UserCheck, UserX, Shield, Truck, Factory, Building2,
    Loader2, RefreshCw, AlertTriangle
} from 'lucide-react';
import { usuarioService } from '../services/admin.service';
import type { Usuario, UsuariosResponse } from '../services/admin.service';

type FilterRol = 'TODOS' | 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
type FilterEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';
type ViewTab = 'todos' | 'pendientes';

interface AdminUsuariosScreenProps {
}

const ROL_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    ADMIN: { icon: <Shield size={14} />, color: 'var(--role-admin, #10b981)', label: 'Admin' },
    GENERADOR: { icon: <Factory size={14} />, color: 'var(--role-generador, #3b82f6)', label: 'Generador' },
    TRANSPORTISTA: { icon: <Truck size={14} />, color: 'var(--role-transportista, #f59e0b)', label: 'Transportista' },
    OPERADOR: { icon: <Building2 size={14} />, color: 'var(--role-operador, #8b5cf6)', label: 'Operador' }
};

const AdminUsuariosScreen: React.FC<AdminUsuariosScreenProps> = () => {
    const [activeTab, setActiveTab] = useState<ViewTab>('todos');
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [pendientes, setPendientes] = useState<Usuario[]>([]);
    const [stats, setStats] = useState<UsuariosResponse['stats'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterRol, setFilterRol] = useState<FilterRol>('TODOS');
    const [filterEstado, setFilterEstado] = useState<FilterEstado>('TODOS');
    const [showFilters, setShowFilters] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadUsuarios = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params: any = {};
            if (filterRol !== 'TODOS') params.rol = filterRol;
            if (filterEstado === 'ACTIVOS') params.activo = 'true';
            if (filterEstado === 'INACTIVOS') params.activo = 'false';
            if (search) params.busqueda = search;

            const [usuariosData, pendientesData] = await Promise.all([
                usuarioService.getUsuarios(params),
                usuarioService.getUsuariosPendientes()
            ]);

            setUsuarios(usuariosData.usuarios);
            setStats(usuariosData.stats);
            setPendientes(pendientesData.usuarios);
        } catch (err) {
            console.error('Error cargando usuarios:', err);
            setError('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    }, [filterRol, filterEstado, search]);

    useEffect(() => {
        loadUsuarios();
    }, [loadUsuarios]);

    const handleAprobar = async (id: string) => {
        try {
            setActionLoading(id);
            await usuarioService.aprobarUsuario(id);
            await loadUsuarios();
        } catch (err) {
            console.error('Error aprobando usuario:', err);
            setError('Error al aprobar usuario');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRechazar = async (id: string) => {
        try {
            setActionLoading(id);
            await usuarioService.rechazarUsuario(id, 'Rechazado desde app móvil');
            await loadUsuarios();
        } catch (err) {
            console.error('Error rechazando usuario:', err);
            setError('Error al rechazar usuario');
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleActivo = async (usuario: Usuario) => {
        try {
            setActionLoading(usuario.id);
            await usuarioService.updateUsuario(usuario.id, { activo: !usuario.activo });
            await loadUsuarios();
        } catch (err) {
            console.error('Error actualizando usuario:', err);
            setError('Error al actualizar usuario');
        } finally {
            setActionLoading(null);
        }
    };

    const getRolBadge = (rol: string) => {
        const config = ROL_CONFIG[rol] || { icon: <Users size={14} />, color: '#64748b', label: rol };
        return (
            <span className="rol-badge" style={{ background: `${config.color}20`, color: config.color }}>
                {config.icon}
                {config.label}
            </span>
        );
    };

    const getEstadoBadge = (activo: boolean) => (
        <span className={`estado-badge ${activo ? 'activo' : 'inactivo'}`}>
            {activo ? <CheckCircle size={12} /> : <XCircle size={12} />}
            {activo ? 'Activo' : 'Inactivo'}
        </span>
    );

    return (
        <div className="admin-usuarios-screen">
            {/* Header */}
            <div className="screen-header">
                <div className="header-top">
                    <h2><Users size={20} /> Gestión de Usuarios</h2>
                    <button className="refresh-btn" onClick={loadUsuarios} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                    </button>
                </div>

                {/* Search */}
                <div className="search-bar">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                        className={`filter-toggle ${showFilters ? 'active' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter size={16} />
                    </button>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="filters-panel">
                        <div className="filter-group">
                            <label>Rol</label>
                            <select value={filterRol} onChange={(e) => setFilterRol(e.target.value as FilterRol)}>
                                <option value="TODOS">Todos</option>
                                <option value="ADMIN">Admin</option>
                                <option value="GENERADOR">Generador</option>
                                <option value="TRANSPORTISTA">Transportista</option>
                                <option value="OPERADOR">Operador</option>
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Estado</label>
                            <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as FilterEstado)}>
                                <option value="TODOS">Todos</option>
                                <option value="ACTIVOS">Activos</option>
                                <option value="INACTIVOS">Inactivos</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats */}
            {stats && (
                <div className="stats-strip">
                    <div className="stat-item">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total</span>
                    </div>
                    <div className="stat-item success">
                        <span className="stat-value">{stats.activos}</span>
                        <span className="stat-label">Activos</span>
                    </div>
                    <div className="stat-item warning">
                        <span className="stat-value">{pendientes.length}</span>
                        <span className="stat-label">Pendientes</span>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="view-tabs">
                <button
                    className={`tab ${activeTab === 'todos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('todos')}
                >
                    <Users size={14} />
                    Todos ({usuarios.length})
                </button>
                <button
                    className={`tab ${activeTab === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendientes')}
                >
                    <AlertTriangle size={14} />
                    Pendientes ({pendientes.length})
                </button>
            </div>

            {/* Content */}
            <div className="screen-content">
                {error && (
                    <div className="error-banner">
                        <AlertTriangle size={16} />
                        {error}
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={32} className="spinning" />
                        <p>Cargando usuarios...</p>
                    </div>
                ) : activeTab === 'todos' ? (
                    <div className="usuarios-list">
                        {usuarios.length > 0 ? (
                            usuarios.map(usuario => (
                                <div key={usuario.id} className="usuario-card">
                                    <div className="usuario-header">
                                        <div className="usuario-info">
                                            <span className="usuario-nombre">
                                                {usuario.nombre} {usuario.apellido}
                                            </span>
                                            <span className="usuario-email">{usuario.email}</span>
                                        </div>
                                        {getRolBadge(usuario.rol)}
                                    </div>
                                    <div className="usuario-meta">
                                        {usuario.empresa && (
                                            <span className="empresa">{usuario.empresa}</span>
                                        )}
                                        {getEstadoBadge(usuario.activo)}
                                    </div>
                                    <div className="usuario-actions">
                                        <button
                                            className={`action-btn ${usuario.activo ? 'deactivate' : 'activate'}`}
                                            onClick={() => handleToggleActivo(usuario)}
                                            disabled={actionLoading === usuario.id}
                                        >
                                            {actionLoading === usuario.id ? (
                                                <Loader2 size={14} className="spinning" />
                                            ) : usuario.activo ? (
                                                <><UserX size={14} /> Desactivar</>
                                            ) : (
                                                <><UserCheck size={14} /> Activar</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Users size={48} />
                                <h3>Sin usuarios</h3>
                                <p>No hay usuarios que coincidan con los filtros</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="pendientes-list">
                        {pendientes.length > 0 ? (
                            pendientes.map(usuario => (
                                <div key={usuario.id} className="pendiente-card">
                                    <div className="pendiente-header">
                                        <span className="usuario-nombre">
                                            {usuario.nombre} {usuario.apellido}
                                        </span>
                                        {getRolBadge(usuario.rol)}
                                    </div>
                                    <div className="pendiente-info">
                                        <p><strong>Email:</strong> {usuario.email}</p>
                                        {usuario.empresa && <p><strong>Empresa:</strong> {usuario.empresa}</p>}
                                        <p><strong>Fecha registro:</strong> {new Date(usuario.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="pendiente-actions">
                                        <button
                                            className="action-btn approve"
                                            onClick={() => handleAprobar(usuario.id)}
                                            disabled={actionLoading === usuario.id}
                                        >
                                            {actionLoading === usuario.id ? (
                                                <Loader2 size={14} className="spinning" />
                                            ) : (
                                                <><CheckCircle size={14} /> Aprobar</>
                                            )}
                                        </button>
                                        <button
                                            className="action-btn reject"
                                            onClick={() => handleRechazar(usuario.id)}
                                            disabled={actionLoading === usuario.id}
                                        >
                                            {actionLoading === usuario.id ? (
                                                <Loader2 size={14} className="spinning" />
                                            ) : (
                                                <><XCircle size={14} /> Rechazar</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state success">
                                <CheckCircle size={48} />
                                <h3>Sin pendientes</h3>
                                <p>No hay usuarios esperando aprobación</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .admin-usuarios-screen {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--color-bg-base, #0a0e14);
                    font-family: var(--font-sans);
                }

                .screen-header {
                    padding: var(--space-3, 12px);
                    background: var(--color-bg-elevated, #0f1419);
                    border-bottom: 1px solid var(--color-border-default);
                }

                .header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-3, 12px);
                }

                .header-top h2 {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    margin: 0;
                    font-size: var(--text-lg, 1.125rem);
                    color: var(--color-text-bright);
                    font-weight: var(--font-semibold);
                }

                .refresh-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-md, 10px);
                    color: var(--color-text-secondary);
                    cursor: pointer;
                }

                .refresh-btn:hover {
                    color: var(--color-primary);
                    border-color: var(--color-primary-dim);
                }

                .search-bar {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    padding: var(--space-2, 8px) var(--space-3, 12px);
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-md, 10px);
                }

                .search-bar input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    color: var(--color-text-primary);
                    font-size: var(--text-sm, 0.875rem);
                }

                .search-bar input::placeholder {
                    color: var(--color-text-muted);
                }

                .filter-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    background: transparent;
                    border: none;
                    border-radius: var(--radius-sm, 6px);
                    color: var(--color-text-secondary);
                    cursor: pointer;
                }

                .filter-toggle:hover,
                .filter-toggle.active {
                    background: var(--color-bg-hover);
                    color: var(--color-primary);
                }

                .filters-panel {
                    display: flex;
                    gap: var(--space-3, 12px);
                    margin-top: var(--space-3, 12px);
                    padding: var(--space-3, 12px);
                    background: var(--color-bg-surface);
                    border-radius: var(--radius-md, 10px);
                }

                .filter-group {
                    flex: 1;
                }

                .filter-group label {
                    display: block;
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-muted);
                    margin-bottom: var(--space-1, 4px);
                }

                .filter-group select {
                    width: 100%;
                    padding: var(--space-2, 8px);
                    background: var(--color-bg-base);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-sm, 6px);
                    color: var(--color-text-primary);
                    font-size: var(--text-sm, 0.875rem);
                }

                .stats-strip {
                    display: flex;
                    padding: var(--space-3, 12px);
                    gap: var(--space-2, 8px);
                    background: var(--color-bg-void, #050709);
                }

                .stat-item {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: var(--space-2, 8px);
                    background: var(--color-bg-surface);
                    border-radius: var(--radius-md, 10px);
                }

                .stat-value {
                    font-size: var(--text-xl, 1.25rem);
                    font-weight: var(--font-bold);
                    color: var(--color-text-bright);
                    font-family: var(--font-mono);
                }

                .stat-item.success .stat-value { color: var(--color-success); }
                .stat-item.warning .stat-value { color: var(--color-warning); }

                .stat-label {
                    font-size: var(--text-2xs, 0.625rem);
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                }

                .view-tabs {
                    display: flex;
                    gap: var(--space-1, 4px);
                    padding: var(--space-2, 8px) var(--space-3, 12px);
                    background: var(--color-bg-elevated, #0f1419);
                    border-bottom: 1px solid var(--color-border-default);
                }

                .tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-1, 4px);
                    padding: var(--space-2, 8px);
                    background: transparent;
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-sm, 6px);
                    color: var(--color-text-secondary);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: var(--font-medium);
                    cursor: pointer;
                }

                .tab:hover {
                    background: var(--color-bg-hover);
                }

                .tab.active {
                    background: var(--color-primary);
                    border-color: var(--color-primary);
                    color: white;
                }

                .screen-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: var(--space-3, 12px);
                }

                .error-banner {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    padding: var(--space-3, 12px);
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid var(--color-danger);
                    border-radius: var(--radius-md, 10px);
                    color: var(--color-danger);
                    font-size: var(--text-sm, 0.875rem);
                    margin-bottom: var(--space-3, 12px);
                }

                .error-banner button {
                    margin-left: auto;
                    background: transparent;
                    border: none;
                    color: var(--color-danger);
                    font-size: var(--text-lg, 1.125rem);
                    cursor: pointer;
                }

                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-12, 48px);
                    color: var(--color-primary);
                }

                .loading-state p {
                    margin-top: var(--space-3, 12px);
                    color: var(--color-text-muted);
                    font-size: var(--text-sm, 0.875rem);
                }

                .spinning {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .usuarios-list,
                .pendientes-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 8px);
                }

                .usuario-card,
                .pendiente-card {
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    border-radius: var(--radius-md, 10px);
                    padding: var(--space-3, 12px);
                }

                .usuario-header,
                .pendiente-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: var(--space-2, 8px);
                }

                .usuario-info {
                    display: flex;
                    flex-direction: column;
                }

                .usuario-nombre {
                    font-weight: var(--font-semibold);
                    color: var(--color-text-bright);
                    font-size: var(--text-sm, 0.875rem);
                }

                .usuario-email {
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-muted);
                }

                .rol-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    border-radius: var(--radius-sm, 6px);
                    font-size: var(--text-2xs, 0.625rem);
                    font-weight: var(--font-semibold);
                    text-transform: uppercase;
                }

                .usuario-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 8px);
                    margin-bottom: var(--space-3, 12px);
                }

                .empresa {
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-secondary);
                }

                .estado-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    border-radius: var(--radius-sm, 6px);
                    font-size: var(--text-2xs, 0.625rem);
                    font-weight: var(--font-semibold);
                }

                .estado-badge.activo {
                    background: rgba(16, 185, 129, 0.15);
                    color: var(--color-success);
                }

                .estado-badge.inactivo {
                    background: rgba(239, 68, 68, 0.15);
                    color: var(--color-danger);
                }

                .usuario-actions,
                .pendiente-actions {
                    display: flex;
                    gap: var(--space-2, 8px);
                    padding-top: var(--space-3, 12px);
                    border-top: 1px solid var(--color-border-subtle);
                }

                .action-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-1, 4px);
                    padding: var(--space-2, 8px);
                    border: none;
                    border-radius: var(--radius-sm, 6px);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: var(--font-semibold);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .action-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .action-btn.activate {
                    background: var(--color-success);
                    color: white;
                }

                .action-btn.deactivate {
                    background: var(--color-bg-hover);
                    color: var(--color-text-secondary);
                    border: 1px solid var(--color-border-default);
                }

                .action-btn.approve {
                    background: var(--color-success);
                    color: white;
                }

                .action-btn.reject {
                    background: var(--color-danger);
                    color: white;
                }

                .pendiente-info {
                    margin-bottom: var(--space-3, 12px);
                }

                .pendiente-info p {
                    margin: 0 0 var(--space-1, 4px);
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-secondary);
                }

                .pendiente-info strong {
                    color: var(--color-text-muted);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-12, 48px) var(--space-6, 24px);
                    text-align: center;
                    color: var(--color-text-muted);
                }

                .empty-state svg {
                    margin-bottom: var(--space-4, 16px);
                    opacity: 0.5;
                }

                .empty-state.success svg {
                    color: var(--color-success);
                    opacity: 0.7;
                }

                .empty-state h3 {
                    margin: 0 0 var(--space-2, 8px);
                    color: var(--color-text-bright);
                    font-weight: var(--font-semibold);
                }

                .empty-state p {
                    margin: 0;
                    font-size: var(--text-sm, 0.875rem);
                }
            `}</style>
        </div>
    );
};

export default AdminUsuariosScreen;
