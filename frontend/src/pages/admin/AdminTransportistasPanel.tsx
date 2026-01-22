import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Eye,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  XCircle,
  ChevronRight,
  Car,
  Users
} from 'lucide-react';
import axios from 'axios';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminBadge } from '../../components/admin/AdminBadge';
import { AdminPagination } from '../../components/admin/AdminPagination';
import '../../components/admin/admin.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface DashboardStats {
  totalTransportistas: number;
  transportistasActivos: number;
  totalVehiculos: number;
  totalChoferes: number;
}

interface Transportista {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  numeroHabilitacion: string;
  activo: boolean;
  usuario: {
    email: string;
    nombre: string;
    apellido: string;
    activo: boolean;
    aprobado: boolean;
  };
  vehiculos: Array<{ id: string; patente: string; activo: boolean }>;
  choferes: Array<{ id: string; nombre: string; apellido: string; activo: boolean }>;
  _count: { manifiestos: number };
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface TipoResiduo {
  id: string;
  codigo: string;
  nombre: string;
  peligrosidad: string;
}

interface FiltrosDisponibles {
  tiposResiduo: TipoResiduo[];
}

const ITEMS_OPTIONS = [10, 15, 25, 50];

const AdminTransportistasPanel: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<string>('todos');
  const [filtroTipoResiduo, setFiltroTipoResiduo] = useState<string>('');
  const [filtrosDisponibles, setFiltrosDisponibles] = useState<FiltrosDisponibles>({
    tiposResiduo: []
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'razonSocial',
    direction: 'asc'
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const handleVerDetalle = (id: string) => {
    navigate(`/admin/transportistas/${id}`);
  };

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  const cargarDashboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin-sectorial/transportistas/dashboard`, {
        headers: getHeaders()
      });
      setStats(response.data.data.stats);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  };

  const cargarFiltrosDisponibles = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin-sectorial/transportistas/filtros-disponibles`, {
        headers: getHeaders()
      });
      setFiltrosDisponibles(response.data.data);
    } catch (error) {
      console.error('Error cargando filtros:', error);
    }
  };

  const cargarTransportistas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', itemsPerPage.toString());
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroActivo !== 'todos') params.append('activo', filtroActivo);
      if (filtroTipoResiduo) params.append('tipoResiduoId', filtroTipoResiduo);
      params.append('sortBy', sortConfig.key);
      params.append('sortOrder', sortConfig.direction);

      const response = await axios.get(
        `${API_URL}/admin-sectorial/transportistas/lista?${params.toString()}`,
        { headers: getHeaders() }
      );
      setTransportistas(response.data.data.transportistas);
      setTotalPages(response.data.data.pagination.totalPages);
      setTotalItems(response.data.data.pagination.total || response.data.data.transportistas.length);
    } catch (error) {
      console.error('Error cargando transportistas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPage(1);
  };

  const renderSortIndicator = (columnKey: string) => {
    if (sortConfig.key !== columnKey) {
      return <span className="admin-sort-indicator admin-sort-indicator--inactive">⇅</span>;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={14} className="admin-sort-indicator" />
      : <ChevronDown size={14} className="admin-sort-indicator" />;
  };

  const aprobarTransportista = async (id: string) => {
    try {
      await axios.post(
        `${API_URL}/admin-sectorial/transportistas/${id}/aprobar`,
        {},
        { headers: getHeaders() }
      );
      cargarTransportistas();
      cargarDashboard();
    } catch (error) {
      console.error('Error aprobando transportista:', error);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroActivo('todos');
    setFiltroTipoResiduo('');
    setPage(1);
  };

  const hayFiltrosActivos = busqueda || filtroActivo !== 'todos' || filtroTipoResiduo;

  useEffect(() => {
    cargarDashboard();
    cargarFiltrosDisponibles();
  }, []);

  useEffect(() => {
    cargarTransportistas();
  }, [page, filtroActivo, filtroTipoResiduo, sortConfig, itemsPerPage]);

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    cargarTransportistas();
  };

  const handleRefresh = () => {
    cargarDashboard();
    cargarTransportistas();
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <AdminPageHeader
        icon={<Truck size={24} />}
        title="Admin Transportistas"
        subtitle={`${totalItems.toLocaleString()} transportistas registrados`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`admin-btn admin-btn--secondary ${showFilters ? 'admin-btn--active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={18} />
              Filtros
            </button>
            <button className="admin-btn admin-btn--secondary" onClick={handleRefresh}>
              <RefreshCw size={18} />
            </button>
          </div>
        }
      />

      {/* Stats Cards - Compact */}
      {stats && (
        <div className="admin-stats-compact">
          <div className="admin-stat-mini">
            <Truck size={16} />
            <span className="admin-stat-mini__value">{stats.totalTransportistas}</span>
            <span className="admin-stat-mini__label">Total</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--success">
            <CheckCircle size={16} />
            <span className="admin-stat-mini__value">{stats.transportistasActivos}</span>
            <span className="admin-stat-mini__label">Activos</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--info">
            <Car size={16} />
            <span className="admin-stat-mini__value">{stats.totalVehiculos}</span>
            <span className="admin-stat-mini__label">Vehículos</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--warning">
            <Users size={16} />
            <span className="admin-stat-mini__value">{stats.totalChoferes}</span>
            <span className="admin-stat-mini__label">Choferes</span>
          </div>
        </div>
      )}

      {/* Filtros - Compact Grid */}
      {showFilters && (
        <div className="admin-filters-grid">
          {/* Row 1: Search + Quick filters */}
          <div className="admin-filters-row">
            <form onSubmit={handleBuscar} className="admin-search-compact">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar razón social, CUIT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <button type="submit" className="admin-btn-icon" title="Buscar">
                <ChevronRight size={16} />
              </button>
            </form>

            <div className="admin-quick-filters">
              <button
                className={`admin-chip ${filtroActivo === 'todos' ? 'admin-chip--active' : ''}`}
                onClick={() => { setFiltroActivo('todos'); setPage(1); }}
              >
                Todos
              </button>
              <button
                className={`admin-chip admin-chip--success ${filtroActivo === 'true' ? 'admin-chip--active' : ''}`}
                onClick={() => { setFiltroActivo('true'); setPage(1); }}
              >
                Activos
              </button>
              <button
                className={`admin-chip admin-chip--danger ${filtroActivo === 'false' ? 'admin-chip--active' : ''}`}
                onClick={() => { setFiltroActivo('false'); setPage(1); }}
              >
                Inactivos
              </button>
            </div>
          </div>

          {/* Row 2: Select filters */}
          <div className="admin-filters-row">
            <select
              className="admin-select-compact"
              value={filtroTipoResiduo}
              onChange={(e) => { setFiltroTipoResiduo(e.target.value); setPage(1); }}
            >
              <option value="">Tipo Residuo Transportado (Y-code)</option>
              {filtrosDisponibles.tiposResiduo?.map(tipo => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.codigo} - {tipo.nombre.length > 35 ? tipo.nombre.substring(0, 35) + '...' : tipo.nombre}
                </option>
              ))}
            </select>

            {hayFiltrosActivos && (
              <button className="admin-btn-clear" onClick={limpiarFiltros} title="Limpiar filtros">
                <XCircle size={16} />
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table Header with Items per page */}
      <div className="admin-table-header">
        <h3 className="admin-table-title">
          <FileText size={18} />
          Listado de Transportistas
          <span className="admin-table-count-badge">{totalItems}</span>
        </h3>
        <div className="admin-table-controls">
          <span className="admin-table-controls__label">Mostrar:</span>
          <select
            className="admin-select-mini"
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
          >
            {ITEMS_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-table-container">
        {loading ? (
          <div className="admin-loading">
            <RefreshCw className="admin-loading-spinner" size={24} />
            <span>Cargando transportistas...</span>
          </div>
        ) : transportistas.length === 0 ? (
          <div className="admin-empty-state">
            <Truck size={48} />
            <p>No se encontraron transportistas</p>
            {hayFiltrosActivos && (
              <button className="admin-btn admin-btn--secondary" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="admin-mobile-cards admin-show-mobile">
              {transportistas.map((t) => (
                <div
                  key={t.id}
                  className="admin-mobile-card"
                  onClick={() => handleVerDetalle(t.id)}
                >
                  <div className="admin-mobile-card__header">
                    <div className="admin-mobile-card__avatar" style={{ background: t.activo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
                      <Truck size={20} />
                    </div>
                    <div className="admin-mobile-card__info">
                      <h3 className="admin-mobile-card__title">{t.razonSocial}</h3>
                      <span className="admin-mobile-card__subtitle">CUIT: {t.cuit}</span>
                    </div>
                    <ChevronRight size={20} className="admin-mobile-card__chevron" />
                  </div>

                  <div className="admin-mobile-card__body">
                    <div className="admin-mobile-card__badges">
                      <AdminBadge variant={t.activo ? 'success' : 'danger'} size="sm">
                        {t.activo ? 'Activo' : 'Inactivo'}
                      </AdminBadge>
                      {!t.usuario.aprobado && (
                        <AdminBadge variant="warning" size="sm">Pendiente</AdminBadge>
                      )}
                    </div>

                    <div className="admin-mobile-card__meta">
                      <span><Car size={12} /> {t.vehiculos?.length || 0} vehículos</span>
                      <span><Users size={12} /> {t.choferes?.length || 0} choferes</span>
                      <span><FileText size={12} /> {t._count.manifiestos} manifiestos</span>
                    </div>
                  </div>

                  {!t.usuario.aprobado && (
                    <div className="admin-mobile-card__actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="admin-mobile-card__action admin-mobile-card__action--success"
                        onClick={() => aprobarTransportista(t.id)}
                      >
                        <CheckCircle size={16} />
                        Aprobar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <table className="admin-table admin-table--fixed admin-hide-mobile">
              <colgroup>
                <col style={{ width: '40%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="admin-th-sortable" onClick={() => handleSort('razonSocial')}>
                    Transportista {renderSortIndicator('razonSocial')}
                  </th>
                  <th>Flota</th>
                  <th>Manifiestos</th>
                  <th className="admin-th-sortable" onClick={() => handleSort('activo')}>
                    Estado {renderSortIndicator('activo')}
                  </th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transportistas.map((t) => (
                  <tr
                    key={t.id}
                    className="admin-table-row--clickable"
                    onClick={() => handleVerDetalle(t.id)}
                  >
                    <td>
                      <div className="admin-cell-primary">
                        <span className="admin-cell-title">{t.razonSocial}</span>
                        <span className="admin-cell-meta">
                          <code>{t.cuit}</code>
                          <span>{t.usuario.email}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="admin-cell-flota">
                        <span><Car size={14} /> {t.vehiculos?.length || 0} vehículos</span>
                        <span><Users size={14} /> {t.choferes?.length || 0} choferes</span>
                      </div>
                    </td>
                    <td>
                      <span className="admin-cell-manifiestos">
                        <FileText size={14} /> {t._count.manifiestos}
                      </span>
                    </td>
                    <td>
                      <div className="admin-cell-status-inline">
                        <AdminBadge variant={t.activo ? 'success' : 'danger'} size="sm">
                          {t.activo ? 'Activo' : 'Inactivo'}
                        </AdminBadge>
                        {!t.usuario.aprobado && (
                          <AdminBadge variant="warning" size="xs">Pend.</AdminBadge>
                        )}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="admin-actions-cell">
                        <button
                          className="admin-action-btn"
                          onClick={() => handleVerDetalle(t.id)}
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                        {!t.usuario.aprobado && (
                          <button
                            className="admin-action-btn admin-action-btn--success"
                            onClick={() => aprobarTransportista(t.id)}
                            title="Aprobar"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        <div className="admin-dropdown">
                          <button
                            className="admin-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenu(openActionMenu === t.id ? null : t.id);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openActionMenu === t.id && (
                            <div className="admin-dropdown-menu admin-dropdown-menu--open">
                              <button onClick={() => handleVerDetalle(t.id)}>
                                <Eye size={14} /> Ver detalle
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Paginación */}
      {transportistas.length > 0 && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

export default AdminTransportistasPanel;
