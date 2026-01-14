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
  Recycle
} from 'lucide-react';
import axios from 'axios';
import './AdminSectorialPanel.css';

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

  const getHeaders = () => {
    const token = localStorage.getItem('token');
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
      params.append('limit', '10');
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroActivo !== 'todos') params.append('activo', filtroActivo);

      const response = await axios.get(
        `${API_URL}/admin-sectorial/operadores/lista?${params.toString()}`,
        { headers: getHeaders() }
      );
      setOperadores(response.data.data.operadores);
      setTotalPages(response.data.data.pagination.totalPages);
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

  return (
    <div className="admin-sectorial-panel">
      <div className="panel-header">
        <div className="header-title">
          <Factory className="header-icon" />
          <div>
            <h1>Panel Admin Operadores</h1>
            <p>Gestion de operadores y tratamientos autorizados</p>
          </div>
        </div>
        <button className="btn-refresh" onClick={() => { cargarDashboard(); cargarOperadores(); }}>
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <Factory size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalOperadores}</span>
              <span className="stat-label">Total Operadores</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.operadoresActivos}</span>
              <span className="stat-label">Activos</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <Recycle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalTratamientos}</span>
              <span className="stat-label">Tratamientos</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <Leaf size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.capacidadTotal?.toLocaleString() || 0} kg</span>
              <span className="stat-label">Capacidad Total</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon yellow">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.manifestosRecibidos}</span>
              <span className="stat-label">Recibidos</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon teal">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.manifestosTratados}</span>
              <span className="stat-label">Tratados</span>
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

      {/* Lista de Operadores */}
      <div className="list-section">
        <h2>
          <FileText size={20} />
          Listado de Operadores
        </h2>

        {loading ? (
          <div className="loading">Cargando...</div>
        ) : (
          <div className="transportistas-list">
            {operadores.map((o) => (
              <div key={o.id} className="transportista-card">
                <div className="card-header">
                  <div className="card-title">
                    <h3>{o.razonSocial}</h3>
                    <span className="cuit">CUIT: {o.cuit}</span>
                  </div>
                  <div className="card-badges">
                    <span className={`badge ${o.activo ? 'badge-active' : 'badge-inactive'}`}>
                      {o.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="badge badge-category">{o.categoria}</span>
                    {!o.usuario.aprobado && (
                      <span className="badge badge-pending">Pendiente Aprobacion</span>
                    )}
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-info">
                    <div className="info-item">
                      <span className="label">Contacto:</span>
                      <span>{o.usuario.nombre} {o.usuario.apellido}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Email:</span>
                      <span>{o.usuario.email}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Telefono:</span>
                      <span>{o.telefono}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Domicilio:</span>
                      <span>{o.domicilio}</span>
                    </div>
                  </div>

                  <div className="card-stats">
                    <div className="mini-stat">
                      <Recycle size={16} />
                      <span>{o.tratamientos?.length || 0} tratamientos</span>
                    </div>
                    <div className="mini-stat">
                      <FileText size={16} />
                      <span>{o._count.manifiestos} manifiestos</span>
                    </div>
                  </div>

                  {/* Tratamientos autorizados */}
                  {o.tratamientos && o.tratamientos.length > 0 && (
                    <div className="tratamientos-list">
                      <h4>Tratamientos Autorizados:</h4>
                      <div className="tratamientos-grid">
                        {o.tratamientos.slice(0, 4).map((t) => (
                          <div key={t.id} className="tratamiento-item">
                            <span className="tratamiento-codigo">{t.tipoResiduo?.codigo || 'N/A'}</span>
                            <span className="tratamiento-metodo">{t.metodo}</span>
                            <span className="tratamiento-capacidad">{t.capacidad} kg/mes</span>
                          </div>
                        ))}
                        {o.tratamientos.length > 4 && (
                          <div className="tratamiento-item more">
                            +{o.tratamientos.length - 4} mas
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!o.usuario.aprobado && (
                  <div className="card-actions">
                    <button
                      className="btn-aprobar"
                      onClick={() => aprobarOperador(o.id)}
                    >
                      <CheckCircle size={16} />
                      Aprobar Operador
                    </button>
                  </div>
                )}
              </div>
            ))}

            {operadores.length === 0 && (
              <div className="empty-state">
                <Factory size={48} />
                <p>No se encontraron operadores</p>
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

export default AdminOperadoresPanel;
