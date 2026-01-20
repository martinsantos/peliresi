/**
 * UsuariosPanel - Panel de Gestión de Usuarios para Admin
 *
 * Muestra todos los usuarios del sistema con:
 * - Filtros por rol, estado, búsqueda
 * - Estadísticas por rol
 * - Acciones: activar/desactivar, cambiar rol, ver detalle
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Users,
    Search,
    Filter,
    MoreVertical,
    UserCheck,
    UserX,
    Shield,
    Truck,
    Factory,
    Building2,
    RefreshCw,
    Mail,
    Phone,
    Calendar,
    Check,
    X,
    Loader2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { usuarioService } from '../services/admin.service';
import type { Usuario, UsuariosResponse } from '../services/admin.service';
import { useSorting } from '../hooks/useSorting';
import {
    AdminStatCard,
    AdminStatsGrid,
    AdminPageHeader,
    AdminBadge,
    AdminPagination,
    AdminButton,
    getRoleVariant
} from '../components/admin';
import './UsuariosPanel.css';

const ROLES = [
    { value: 'TODOS', label: 'Todos los roles', icon: Users },
    { value: 'ADMIN', label: 'Administradores', icon: Shield },
    { value: 'GENERADOR', label: 'Generadores', icon: Building2 },
    { value: 'TRANSPORTISTA', label: 'Transportistas', icon: Truck },
    { value: 'OPERADOR', label: 'Operadores', icon: Factory }
];

const getRoleColor = (rol: string) => {
    const colors: Record<string, string> = {
        ADMIN: 'var(--role-admin, #10b981)',
        GENERADOR: 'var(--role-generador, #3b82f6)',
        TRANSPORTISTA: 'var(--role-transportista, #f59e0b)',
        OPERADOR: 'var(--role-operador, #8b5cf6)'
    };
    return colors[rol] || '#64748b';
};

const getRoleIcon = (rol: string) => {
    const icons: Record<string, React.ReactNode> = {
        ADMIN: <Shield size={16} />,
        GENERADOR: <Building2 size={16} />,
        TRANSPORTISTA: <Truck size={16} />,
        OPERADOR: <Factory size={16} />
    };
    return icons[rol] || <Users size={16} />;
};

const getRoleVariantForStats = (rol: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    const variants: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
        ADMIN: 'info',
        GENERADOR: 'primary',
        TRANSPORTISTA: 'warning',
        OPERADOR: 'success'
    };
    return variants[rol] || 'neutral';
};

const UsuariosPanel: React.FC = () => {
    const [data, setData] = useState<UsuariosResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros
    const [busqueda, setBusqueda] = useState('');
    const [rolFiltro, setRolFiltro] = useState('TODOS');
    const [activoFiltro, setActivoFiltro] = useState<string>('');
    const [page, setPage] = useState(1);

    // Modal de detalle
    const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [procesando, setProcesando] = useState(false);

    const fetchUsuarios = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: any = { page, limit: 20 };
            if (rolFiltro !== 'TODOS') params.rol = rolFiltro;
            if (activoFiltro !== '') params.activo = activoFiltro;
            if (busqueda) params.busqueda = busqueda;

            const response = await usuarioService.getUsuarios(params);
            setData(response);
        } catch (err: any) {
            console.error('[UsuariosPanel] Error:', err);
            setError(err.message || 'Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    }, [page, rolFiltro, activoFiltro, busqueda]);

    useEffect(() => {
        fetchUsuarios();
    }, [fetchUsuarios]);

    // Debounce búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [busqueda]);

    const handleToggleActivo = async (usuario: Usuario) => {
        setProcesando(true);
        try {
            await usuarioService.updateUsuario(usuario.id, { activo: !usuario.activo });
            await fetchUsuarios();
        } catch (err: any) {
            alert(err.message || 'Error al actualizar usuario');
        } finally {
            setProcesando(false);
        }
    };

    const handleAprobar = async (usuario: Usuario) => {
        setProcesando(true);
        try {
            await usuarioService.aprobarUsuario(usuario.id);
            await fetchUsuarios();
        } catch (err: any) {
            alert(err.message || 'Error al aprobar usuario');
        } finally {
            setProcesando(false);
        }
    };

    const handleRechazar = async (usuario: Usuario) => {
        if (!confirm(`¿Rechazar y eliminar a ${usuario.nombre} ${usuario.apellido}?`)) return;
        setProcesando(true);
        try {
            await usuarioService.rechazarUsuario(usuario.id, 'Rechazado por admin');
            await fetchUsuarios();
        } catch (err: any) {
            alert(err.message || 'Error al rechazar usuario');
        } finally {
            setProcesando(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Sorting hook
    const { sortedData: sortedUsuarios, handleSort, getSortIcon } = useSorting(
        data?.usuarios || [],
        { defaultKey: 'createdAt', defaultDirection: 'desc' }
    );

    // Renderizar icono de sorting
    const SortIcon = ({ column }: { column: string }) => {
        const direction = getSortIcon(column);
        if (!direction) return <ArrowUpDown size={14} className="sort-icon" />;
        return direction === 'asc'
            ? <ArrowUp size={14} className="sort-icon active" />
            : <ArrowDown size={14} className="sort-icon active" />;
    };

    return (
        <div className="usuarios-panel admin-page">
            {/* Header */}
            <AdminPageHeader
                icon={<Users size={28} />}
                title="Gestión de Usuarios"
                subtitle="Administra todos los usuarios del sistema"
                actions={
                    <AdminButton
                        variant="ghost"
                        icon={<RefreshCw size={16} className={loading ? 'spinning' : ''} />}
                        onClick={fetchUsuarios}
                        disabled={loading}
                    >
                        Actualizar
                    </AdminButton>
                }
            />

            {/* Stats Cards */}
            {data?.stats && (
                <AdminStatsGrid columns="auto">
                    <AdminStatCard
                        icon={<Users size={24} />}
                        value={data.stats.total}
                        label="Total Usuarios"
                        variant="primary"
                    />
                    <AdminStatCard
                        icon={<UserCheck size={24} />}
                        value={data.stats.activos}
                        label="Activos"
                        variant="success"
                    />
                    <AdminStatCard
                        icon={<UserX size={24} />}
                        value={data.stats.inactivos}
                        label="Pendientes"
                        variant="warning"
                    />
                    {Object.entries(data.stats.porRol).map(([rol, count]) => (
                        <AdminStatCard
                            key={rol}
                            icon={getRoleIcon(rol)}
                            value={count as number}
                            label={rol}
                            variant={getRoleVariantForStats(rol)}
                        />
                    ))}
                </AdminStatsGrid>
            )}

            {/* Filtros */}
            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email, empresa..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <Filter size={16} />
                    <select value={rolFiltro} onChange={e => { setRolFiltro(e.target.value); setPage(1); }}>
                        {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <select value={activoFiltro} onChange={e => { setActivoFiltro(e.target.value); setPage(1); }}>
                        <option value="">Todos los estados</option>
                        <option value="true">Activos</option>
                        <option value="false">Pendientes/Inactivos</option>
                    </select>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="error-message">
                    <span>{error}</span>
                    <button onClick={fetchUsuarios}>Reintentar</button>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="loading-state">
                    <Loader2 className="spinning" size={32} />
                    <span>Cargando usuarios...</span>
                </div>
            )}

            {/* Table & Cards */}
            {!loading && data && (
                <>
                    {/* Mobile Cards View */}
                    <div className="users-cards">
                        {sortedUsuarios.map(usuario => (
                            <div key={usuario.id} className={`user-card ${!usuario.activo ? 'inactive' : ''}`}>
                                <div className="user-card-header">
                                    <div className="user-avatar" style={{ background: getRoleColor(usuario.rol) }}>
                                        {usuario.nombre?.charAt(0)}{usuario.apellido?.charAt(0)}
                                    </div>
                                    <div className="user-card-info">
                                        <span className="user-name">{usuario.nombre} {usuario.apellido}</span>
                                        <span className="user-email">{usuario.email}</span>
                                    </div>
                                    <AdminBadge variant={getRoleVariant(usuario.rol)} size="sm">
                                        {getRoleIcon(usuario.rol)}
                                        {usuario.rol}
                                    </AdminBadge>
                                </div>
                                <div className="user-card-body">
                                    <div className="card-detail-grid">
                                        <div className="card-detail">
                                            <Building2 size={14} />
                                            <span>{usuario.empresa || 'Sin empresa'}</span>
                                        </div>
                                        <div className="card-detail">
                                            <Phone size={14} />
                                            <span>{usuario.telefono || '—'}</span>
                                        </div>
                                        <div className="card-detail">
                                            <Calendar size={14} />
                                            <span>{formatDate(usuario.createdAt)}</span>
                                        </div>
                                        <div className="card-detail">
                                            <AdminBadge variant={usuario.activo ? 'success' : 'warning'} size="sm">
                                                {usuario.activo ? 'Activo' : 'Pendiente'}
                                            </AdminBadge>
                                        </div>
                                    </div>
                                </div>
                                <div className="user-card-actions">
                                    {!usuario.activo ? (
                                        <>
                                            <button
                                                className="card-action-btn approve"
                                                onClick={() => handleAprobar(usuario)}
                                                disabled={procesando}
                                            >
                                                <Check size={18} />
                                                <span>Aprobar</span>
                                            </button>
                                            <button
                                                className="card-action-btn reject"
                                                onClick={() => handleRechazar(usuario)}
                                                disabled={procesando}
                                            >
                                                <X size={18} />
                                                <span>Rechazar</span>
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="card-action-btn toggle"
                                            onClick={() => handleToggleActivo(usuario)}
                                            disabled={procesando}
                                        >
                                            <UserX size={18} />
                                            <span>Desactivar</span>
                                        </button>
                                    )}
                                    <button
                                        className="card-action-btn more"
                                        onClick={() => { setSelectedUser(usuario); setShowModal(true); }}
                                    >
                                        <MoreVertical size={18} />
                                        <span>Más</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="users-table-container">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th className="sortable-header" onClick={() => handleSort('nombre')}>
                                        Usuario <SortIcon column="nombre" />
                                    </th>
                                    <th className="sortable-header" onClick={() => handleSort('rol')}>
                                        Rol <SortIcon column="rol" />
                                    </th>
                                    <th>Empresa</th>
                                    <th>Contacto</th>
                                    <th className="sortable-header" onClick={() => handleSort('activo')}>
                                        Estado <SortIcon column="activo" />
                                    </th>
                                    <th className="sortable-header" onClick={() => handleSort('createdAt')}>
                                        Registro <SortIcon column="createdAt" />
                                    </th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedUsuarios.map(usuario => (
                                    <tr key={usuario.id} className={!usuario.activo ? 'inactive' : ''}>
                                        <td className="user-cell">
                                            <div className="user-avatar" style={{ background: getRoleColor(usuario.rol) }}>
                                                {usuario.nombre?.charAt(0)}{usuario.apellido?.charAt(0)}
                                            </div>
                                            <div className="user-info">
                                                <span className="user-name">{usuario.nombre} {usuario.apellido}</span>
                                                <span className="user-email">{usuario.email}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <AdminBadge variant={getRoleVariant(usuario.rol)} size="sm">
                                                {getRoleIcon(usuario.rol)}
                                                {usuario.rol}
                                            </AdminBadge>
                                        </td>
                                        <td>{usuario.empresa || '-'}</td>
                                        <td className="contact-cell">
                                            {usuario.telefono && (
                                                <span><Phone size={14} /> {usuario.telefono}</span>
                                            )}
                                        </td>
                                        <td>
                                            <AdminBadge variant={usuario.activo ? 'success' : 'warning'} size="sm">
                                                {usuario.activo ? 'Activo' : 'Pendiente'}
                                            </AdminBadge>
                                        </td>
                                        <td>
                                            <span className="date-cell">
                                                <Calendar size={14} />
                                                {formatDate(usuario.createdAt)}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            {!usuario.activo ? (
                                                <>
                                                    <button
                                                        className="action-btn approve"
                                                        onClick={() => handleAprobar(usuario)}
                                                        disabled={procesando}
                                                        title="Aprobar"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button
                                                        className="action-btn reject"
                                                        onClick={() => handleRechazar(usuario)}
                                                        disabled={procesando}
                                                        title="Rechazar"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className="action-btn toggle"
                                                    onClick={() => handleToggleActivo(usuario)}
                                                    disabled={procesando}
                                                    title="Desactivar"
                                                >
                                                    <UserX size={16} />
                                                </button>
                                            )}
                                            <button
                                                className="action-btn more"
                                                onClick={() => { setSelectedUser(usuario); setShowModal(true); }}
                                                title="Ver más"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data.pagination.pages > 1 && (
                        <AdminPagination
                            page={page}
                            totalPages={data.pagination.pages}
                            totalItems={data.pagination.total}
                            itemsPerPage={data.pagination.limit}
                            onPageChange={setPage}
                        />
                    )}
                </>
            )}

            {/* Modal Detalle */}
            {showModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content user-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="user-avatar large" style={{ background: getRoleColor(selectedUser.rol) }}>
                                {selectedUser.nombre?.charAt(0)}{selectedUser.apellido?.charAt(0)}
                            </div>
                            <div>
                                <h3>{selectedUser.nombre} {selectedUser.apellido}</h3>
                                <AdminBadge variant={getRoleVariant(selectedUser.rol)} size="sm">
                                    {getRoleIcon(selectedUser.rol)} {selectedUser.rol}
                                </AdminBadge>
                            </div>
                            <button className="close-btn" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="detail-row">
                                <Mail size={16} />
                                <span>{selectedUser.email}</span>
                            </div>
                            {selectedUser.telefono && (
                                <div className="detail-row">
                                    <Phone size={16} />
                                    <span>{selectedUser.telefono}</span>
                                </div>
                            )}
                            {selectedUser.empresa && (
                                <div className="detail-row">
                                    <Building2 size={16} />
                                    <span>{selectedUser.empresa}</span>
                                </div>
                            )}
                            <div className="detail-row">
                                <Calendar size={16} />
                                <span>Registrado: {formatDate(selectedUser.createdAt)}</span>
                            </div>
                            <div className="detail-row">
                                <AdminBadge variant={selectedUser.activo ? 'success' : 'warning'} size="md">
                                    {selectedUser.activo ? 'Usuario Activo' : 'Pendiente de Aprobacion'}
                                </AdminBadge>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>
                                Cerrar
                            </button>
                            {!selectedUser.activo ? (
                                <button
                                    className="btn-primary"
                                    onClick={() => { handleAprobar(selectedUser); setShowModal(false); }}
                                >
                                    Aprobar Usuario
                                </button>
                            ) : (
                                <button
                                    className="btn-danger"
                                    onClick={() => { handleToggleActivo(selectedUser); setShowModal(false); }}
                                >
                                    Desactivar Usuario
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsuariosPanel;
