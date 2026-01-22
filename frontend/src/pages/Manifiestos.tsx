import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { manifiestoService } from '../services/manifiesto.service';
import type { Manifiesto } from '../types';
import {
    FileText,
    Plus,
    Search,
    Filter,
    Eye,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { useSorting } from '../hooks/useSorting';
import './Manifiestos.css';

const ESTADO_OPTIONS = [
    { value: '', label: 'Todos los estados' },
    { value: 'BORRADOR', label: 'Borrador' },
    { value: 'APROBADO', label: 'Aprobado' },
    { value: 'EN_TRANSITO', label: 'En Tránsito' },
    { value: 'ENTREGADO', label: 'Entregado' },
    { value: 'RECIBIDO', label: 'Recibido' },
    { value: 'TRATADO', label: 'Tratado' },
];

const Manifiestos: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [estadoFilter, setEstadoFilter] = useState('');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 1
    });



    useEffect(() => {
        loadManifiestos();
    }, [pagination.page, estadoFilter]);

    const loadManifiestos = async () => {
        try {
            setLoading(true);
            const data = await manifiestoService.getManifiestos({
                page: pagination.page,
                limit: pagination.limit,
                estado: estadoFilter || undefined
            });
            setManifiestos(data.manifiestos);
            setPagination(prev => ({
                ...prev,
                ...data.pagination
            }));
        } catch (err: any) {
            console.error('Error loading manifiestos:', err);
            setError('Error al cargar la lista de manifiestos. Por favor intente más tarde.');
        } finally {
            setLoading(false);
        }
    };

    const getEstadoBadge = (estado: string) => {
        const badges: Record<string, { class: string; label: string }> = {
            BORRADOR: { class: 'badge-info', label: 'Borrador' },
            PENDIENTE_APROBACION: { class: 'badge-warning', label: 'Pendiente' },
            APROBADO: { class: 'badge-success', label: 'Aprobado' },
            EN_TRANSITO: { class: 'badge-warning', label: 'En Tránsito' },
            ENTREGADO: { class: 'badge-primary', label: 'Entregado' },
            RECIBIDO: { class: 'badge-info', label: 'Recibido' },
            EN_TRATAMIENTO: { class: 'badge-primary', label: 'En Tratamiento' },
            TRATADO: { class: 'badge-success', label: 'Tratado' },
            RECHAZADO: { class: 'badge-error', label: 'Rechazado' },
            CANCELADO: { class: 'badge-error', label: 'Cancelado' },
        };
        return badges[estado] || { class: 'badge-info', label: estado };
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const filteredManifiestos = (manifiestos || []).filter(m =>
        m?.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m?.generador?.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m?.transportista?.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sorting hook
    const { sortedData, sortConfig, handleSort, getSortIcon } = useSorting(filteredManifiestos, {
        defaultKey: 'createdAt',
        defaultDirection: 'desc'
    });

    // Renderizar icono de sorting
    const SortIcon = ({ column }: { column: string }) => {
        const direction = getSortIcon(column);
        if (!direction) return <ArrowUpDown size={14} className="sort-icon" />;
        return direction === 'asc'
            ? <ArrowUp size={14} className="sort-icon active" />
            : <ArrowDown size={14} className="sort-icon active" />;
    };

    if (loading && manifiestos.length === 0) {
        return (
            <div className="manifiestos-loading">
                <div className="spinner" />
                <p>Cargando manifiestos...</p>
            </div>
        );
    }

    return (
        <div className="manifiestos-page animate-fadeIn">
            {/* Header */}
            <div className="manifiestos-header">
                <div className="header-title">
                    <h2>Gestión de Manifiestos</h2>
                    <p>Administra los manifiestos de residuos peligrosos</p>
                </div>
                {user?.rol === 'GENERADOR' && (
                    <Link to="/manifiestos/nuevo" className="btn btn-primary">
                        <Plus size={18} />
                        Nuevo Manifiesto
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="manifiestos-filters">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por número, generador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <CustomSelect
                    options={ESTADO_OPTIONS}
                    value={estadoFilter}
                    onChange={(value) => {
                        setEstadoFilter(value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    placeholder="Todos los estados"
                    icon={<Filter size={18} />}
                />
            </div>

            {error && (
                <div className="manifiestos-error">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            {/* Table / Cards */}
            {sortedData.length > 0 ? (
                <>
                    {/* Mobile Cards View */}
                    <div className="mobile-cards">
                        {sortedData.map((manifiesto) => {
                            const badge = getEstadoBadge(manifiesto.estado);
                            return (
                                <div
                                    key={manifiesto.id}
                                    className="manifest-card"
                                    onClick={() => navigate(`/manifiestos/${manifiesto.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="manifest-card-header">
                                        <div className="manifest-card-id">
                                            <span className="manifest-number">{manifiesto.numero}</span>
                                            <span className="manifest-date">{formatDate(manifiesto.createdAt)}</span>
                                        </div>
                                        <span className={`badge ${badge.class}`}>{badge.label}</span>
                                        <Link
                                            to={`/manifiestos/${manifiesto.id}`}
                                            className="manifest-card-action"
                                            title="Ver detalle"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Eye size={20} />
                                        </Link>
                                    </div>
                                    <div className="manifest-card-body">
                                        <div className="manifest-actor-row">
                                            <div className="actor-label generador">GEN</div>
                                            <div className="actor-info">
                                                <div className="actor-name">{manifiesto.generador?.razonSocial || '—'}</div>
                                                <div className="actor-cuit">{manifiesto.generador?.cuit || ''}</div>
                                            </div>
                                        </div>
                                        <div className="manifest-actor-row">
                                            <div className="actor-label transportista">TRA</div>
                                            <div className="actor-info">
                                                <div className="actor-name">{manifiesto.transportista?.razonSocial || '—'}</div>
                                                <div className="actor-cuit">{manifiesto.transportista?.cuit || ''}</div>
                                            </div>
                                        </div>
                                        <div className="manifest-actor-row">
                                            <div className="actor-label operador">OPE</div>
                                            <div className="actor-info">
                                                <div className="actor-name">{manifiesto.operador?.razonSocial || '—'}</div>
                                                <div className="actor-cuit">{manifiesto.operador?.cuit || ''}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th className="sortable-header" onClick={() => handleSort('numero')}>
                                        Número <SortIcon column="numero" />
                                    </th>
                                    <th>Generador</th>
                                    <th>Transportista</th>
                                    <th>Operador</th>
                                    <th className="sortable-header" onClick={() => handleSort('estado')}>
                                        Estado <SortIcon column="estado" />
                                    </th>
                                    <th className="sortable-header" onClick={() => handleSort('createdAt')}>
                                        Fecha <SortIcon column="createdAt" />
                                    </th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map((manifiesto) => {
                                    const badge = getEstadoBadge(manifiesto.estado);
                                    return (
                                        <tr
                                            key={manifiesto.id}
                                            onClick={() => navigate(`/manifiestos/${manifiesto.id}`)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td>
                                                <span className="manifest-number">{manifiesto.numero}</span>
                                            </td>
                                            <td>
                                                <div className="actor-cell">
                                                    <strong>{manifiesto.generador?.razonSocial}</strong>
                                                    <span>{manifiesto.generador?.cuit}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="actor-cell">
                                                    <strong>{manifiesto.transportista?.razonSocial}</strong>
                                                    <span>{manifiesto.transportista?.cuit}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="actor-cell">
                                                    <strong>{manifiesto.operador?.razonSocial}</strong>
                                                    <span>{manifiesto.operador?.cuit}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${badge.class}`}>{badge.label}</span>
                                            </td>
                                            <td>{formatDate(manifiesto.createdAt)}</td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <Link
                                                    to={`/manifiestos/${manifiesto.id}`}
                                                    className="btn btn-icon btn-ghost"
                                                    title="Ver detalle"
                                                >
                                                    <Eye size={18} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="pagination">
                        <span className="pagination-info">
                            Mostrando {sortedData.length} de {pagination.total} (ordenado por {sortConfig.key} {sortConfig.direction === 'asc' ? '↑' : '↓'})
                        </span>
                        <div className="pagination-controls">
                            <button
                                className="btn btn-icon btn-ghost"
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="pagination-current">{pagination.page} / {pagination.pages}</span>
                            <button
                                className="btn btn-icon btn-ghost"
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="manifiestos-empty">
                    <FileText size={64} />
                    <h3>No hay manifiestos</h3>
                    <p>
                        {searchTerm || estadoFilter
                            ? 'No se encontraron manifiestos con los filtros aplicados'
                            : 'Aún no hay manifiestos registrados en el sistema'}
                    </p>
                    {user?.rol === 'GENERADOR' && !searchTerm && !estadoFilter && (
                        <Link to="/manifiestos/nuevo" className="btn btn-primary mt-4">
                            <Plus size={18} />
                            Crear primer manifiesto
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
};

export default Manifiestos;
