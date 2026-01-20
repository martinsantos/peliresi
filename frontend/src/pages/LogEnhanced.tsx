import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Calendar,
  Clock, Download, FileText, RefreshCw, Search, Shield, TrendingUp,
  User, Users, Zap, X, Eye, AlertCircle
} from 'lucide-react';
import {
  AdminStatCard,
  AdminStatsGrid,
  AdminPageHeader,
  AdminBadge,
  AdminPagination,
  AdminFilterPanel,
  AdminButton,
  getModuleVariant
} from '../components/admin';
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

  // Badge variants for AdminBadge
  const getAccionVariant = (accion: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    if (accion.includes('LOGIN_FALLIDO') || accion.includes('RECHAZAR') || accion.includes('ELIMINAR'))
      return 'danger';
    if (accion.includes('LOGIN') || accion.includes('LOGOUT'))
      return 'info';
    if (accion.includes('CREAR') || accion.includes('APROBAR'))
      return 'success';
    if (accion.includes('FIRMAR') || accion.includes('CONFIRMAR'))
      return 'primary';
    if (accion.includes('REVERTIR') || accion.includes('REVERSION'))
      return 'warning';
    return 'neutral';
  };

  const getSeveridadVariant = (severidad?: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    switch (severidad) {
      case 'CRITICAL': return 'danger';
      case 'ERROR': return 'danger';
      case 'WARNING': return 'warning';
      case 'INFO': return 'info';
      default: return 'neutral';
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
                    <AdminBadge variant={getAccionVariant(log.accion)} size="sm">
                      {log.accion}
                    </AdminBadge>
                    <AdminBadge variant={getModuleVariant(log.modulo)} size="sm">
                      {log.modulo}
                    </AdminBadge>
                    {log.severidad && log.severidad !== 'INFO' && (
                      <AdminBadge variant={getSeveridadVariant(log.severidad)} size="sm">
                        {getSeveridadColor(log.severidad).label}
                      </AdminBadge>
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
      {/* Mobile Cards View */}
      <div className="admin-mobile-cards admin-show-mobile">
        {logs.map(log => (
          <div
            key={log.id}
            className={`admin-mobile-card ${log.severidad === 'ERROR' || log.severidad === 'CRITICAL' ? 'admin-mobile-card--error' : ''}`}
            onClick={() => { setSelectedLog(log); setShowDiffModal(true); }}
          >
            <div className="admin-mobile-card__header">
              <div className="admin-mobile-card__avatar">
                <User size={18} />
              </div>
              <div className="admin-mobile-card__title">
                <h3>{log.usuario.nombre} {log.usuario.apellido || ''}</h3>
                <span className="admin-mobile-card__subtitle">{log.usuario.email}</span>
              </div>
            </div>

            <div className="admin-mobile-card__badges">
              <AdminBadge variant={getAccionVariant(log.accion)} size="sm">
                {log.accion}
              </AdminBadge>
              <AdminBadge variant={getModuleVariant(log.modulo)} size="sm">
                {log.modulo}
              </AdminBadge>
              {log.severidad && log.severidad !== 'INFO' && (
                <AdminBadge variant={getSeveridadVariant(log.severidad)} size="sm">
                  {log.severidad}
                </AdminBadge>
              )}
            </div>

            <div className="admin-mobile-card__body">
              <div className="admin-mobile-card__grid">
                <div className="admin-mobile-card__detail">
                  <Clock size={14} />
                  <span>{formatDate(log.timestamp)}</span>
                </div>
                {log.ip && (
                  <div className="admin-mobile-card__detail">
                    <Shield size={14} />
                    <span>{log.ip}</span>
                  </div>
                )}
                {log.duracionMs && (
                  <div className="admin-mobile-card__detail">
                    <Zap size={14} />
                    <span>{log.duracionMs}ms</span>
                  </div>
                )}
              </div>
            </div>

            {(log.datosAntes || log.datosDespues) && (
              <div className="admin-mobile-card__actions">
                <button className="admin-mobile-card__action admin-mobile-card__action--primary">
                  <Eye size={16} />
                  Ver cambios
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="admin-hide-mobile">
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
                  <AdminBadge variant={getAccionVariant(log.accion)} size="sm">
                    {log.accion}
                  </AdminBadge>
                </td>
                <td>
                  <AdminBadge variant={getModuleVariant(log.modulo)} size="sm">
                    {log.modulo}
                  </AdminBadge>
                </td>
                <td>
                  {log.severidad && (
                    <AdminBadge variant={getSeveridadVariant(log.severidad)} size="sm">
                      {log.severidad}
                    </AdminBadge>
                  )}
                </td>
                <td>{log.duracionMs ? `${log.duracionMs}ms` : '-'}</td>
                <td className="td-ip">{log.ip || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <div className="log-enhanced-container admin-page">
      {/* Header */}
      <AdminPageHeader
        icon={<Activity size={28} />}
        title="Log de Auditoria Avanzado"
        subtitle="Monitoreo en tiempo real y analisis de actividad"
        actions={
          <>
            <AdminButton
              variant="ghost"
              size="sm"
              icon={<Download size={16} />}
              onClick={() => handleExport('csv')}
            >
              CSV
            </AdminButton>
            <AdminButton
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={16} className={loading ? 'spinning' : ''} />}
              onClick={() => { fetchLogs(1); fetchStats(); }}
            >
              Actualizar
            </AdminButton>
          </>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <AdminStatsGrid columns="auto">
          <AdminStatCard
            icon={<Activity size={24} />}
            value={stats.total.toLocaleString()}
            label="Total Eventos"
            variant="primary"
          />
          <AdminStatCard
            icon={<AlertTriangle size={24} />}
            value={alertas.filter(a => !a.resuelta).length}
            label="Alertas Activas"
            variant="warning"
          />
          <AdminStatCard
            icon={<Users size={24} />}
            value={new Set(logs.map(l => l.usuarioId)).size}
            label="Usuarios Activos"
            variant="info"
          />
          <AdminStatCard
            icon={<TrendingUp size={24} />}
            value={stats.porModulo.length}
            label="Modulos"
            variant="success"
          />
        </AdminStatsGrid>
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
      <AdminFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        title="Filtros de Auditoria"
      >
        <div className="admin-filter-grid">
          <div className="admin-form-group">
            <label className="admin-label">Accion</label>
            <select
              className="admin-select"
              value={filtros.accion}
              onChange={e => setFiltros(prev => ({ ...prev, accion: e.target.value }))}
            >
              <option value="">Todas</option>
              {acciones.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Modulo</label>
            <select
              className="admin-select"
              value={filtros.modulo}
              onChange={e => setFiltros(prev => ({ ...prev, modulo: e.target.value }))}
            >
              <option value="">Todos</option>
              {modulos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Severidad</label>
            <select
              className="admin-select"
              value={filtros.severidad}
              onChange={e => setFiltros(prev => ({ ...prev, severidad: e.target.value }))}
            >
              <option value="">Todas</option>
              {severidades.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Desde</label>
            <input
              type="date"
              className="admin-input"
              value={filtros.desde}
              onChange={e => setFiltros(prev => ({ ...prev, desde: e.target.value }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Hasta</label>
            <input
              type="date"
              className="admin-input"
              value={filtros.hasta}
              onChange={e => setFiltros(prev => ({ ...prev, hasta: e.target.value }))}
            />
          </div>
          <div className="admin-form-group admin-form-group--action">
            <AdminButton
              variant="primary"
              icon={<Search size={16} />}
              onClick={() => fetchLogs(1)}
            >
              Buscar
            </AdminButton>
          </div>
        </div>
      </AdminFilterPanel>

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
        <AdminPagination
          page={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={fetchLogs}
        />
      )}

      {/* Diff Modal */}
      {renderDiffModal()}
    </div>
  );
};

export default LogEnhanced;
