import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Calendar, ChevronLeft, ChevronRight,
  Clock, Download, FileText, Filter, RefreshCw, Search, Shield, TrendingUp,
  User, Users, Zap, X, Eye, AlertCircle
} from 'lucide-react';
import './LogEnhanced.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

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
  severidad?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  duracionMs?: number;
  resultadoExito?: boolean;
  datosAntes?: Record<string, any>;
  datosDespues?: Record<string, any>;
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
  porHora?: { hora: number; count: number }[];
  topUsuarios?: { usuario: string; email: string; count: number }[];
}

interface Alerta {
  id: string;
  tipo: string;
  mensaje: string;
  severidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  resuelta: boolean;
  timestamp: string;
  detalles?: Record<string, any>;
}

const LogEnhanced: React.FC = () => {
  // State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'timeline' | 'table' | 'charts' | 'alerts'>('timeline');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Filtros
  const [filtros, setFiltros] = useState({
    accion: '',
    modulo: '',
    severidad: '',
    usuario: '',
    desde: '',
    hasta: '',
    soloErrores: false
  });

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : ''
  });

  // Fetch logs
  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' });
      if (filtros.accion) params.append('accion', filtros.accion);
      if (filtros.modulo) params.append('modulo', filtros.modulo);
      if (filtros.desde) params.append('desde', new Date(filtros.desde).toISOString());
      if (filtros.hasta) params.append('hasta', new Date(filtros.hasta).toISOString());

      const response = await fetch(`${API_URL}/admin/auditoria?${params}`, { headers: getHeaders() });
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

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/auditoria/estadisticas`, { headers: getHeaders() });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch alertas
  const fetchAlertas = async () => {
    try {
      const response = await fetch(`${API_URL}/alertas?tipo=SEGURIDAD&limit=20`, { headers: getHeaders() });
      const data = await response.json();
      if (data.success) {
        setAlertas(data.data?.alertas || []);
      }
    } catch (err) {
      console.error('Error fetching alertas:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    fetchAlertas();
  }, []);

  // Export
  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const params = new URLSearchParams();
      if (filtros.accion) params.append('accion', filtros.accion);
      if (filtros.modulo) params.append('modulo', filtros.modulo);

      const endpoint = format === 'excel' ? '/admin/auditoria/exportar-excel' : '/admin/auditoria/exportar';
      const response = await fetch(`${API_URL}${endpoint}?${params}`, { headers: getHeaders() });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
    } catch (err) {
      console.error('Error exporting:', err);
    }
  };

  // Group logs by date/hour for timeline
  const timelineGroups = useMemo(() => {
    const groups: Record<string, LogEntry[]> = {};
    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const key = date.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'short' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    return groups;
  }, [logs]);

  // Calculate activity by hour for charts
  const activityByHour = useMemo(() => {
    const hours: number[] = Array(24).fill(0);
    logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hours[hour]++;
    });
    return hours;
  }, [logs]);

  // Severity color
  const getSeveridadColor = (severidad?: string) => {
    switch (severidad) {
      case 'CRITICAL': return { bg: '#fee2e2', color: '#991b1b', label: 'Critico' };
      case 'ERROR': return { bg: '#fef2f2', color: '#dc2626', label: 'Error' };
      case 'WARNING': return { bg: '#fef3c7', color: '#d97706', label: 'Alerta' };
      case 'INFO': return { bg: '#dbeafe', color: '#2563eb', label: 'Info' };
      default: return { bg: '#f3f4f6', color: '#6b7280', label: 'Debug' };
    }
  };

  // Action color
  const getAccionColor = (accion: string) => {
    if (accion.includes('LOGIN_FALLIDO') || accion.includes('RECHAZAR') || accion.includes('ELIMINAR'))
      return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
    if (accion.includes('LOGIN') || accion.includes('LOGOUT'))
      return { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' };
    if (accion.includes('CREAR') || accion.includes('APROBAR'))
      return { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' };
    if (accion.includes('FIRMAR') || accion.includes('CONFIRMAR'))
      return { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' };
    if (accion.includes('REVERTIR') || accion.includes('REVERSION'))
      return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
    if (accion.includes('VER') || accion.includes('EXPORTAR'))
      return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
    return { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
  };

  // Module color
  const getModuloColor = (modulo: string) => {
    switch (modulo) {
      case 'AUTH': return { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' };
      case 'MANIFIESTOS': return { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' };
      case 'REPORTES': return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
      case 'USUARIOS': return { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' };
      case 'REVERSIONES': return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
      case 'SISTEMA': return { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' };
      case 'PUSH': return { bg: '#cffafe', color: '#0e7490', border: '#a5f3fc' };
      case 'ADMIN_SECTORIAL': return { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' };
      default: return { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const acciones = [
    'LOGIN', 'LOGOUT', 'LOGIN_FALLIDO',
    'CREAR_MANIFIESTO', 'FIRMAR_MANIFIESTO', 'CONFIRMAR_RETIRO',
    'CONFIRMAR_ENTREGA', 'CONFIRMAR_RECEPCION', 'CERRAR_MANIFIESTO',
    'REVERTIR_ENTREGA', 'REVERTIR_RECEPCION', 'REVERTIR_CERTIFICADO',
    'APROBAR_USUARIO', 'RECHAZAR_USUARIO', 'VER_AUDITORIA', 'EXPORTAR_DATOS'
  ];

  const modulos = ['AUTH', 'MANIFIESTOS', 'USUARIOS', 'REPORTES', 'SISTEMA', 'PUSH', 'ADMIN_SECTORIAL'];
  const severidades = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

  // Render timeline view
  const renderTimeline = () => (
    <div className="timeline-view">
      {Object.entries(timelineGroups).map(([date, entries]) => (
        <div key={date} className="timeline-group">
          <div className="timeline-date">
            <Calendar size={16} />
            <span>{date}</span>
            <span className="date-count">{entries.length} eventos</span>
          </div>
          <div className="timeline-entries">
            {entries.map(log => (
              <div
                key={log.id}
                className={`timeline-entry ${log.severidad === 'ERROR' || log.severidad === 'CRITICAL' ? 'entry-error' : ''}`}
                onClick={() => { setSelectedLog(log); setShowDiffModal(true); }}
              >
                <div className="entry-time">
                  <Clock size={12} />
                  <span>{formatTime(log.timestamp)}</span>
                </div>
                <div className="entry-content">
                  <div className="entry-header">
                    <span
                      className="entry-accion"
                      style={{ background: getAccionColor(log.accion).bg, color: getAccionColor(log.accion).color, border: `1px solid ${getAccionColor(log.accion).border}` }}
                    >
                      {log.accion}
                    </span>
                    <span
                      className="entry-modulo"
                      style={{ background: getModuloColor(log.modulo).bg, color: getModuloColor(log.modulo).color, border: `1px solid ${getModuloColor(log.modulo).border}` }}
                    >
                      {log.modulo}
                    </span>
                    {log.severidad && log.severidad !== 'INFO' && (
                      <span
                        className="entry-severidad"
                        style={{ background: getSeveridadColor(log.severidad).bg, color: getSeveridadColor(log.severidad).color }}
                      >
                        {getSeveridadColor(log.severidad).label}
                      </span>
                    )}
                  </div>
                  <div className="entry-user">
                    <User size={14} />
                    <span>{log.usuario.nombre} {log.usuario.apellido || ''}</span>
                    <span className="entry-email">{log.usuario.email}</span>
                  </div>
                  {log.duracionMs && (
                    <span className="entry-duration">
                      <Zap size={12} /> {log.duracionMs}ms
                    </span>
                  )}
                </div>
                {(log.datosAntes || log.datosDespues) && (
                  <button className="btn-diff" title="Ver cambios">
                    <Eye size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // Render charts view
  const renderCharts = () => {
    const maxHour = Math.max(...activityByHour);

    return (
      <div className="charts-view">
        <div className="chart-section">
          <h3><BarChart3 size={18} /> Actividad por Hora</h3>
          <div className="hourly-chart">
            {activityByHour.map((count, hour) => (
              <div key={hour} className="hour-bar-container">
                <div
                  className="hour-bar"
                  style={{ height: `${maxHour > 0 ? (count / maxHour) * 100 : 0}%` }}
                  title={`${hour}:00 - ${count} eventos`}
                />
                <span className="hour-label">{hour}</span>
              </div>
            ))}
          </div>
        </div>

        {stats && (
          <>
            <div className="chart-section">
              <h3><Activity size={18} /> Top Acciones</h3>
              <div className="action-bars">
                {stats.porAccion.slice(0, 8).map(a => (
                  <div key={a.accion} className="action-bar-row">
                    <span className="action-name">{a.accion}</span>
                    <div className="action-bar-container">
                      <div
                        className="action-bar"
                        style={{ width: `${(a.count / (stats.porAccion[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="action-count">{a.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-section">
              <h3><FileText size={18} /> Por Modulo</h3>
              <div className="module-grid">
                {stats.porModulo.map(m => (
                  <div key={m.modulo} className="module-card">
                    <span className="module-count">{m.count}</span>
                    <span className="module-name">{m.modulo}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Render alerts view
  const renderAlerts = () => (
    <div className="alerts-view">
      <div className="alerts-header">
        <h3><Shield size={18} /> Alertas de Seguridad</h3>
        <span className="alerts-count">{alertas.filter(a => !a.resuelta).length} pendientes</span>
      </div>

      {alertas.length === 0 ? (
        <div className="empty-alerts">
          <AlertCircle size={48} />
          <p>No hay alertas de seguridad recientes</p>
        </div>
      ) : (
        <div className="alerts-list">
          {alertas.map(alerta => (
            <div
              key={alerta.id}
              className={`alert-card severity-${alerta.severidad.toLowerCase()} ${alerta.resuelta ? 'resolved' : ''}`}
            >
              <div className="alert-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="alert-content">
                <div className="alert-header">
                  <span className="alert-type">{alerta.tipo}</span>
                  <span className={`alert-severity severity-${alerta.severidad.toLowerCase()}`}>
                    {alerta.severidad}
                  </span>
                  {alerta.resuelta && <span className="alert-resolved">Resuelta</span>}
                </div>
                <p className="alert-message">{alerta.mensaje}</p>
                <span className="alert-time">{formatDate(alerta.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="alert-patterns">
        <h4><TrendingUp size={16} /> Patrones Detectados</h4>
        <div className="pattern-cards">
          <div className="pattern-card">
            <span className="pattern-value">
              {logs.filter(l => l.accion === 'LOGIN_FALLIDO').length}
            </span>
            <span className="pattern-label">Logins Fallidos</span>
          </div>
          <div className="pattern-card">
            <span className="pattern-value">
              {logs.filter(l => l.accion.includes('REVERTIR')).length}
            </span>
            <span className="pattern-label">Reversiones</span>
          </div>
          <div className="pattern-card">
            <span className="pattern-value">
              {logs.filter(l => l.severidad === 'ERROR' || l.severidad === 'CRITICAL').length}
            </span>
            <span className="pattern-label">Errores</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Render table view
  const renderTable = () => (
    <div className="table-view">
      <table className="log-table">
        <thead>
          <tr>
            <th>Fecha/Hora</th>
            <th>Usuario</th>
            <th>Accion</th>
            <th>Modulo</th>
            <th>Severidad</th>
            <th>Duracion</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr
              key={log.id}
              className={log.severidad === 'ERROR' || log.severidad === 'CRITICAL' ? 'row-error' : ''}
              onClick={() => { setSelectedLog(log); setShowDiffModal(true); }}
            >
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
                <span
                  className="accion-badge"
                  style={{ background: getAccionColor(log.accion).bg, color: getAccionColor(log.accion).color, border: `1px solid ${getAccionColor(log.accion).border}` }}
                >
                  {log.accion}
                </span>
              </td>
              <td>
                <span
                  className="modulo-badge"
                  style={{ background: getModuloColor(log.modulo).bg, color: getModuloColor(log.modulo).color, border: `1px solid ${getModuloColor(log.modulo).border}` }}
                >
                  {log.modulo}
                </span>
              </td>
              <td>
                {log.severidad && (
                  <span
                    className="severidad-badge"
                    style={{ background: getSeveridadColor(log.severidad).bg, color: getSeveridadColor(log.severidad).color }}
                  >
                    {log.severidad}
                  </span>
                )}
              </td>
              <td>{log.duracionMs ? `${log.duracionMs}ms` : '-'}</td>
              <td className="td-ip">{log.ip || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Diff modal
  const renderDiffModal = () => {
    if (!selectedLog || !showDiffModal) return null;

    return (
      <div className="diff-modal-overlay" onClick={() => setShowDiffModal(false)}>
        <div className="diff-modal" onClick={e => e.stopPropagation()}>
          <div className="diff-header">
            <h3>Detalles del Evento</h3>
            <button onClick={() => setShowDiffModal(false)}><X size={20} /></button>
          </div>
          <div className="diff-content">
            <div className="diff-info">
              <div className="info-row">
                <span className="label">Accion:</span>
                <span className="value">{selectedLog.accion}</span>
              </div>
              <div className="info-row">
                <span className="label">Modulo:</span>
                <span className="value">{selectedLog.modulo}</span>
              </div>
              <div className="info-row">
                <span className="label">Usuario:</span>
                <span className="value">{selectedLog.usuario.nombre} ({selectedLog.usuario.email})</span>
              </div>
              <div className="info-row">
                <span className="label">Fecha:</span>
                <span className="value">{formatDate(selectedLog.timestamp)}</span>
              </div>
              {selectedLog.ip && (
                <div className="info-row">
                  <span className="label">IP:</span>
                  <span className="value">{selectedLog.ip}</span>
                </div>
              )}
            </div>

            {selectedLog.detalles && Object.keys(selectedLog.detalles).length > 0 && (
              <div className="diff-section">
                <h4>Detalles</h4>
                <pre>{JSON.stringify(selectedLog.detalles, null, 2)}</pre>
              </div>
            )}

            {(selectedLog.datosAntes || selectedLog.datosDespues) && (
              <div className="diff-comparison">
                <div className="diff-antes">
                  <h4>Antes</h4>
                  <pre>{selectedLog.datosAntes ? JSON.stringify(selectedLog.datosAntes, null, 2) : '(sin datos)'}</pre>
                </div>
                <div className="diff-despues">
                  <h4>Despues</h4>
                  <pre>{selectedLog.datosDespues ? JSON.stringify(selectedLog.datosDespues, null, 2) : '(sin datos)'}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="log-enhanced-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <h1><Activity size={28} /> Log de Auditoria Avanzado</h1>
          <p>Monitoreo en tiempo real y analisis de actividad</p>
        </div>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={18} />
            Filtros
          </button>
          <div className="export-dropdown">
            <button className="btn-icon" onClick={() => handleExport('csv')}>
              <Download size={18} />
              CSV
            </button>
          </div>
          <button className="btn-icon" onClick={() => { fetchLogs(1); fetchStats(); }}>
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card stat-primary">
            <Activity size={24} />
            <div>
              <span className="stat-value">{stats.total.toLocaleString()}</span>
              <span className="stat-label">Total Eventos</span>
            </div>
          </div>
          <div className="stat-card stat-warning">
            <AlertTriangle size={24} />
            <div>
              <span className="stat-value">{alertas.filter(a => !a.resuelta).length}</span>
              <span className="stat-label">Alertas Activas</span>
            </div>
          </div>
          <div className="stat-card stat-info">
            <Users size={24} />
            <div>
              <span className="stat-value">{new Set(logs.map(l => l.usuarioId)).size}</span>
              <span className="stat-label">Usuarios Activos</span>
            </div>
          </div>
          <div className="stat-card stat-success">
            <TrendingUp size={24} />
            <div>
              <span className="stat-value">{stats.porModulo.length}</span>
              <span className="stat-label">Modulos</span>
            </div>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="view-tabs">
        <button
          className={`tab ${activeView === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveView('timeline')}
        >
          <Clock size={16} /> Timeline
        </button>
        <button
          className={`tab ${activeView === 'table' ? 'active' : ''}`}
          onClick={() => setActiveView('table')}
        >
          <FileText size={16} /> Tabla
        </button>
        <button
          className={`tab ${activeView === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveView('charts')}
        >
          <BarChart3 size={16} /> Graficos
        </button>
        <button
          className={`tab ${activeView === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveView('alerts')}
        >
          <Shield size={16} /> Alertas
          {alertas.filter(a => !a.resuelta).length > 0 && (
            <span className="alert-badge">{alertas.filter(a => !a.resuelta).length}</span>
          )}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label>Accion</label>
              <select
                value={filtros.accion}
                onChange={e => setFiltros(prev => ({ ...prev, accion: e.target.value }))}
              >
                <option value="">Todas</option>
                {acciones.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Modulo</label>
              <select
                value={filtros.modulo}
                onChange={e => setFiltros(prev => ({ ...prev, modulo: e.target.value }))}
              >
                <option value="">Todos</option>
                {modulos.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Severidad</label>
              <select
                value={filtros.severidad}
                onChange={e => setFiltros(prev => ({ ...prev, severidad: e.target.value }))}
              >
                <option value="">Todas</option>
                {severidades.map(s => <option key={s} value={s}>{s}</option>)}
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

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <div className="loader"></div>
          <span>Cargando eventos...</span>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="log-content">
          {activeView === 'timeline' && renderTimeline()}
          {activeView === 'table' && renderTable()}
          {activeView === 'charts' && renderCharts()}
          {activeView === 'alerts' && renderAlerts()}
        </div>
      )}

      {/* Pagination */}
      {!loading && (activeView === 'timeline' || activeView === 'table') && (
        <div className="pagination">
          <span className="pagination-info">
            Mostrando {logs.length} de {pagination.total} eventos
          </span>
          <div className="pagination-controls">
            <button disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)}>
              <ChevronLeft size={18} />
            </button>
            <span>Pagina {pagination.page} de {pagination.pages}</span>
            <button disabled={pagination.page >= pagination.pages} onClick={() => fetchLogs(pagination.page + 1)}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Diff Modal */}
      {renderDiffModal()}
    </div>
  );
};

export default LogEnhanced;
