import React, { useState, useEffect } from 'react';
import { 
  FileText, Filter, Download, RefreshCw, Search, 
  ChevronLeft, ChevronRight, User, Clock, Activity
} from 'lucide-react';
import './LogAuditoria.css';

const API_URL = import.meta.env.VITE_API_URL || '';

interface LogEntry {
  id: string;
  usuarioId: string;
  accion: string;
  modulo: string;
  entidadId?: string;
  detalles?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
  usuario: {
    id: string;
    email: string;
    nombre: string;
    apellido?: string;
    rol: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Estadisticas {
  total: number;
  porAccion: { accion: string; count: number }[];
  porModulo: { modulo: string; count: number }[];
}

const LogAuditoria: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 50, total: 0, pages: 0
  });
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filtros
  const [filtros, setFiltros] = useState({
    accion: '',
    modulo: '',
    desde: '',
    hasta: '',
  });

  const token = localStorage.getItem('accessToken');

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (filtros.accion) params.append('accion', filtros.accion);
      if (filtros.modulo) params.append('modulo', filtros.modulo);
      if (filtros.desde) params.append('desde', new Date(filtros.desde).toISOString());
      if (filtros.hasta) params.append('hasta', new Date(filtros.hasta).toISOString());

      const response = await fetch(`${API_URL}/admin/auditoria?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data?.success) {
        setLogs(data?.data?.logs || []);
        setPagination(data?.data?.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/auditoria/estadisticas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, []);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filtros.accion) params.append('accion', filtros.accion);
      if (filtros.modulo) params.append('modulo', filtros.modulo);

      const response = await fetch(`${API_URL}/admin/auditoria/exportar?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (err) {
      console.error('Error exporting:', err);
    }
  };

  const getAccionColor = (accion: string) => {
    if (accion.includes('LOGIN')) return 'accion-auth';
    if (accion.includes('CREAR') || accion.includes('APROBAR')) return 'accion-create';
    if (accion.includes('FIRMAR') || accion.includes('CONFIRMAR')) return 'accion-confirm';
    if (accion.includes('RECHAZAR') || accion.includes('ELIMINAR')) return 'accion-delete';
    return 'accion-default';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const acciones = [
    'LOGIN', 'LOGOUT', 'LOGIN_FALLIDO',
    'CREAR_MANIFIESTO', 'FIRMAR_MANIFIESTO', 'CONFIRMAR_RETIRO',
    'CONFIRMAR_ENTREGA', 'CONFIRMAR_RECEPCION', 'CERRAR_MANIFIESTO',
    'APROBAR_USUARIO', 'RECHAZAR_USUARIO', 'VER_AUDITORIA', 'EXPORTAR_DATOS'
  ];

  const modulos = ['AUTH', 'MANIFIESTOS', 'USUARIOS', 'REPORTES', 'SISTEMA', 'PUSH'];

  return (
    <div className="auditoria-container">
      <div className="page-header">
        <div>
          <h1>Log de Auditoría</h1>
          <p>Registro completo de actividad del sistema</p>
        </div>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={18} />
            Filtros
          </button>
          <button className="btn-icon" onClick={handleExport}>
            <Download size={18} />
            Exportar CSV
          </button>
          <button className="btn-icon" onClick={() => fetchLogs(pagination.page)}>
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <Activity size={24} />
            <div>
              <span className="stat-value">{stats.total.toLocaleString()}</span>
              <span className="stat-label">Total Registros</span>
            </div>
          </div>
          {stats.porModulo.slice(0, 3).map(m => (
            <div key={m.modulo} className="stat-card">
              <FileText size={24} />
              <div>
                <span className="stat-value">{m.count}</span>
                <span className="stat-label">{m.modulo}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label>Acción</label>
              <select 
                value={filtros.accion} 
                onChange={e => setFiltros(prev => ({ ...prev, accion: e.target.value }))}
              >
                <option value="">Todas</option>
                {acciones.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Módulo</label>
              <select 
                value={filtros.modulo}
                onChange={e => setFiltros(prev => ({ ...prev, modulo: e.target.value }))}
              >
                <option value="">Todos</option>
                {modulos.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Desde</label>
              <input 
                type="date" 
                value={filtros.desde}
                onChange={e => setFiltros(prev => ({ ...prev, desde: e.target.value }))}
              />
            </div>
            <div className="filter-group">
              <label>Hasta</label>
              <input 
                type="date" 
                value={filtros.hasta}
                onChange={e => setFiltros(prev => ({ ...prev, hasta: e.target.value }))}
              />
            </div>
            <button className="btn-apply" onClick={() => fetchLogs(1)}>
              <Search size={16} />
              Buscar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
          </div>
        ) : (
          <table className="audit-table">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Detalles</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="td-timestamp">
                    <Clock size={14} />
                    {formatDate(log.timestamp)}
                  </td>
                  <td className="td-user">
                    <User size={14} />
                    <div>
                      <span className="user-name">{log.usuario.nombre}</span>
                      <span className="user-email">{log.usuario.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`accion-badge ${getAccionColor(log.accion)}`}>
                      {log.accion}
                    </span>
                  </td>
                  <td>
                    <span className="modulo-badge">{log.modulo}</span>
                  </td>
                  <td className="td-detalles">
                    {log.entidadId && <code>{log.entidadId.slice(0, 8)}...</code>}
                    {log.detalles && Object.keys(log.detalles).length > 0 && (
                      <span className="has-details" title={JSON.stringify(log.detalles)}>
                        📋
                      </span>
                    )}
                  </td>
                  <td className="td-ip">{log.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span className="pagination-info">
          Mostrando {logs.length} de {pagination.total} registros
        </span>
        <div className="pagination-controls">
          <button 
            disabled={pagination.page <= 1}
            onClick={() => fetchLogs(pagination.page - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>Página {pagination.page} de {pagination.pages}</span>
          <button 
            disabled={pagination.page >= pagination.pages}
            onClick={() => fetchLogs(pagination.page + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogAuditoria;
