import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  TrendingUp,
  CheckCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Mail,
  Eye,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Edit,
  XCircle,
  ChevronRight
} from 'lucide-react';
import axios from 'axios';
import { CategoriaBadgesCompact } from '../../components/CategoriaBadges';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminBadge } from '../../components/admin/AdminBadge';
import { AdminPagination } from '../../components/admin/AdminPagination';
import '../../components/admin/admin.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface DashboardStats {
  totalGeneradores: number;
  generadoresActivos: number;
  totalCategorias: number;
  manifestosBorrador: number;
  manifestosAprobados: number;
  manifestosEnTransito: number;
}

interface Generador {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  numeroInscripcion: string;
  categoria: string;
  activo: boolean;
  latitud?: number;
  longitud?: number;
  domicilioLegalDepartamento?: string;
  domicilioRealDepartamento?: string;
  rubro?: string;
  actividad?: string;
  clasificacion?: string;
  certificado?: string;
  usuario: {
    email: string;
    nombre: string;
    apellido: string;
    activo: boolean;
    aprobado: boolean;
  };
  _count: { manifiestos: number };
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface FiltrosDisponibles {
  departamentos: string[];
  rubros: string[];
  clasificaciones: string[];
  actividades: string[];
}

const ITEMS_OPTIONS = [10, 15, 25, 50];

const AdminGeneradoresPanel: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [generadores, setGeneradores] = useState<Generador[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroDepartamento, setFiltroDepartamento] = useState<string>('');
  const [filtroRubro, setFiltroRubro] = useState<string>('');
  const [filtroClasificacion, setFiltroClasificacion] = useState<string>('');
  const [filtrosDisponibles, setFiltrosDisponibles] = useState<FiltrosDisponibles>({
    departamentos: [],
    rubros: [],
    clasificaciones: [],
    actividades: []
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
    navigate(`/admin/generadores/${id}`);
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
      const response = await axios.get(`${API_URL}/admin-sectorial/generadores/dashboard`, {
        headers: getHeaders()
      });
      setStats(response.data.data.stats);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  };

  const cargarFiltrosDisponibles = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin-sectorial/generadores/filtros-disponibles`, {
        headers: getHeaders()
      });
      setFiltrosDisponibles(response.data.data);
    } catch (error) {
      console.error('Error cargando filtros:', error);
    }
  };

  const cargarGeneradores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', itemsPerPage.toString());
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroActivo !== 'todos') params.append('activo', filtroActivo);
      if (filtroCategoria !== 'todas') params.append('categoria', filtroCategoria);
      if (filtroDepartamento) params.append('departamento', filtroDepartamento);
      if (filtroRubro) params.append('rubro', filtroRubro);
      if (filtroClasificacion) params.append('clasificacion', filtroClasificacion);
      params.append('sortBy', sortConfig.key);
      params.append('sortOrder', sortConfig.direction);

      const response = await axios.get(
        `${API_URL}/admin-sectorial/generadores/lista?${params.toString()}`,
        { headers: getHeaders() }
      );
      setGeneradores(response.data.data.generadores);
      setTotalPages(response.data.data.pagination.totalPages);
      setTotalItems(response.data.data.pagination.total || response.data.data.generadores.length);
    } catch (error) {
      console.error('Error cargando generadores:', error);
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

  const aprobarGenerador = async (id: string) => {
    try {
      await axios.post(
        `${API_URL}/admin-sectorial/generadores/${id}/aprobar`,
        {},
        { headers: getHeaders() }
      );
      cargarGeneradores();
      cargarDashboard();
    } catch (error) {
      console.error('Error aprobando generador:', error);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroActivo('todos');
    setFiltroCategoria('todas');
    setFiltroDepartamento('');
    setFiltroRubro('');
    setFiltroClasificacion('');
    setPage(1);
  };

  const hayFiltrosActivos = busqueda || filtroActivo !== 'todos' || filtroCategoria !== 'todas' ||
    filtroDepartamento || filtroRubro || filtroClasificacion;

  useEffect(() => {
    cargarDashboard();
    cargarFiltrosDisponibles();
  }, []);

  useEffect(() => {
    cargarGeneradores();
  }, [page, filtroActivo, filtroCategoria, filtroDepartamento, filtroRubro, filtroClasificacion, sortConfig, itemsPerPage]);

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    cargarGeneradores();
  };

  const handleRefresh = () => {
    cargarDashboard();
    cargarGeneradores();
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <AdminPageHeader
        icon={<Building2 size={24} />}
        title="Admin Generadores"
        subtitle={`${totalItems.toLocaleString()} generadores registrados`}
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
            <Building2 size={16} />
            <span className="admin-stat-mini__value">{stats.totalGeneradores}</span>
            <span className="admin-stat-mini__label">Total</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--success">
            <CheckCircle size={16} />
            <span className="admin-stat-mini__value">{stats.generadoresActivos}</span>
            <span className="admin-stat-mini__label">Activos</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--warning">
            <Clock size={16} />
            <span className="admin-stat-mini__value">{stats.manifestosBorrador}</span>
            <span className="admin-stat-mini__label">Borradores</span>
          </div>
          <div className="admin-stat-mini admin-stat-mini--info">
            <TrendingUp size={16} />
            <span className="admin-stat-mini__value">{stats.manifestosEnTransito}</span>
            <span className="admin-stat-mini__label">En Tránsito</span>
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
              value={filtroDepartamento}
              onChange={(e) => { setFiltroDepartamento(e.target.value); setPage(1); }}
            >
              <option value="">Departamento</option>
              {filtrosDisponibles.departamentos.map(depto => (
                <option key={depto} value={depto}>{depto}</option>
              ))}
            </select>

            <select
              className="admin-select-compact"
              value={filtroRubro}
              onChange={(e) => { setFiltroRubro(e.target.value); setPage(1); }}
            >
              <option value="">Rubro</option>
              {filtrosDisponibles.rubros.map(rubro => (
                <option key={rubro} value={rubro}>{rubro.length > 30 ? rubro.substring(0, 30) + '...' : rubro}</option>
              ))}
            </select>

            <select
              className="admin-select-compact"
              value={filtroCategoria}
              onChange={(e) => { setFiltroCategoria(e.target.value); setPage(1); }}
            >
              <option value="todas">Categoría Gen.</option>
              <option value="GRAN_GENERADOR">Gran Generador</option>
              <option value="MEDIANO_GENERADOR">Mediano</option>
              <option value="PEQUENO_GENERADOR">Pequeño</option>
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
          Listado de Generadores
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
            <span>Cargando generadores...</span>
          </div>
        ) : generadores.length === 0 ? (
          <div className="admin-empty-state">
            <Building2 size={48} />
            <p>No se encontraron generadores</p>
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
              {generadores.map((g) => (
                <div
                  key={g.id}
                  className="admin-mobile-card"
                  onClick={() => handleVerDetalle(g.id)}
                >
                  <div className="admin-mobile-card__header">
                    <div className="admin-mobile-card__avatar" style={{ background: g.activo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
                      <Building2 size={20} />
                    </div>
                    <div className="admin-mobile-card__info">
                      <h3 className="admin-mobile-card__title">{g.razonSocial}</h3>
                      <span className="admin-mobile-card__subtitle">CUIT: {g.cuit}</span>
                    </div>
                    <ChevronRight size={20} className="admin-mobile-card__chevron" />
                  </div>

                  <div className="admin-mobile-card__body">
                    <div className="admin-mobile-card__badges">
                      <AdminBadge variant={g.activo ? 'success' : 'danger'} size="sm">
                        {g.activo ? 'Activo' : 'Inactivo'}
                      </AdminBadge>
                      {!g.usuario.aprobado && (
                        <AdminBadge variant="warning" size="sm">Pendiente</AdminBadge>
                      )}
                      <span className="admin-mobile-card__manifiestos">
                        <FileText size={12} /> {g._count.manifiestos}
                      </span>
                    </div>

                    {g.categoria && (
                      <div style={{ marginTop: '8px' }}>
                        <CategoriaBadgesCompact categorias={g.categoria} maxVisible={4} />
                      </div>
                    )}

                    <div className="admin-mobile-card__meta">
                      <span><MapPin size={12} /> {g.domicilioLegalDepartamento || '-'}</span>
                      <span><Mail size={12} /> {g.usuario.email}</span>
                    </div>
                  </div>

                  {!g.usuario.aprobado && (
                    <div className="admin-mobile-card__actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="admin-mobile-card__action admin-mobile-card__action--success"
                        onClick={() => aprobarGenerador(g.id)}
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
                    Generador {renderSortIndicator('razonSocial')}
                  </th>
                  <th>Categorías</th>
                  <th className="admin-th-sortable" onClick={() => handleSort('domicilioLegalDepartamento')}>
                    Depto {renderSortIndicator('domicilioLegalDepartamento')}
                  </th>
                  <th className="admin-th-sortable" onClick={() => handleSort('activo')}>
                    Estado {renderSortIndicator('activo')}
                  </th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {generadores.map((g) => (
                  <tr
                    key={g.id}
                    className="admin-table-row--clickable"
                    onClick={() => handleVerDetalle(g.id)}
                  >
                    <td>
                      <div className="admin-cell-primary">
                        <span className="admin-cell-title">{g.razonSocial}</span>
                        <span className="admin-cell-meta">
                          <code>{g.cuit}</code>
                          {g.rubro && <span className="admin-cell-tag">{g.rubro.length > 25 ? g.rubro.substring(0, 25) + '...' : g.rubro}</span>}
                        </span>
                      </div>
                    </td>
                    <td>
                      {g.categoria ? (
                        <CategoriaBadgesCompact categorias={g.categoria} maxVisible={3} />
                      ) : (
                        <span className="admin-cell-empty">-</span>
                      )}
                    </td>
                    <td>
                      <span className="admin-cell-depto">{g.domicilioLegalDepartamento || g.domicilioRealDepartamento || '-'}</span>
                    </td>
                    <td>
                      <div className="admin-cell-status-inline">
                        <AdminBadge variant={g.activo ? 'success' : 'danger'} size="sm">
                          {g.activo ? 'Activo' : 'Inactivo'}
                        </AdminBadge>
                        {!g.usuario.aprobado && (
                          <AdminBadge variant="warning" size="xs">Pend.</AdminBadge>
                        )}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="admin-actions-cell">
                        <button
                          className="admin-action-btn"
                          onClick={() => handleVerDetalle(g.id)}
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                        {!g.usuario.aprobado && (
                          <button
                            className="admin-action-btn admin-action-btn--success"
                            onClick={() => aprobarGenerador(g.id)}
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
                              setOpenActionMenu(openActionMenu === g.id ? null : g.id);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openActionMenu === g.id && (
                            <div className="admin-dropdown-menu admin-dropdown-menu--open">
                              <button onClick={() => handleVerDetalle(g.id)}>
                                <Eye size={14} /> Ver detalle
                              </button>
                              <button onClick={() => navigate(`/admin/generadores/${g.id}/editar`)}>
                                <Edit size={14} /> Editar
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
      {generadores.length > 0 && (
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

export default AdminGeneradoresPanel;
