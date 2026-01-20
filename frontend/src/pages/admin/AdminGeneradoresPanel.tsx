import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  Phone,
  Mail,
  User,
  Hash
} from 'lucide-react';
import axios from 'axios';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminBadge } from '../../components/admin/AdminBadge';
import type { BadgeVariant } from '../../components/admin/AdminBadge';
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
  usuario: {
    email: string;
    nombre: string;
    apellido: string;
    activo: boolean;
    aprobado: boolean;
  };
  _count: { manifiestos: number };
}

const AdminGeneradoresPanel: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [generadores, setGeneradores] = useState<Generador[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 10;

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

  const cargarGeneradores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', ITEMS_PER_PAGE.toString());
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroActivo !== 'todos') params.append('activo', filtroActivo);
      if (filtroCategoria !== 'todas') params.append('categoria', filtroCategoria);

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

  useEffect(() => {
    cargarDashboard();
    cargarGeneradores();
  }, [page, filtroActivo, filtroCategoria]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    cargarGeneradores();
  };

  const getCategoriaVariant = (categoria: string): BadgeVariant => {
    switch (categoria?.toUpperCase()) {
      case 'GRAN_GENERADOR': return 'danger';
      case 'MEDIANO_GENERADOR': return 'warning';
      case 'PEQUENO_GENERADOR': return 'info';
      default: return 'neutral';
    }
  };

  const getCategoriaLabel = (categoria: string) => {
    switch (categoria?.toUpperCase()) {
      case 'GRAN_GENERADOR': return 'Gran Generador';
      case 'MEDIANO_GENERADOR': return 'Mediano';
      case 'PEQUENO_GENERADOR': return 'Pequeño';
      default: return categoria || 'Sin categoría';
    }
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
        title="Panel Admin Generadores"
        subtitle="Gestión de generadores de residuos peligrosos"
        actions={
          <button className="admin-btn admin-btn--secondary" onClick={handleRefresh}>
            <RefreshCw size={18} />
            <span className="admin-hide-mobile">Actualizar</span>
          </button>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <AdminStatsGrid columns={3}>
          <AdminStatCard
            icon={<Building2 size={22} />}
            value={stats.totalGeneradores}
            label="Total Generadores"
            variant="primary"
          />
          <AdminStatCard
            icon={<CheckCircle size={22} />}
            value={stats.generadoresActivos}
            label="Activos"
            variant="success"
          />
          <AdminStatCard
            icon={<AlertTriangle size={22} />}
            value={stats.totalCategorias}
            label="Categorías"
            variant="info"
          />
          <AdminStatCard
            icon={<FileText size={22} />}
            value={stats.manifestosBorrador}
            label="Borradores"
            variant="warning"
          />
          <AdminStatCard
            icon={<Clock size={22} />}
            value={stats.manifestosAprobados}
            label="Aprobados"
            variant="success"
          />
          <AdminStatCard
            icon={<TrendingUp size={22} />}
            value={stats.manifestosEnTransito}
            label="En Tránsito"
            variant="primary"
          />
        </AdminStatsGrid>
      )}

      {/* Filtros y Búsqueda */}
      <div className="admin-filters">
        <form onSubmit={handleBuscar} className="admin-search-form">
          <div className="admin-search-input">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por razón social o CUIT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button type="submit" className="admin-btn admin-btn--primary admin-touch-target">
            Buscar
          </button>
        </form>

        <div className="admin-filter-group">
          <Filter size={18} className="admin-filter-icon" />
          <div className="admin-filter-buttons">
            <button
              className={`admin-filter-btn ${filtroActivo === 'todos' ? 'admin-filter-btn--active' : ''}`}
              onClick={() => { setFiltroActivo('todos'); setPage(1); }}
            >
              Todos
            </button>
            <button
              className={`admin-filter-btn ${filtroActivo === 'true' ? 'admin-filter-btn--active' : ''}`}
              onClick={() => { setFiltroActivo('true'); setPage(1); }}
            >
              Activos
            </button>
            <button
              className={`admin-filter-btn ${filtroActivo === 'false' ? 'admin-filter-btn--active' : ''}`}
              onClick={() => { setFiltroActivo('false'); setPage(1); }}
            >
              Inactivos
            </button>
          </div>
        </div>

        <div className="admin-filter-group admin-hide-mobile">
          <span className="admin-filter-label">Categoría:</span>
          <div className="admin-filter-buttons">
            <button
              className={`admin-filter-btn ${filtroCategoria === 'todas' ? 'admin-filter-btn--active' : ''}`}
              onClick={() => { setFiltroCategoria('todas'); setPage(1); }}
            >
              Todas
            </button>
            <button
              className={`admin-filter-btn ${filtroCategoria === 'GRAN_GENERADOR' ? 'admin-filter-btn--active' : ''}`}
              onClick={() => { setFiltroCategoria('GRAN_GENERADOR'); setPage(1); }}
            >
              Grandes
            </button>
            <button
              className={`admin-filter-btn ${filtroCategoria === 'MEDIANO_GENERADOR' ? 'admin-filter-btn--active' : ''}`}
              onClick={() => { setFiltroCategoria('MEDIANO_GENERADOR'); setPage(1); }}
            >
              Medianos
            </button>
            <button
              className={`admin-filter-btn ${filtroCategoria === 'PEQUENO_GENERADOR' ? 'admin-filter-btn--active' : ''}`}
              onClick={() => { setFiltroCategoria('PEQUENO_GENERADOR'); setPage(1); }}
            >
              Pequeños
            </button>
          </div>
        </div>

        {/* Mobile Category Filter (Select) */}
        <div className="admin-filter-group admin-show-mobile-flex">
          <span className="admin-filter-label">Categoría:</span>
          <select
            className="admin-select"
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value); setPage(1); }}
          >
            <option value="todas">Todas</option>
            <option value="GRAN_GENERADOR">Grandes</option>
            <option value="MEDIANO_GENERADOR">Medianos</option>
            <option value="PEQUENO_GENERADOR">Pequeños</option>
          </select>
        </div>
      </div>

      {/* Lista de Generadores */}
      <div className="admin-section">
        <h2 className="admin-section-title">
          <FileText size={20} />
          Listado de Generadores
        </h2>

        {loading ? (
          <div className="admin-loading">
            <RefreshCw className="admin-loading-spinner" size={24} />
            <span>Cargando...</span>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="admin-mobile-cards admin-show-mobile">
              {generadores.map((g) => (
                <div key={g.id} className="admin-mobile-card">
                  <div className="admin-mobile-card__header">
                    <div className="admin-mobile-card__avatar">
                      <Building2 size={20} />
                    </div>
                    <div className="admin-mobile-card__title">
                      <h3>{g.razonSocial}</h3>
                      <span className="admin-mobile-card__subtitle">CUIT: {g.cuit}</span>
                    </div>
                  </div>

                  <div className="admin-mobile-card__badges">
                    <AdminBadge variant={g.activo ? 'success' : 'danger'} size="sm">
                      {g.activo ? 'Activo' : 'Inactivo'}
                    </AdminBadge>
                    <AdminBadge variant={getCategoriaVariant(g.categoria)} size="sm">
                      {getCategoriaLabel(g.categoria)}
                    </AdminBadge>
                    {!g.usuario.aprobado && (
                      <AdminBadge variant="warning" size="sm">
                        Pendiente
                      </AdminBadge>
                    )}
                  </div>

                  <div className="admin-mobile-card__body">
                    <div className="admin-mobile-card__grid">
                      <div className="admin-mobile-card__detail">
                        <User size={14} />
                        <span>{g.usuario.nombre} {g.usuario.apellido}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <Mail size={14} />
                        <span>{g.usuario.email}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <Phone size={14} />
                        <span>{g.telefono}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <MapPin size={14} />
                        <span>{g.domicilio}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <Hash size={14} />
                        <span>{g.numeroInscripcion || 'Sin registro'}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <FileText size={14} />
                        <span>{g._count.manifiestos} manifiestos</span>
                      </div>
                    </div>
                  </div>

                  {!g.usuario.aprobado && (
                    <div className="admin-mobile-card__actions">
                      <button
                        className="admin-mobile-card__action admin-mobile-card__action--success"
                        onClick={() => aprobarGenerador(g.id)}
                      >
                        <CheckCircle size={16} />
                        Aprobar Generador
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="admin-table-container admin-hide-mobile">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Razón Social</th>
                    <th>CUIT</th>
                    <th>Contacto</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                    <th>Manifiestos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {generadores.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <div className="admin-table-cell-main">
                          <span className="admin-table-cell-title">{g.razonSocial}</span>
                          <span className="admin-table-cell-subtitle">{g.domicilio}</span>
                        </div>
                      </td>
                      <td>
                        <code className="admin-code">{g.cuit}</code>
                      </td>
                      <td>
                        <div className="admin-table-cell-main">
                          <span>{g.usuario.nombre} {g.usuario.apellido}</span>
                          <span className="admin-table-cell-subtitle">{g.usuario.email}</span>
                        </div>
                      </td>
                      <td>
                        <AdminBadge variant={getCategoriaVariant(g.categoria)} size="sm">
                          {getCategoriaLabel(g.categoria)}
                        </AdminBadge>
                      </td>
                      <td>
                        <div className="admin-badge-stack">
                          <AdminBadge variant={g.activo ? 'success' : 'danger'} size="sm">
                            {g.activo ? 'Activo' : 'Inactivo'}
                          </AdminBadge>
                          {!g.usuario.aprobado && (
                            <AdminBadge variant="warning" size="sm">
                              Pendiente
                            </AdminBadge>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="admin-table-count">
                          <FileText size={14} />
                          {g._count.manifiestos}
                        </span>
                      </td>
                      <td>
                        {!g.usuario.aprobado ? (
                          <button
                            className="admin-btn admin-btn--success admin-btn--sm"
                            onClick={() => aprobarGenerador(g.id)}
                          >
                            <CheckCircle size={14} />
                            Aprobar
                          </button>
                        ) : (
                          <span className="admin-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {generadores.length === 0 && (
              <div className="admin-empty-state">
                <Building2 size={48} />
                <p>No se encontraron generadores</p>
              </div>
            )}
          </>
        )}

        {/* Paginación */}
        <AdminPagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export default AdminGeneradoresPanel;
