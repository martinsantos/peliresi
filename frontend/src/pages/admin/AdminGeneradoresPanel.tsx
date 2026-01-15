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
  AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import './AdminSectorialPanel.css';

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
      params.append('limit', '10');
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroActivo !== 'todos') params.append('activo', filtroActivo);
      if (filtroCategoria !== 'todas') params.append('categoria', filtroCategoria);

      const response = await axios.get(
        `${API_URL}/admin-sectorial/generadores/lista?${params.toString()}`,
        { headers: getHeaders() }
      );
      setGeneradores(response.data.data.generadores);
      setTotalPages(response.data.data.pagination.totalPages);
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

  const getCategoriaColor = (categoria: string) => {
    switch (categoria?.toUpperCase()) {
      case 'GRAN_GENERADOR': return 'badge-danger';
      case 'MEDIANO_GENERADOR': return 'badge-warning';
      case 'PEQUENO_GENERADOR': return 'badge-info';
      default: return 'badge-category';
    }
  };

  const getCategoriaLabel = (categoria: string) => {
    switch (categoria?.toUpperCase()) {
      case 'GRAN_GENERADOR': return 'Gran Generador';
      case 'MEDIANO_GENERADOR': return 'Mediano';
      case 'PEQUENO_GENERADOR': return 'Pequeno';
      default: return categoria || 'Sin categoria';
    }
  };

  return (
    <div className="admin-sectorial-panel">
      <div className="panel-header">
        <div className="header-title">
          <Building2 className="header-icon" />
          <div>
            <h1>Panel Admin Generadores</h1>
            <p>Gestion de generadores de residuos peligrosos</p>
          </div>
        </div>
        <button className="btn-refresh" onClick={() => { cargarDashboard(); cargarGeneradores(); }}>
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <Building2 size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalGeneradores}</span>
              <span className="stat-label">Total Generadores</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.generadoresActivos}</span>
              <span className="stat-label">Activos</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <AlertTriangle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalCategorias}</span>
              <span className="stat-label">Categorias</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.manifestosBorrador}</span>
              <span className="stat-label">Borradores</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon yellow">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.manifestosAprobados}</span>
              <span className="stat-label">Aprobados</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon teal">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.manifestosEnTransito}</span>
              <span className="stat-label">En Transito</span>
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

        <div className="filter-buttons">
          <span className="filter-label">Categoria:</span>
          <button
            className={`filter-btn ${filtroCategoria === 'todas' ? 'active' : ''}`}
            onClick={() => { setFiltroCategoria('todas'); setPage(1); }}
          >
            Todas
          </button>
          <button
            className={`filter-btn ${filtroCategoria === 'GRAN_GENERADOR' ? 'active' : ''}`}
            onClick={() => { setFiltroCategoria('GRAN_GENERADOR'); setPage(1); }}
          >
            Grandes
          </button>
          <button
            className={`filter-btn ${filtroCategoria === 'MEDIANO_GENERADOR' ? 'active' : ''}`}
            onClick={() => { setFiltroCategoria('MEDIANO_GENERADOR'); setPage(1); }}
          >
            Medianos
          </button>
          <button
            className={`filter-btn ${filtroCategoria === 'PEQUENO_GENERADOR' ? 'active' : ''}`}
            onClick={() => { setFiltroCategoria('PEQUENO_GENERADOR'); setPage(1); }}
          >
            Pequenos
          </button>
        </div>
      </div>

      {/* Lista de Generadores */}
      <div className="list-section">
        <h2>
          <FileText size={20} />
          Listado de Generadores
        </h2>

        {loading ? (
          <div className="loading">Cargando...</div>
        ) : (
          <div className="transportistas-list">
            {generadores.map((g) => (
              <div key={g.id} className="transportista-card">
                <div className="card-header">
                  <div className="card-title">
                    <h3>{g.razonSocial}</h3>
                    <span className="cuit">CUIT: {g.cuit}</span>
                  </div>
                  <div className="card-badges">
                    <span className={`badge ${g.activo ? 'badge-active' : 'badge-inactive'}`}>
                      {g.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className={`badge ${getCategoriaColor(g.categoria)}`}>
                      {getCategoriaLabel(g.categoria)}
                    </span>
                    {!g.usuario.aprobado && (
                      <span className="badge badge-pending">Pendiente Aprobacion</span>
                    )}
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-info">
                    <div className="info-item">
                      <span className="label">Contacto:</span>
                      <span>{g.usuario.nombre} {g.usuario.apellido}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Email:</span>
                      <span>{g.usuario.email}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Telefono:</span>
                      <span>{g.telefono}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Domicilio:</span>
                      <span>{g.domicilio}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">N° Inscripcion:</span>
                      <span>{g.numeroInscripcion || 'Sin registro'}</span>
                    </div>
                  </div>

                  <div className="card-stats">
                    <div className="mini-stat">
                      <FileText size={16} />
                      <span>{g._count.manifiestos} manifiestos</span>
                    </div>
                    {g.latitud && g.longitud && (
                      <div className="mini-stat">
                        <MapPin size={16} />
                        <span>Georeferenciado</span>
                      </div>
                    )}
                  </div>
                </div>

                {!g.usuario.aprobado && (
                  <div className="card-actions">
                    <button
                      className="btn-aprobar"
                      onClick={() => aprobarGenerador(g.id)}
                    >
                      <CheckCircle size={16} />
                      Aprobar Generador
                    </button>
                  </div>
                )}
              </div>
            ))}

            {generadores.length === 0 && (
              <div className="empty-state">
                <Building2 size={48} />
                <p>No se encontraron generadores</p>
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

export default AdminGeneradoresPanel;
