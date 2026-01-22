import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
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
  Recycle,
  Package
} from 'lucide-react';
import axios from 'axios';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminBadge } from '../../components/admin/AdminBadge';
import type { BadgeVariant } from '../../components/admin/AdminBadge';
import { AdminPagination } from '../../components/admin/AdminPagination';
import '../../components/admin/admin.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface DashboardStats {
  totalOperadores: number;
  operadoresActivos: number;
  totalTratamientos: number;
  capacidadTotal: number;
}

interface TratamientoAutorizado {
  id: string;
  metodo: string;
  capacidad: number;
  activo: boolean;
  tipoResiduo: {
    codigo: string;
    nombre: string;
  };
}

interface Operador {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  categoria: string;
  activo: boolean;
  usuario: {
    email: string;
    nombre: string;
    apellido: string;
    activo: boolean;
    aprobado: boolean;
  };
  tratamientos: TratamientoAutorizado[];
  _count: { manifiestos: number };
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface TipoResiduoFiltro {
  id: string;
  codigo: string;
  nombre: string;
  peligrosidad: string;
}

interface FiltrosDisponibles {
  tiposResiduo: TipoResiduoFiltro[];
}

const ITEMS_OPTIONS = [10, 15, 25, 50];

const AdminOperadoresPanel: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>([]);
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
    navigate(`/admin/operadores/${id}`);
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
      const response = await axios.get(`${API_URL}/admin-sectorial/operadores/dashboard`, {
        headers: getHeaders()
      });
      setStats(response.data.data.stats);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  };

  const cargarFiltrosDisponibles = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin-sectorial/operadores/filtros-disponibles`, {
        headers: getHeaders()
      });
      setFiltrosDisponibles(response.data.data);
    } catch (error) {
      console.error('Error cargando filtros:', error);
    }
  };

  const cargarOperadores = async () => {
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
        `${API_URL}/admin-sectorial/operadores/lista?${params.toString()}`,
        { headers: getHeaders() }
      );
      setOperadores(response.data.data.operadores);
      setTotalPages(response.data.data.pagination.totalPages);
      setTotalItems(response.data.data.pagination.total || response.data.data.operadores.length);
    } catch (error) {
      console.error('Error cargando operadores:', error);
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

  const aprobarOperador = async (id: string) => {
    try {
      await axios.post(
        `${API_URL}/admin-sectorial/operadores/${id}/aprobar`,
        {},
        { headers: getHeaders() }
      );
      cargarOperadores();
      cargarDashboard();
    } catch (error) {
      console.error('Error aprobando operador:', error);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroActivo('todos');
    setFiltroTipoResiduo('');
    setPage(1);
  };

  const hayFiltrosActivos = busqueda || filtroActivo !== 'todos' || filtroTipoResiduo;

  const getCategoriaVariant = (categoria: string): BadgeVariant => {
    switch (categoria?.toUpperCase()) {
      case 'CATEGORIA_A':
      case 'CATEGORIA I': return 'danger';
      case 'CATEGORIA_B':
      case 'CATEGORIA II': return 'warning';
      case 'CATEGORIA_C':
      case 'CATEGORIA III': return 'info';
      default: return 'neutral';
    }
  };

  const formatKg = (value: number): string => {
    if (!value) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toLocaleString('es-AR');
  };

  useEffect(() => {
    cargarDashboard();
    cargarFiltrosDisponibles();
  }, []);

  useEffect(() => {
    cargarOperadores();
  }, [page, filtroActivo, filtroTipoResiduo, sortConfig, itemsPerPage]);

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    cargarOperadores();
  };

  const handleRefresh = () => {
    cargarDashboard();
    cargarOperadores();
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <AdminPageHeader
        icon={<Factory size={24} />}
        title="Admin Operadores"
        subtitle={`${totalItems.toLocaleString()} operadores registrados`}
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
            <Factory size={16} />
            <span className="admin-stat-mini__value">{stats.totalOperadores}</span>
            <span className="admin-stat-mini__label">Total</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--success">
            <CheckCircle size={16} />
            <span className="admin-stat-mini__value">{stats.operadoresActivos}</span>
            <span className="admin-stat-mini__label">Activos</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--info">
            <Recycle size={16} />
            <span className="admin-stat-mini__value">{stats.totalTratamientos}</span>
            <span className="admin-stat-mini__label">Tratamientos</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--warning">
            <Package size={16} />
            <span className="admin-stat-mini__value">{formatKg(stats.capacidadTotal)}</span>
            <span className="admin-stat-mini__label">Capacidad</span>
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
              <option value="">Tipo Residuo Autorizado (Y-code)</option>
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
          Listado de Operadores
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
            <span>Cargando operadores...</span>
          </div>
        ) : operadores.length === 0 ? (
          <div className="admin-empty-state">
            <Factory size={48} />
            <p>No se encontraron operadores</p>
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
              {operadores.map((o) => (
                <div
                  key={o.id}
                  className="admin-mobile-card"
                  onClick={() => handleVerDetalle(o.id)}
                >
                  <div className="admin-mobile-card__header">
                    <div className="admin-mobile-card__avatar" style={{ background: o.activo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
                      <Factory size={20} />
                    </div>
                    <div className="admin-mobile-card__info">
                      <h3 className="admin-mobile-card__title">{o.razonSocial}</h3>
                      <span className="admin-mobile-card__subtitle">CUIT: {o.cuit}</span>
                    </div>
                    <ChevronRight size={20} className="admin-mobile-card__chevron" />
                  </div>

                  <div className="admin-mobile-card__body">
                    <div className="admin-mobile-card__badges">
                      <AdminBadge variant={o.activo ? 'success' : 'danger'} size="sm">
                        {o.activo ? 'Activo' : 'Inactivo'}
                      </AdminBadge>
                      <AdminBadge variant={getCategoriaVariant(o.categoria)} size="sm">
                        {o.categoria || 'Sin cat.'}
                      </AdminBadge>
                      {!o.usuario.aprobado && (
                        <AdminBadge variant="warning" size="sm">Pendiente</AdminBadge>
                      )}
                    </div>

                    {o.tratamientos && o.tratamientos.length > 0 && (
                      <div className="admin-cell-tratamientos" style={{ marginTop: '8px' }}>
                        {o.tratamientos.slice(0, 3).map((t, i) => (
                          <span key={i} className="admin-ycode-badge">{t.tipoResiduo?.codigo}</span>
                        ))}
                        {o.tratamientos.length > 3 && (
                          <span className="admin-ycode-badge admin-ycode-badge--more">+{o.tratamientos.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="admin-mobile-card__meta">
                      <span><Recycle size={12} /> {o.tratamientos?.length || 0} tratamientos</span>
                      <span><FileText size={12} /> {o._count.manifiestos} manifiestos</span>
                    </div>
                  </div>

                  {!o.usuario.aprobado && (
                    <div className="admin-mobile-card__actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="admin-mobile-card__action admin-mobile-card__action--success"
                        onClick={() => aprobarOperador(o.id)}
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
                    Operador {renderSortIndicator('razonSocial')}
                  </th>
                  <th>Tratamientos</th>
                  <th className="admin-th-sortable" onClick={() => handleSort('categoria')}>
                    Categoría {renderSortIndicator('categoria')}
                  </th>
                  <th className="admin-th-sortable" onClick={() => handleSort('activo')}>
                    Estado {renderSortIndicator('activo')}
                  </th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {operadores.map((o) => (
                  <tr
                    key={o.id}
                    className="admin-table-row--clickable"
                    onClick={() => handleVerDetalle(o.id)}
                  >
                    <td>
                      <div className="admin-cell-primary">
                        <span className="admin-cell-title">{o.razonSocial}</span>
                        <span className="admin-cell-meta">
                          <code>{o.cuit}</code>
                          <span>{o.usuario.email}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="admin-cell-tratamientos">
                        {o.tratamientos?.slice(0, 3).map((t, i) => (
                          <span key={i} className="admin-ycode-badge">{t.tipoResiduo?.codigo}</span>
                        ))}
                        {(o.tratamientos?.length || 0) > 3 && (
                          <span className="admin-ycode-badge admin-ycode-badge--more">+{o.tratamientos.length - 3}</span>
                        )}
                        {(!o.tratamientos || o.tratamientos.length === 0) && (
                          <span className="admin-cell-empty">-</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <AdminBadge variant={getCategoriaVariant(o.categoria)} size="sm">
                        {o.categoria || 'Sin cat.'}
                      </AdminBadge>
                    </td>
                    <td>
                      <div className="admin-cell-status-inline">
                        <AdminBadge variant={o.activo ? 'success' : 'danger'} size="sm">
                          {o.activo ? 'Activo' : 'Inactivo'}
                        </AdminBadge>
                        {!o.usuario.aprobado && (
                          <AdminBadge variant="warning" size="xs">Pend.</AdminBadge>
                        )}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="admin-actions-cell">
                        <button
                          className="admin-action-btn"
                          onClick={() => handleVerDetalle(o.id)}
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                        {!o.usuario.aprobado && (
                          <button
                            className="admin-action-btn admin-action-btn--success"
                            onClick={() => aprobarOperador(o.id)}
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
                              setOpenActionMenu(openActionMenu === o.id ? null : o.id);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openActionMenu === o.id && (
                            <div className="admin-dropdown-menu admin-dropdown-menu--open">
                              <button onClick={() => handleVerDetalle(o.id)}>
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
      {operadores.length > 0 && (
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

export default AdminOperadoresPanel;
