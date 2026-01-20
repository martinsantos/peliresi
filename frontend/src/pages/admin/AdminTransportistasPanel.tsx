import React, { useState, useEffect } from 'react';
import {
  Truck,
  Users,
  Car,
  TrendingUp,
  CheckCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  FileText,
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
import { AdminPagination } from '../../components/admin/AdminPagination';
import '../../components/admin/admin.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface DashboardStats {
  totalTransportistas: number;
  transportistasActivos: number;
  totalVehiculos: number;
  totalChoferes: number;
  manifestosEnTransito: number;
  manifestosEntregados: number;
}

interface Transportista {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  activo: boolean;
  usuario: {
    email: string;
    nombre: string;
    apellido: string;
    activo: boolean;
    aprobado: boolean;
  };
  vehiculos: { id: string; patente: string; activo: boolean }[];
  choferes: { id: string; nombre: string; apellido: string; activo: boolean }[];
  _count: { manifiestos: number };
}

const AdminTransportistasPanel: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
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
      const response = await axios.get(`${API_URL}/admin-sectorial/transportistas/dashboard`, {
        headers: getHeaders()
      });
      setStats(response.data.data.stats);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  };

  const cargarTransportistas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', ITEMS_PER_PAGE.toString());
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroActivo !== 'todos') params.append('activo', filtroActivo);

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

  useEffect(() => {
    cargarDashboard();
    cargarTransportistas();
  }, [page, filtroActivo]);

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
        title="Panel Admin Transportistas"
        subtitle="Gestión de transportistas, vehículos y choferes"
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
            icon={<Truck size={22} />}
            value={stats.totalTransportistas}
            label="Total Transportistas"
            variant="primary"
          />
          <AdminStatCard
            icon={<CheckCircle size={22} />}
            value={stats.transportistasActivos}
            label="Activos"
            variant="success"
          />
          <AdminStatCard
            icon={<Car size={22} />}
            value={stats.totalVehiculos}
            label="Vehículos"
            variant="info"
          />
          <AdminStatCard
            icon={<Users size={22} />}
            value={stats.totalChoferes}
            label="Choferes"
            variant="warning"
          />
          <AdminStatCard
            icon={<Clock size={22} />}
            value={stats.manifestosEnTransito}
            label="En Tránsito"
            variant="primary"
          />
          <AdminStatCard
            icon={<TrendingUp size={22} />}
            value={stats.manifestosEntregados}
            label="Entregados"
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

      {/* Lista de Transportistas */}
      <div className="admin-section">
        <h2 className="admin-section-title">
          <FileText size={20} />
          Listado de Transportistas
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
              {transportistas.map((t) => (
                <div key={t.id} className="admin-mobile-card">
                  <div className="admin-mobile-card__header">
                    <div className="admin-mobile-card__avatar">
                      <Truck size={20} />
                    </div>
                    <div className="admin-mobile-card__title">
                      <h3>{t.razonSocial}</h3>
                      <span className="admin-mobile-card__subtitle">CUIT: {t.cuit}</span>
                    </div>
                  </div>

                  <div className="admin-mobile-card__badges">
                    <AdminBadge variant={t.activo ? 'success' : 'danger'} size="sm">
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </AdminBadge>
                    {!t.usuario.aprobado && (
                      <AdminBadge variant="warning" size="sm">
                        Pendiente
                      </AdminBadge>
                    )}
                  </div>

                  <div className="admin-mobile-card__body">
                    <div className="admin-mobile-card__grid">
                      <div className="admin-mobile-card__detail">
                        <User size={14} />
                        <span>{t.usuario.nombre} {t.usuario.apellido}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <Mail size={14} />
                        <span>{t.usuario.email}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <Phone size={14} />
                        <span>{t.telefono}</span>
                      </div>
                      <div className="admin-mobile-card__detail">
                        <MapPin size={14} />
                        <span>{t.domicilio}</span>
                      </div>
                    </div>

                    <div className="admin-mobile-card__stats">
                      <div className="admin-mobile-card__stat">
                        <Car size={14} />
                        <span>{t.vehiculos.length} vehículos</span>
                      </div>
                      <div className="admin-mobile-card__stat">
                        <Users size={14} />
                        <span>{t.choferes.length} choferes</span>
                      </div>
                      <div className="admin-mobile-card__stat">
                        <FileText size={14} />
                        <span>{t._count.manifiestos} manifiestos</span>
                      </div>
                    </div>
                  </div>

                  {!t.usuario.aprobado && (
                    <div className="admin-mobile-card__actions">
                      <button
                        className="admin-mobile-card__action admin-mobile-card__action--success"
                        onClick={() => aprobarTransportista(t.id)}
                      >
                        <CheckCircle size={16} />
                        Aprobar Transportista
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
                    <th>Flota</th>
                    <th>Estado</th>
                    <th>Manifiestos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {transportistas.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="admin-table-cell-main">
                          <span className="admin-table-cell-title">{t.razonSocial}</span>
                          <span className="admin-table-cell-subtitle">{t.domicilio}</span>
                        </div>
                      </td>
                      <td>
                        <code className="admin-code">{t.cuit}</code>
                      </td>
                      <td>
                        <div className="admin-table-cell-main">
                          <span>{t.usuario.nombre} {t.usuario.apellido}</span>
                          <span className="admin-table-cell-subtitle">{t.usuario.email}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-table-fleet">
                          <span className="admin-table-count">
                            <Car size={14} />
                            {t.vehiculos.length}
                          </span>
                          <span className="admin-table-count">
                            <Users size={14} />
                            {t.choferes.length}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-badge-stack">
                          <AdminBadge variant={t.activo ? 'success' : 'danger'} size="sm">
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </AdminBadge>
                          {!t.usuario.aprobado && (
                            <AdminBadge variant="warning" size="sm">
                              Pendiente
                            </AdminBadge>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="admin-table-count">
                          <FileText size={14} />
                          {t._count.manifiestos}
                        </span>
                      </td>
                      <td>
                        {!t.usuario.aprobado ? (
                          <button
                            className="admin-btn admin-btn--success admin-btn--sm"
                            onClick={() => aprobarTransportista(t.id)}
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

            {transportistas.length === 0 && (
              <div className="admin-empty-state">
                <Truck size={48} />
                <p>No se encontraron transportistas</p>
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

export default AdminTransportistasPanel;
