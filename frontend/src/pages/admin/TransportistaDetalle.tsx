/**
 * TransportistaDetalle - Página de detalle de un transportista para administradores
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Truck,
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
  Car,
  Users,
  Power
} from 'lucide-react';
import { AdminBadge } from '../../components/admin/AdminBadge';
import '../../components/admin/admin.css';
import '../MiPerfil.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface Vehiculo {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  capacidad: number;
  activo: boolean;
}

interface Chofer {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  licencia: string;
  activo: boolean;
}

interface Transportista {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  numeroHabilitacion?: string;
  activo: boolean;
  usuario?: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    activo: boolean;
    aprobado: boolean;
  };
  vehiculos?: Vehiculo[];
  choferes?: Chofer[];
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

const TransportistaDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transportista, setTransportista] = useState<Transportista | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState<Partial<Transportista>>({});

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  const cargarTransportista = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/admin-sectorial/transportistas/${id}`, {
        headers: getHeaders()
      });
      setTransportista(response.data.data.transportista);
      setFormData(response.data.data.transportista);
    } catch (err: any) {
      console.error('Error cargando transportista:', err);
      setError(err.response?.data?.message || 'Error al cargar el transportista');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTransportista();
  }, [id]);

  const handleGuardar = async () => {
    if (!id || !formData) return;

    setGuardando(true);
    try {
      await axios.patch(
        `${API_URL}/admin-sectorial/transportistas/${id}`,
        formData,
        { headers: getHeaders() }
      );
      setEditando(false);
      cargarTransportista();
    } catch (err: any) {
      console.error('Error guardando:', err);
      alert(err.response?.data?.message || 'Error al guardar los cambios');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivo = async () => {
    if (!id || !transportista) return;

    try {
      await axios.patch(
        `${API_URL}/admin-sectorial/transportistas/${id}`,
        { activo: !transportista.activo },
        { headers: getHeaders() }
      );
      cargarTransportista();
    } catch (err: any) {
      console.error('Error cambiando estado:', err);
      alert(err.response?.data?.message || 'Error al cambiar el estado');
    }
  };

  const handleAprobar = async () => {
    if (!id) return;

    try {
      await axios.post(
        `${API_URL}/admin-sectorial/transportistas/${id}/aprobar`,
        {},
        { headers: getHeaders() }
      );
      cargarTransportista();
    } catch (err: any) {
      console.error('Error aprobando:', err);
      alert(err.response?.data?.message || 'Error al aprobar');
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <RefreshCw className="admin-loading-spinner" size={24} />
          <span>Cargando transportista...</span>
        </div>
      </div>
    );
  }

  if (error || !transportista) {
    return (
      <div className="admin-page">
        <div className="admin-empty-state">
          <AlertTriangle size={48} />
          <p>{error || 'Transportista no encontrado'}</p>
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => navigate('/admin/transportistas')}
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
          to="/admin/transportistas"
          style={{
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={14} />
          Transportistas
        </Link>
        <span style={{ color: '#475569' }}>/</span>
        <span style={{ color: '#94a3b8' }}>{transportista.razonSocial}</span>
      </div>

      {/* Header con título y botones */}
      <div className="admin-detail-header">
        <div className="admin-detail-header-info">
          <div className="admin-detail-header-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
            <Truck size={28} />
          </div>
          <div>
            <h1 className="admin-detail-title">{transportista.razonSocial}</h1>
            <div className="admin-detail-subtitle">
              CUIT: <span style={{ fontFamily: 'monospace' }}>{transportista.cuit}</span>
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
              {transportista.usuario && !transportista.usuario.aprobado && (
                <button
                  className="admin-btn admin-btn--success"
                  onClick={handleAprobar}
                >
                  <CheckCircle size={16} />
                  Aprobar
                </button>
              )}
              <button
                className={`admin-btn ${transportista.activo ? 'admin-btn--warning' : 'admin-btn--success'}`}
                onClick={handleToggleActivo}
              >
                <Power size={16} />
                {transportista.activo ? 'Desactivar' : 'Activar'}
              </button>
            </>
          ) : (
            <>
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => {
                  setEditando(false);
                  setFormData(transportista);
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
        <AdminBadge variant={transportista.activo ? 'success' : 'danger'}>
          {transportista.activo ? 'Activo' : 'Inactivo'}
        </AdminBadge>
        {transportista.usuario && (
          <AdminBadge variant={transportista.usuario.aprobado ? 'success' : 'warning'}>
            Usuario {transportista.usuario.aprobado ? 'Aprobado' : 'Pendiente'}
          </AdminBadge>
        )}
        <AdminBadge variant="info">
          {transportista._count?.manifiestos || 0} manifiestos
        </AdminBadge>
        <AdminBadge variant="neutral">
          {transportista.vehiculos?.length || 0} vehículos
        </AdminBadge>
        <AdminBadge variant="neutral">
          {transportista.choferes?.length || 0} choferes
        </AdminBadge>
      </div>

      {/* Grid principal de información */}
      <div className="perfil-grid">
        {/* Información General */}
        <div className="perfil-section">
          <h2 className="perfil-section-title">
            <Truck size={20} />
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
              </div>
            ) : (
              <>
                <div className="perfil-field">
                  <Hash size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">CUIT</span>
                    <span className="perfil-field-value" style={{ fontFamily: 'monospace' }}>
                      {transportista.cuit}
                    </span>
                  </div>
                </div>

                <div className="perfil-field">
                  <MapPin size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">Domicilio</span>
                    <span className="perfil-field-value">{transportista.domicilio || 'No registrado'}</span>
                  </div>
                </div>

                <div className="perfil-field">
                  <Phone size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">Teléfono</span>
                    <span className="perfil-field-value">{transportista.telefono || 'No registrado'}</span>
                  </div>
                </div>

                <div className="perfil-field">
                  <FileText size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">N° de Habilitación</span>
                    <span className="perfil-field-value" style={{ fontFamily: 'monospace', color: '#06b6d4' }}>
                      {transportista.numeroHabilitacion || 'Sin número'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Usuario Asociado */}
        {transportista.usuario && (
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
                    {transportista.usuario.nombre} {transportista.usuario.apellido}
                  </span>
                </div>
              </div>
              <div className="perfil-field">
                <Mail size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Email de acceso</span>
                  <span className="perfil-field-value" style={{ wordBreak: 'break-all' }}>
                    {transportista.usuario.email}
                  </span>
                </div>
              </div>
              <div className="perfil-field">
                <CheckCircle size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Estado de aprobación</span>
                  <span
                    className="perfil-field-value"
                    style={{ color: transportista.usuario.aprobado ? '#34d399' : '#fbbf24' }}
                  >
                    {transportista.usuario.aprobado ? 'Aprobado' : 'Pendiente de aprobación'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vehículos */}
      {transportista.vehiculos && transportista.vehiculos.length > 0 && (
        <div className="actor-profile" style={{ marginTop: '24px' }}>
          <div className="actor-profile-header" style={{ borderLeft: '3px solid #06b6d4' }}>
            <Car size={20} style={{ color: '#06b6d4' }} />
            <h2>Vehículos ({transportista.vehiculos.length})</h2>
          </div>
          <div className="actor-profile-content">
            <div className="tratamientos-list">
              {transportista.vehiculos.map((vehiculo) => (
                <div key={vehiculo.id} className="tratamiento-item">
                  <div className="tratamiento-item-icon" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
                    <Car size={20} style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="tratamiento-item-info">
                    <div className="tratamiento-item-name" style={{ fontFamily: 'monospace' }}>
                      {vehiculo.patente}
                    </div>
                    <div className="tratamiento-item-detail">
                      {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio ? `(${vehiculo.anio})` : ''}
                    </div>
                  </div>
                  <AdminBadge variant={vehiculo.activo ? 'success' : 'danger'} size="sm">
                    {vehiculo.activo ? 'Activo' : 'Inactivo'}
                  </AdminBadge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Choferes */}
      {transportista.choferes && transportista.choferes.length > 0 && (
        <div className="actor-profile" style={{ marginTop: '24px' }}>
          <div className="actor-profile-header" style={{ borderLeft: '3px solid #22d3ee' }}>
            <Users size={20} style={{ color: '#22d3ee' }} />
            <h2>Choferes ({transportista.choferes.length})</h2>
          </div>
          <div className="actor-profile-content">
            <div className="tratamientos-list">
              {transportista.choferes.map((chofer) => (
                <div key={chofer.id} className="tratamiento-item">
                  <div className="tratamiento-item-icon" style={{ background: 'rgba(34, 211, 238, 0.15)' }}>
                    <User size={20} style={{ color: '#22d3ee' }} />
                  </div>
                  <div className="tratamiento-item-info">
                    <div className="tratamiento-item-name">
                      {chofer.nombre} {chofer.apellido}
                    </div>
                    <div className="tratamiento-item-detail">
                      DNI: {chofer.dni} | Lic: {chofer.licencia}
                    </div>
                  </div>
                  <AdminBadge variant={chofer.activo ? 'success' : 'danger'} size="sm">
                    {chofer.activo ? 'Activo' : 'Inactivo'}
                  </AdminBadge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Historial de Manifiestos */}
      {transportista.manifiestos && transportista.manifiestos.length > 0 && (
        <div className="actor-profile" style={{ marginTop: '24px' }}>
          <div className="actor-profile-header" style={{ borderLeft: '3px solid #a78bfa' }}>
            <FileText size={20} style={{ color: '#a78bfa' }} />
            <h2>Últimos Manifiestos</h2>
          </div>
          <div className="actor-profile-content">
            <div className="tratamientos-list">
              {transportista.manifiestos.slice(0, 10).map((manifiesto) => (
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

export default TransportistaDetalle;
