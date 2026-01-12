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
    ChevronLeft,
    ChevronRight,
    Mail,
    Phone,
    Calendar,
    Check,
    X,
    Loader2
} from 'lucide-react';
import { usuarioService } from '../services/admin.service';
import type { Usuario, UsuariosResponse } from '../services/admin.service';
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

    return (
        <div className="usuarios-panel">
            {/* Header */}
            <div className="panel-header">
                <div className="header-title">
                    <Users size={28} />
                    <div>
                        <h1>Gestión de Usuarios</h1>
                        <p>Administra todos los usuarios del sistema</p>
                    </div>
                </div>
                <button className="btn-refresh" onClick={fetchUsuarios} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Stats Cards */}
            {data?.stats && (
                <div className="stats-grid">
                    <div className="stat-card total">
                        <Users size={24} />
                        <div className="stat-info">
                            <span className="stat-value">{data.stats.total}</span>
                            <span className="stat-label">Total Usuarios</span>
                        </div>
                    </div>
                    <div className="stat-card activos">
                        <UserCheck size={24} />
                        <div className="stat-info">
                            <span className="stat-value">{data.stats.activos}</span>
                            <span className="stat-label">Activos</span>
                        </div>
                    </div>
                    <div className="stat-card inactivos">
                        <UserX size={24} />
                        <div className="stat-info">
                            <span className="stat-value">{data.stats.inactivos}</span>
                            <span className="stat-label">Pendientes</span>
                        </div>
                    </div>
                    {Object.entries(data.stats.porRol).map(([rol, count]) => (
                        <div key={rol} className="stat-card role" style={{ borderColor: getRoleColor(rol) }}>
                            {getRoleIcon(rol)}
                            <div className="stat-info">
                                <span className="stat-value">{count}</span>
                                <span className="stat-label">{rol}</span>
                            </div>
                        </div>
                    ))}
                </div>
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

            {/* Table */}
            {!loading && data && (
                <>
                    <div className="users-table-container">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th>Empresa</th>
                                    <th>Contacto</th>
                                    <th>Estado</th>
                                    <th>Registro</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.usuarios.map(usuario => (
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
                                            <span className="role-badge" style={{ background: getRoleColor(usuario.rol) + '20', color: getRoleColor(usuario.rol) }}>
                                                {getRoleIcon(usuario.rol)}
                                                {usuario.rol}
                                            </span>
                                        </td>
                                        <td>{usuario.empresa || '-'}</td>
                                        <td className="contact-cell">
                                            {usuario.telefono && (
                                                <span><Phone size={14} /> {usuario.telefono}</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${usuario.activo ? 'active' : 'pending'}`}>
                                                {usuario.activo ? 'Activo' : 'Pendiente'}
                                            </span>
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
                        <div className="pagination">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft size={18} />
                                Anterior
                            </button>
                            <span className="page-info">
                                Página {page} de {data.pagination.pages}
                            </span>
                            <button
                                disabled={page >= data.pagination.pages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Siguiente
                                <ChevronRight size={18} />
                            </button>
                        </div>
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
                                <span className="role-badge" style={{ background: getRoleColor(selectedUser.rol) + '20', color: getRoleColor(selectedUser.rol) }}>
                                    {getRoleIcon(selectedUser.rol)} {selectedUser.rol}
                                </span>
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
                                <span className={`status-badge ${selectedUser.activo ? 'active' : 'pending'}`}>
                                    {selectedUser.activo ? 'Usuario Activo' : 'Pendiente de Aprobación'}
                                </span>
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
