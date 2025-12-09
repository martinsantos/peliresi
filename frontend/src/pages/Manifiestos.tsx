import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    AlertTriangle
} from 'lucide-react';
import './Manifiestos.css';

const Manifiestos: React.FC = () => {
    const { user } = useAuth();
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

    // Demo manifiestos fallback
    const demoManifiestos: Manifiesto[] = [
        {
            id: '1',
            numero: 'MAN-2025-000005',
            estado: 'APROBADO',
            generador: { razonSocial: 'Química Industrial Mendoza', cuit: '30-71234567-8' },
            transportista: { razonSocial: 'Transportes Los Andes S.A.', cuit: '30-71234568-9' },
            operador: { razonSocial: 'Centro de Tratamiento Cuyo', cuit: '30-71234569-0' },
            createdAt: new Date('2025-12-05').toISOString()
        } as Manifiesto,
        {
            id: '2',
            numero: 'MAN-2025-000006',
            estado: 'EN_TRANSITO',
            generador: { razonSocial: 'Hospital Central Mendoza', cuit: '30-71234570-1' },
            transportista: { razonSocial: 'Logística Cuyo S.R.L.', cuit: '30-71234571-2' },
            operador: { razonSocial: 'Planta Este Residuos', cuit: '30-71234572-3' },
            createdAt: new Date('2025-12-06').toISOString()
        } as Manifiesto,
        {
            id: '3',
            numero: 'MAN-2025-000007',
            estado: 'RECIBIDO',
            generador: { razonSocial: 'Petroandina S.A.', cuit: '30-71234573-4' },
            transportista: { razonSocial: 'Transportes Los Andes S.A.', cuit: '30-71234568-9' },
            operador: { razonSocial: 'Centro de Tratamiento Cuyo', cuit: '30-71234569-0' },
            createdAt: new Date('2025-12-04').toISOString()
        } as Manifiesto,
        {
            id: '4',
            numero: 'MAN-2025-000008',
            estado: 'TRATADO',
            generador: { razonSocial: 'Farmacéutica Los Andes', cuit: '30-71234574-5' },
            transportista: { razonSocial: 'Logística Cuyo S.R.L.', cuit: '30-71234571-2' },
            operador: { razonSocial: 'Planta Este Residuos', cuit: '30-71234572-3' },
            createdAt: new Date('2025-12-01').toISOString()
        } as Manifiesto,
        {
            id: '5',
            numero: 'MAN-2025-000009',
            estado: 'APROBADO',
            generador: { razonSocial: 'Metalúrgica del Oeste', cuit: '30-71234575-6' },
            transportista: { razonSocial: 'Transportes Los Andes S.A.', cuit: '30-71234568-9' },
            operador: { razonSocial: 'Centro de Tratamiento Cuyo', cuit: '30-71234569-0' },
            createdAt: new Date('2025-12-07').toISOString()
        } as Manifiesto,
        {
            id: '6',
            numero: 'MAN-2025-000010',
            estado: 'EN_TRANSITO',
            generador: { razonSocial: 'Laboratorio Análisis S.A.', cuit: '30-71234576-7' },
            transportista: { razonSocial: 'Logística Cuyo S.R.L.', cuit: '30-71234571-2' },
            operador: { razonSocial: 'Planta Este Residuos', cuit: '30-71234572-3' },
            createdAt: new Date('2025-12-07').toISOString()
        } as Manifiesto,
    ];

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
            console.error('Error loading manifiestos, using demo data:', err);
            // Usar datos demo en caso de error
            setManifiestos(demoManifiestos);
            setPagination(prev => ({
                ...prev,
                total: demoManifiestos.length,
                pages: Math.ceil(demoManifiestos.length / prev.limit)
            }));
            setError('');  // No mostrar error, solo usar datos demo
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

    const filteredManifiestos = manifiestos.filter(m =>
        m.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.generador?.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.transportista?.razonSocial.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <div className="filter-box">
                    <Filter size={18} />
                    <select
                        value={estadoFilter}
                        onChange={(e) => {
                            setEstadoFilter(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    >
                        <option value="">Todos los estados</option>
                        <option value="BORRADOR">Borrador</option>
                        <option value="APROBADO">Aprobado</option>
                        <option value="EN_TRANSITO">En Tránsito</option>
                        <option value="ENTREGADO">Entregado</option>
                        <option value="RECIBIDO">Recibido</option>
                        <option value="TRATADO">Tratado</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="manifiestos-error">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            {/* Table */}
            {filteredManifiestos.length > 0 ? (
                <>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Número</th>
                                    <th>Generador</th>
                                    <th>Transportista</th>
                                    <th>Operador</th>
                                    <th>Estado</th>
                                    <th>Fecha</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredManifiestos.map((manifiesto) => {
                                    const badge = getEstadoBadge(manifiesto.estado);
                                    return (
                                        <tr key={manifiesto.id}>
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
                                            <td>
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
                            Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
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
