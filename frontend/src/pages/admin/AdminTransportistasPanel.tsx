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
  FileText
} from 'lucide-react';
import axios from 'axios';
import './AdminSectorialPanel.css';

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

  const getHeaders = () => {
    const token = localStorage.getItem('token');
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
      params.append('limit', '10');
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroActivo !== 'todos') params.append('activo', filtroActivo);

      const response = await axios.get(
        `${API_URL}/admin-sectorial/transportistas/lista?${params.toString()}`,
        { headers: getHeaders() }
      );
      setTransportistas(response.data.data.transportistas);
      setTotalPages(response.data.data.pagination.totalPages);
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

  return (
    <div className="admin-sectorial-panel">
      <div className="panel-header">
        <div className="header-title">
          <Truck className="header-icon" />
          <div>
            <h1>Panel Admin Transportistas</h1>
            <p>Gestion de transportistas, vehiculos y choferes</p>
          </div>
        </div>
        <button className="btn-refresh" onClick={() => { cargarDashboard(); cargarTransportistas(); }}>
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <Truck size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalTransportistas}</span>
              <span className="stat-label">Total Transportistas</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.transportistasActivos}</span>
              <span className="stat-label">Activos</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <Car size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalVehiculos}</span>
              <span className="stat-label">Vehiculos</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalChoferes}</span>
              <span className="stat-label">Choferes</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon yellow">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.manifestosEnTransito}</span>
              <span className="stat-label">En Transito</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon teal">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.manifestosEntregados}</span>
              <span className="stat-label">Entregados</span>
            </div>
          </div>
        </div>
      )}

      {/* Filtros y Busqueda */}
      <div className="filters-section">
        <form onSubmit={handleBuscar} className="search-form">
          <div className="search-input-wrapper">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por razon social o CUIT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-search">Buscar</button>
        </form>

        <div className="filter-buttons">
          <Filter size={18} />
          <button
            className={`filter-btn ${filtroActivo === 'todos' ? 'active' : ''}`}
            onClick={() => { setFiltroActivo('todos'); setPage(1); }}
          >
            Todos
          </button>
          <button
            className={`filter-btn ${filtroActivo === 'true' ? 'active' : ''}`}
            onClick={() => { setFiltroActivo('true'); setPage(1); }}
          >
            Activos
          </button>
          <button
            className={`filter-btn ${filtroActivo === 'false' ? 'active' : ''}`}
            onClick={() => { setFiltroActivo('false'); setPage(1); }}
          >
            Inactivos
          </button>
        </div>
      </div>

      {/* Lista de Transportistas */}
      <div className="list-section">
        <h2>
          <FileText size={20} />
          Listado de Transportistas
        </h2>

        {loading ? (
          <div className="loading">Cargando...</div>
        ) : (
          <div className="transportistas-list">
            {transportistas.map((t) => (
              <div key={t.id} className="transportista-card">
                <div className="card-header">
                  <div className="card-title">
                    <h3>{t.razonSocial}</h3>
                    <span className="cuit">CUIT: {t.cuit}</span>
                  </div>
                  <div className="card-badges">
                    <span className={`badge ${t.activo ? 'badge-active' : 'badge-inactive'}`}>
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {!t.usuario.aprobado && (
                      <span className="badge badge-pending">Pendiente Aprobacion</span>
                    )}
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-info">
                    <div className="info-item">
                      <span className="label">Contacto:</span>
                      <span>{t.usuario.nombre} {t.usuario.apellido}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Email:</span>
                      <span>{t.usuario.email}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Telefono:</span>
                      <span>{t.telefono}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Domicilio:</span>
                      <span>{t.domicilio}</span>
                    </div>
                  </div>

                  <div className="card-stats">
                    <div className="mini-stat">
                      <Car size={16} />
                      <span>{t.vehiculos.length} vehiculos</span>
                    </div>
                    <div className="mini-stat">
                      <Users size={16} />
                      <span>{t.choferes.length} choferes</span>
                    </div>
                    <div className="mini-stat">
                      <FileText size={16} />
                      <span>{t._count.manifiestos} manifiestos</span>
                    </div>
                  </div>
                </div>

                {!t.usuario.aprobado && (
                  <div className="card-actions">
                    <button
                      className="btn-aprobar"
                      onClick={() => aprobarTransportista(t.id)}
                    >
                      <CheckCircle size={16} />
                      Aprobar Transportista
                    </button>
                  </div>
                )}
              </div>
            ))}

            {transportistas.length === 0 && (
              <div className="empty-state">
                <Truck size={48} />
                <p>No se encontraron transportistas</p>
              </div>
            )}
          </div>
        )}

        {/* Paginacion */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>Pagina {page} de {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTransportistasPanel;
