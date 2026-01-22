/**
 * OperadorDetalle - Página de detalle de un operador para administradores
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Factory,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Hash,
  FileText,
  AlertTriangle,
  Edit,
  Save,
  X,
  User,
  RefreshCw,
  CheckCircle,
  ExternalLink,
  Recycle,
  Package,
  Power,
  Award
} from 'lucide-react';
import { AdminBadge } from '../../components/admin/AdminBadge';
import '../../components/admin/admin.css';
import '../MiPerfil.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface TipoResiduo {
  id: string;
  codigo: string;
  nombre: string;
}

interface Tratamiento {
  id: string;
  tipoTratamiento: string;
  capacidadMensual?: number;
  activo: boolean;
  tipoResiduo?: TipoResiduo;
}

interface Operador {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  numeroHabilitacion?: string;
  categoria?: string;
  activo: boolean;
  usuario?: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    activo: boolean;
    aprobado: boolean;
  };
  tratamientos?: Tratamiento[];
  _count?: {
    manifiestos: number;
  };
  manifiestos?: Array<{
    id: string;
    numero: string;
    estado: string;
    fechaCreacion: string;
  }>;
}

const OperadorDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [operador, setOperador] = useState<Operador | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState<Partial<Operador>>({});

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  const cargarOperador = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/admin-sectorial/operadores/${id}`, {
        headers: getHeaders()
      });
      setOperador(response.data.data.operador);
      setFormData(response.data.data.operador);
    } catch (err: any) {
      console.error('Error cargando operador:', err);
      setError(err.response?.data?.message || 'Error al cargar el operador');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarOperador();
  }, [id]);

  const handleGuardar = async () => {
    if (!id || !formData) return;

    setGuardando(true);
    try {
      await axios.patch(
        `${API_URL}/admin-sectorial/operadores/${id}`,
        formData,
        { headers: getHeaders() }
      );
      setEditando(false);
      cargarOperador();
    } catch (err: any) {
      console.error('Error guardando:', err);
      alert(err.response?.data?.message || 'Error al guardar los cambios');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivo = async () => {
    if (!id || !operador) return;

    try {
      await axios.patch(
        `${API_URL}/admin-sectorial/operadores/${id}`,
        { activo: !operador.activo },
        { headers: getHeaders() }
      );
      cargarOperador();
    } catch (err: any) {
      console.error('Error cambiando estado:', err);
      alert(err.response?.data?.message || 'Error al cambiar el estado');
    }
  };

  const handleAprobar = async () => {
    if (!id) return;

    try {
      await axios.post(
        `${API_URL}/admin-sectorial/operadores/${id}/aprobar`,
        {},
        { headers: getHeaders() }
      );
      cargarOperador();
    } catch (err: any) {
      console.error('Error aprobando:', err);
      alert(err.response?.data?.message || 'Error al aprobar');
    }
  };

  // Calcular capacidad total de tratamientos
  const capacidadTotal = operador?.tratamientos?.reduce(
    (sum, t) => sum + (t.capacidadMensual || 0),
    0
  ) || 0;

  const formatKg = (kg: number): string => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)} t`;
    }
    return `${kg} kg`;
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <RefreshCw className="admin-loading-spinner" size={24} />
          <span>Cargando operador...</span>
        </div>
      </div>
    );
  }

  if (error || !operador) {
    return (
      <div className="admin-page">
        <div className="admin-empty-state">
          <AlertTriangle size={48} />
          <p>{error || 'Operador no encontrado'}</p>
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => navigate('/admin/operadores')}
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Link
          to="/admin/operadores"
          style={{
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={14} />
          Operadores
        </Link>
        <span style={{ color: '#475569' }}>/</span>
        <span style={{ color: '#94a3b8' }}>{operador.razonSocial}</span>
      </div>

      {/* Header con título y botones */}
      <div className="admin-detail-header">
        <div className="admin-detail-header-info">
          <div className="admin-detail-header-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
            <Factory size={28} />
          </div>
          <div>
            <h1 className="admin-detail-title">{operador.razonSocial}</h1>
            <div className="admin-detail-subtitle">
              CUIT: <span style={{ fontFamily: 'monospace' }}>{operador.cuit}</span>
            </div>
          </div>
        </div>
        <div className="admin-detail-header-actions">
          {!editando ? (
            <>
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => setEditando(true)}
              >
                <Edit size={16} />
                Editar
              </button>
              {operador.usuario && !operador.usuario.aprobado && (
                <button
                  className="admin-btn admin-btn--success"
                  onClick={handleAprobar}
                >
                  <CheckCircle size={16} />
                  Aprobar
                </button>
              )}
              <button
                className={`admin-btn ${operador.activo ? 'admin-btn--warning' : 'admin-btn--success'}`}
                onClick={handleToggleActivo}
              >
                <Power size={16} />
                {operador.activo ? 'Desactivar' : 'Activar'}
              </button>
            </>
          ) : (
            <>
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => {
                  setEditando(false);
                  setFormData(operador);
                }}
              >
                <X size={16} />
                Cancelar
              </button>
              <button
                className="admin-btn admin-btn--success"
                onClick={handleGuardar}
                disabled={guardando}
              >
                <Save size={16} />
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Badges de estado */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <AdminBadge variant={operador.activo ? 'success' : 'danger'}>
          {operador.activo ? 'Activo' : 'Inactivo'}
        </AdminBadge>
        {operador.usuario && (
          <AdminBadge variant={operador.usuario.aprobado ? 'success' : 'warning'}>
            Usuario {operador.usuario.aprobado ? 'Aprobado' : 'Pendiente'}
          </AdminBadge>
        )}
        <AdminBadge variant="info">
          {operador._count?.manifiestos || 0} manifiestos
        </AdminBadge>
        <AdminBadge variant="neutral">
          {operador.tratamientos?.length || 0} tratamientos
        </AdminBadge>
        {capacidadTotal > 0 && (
          <AdminBadge variant="warning">
            Capacidad: {formatKg(capacidadTotal)}/mes
          </AdminBadge>
        )}
        {operador.categoria && (
          <AdminBadge variant="neutral">
            {operador.categoria}
          </AdminBadge>
        )}
      </div>

      {/* Grid principal de información */}
      <div className="perfil-grid">
        {/* Información General */}
        <div className="perfil-section">
          <h2 className="perfil-section-title">
            <Factory size={20} />
            Información General
          </h2>
          <div className="perfil-card">
            {editando ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="admin-label">Razón Social</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.razonSocial || ''}
                    onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                  />
                </div>
                <div>
                  <label className="admin-label">Domicilio</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.domicilio || ''}
                    onChange={(e) => setFormData({ ...formData, domicilio: e.target.value })}
                  />
                </div>
                <div>
                  <label className="admin-label">Teléfono</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.telefono || ''}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>
                <div>
                  <label className="admin-label">N° Habilitación</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.numeroHabilitacion || ''}
                    onChange={(e) => setFormData({ ...formData, numeroHabilitacion: e.target.value })}
                  />
                </div>
                <div>
                  <label className="admin-label">Categoría</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.categoria || ''}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="perfil-field">
                  <Hash size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">CUIT</span>
                    <span className="perfil-field-value" style={{ fontFamily: 'monospace' }}>
                      {operador.cuit}
                    </span>
                  </div>
                </div>

                <div className="perfil-field">
                  <MapPin size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">Domicilio</span>
                    <span className="perfil-field-value">{operador.domicilio || 'No registrado'}</span>
                  </div>
                </div>

                <div className="perfil-field">
                  <Phone size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">Teléfono</span>
                    <span className="perfil-field-value">{operador.telefono || 'No registrado'}</span>
                  </div>
                </div>

                <div className="perfil-field">
                  <FileText size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">N° de Habilitación</span>
                    <span className="perfil-field-value" style={{ fontFamily: 'monospace', color: '#22c55e' }}>
                      {operador.numeroHabilitacion || 'Sin número'}
                    </span>
                  </div>
                </div>

                {operador.categoria && (
                  <div className="perfil-field">
                    <Award size={16} className="perfil-field-icon" />
                    <div>
                      <span className="perfil-field-label">Categoría</span>
                      <span className="perfil-field-value">{operador.categoria}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Usuario Asociado */}
        {operador.usuario && (
          <div className="perfil-section">
            <h2 className="perfil-section-title">
              <User size={20} />
              Usuario Asociado
            </h2>
            <div className="perfil-card">
              <div className="perfil-field">
                <User size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Nombre</span>
                  <span className="perfil-field-value">
                    {operador.usuario.nombre} {operador.usuario.apellido}
                  </span>
                </div>
              </div>
              <div className="perfil-field">
                <Mail size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Email de acceso</span>
                  <span className="perfil-field-value" style={{ wordBreak: 'break-all' }}>
                    {operador.usuario.email}
                  </span>
                </div>
              </div>
              <div className="perfil-field">
                <CheckCircle size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Estado de aprobación</span>
                  <span
                    className="perfil-field-value"
                    style={{ color: operador.usuario.aprobado ? '#34d399' : '#fbbf24' }}
                  >
                    {operador.usuario.aprobado ? 'Aprobado' : 'Pendiente de aprobación'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tratamientos */}
      {operador.tratamientos && operador.tratamientos.length > 0 && (
        <div className="actor-profile" style={{ marginTop: '24px' }}>
          <div className="actor-profile-header" style={{ borderLeft: '3px solid #22c55e' }}>
            <Recycle size={20} style={{ color: '#22c55e' }} />
            <h2>Tratamientos Autorizados ({operador.tratamientos.length})</h2>
          </div>
          <div className="actor-profile-content">
            <div className="tratamientos-list">
              {operador.tratamientos.map((tratamiento) => (
                <div key={tratamiento.id} className="tratamiento-item">
                  <div className="tratamiento-item-icon" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
                    <Recycle size={20} style={{ color: '#22c55e' }} />
                  </div>
                  <div className="tratamiento-item-info">
                    <div className="tratamiento-item-name">
                      {tratamiento.tipoResiduo?.codigo && (
                        <span style={{
                          fontFamily: 'monospace',
                          background: 'rgba(251, 191, 36, 0.15)',
                          color: '#fbbf24',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginRight: '8px',
                          fontSize: '12px'
                        }}>
                          {tratamiento.tipoResiduo.codigo}
                        </span>
                      )}
                      {tratamiento.tipoTratamiento}
                    </div>
                    <div className="tratamiento-item-detail">
                      {tratamiento.tipoResiduo?.nombre || 'Sin tipo de residuo'}
                      {tratamiento.capacidadMensual && tratamiento.capacidadMensual > 0 && (
                        <span style={{ marginLeft: '12px', color: '#22c55e' }}>
                          <Package size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {formatKg(tratamiento.capacidadMensual)}/mes
                        </span>
                      )}
                    </div>
                  </div>
                  <AdminBadge variant={tratamiento.activo ? 'success' : 'danger'} size="sm">
                    {tratamiento.activo ? 'Activo' : 'Inactivo'}
                  </AdminBadge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Capacidad Total */}
      {capacidadTotal > 0 && (
        <div className="admin-detail-section" style={{ marginTop: '24px' }}>
          <h3 className="admin-detail-section-title">
            <Package size={18} style={{ color: '#fbbf24' }} />
            Capacidad de Procesamiento
          </h3>
          <div className="admin-detail-grid">
            <div className="admin-detail-field">
              <Package size={16} className="admin-detail-field-icon" style={{ color: '#fbbf24' }} />
              <div>
                <span className="admin-detail-field-label">Capacidad Total Mensual</span>
                <span className="admin-detail-field-value" style={{ fontSize: '18px', color: '#fbbf24', fontWeight: 600 }}>
                  {formatKg(capacidadTotal)}
                </span>
              </div>
            </div>
            <div className="admin-detail-field">
              <Recycle size={16} className="admin-detail-field-icon" style={{ color: '#22c55e' }} />
              <div>
                <span className="admin-detail-field-label">Tratamientos Activos</span>
                <span className="admin-detail-field-value">
                  {operador.tratamientos?.filter(t => t.activo).length || 0} de {operador.tratamientos?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historial de Manifiestos */}
      {operador.manifiestos && operador.manifiestos.length > 0 && (
        <div className="actor-profile" style={{ marginTop: '24px' }}>
          <div className="actor-profile-header" style={{ borderLeft: '3px solid #a78bfa' }}>
            <FileText size={20} style={{ color: '#a78bfa' }} />
            <h2>Últimos Manifiestos</h2>
          </div>
          <div className="actor-profile-content">
            <div className="tratamientos-list">
              {operador.manifiestos.slice(0, 10).map((manifiesto) => (
                <div key={manifiesto.id} className="tratamiento-item">
                  <div className="tratamiento-item-icon">
                    <FileText size={20} />
                  </div>
                  <div className="tratamiento-item-info">
                    <div className="tratamiento-item-name">
                      {manifiesto.numero}
                    </div>
                    <div className="tratamiento-item-detail">
                      {new Date(manifiesto.fechaCreacion).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  <AdminBadge variant={
                    manifiesto.estado === 'TRATADO' ? 'success' :
                    manifiesto.estado === 'EN_TRANSITO' ? 'warning' :
                    manifiesto.estado === 'RECHAZADO' ? 'danger' : 'info'
                  } size="sm">
                    {manifiesto.estado}
                  </AdminBadge>
                  <Link
                    to={`/manifiestos/${manifiesto.id}`}
                    style={{ color: '#a78bfa', marginLeft: '8px' }}
                  >
                    <ExternalLink size={16} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperadorDetalle;
