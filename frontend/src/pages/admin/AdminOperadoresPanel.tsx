import React, { useState, useEffect } from 'react';
import {
  Factory,
  Leaf,
  TrendingUp,
  CheckCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Recycle,
  Phone,
  Mail,
  User,
  MapPin
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
  totalOperadores: number;
  operadoresActivos: number;
  totalTratamientos: number;
  capacidadTotal: number;
  manifestosRecibidos: number;
  manifestosTratados: number;
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

const AdminOperadoresPanel: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<string>('todos');
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
      const response = await axios.get(`${API_URL}/admin-sectorial/operadores/dashboard`, {
        headers: getHeaders()
      });
      setStats(response.data.data.stats);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  };

  const cargarOperadores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', ITEMS_PER_PAGE.toString());
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroActivo !== 'todos') params.append('activo', filtroActivo);

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

  useEffect(() => {
    cargarDashboard();
    cargarOperadores();
  }, [page, filtroActivo]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    cargarOperadores();
  };

  const handleRefresh = () => {
    cargarDashboard();
    cargarOperadores();
  };

  const getCategoriaVariant = (categoria: string): BadgeVariant => {
    switch (categoria?.toUpperCase()) {
      case 'CATEGORIA_A': return 'danger';
      case 'CATEGORIA_B': return 'warning';
      case 'CATEGORIA_C': return 'info';
      default: return 'neutral';
    }
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <AdminPageHeader
        icon={<Factory size={24} />}
        title="Panel Admin Operadores"
        subtitle="Gestión de operadores y tratamientos autorizados"
        actions={
          <button className="admin-btn admin-btn--secondary" onClick={handleRefresh}>
            <RefreshCw size={18} className={loading ? 'admin-loading-spinner' : ''} />
            <span className="admin-hide-mobile">Actualizar</span>
          </button>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <AdminStatsGrid columns={3}>
          <AdminStatCard
            icon={<Factory size={22} />}
            value={stats.totalOperadores}
            label="Total Operadores"
            variant="primary"
          />
          <AdminStatCard
            icon={<CheckCircle size={22} />}
            value={stats.operadoresActivos}
            label="Activos"
            variant="success"
          />
          <AdminStatCard
            icon={<Recycle size={22} />}
            value={stats.totalTratamientos}
            label="Tratamientos"
            variant="info"
          />
          <AdminStatCard
            icon={<Leaf size={22} />}
            value={`${stats.capacidadTotal?.toLocaleString('es-AR') || 0} kg`}
            label="Capacidad Total"
            variant="warning"
          />
          <AdminStatCard
            icon={<Clock size={22} />}
            value={stats.manifestosRecibidos}
            label="Recibidos"
            variant="neutral"
          />
          <AdminStatCard
            icon={<TrendingUp size={22} />}
            value={stats.manifestosTratados}
            label="Tratados"
            variant="success"
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
      </div>

      {/* Lista de Operadores */}
      <div className="admin-section">
        <h2 className="admin-section-title">
          <FileText size={20} />
          Listado de Operadores
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
              {operadores.map((o) => (
                <div key={o.id} className="admin-mobile-card">
                  <div className="admin-mobile-card__header">
                    <div className="admin-mobile-card__avatar">
                      <Factory size={20} />
                    </div>
                    <div className="admin-mobile-card__title">
                      <h3>{o.razonSocial}</h3>
                      <span className="admin-mobile-card__subtitle">CUIT: {o.cuit}</span>
                    </div>
                  </div>

                  <div className="admin-mobile-card__badges">
                    <AdminBadge variant={o.activo ? 'success' : 'danger'} size="sm">
                      {o.activo ? 'Activo' : 'Inactivo'}
                    </AdminBadge>
                    <AdminBadge variant={getCategoriaVariant(o.categoria)} size="sm">
                      {o.categoria || 'Sin categoría'}
                    </AdminBadge>
                    {!o.usuario.aprobado && (
                      <AdminBadge variant="warning" size="sm">
                        Pendiente
                      </AdminBadge>
                    )}
                  </div>

                  <div className="admin-mobile-card__body">
                    <div className="admin-mobile-card__grid">
                      <div className="admin-mobile-card__detail">
                        <User size={14} />
                        <span>{o.usuario.nombre} {o.usuario.apellido}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <Mail size={14} />
                        <span>{o.usuario.email}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <Phone size={14} />
                        <span>{o.telefono}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <MapPin size={14} />
                        <span>{o.domicilio}</span>
                      </div>
                    </div>

                    <div className="admin-mobile-card__stats">
                      <div className="admin-mobile-card__stat">
                        <Recycle size={14} />
                        <span>{o.tratamientos?.length || 0} tratamientos</span>
                      </div>
                      <div className="admin-mobile-card__stat">
                        <FileText size={14} />
                        <span>{o._count.manifiestos} manifiestos</span>
                      </div>
                    </div>

                    {/* Tratamientos (mobile simplified) */}
                    {o.tratamientos && o.tratamientos.length > 0 && (
                      <div className="admin-mobile-card__extra">
                        <span className="admin-mobile-card__extra-label">Tratamientos:</span>
                        <div className="admin-mobile-card__tags">
                          {o.tratamientos.slice(0, 3).map((t) => (
                            <span key={t.id} className="admin-mobile-card__tag">
                              {t.tipoResiduo?.codigo || 'N/A'}
                            </span>
                          ))}
                          {o.tratamientos.length > 3 && (
                            <span className="admin-mobile-card__tag admin-mobile-card__tag--more">
                              +{o.tratamientos.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {!o.usuario.aprobado && (
                    <div className="admin-mobile-card__actions">
                      <button
                        className="admin-mobile-card__action admin-mobile-card__action--success"
                        onClick={() => aprobarOperador(o.id)}
                      >
                        <CheckCircle size={16} />
                        Aprobar Operador
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
                    <th>Tratamientos</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {operadores.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div className="admin-table-cell-main">
                          <span className="admin-table-cell-title">{o.razonSocial}</span>
                          <span className="admin-table-cell-subtitle">{o.domicilio}</span>
                        </div>
                      </td>
                      <td>
                        <code className="admin-code">{o.cuit}</code>
                      </td>
                      <td>
                        <div className="admin-table-cell-main">
                          <span>{o.usuario.nombre} {o.usuario.apellido}</span>
                          <span className="admin-table-cell-subtitle">{o.usuario.email}</span>
                        </div>
                      </td>
                      <td>
                        <AdminBadge variant={getCategoriaVariant(o.categoria)} size="sm">
                          {o.categoria || 'Sin categoría'}
                        </AdminBadge>
                      </td>
                      <td>
                        <div className="admin-table-treatments">
                          <span className="admin-table-count">
                            <Recycle size={14} />
                            {o.tratamientos?.length || 0}
                          </span>
                          {o.tratamientos && o.tratamientos.length > 0 && (
                            <div className="admin-table-treatment-codes">
                              {o.tratamientos.slice(0, 2).map((t) => (
                                <span key={t.id} className="admin-code admin-code--sm">
                                  {t.tipoResiduo?.codigo || 'N/A'}
                                </span>
                              ))}
                              {o.tratamientos.length > 2 && (
                                <span className="admin-text-muted">+{o.tratamientos.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-badge-stack">
                          <AdminBadge variant={o.activo ? 'success' : 'danger'} size="sm">
                            {o.activo ? 'Activo' : 'Inactivo'}
                          </AdminBadge>
                          {!o.usuario.aprobado && (
                            <AdminBadge variant="warning" size="sm">
                              Pendiente
                            </AdminBadge>
                          )}
                        </div>
                      </td>
                      <td>
                        {!o.usuario.aprobado ? (
                          <button
                            className="admin-btn admin-btn--success admin-btn--sm"
                            onClick={() => aprobarOperador(o.id)}
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

            {operadores.length === 0 && (
              <div className="admin-empty-state">
                <Factory size={48} />
                <p>No se encontraron operadores</p>
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

export default AdminOperadoresPanel;
