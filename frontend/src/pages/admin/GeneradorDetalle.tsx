/**
 * GeneradorDetalle - Página de detalle de un generador para administradores
 * Permite ver, editar y gestionar un generador específico
 * Muestra todos los campos extendidos incluyendo inscripción, actividad, cumplimiento, etc.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Building2,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Hash,
  FileText,
  AlertTriangle,
  Edit,
  Trash2,
  Save,
  X,
  User,
  RefreshCw,
  CheckCircle,
  ExternalLink,
  Award,
  Briefcase,
  Factory,
  BookOpen,
  ClipboardList,
  FileCheck,
  MapPinned,
  Power
} from 'lucide-react';
import { CategoriaBadges, CategoriasDetalle } from '../../components/CategoriaBadges';
import { AdminBadge } from '../../components/admin/AdminBadge';
import '../../components/admin/admin.css';
import '../MiPerfil.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface Generador {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  email: string;
  numeroInscripcion: string;
  categoria: string;
  activo: boolean;
  latitud?: number;
  longitud?: number;
  // Nuevos campos de inscripción
  certificado?: string;
  expedienteInscripcion?: string;
  resolucionInscripcion?: string;
  // Datos de actividad
  actividad?: string;
  rubro?: string;
  // Domicilio Legal separado
  domicilioLegalCalle?: string;
  domicilioLegalLocalidad?: string;
  domicilioLegalDepartamento?: string;
  // Domicilio Real separado
  domicilioRealCalle?: string;
  domicilioRealLocalidad?: string;
  domicilioRealDepartamento?: string;
  // Certificaciones y clasificación
  certificacionIso?: string;
  clasificacion?: string;
  // Datos de cumplimiento
  informeTecnico?: string;
  tef?: string;
  libroOperatoria?: boolean;
  // DDJJ
  ddjj2021?: string;
  ddjj2022?: string;
  ddjj2023?: string;
  ddjj2024?: string;
  ddjjAbril2024?: string;
  ddjj2025?: string;
  ddjj2026?: string;
  // Métricas
  residuosR?: string;
  residuosMxR?: string;
  // Control
  cuitValido?: boolean;
  // Relaciones
  usuario?: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    activo: boolean;
    aprobado: boolean;
  };
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

const GeneradorDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [generador, setGenerador] = useState<Generador | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState<Partial<Generador>>({});

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  const cargarGenerador = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/admin-sectorial/generadores/${id}`, {
        headers: getHeaders()
      });
      setGenerador(response.data.data.generador);
      setFormData(response.data.data.generador);
    } catch (err: any) {
      console.error('Error cargando generador:', err);
      setError(err.response?.data?.message || 'Error al cargar el generador');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarGenerador();
  }, [id]);

  const handleGuardar = async () => {
    if (!id || !formData) return;

    setGuardando(true);
    try {
      await axios.put(
        `${API_URL}/admin-sectorial/generadores/${id}`,
        formData,
        { headers: getHeaders() }
      );
      setEditando(false);
      cargarGenerador();
    } catch (err: any) {
      console.error('Error guardando:', err);
      alert(err.response?.data?.message || 'Error al guardar los cambios');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!id) return;

    if (!confirm('¿Estás seguro de eliminar este generador? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/admin-sectorial/generadores/${id}`, {
        headers: getHeaders()
      });
      navigate('/admin/generadores');
    } catch (err: any) {
      console.error('Error eliminando:', err);
      alert(err.response?.data?.message || 'Error al eliminar el generador');
    }
  };

  const handleToggleActivo = async () => {
    if (!id || !generador) return;

    try {
      await axios.put(
        `${API_URL}/admin-sectorial/generadores/${id}`,
        { activo: !generador.activo },
        { headers: getHeaders() }
      );
      cargarGenerador();
    } catch (err: any) {
      console.error('Error cambiando estado:', err);
      alert(err.response?.data?.message || 'Error al cambiar el estado');
    }
  };

  // Helper para formatear domicilio
  const formatDomicilio = (calle?: string, localidad?: string, depto?: string) => {
    const parts = [calle, localidad, depto].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <RefreshCw className="admin-loading-spinner" size={24} />
          <span>Cargando generador...</span>
        </div>
      </div>
    );
  }

  if (error || !generador) {
    return (
      <div className="admin-page">
        <div className="admin-empty-state">
          <AlertTriangle size={48} />
          <p>{error || 'Generador no encontrado'}</p>
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => navigate('/admin/generadores')}
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const domicilioLegal = formatDomicilio(
    generador.domicilioLegalCalle,
    generador.domicilioLegalLocalidad,
    generador.domicilioLegalDepartamento
  );

  const domicilioReal = formatDomicilio(
    generador.domicilioRealCalle,
    generador.domicilioRealLocalidad,
    generador.domicilioRealDepartamento
  );

  return (
    <div className="admin-page">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Link
          to="/admin/generadores"
          style={{
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={14} />
          Generadores
        </Link>
        <span style={{ color: '#475569' }}>/</span>
        <span style={{ color: '#94a3b8' }}>{generador.razonSocial}</span>
      </div>

      {/* Header con título y botones */}
      <div className="admin-detail-header">
        <div className="admin-detail-header-info">
          <div className="admin-detail-header-icon" style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' }}>
            <Building2 size={28} />
          </div>
          <div>
            <h1 className="admin-detail-title">{generador.razonSocial}</h1>
            <div className="admin-detail-subtitle">
              CUIT: <span style={{ fontFamily: 'monospace' }}>{generador.cuit}</span>
              {generador.cuitValido === false && (
                <span style={{
                  marginLeft: '12px',
                  padding: '2px 8px',
                  background: 'rgba(251, 191, 36, 0.15)',
                  color: '#fbbf24',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  CUIT PENDIENTE VERIFICACIÓN
                </span>
              )}
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
              <button
                className={`admin-btn ${generador.activo ? 'admin-btn--warning' : 'admin-btn--success'}`}
                onClick={handleToggleActivo}
              >
                <Power size={16} />
                {generador.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button
                className="admin-btn admin-btn--danger"
                onClick={handleEliminar}
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            </>
          ) : (
            <>
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => {
                  setEditando(false);
                  setFormData(generador);
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
        <AdminBadge variant={generador.activo ? 'success' : 'danger'}>
          {generador.activo ? 'Activo' : 'Inactivo'}
        </AdminBadge>
        {generador.usuario && (
          <AdminBadge variant={generador.usuario.aprobado ? 'success' : 'warning'}>
            Usuario {generador.usuario.aprobado ? 'Aprobado' : 'Pendiente'}
          </AdminBadge>
        )}
        <AdminBadge variant="info">
          {generador._count?.manifiestos || 0} manifiestos
        </AdminBadge>
        {generador.clasificacion && (
          <AdminBadge variant={generador.clasificacion === 'INDIVIDUAL' ? 'warning' : 'neutral'}>
            {generador.clasificacion}
          </AdminBadge>
        )}
        {generador.certificacionIso && (
          <AdminBadge variant="success">
            ISO {generador.certificacionIso}
          </AdminBadge>
        )}
      </div>

      {/* Sección: Datos de Inscripción */}
      {(generador.certificado || generador.expedienteInscripcion || generador.resolucionInscripcion) && (
        <div className="admin-detail-section">
          <h3 className="admin-detail-section-title">
            <Award size={18} style={{ color: '#22d3ee' }} />
            Datos de Inscripción
          </h3>
          <div className="admin-detail-grid">
            {generador.certificado && (
              <div className="admin-detail-field">
                <FileCheck size={16} className="admin-detail-field-icon" style={{ color: '#22d3ee' }} />
                <div>
                  <span className="admin-detail-field-label">Certificado</span>
                  <span className="admin-detail-field-value" style={{ fontFamily: 'monospace', color: '#22d3ee', fontSize: '16px' }}>
                    {generador.certificado}
                  </span>
                </div>
              </div>
            )}
            {generador.expedienteInscripcion && (
              <div className="admin-detail-field">
                <FileText size={16} className="admin-detail-field-icon" />
                <div>
                  <span className="admin-detail-field-label">Expediente de Inscripción</span>
                  <span className="admin-detail-field-value" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                    {generador.expedienteInscripcion}
                  </span>
                </div>
              </div>
            )}
            {generador.resolucionInscripcion && (
              <div className="admin-detail-field">
                <ClipboardList size={16} className="admin-detail-field-icon" />
                <div>
                  <span className="admin-detail-field-label">Resolución de Inscripción</span>
                  <span className="admin-detail-field-value">{generador.resolucionInscripcion}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid principal de información */}
      <div className="perfil-grid">
        {/* Información General */}
        <div className="perfil-section">
          <h2 className="perfil-section-title">
            <Building2 size={20} />
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
                  <label className="admin-label">Email</label>
                  <input
                    type="email"
                    className="admin-input"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="admin-label">N° Inscripción</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.numeroInscripcion || ''}
                    onChange={(e) => setFormData({ ...formData, numeroInscripcion: e.target.value })}
                  />
                </div>
                <div>
                  <label className="admin-label">Categoría (Y-codes)</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.categoria || ''}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    placeholder="Ej: Y8-Y9-Y12-Y48"
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
                      {generador.cuit}
                    </span>
                  </div>
                </div>

                {generador.actividad && (
                  <div className="perfil-field">
                    <Briefcase size={16} className="perfil-field-icon" />
                    <div>
                      <span className="perfil-field-label">Actividad</span>
                      <span className="perfil-field-value">{generador.actividad}</span>
                    </div>
                  </div>
                )}

                {generador.rubro && (
                  <div className="perfil-field">
                    <Factory size={16} className="perfil-field-icon" />
                    <div>
                      <span className="perfil-field-label">Rubro</span>
                      <span className="perfil-field-value">{generador.rubro}</span>
                    </div>
                  </div>
                )}

                <div className="perfil-field">
                  <Phone size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">Teléfono</span>
                    <span className="perfil-field-value">{generador.telefono || 'No registrado'}</span>
                  </div>
                </div>

                <div className="perfil-field">
                  <Mail size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">Email</span>
                    <span className="perfil-field-value">{generador.email || 'No registrado'}</span>
                  </div>
                </div>

                <div className="perfil-field">
                  <FileText size={16} className="perfil-field-icon" />
                  <div>
                    <span className="perfil-field-label">N° de Inscripción</span>
                    <span className="perfil-field-value" style={{ fontFamily: 'monospace', color: '#22d3ee' }}>
                      {generador.numeroInscripcion || 'Sin número'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Usuario Asociado */}
        {generador.usuario && (
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
                    {generador.usuario.nombre} {generador.usuario.apellido}
                  </span>
                </div>
              </div>
              <div className="perfil-field">
                <Mail size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Email de acceso</span>
                  <span className="perfil-field-value" style={{ wordBreak: 'break-all' }}>
                    {generador.usuario.email}
                  </span>
                </div>
              </div>
              <div className="perfil-field">
                <CheckCircle size={16} className="perfil-field-icon" />
                <div>
                  <span className="perfil-field-label">Estado de aprobación</span>
                  <span
                    className="perfil-field-value"
                    style={{ color: generador.usuario.aprobado ? '#34d399' : '#fbbf24' }}
                  >
                    {generador.usuario.aprobado ? 'Aprobado' : 'Pendiente de aprobación'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sección: Domicilios */}
      {(domicilioLegal || domicilioReal || generador.latitud) && (
        <div className="admin-detail-section" style={{ marginTop: '24px' }}>
          <h3 className="admin-detail-section-title">
            <MapPinned size={18} style={{ color: '#a78bfa' }} />
            Domicilios
          </h3>
          <div className="admin-detail-grid">
            <div className="admin-detail-field">
              <Building2 size={16} className="admin-detail-field-icon" />
              <div>
                <span className="admin-detail-field-label">Domicilio Legal</span>
                <span className="admin-detail-field-value">{domicilioLegal || generador.domicilio}</span>
              </div>
            </div>

            {domicilioReal && domicilioReal !== domicilioLegal && (
              <div className="admin-detail-field">
                <MapPin size={16} className="admin-detail-field-icon" />
                <div>
                  <span className="admin-detail-field-label">Domicilio Real</span>
                  <span className="admin-detail-field-value">{domicilioReal}</span>
                </div>
              </div>
            )}

            {generador.latitud && generador.longitud && (
              <div className="admin-detail-field">
                <MapPin size={16} className="admin-detail-field-icon" style={{ color: '#a78bfa' }} />
                <div>
                  <span className="admin-detail-field-label">Coordenadas GPS</span>
                  <span className="admin-detail-field-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {generador.latitud.toFixed(6)}, {generador.longitud.toFixed(6)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sección: Cumplimiento Normativo */}
      {(generador.libroOperatoria !== undefined || generador.tef || generador.ddjj2024 || generador.ddjj2025 || generador.residuosR) && (
        <div className="admin-detail-section" style={{ marginTop: '24px' }}>
          <h3 className="admin-detail-section-title">
            <BookOpen size={18} style={{ color: '#4ade80' }} />
            Cumplimiento Normativo
          </h3>
          <div className="admin-detail-grid">
            {generador.libroOperatoria !== undefined && (
              <div className="admin-detail-field">
                <BookOpen size={16} className="admin-detail-field-icon" style={{ color: generador.libroOperatoria ? '#34d399' : '#f87171' }} />
                <div>
                  <span className="admin-detail-field-label">Libro de Operatoria</span>
                  <span className="admin-detail-field-value" style={{ color: generador.libroOperatoria ? '#34d399' : '#f87171' }}>
                    {generador.libroOperatoria ? 'SI' : 'NO'}
                  </span>
                </div>
              </div>
            )}

            {generador.tef && (
              <div className="admin-detail-field">
                <FileText size={16} className="admin-detail-field-icon" />
                <div>
                  <span className="admin-detail-field-label">TEF 2025</span>
                  <span className="admin-detail-field-value" style={{ fontFamily: 'monospace' }}>{generador.tef}</span>
                </div>
              </div>
            )}

            {(generador.residuosR || generador.residuosMxR) && (
              <div className="admin-detail-field">
                <AlertTriangle size={16} className="admin-detail-field-icon" style={{ color: '#fbbf24' }} />
                <div>
                  <span className="admin-detail-field-label">Métricas de Residuos</span>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {generador.residuosR && (
                      <span className="admin-detail-field-value">
                        <strong style={{ color: '#fbbf24' }}>R:</strong> {generador.residuosR}
                      </span>
                    )}
                    {generador.residuosMxR && (
                      <span className="admin-detail-field-value">
                        <strong style={{ color: '#fbbf24' }}>M×R:</strong> {generador.residuosMxR}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(generador.ddjj2025 || generador.ddjj2024 || generador.ddjj2023) && (
              <div className="admin-detail-field">
                <ClipboardList size={16} className="admin-detail-field-icon" />
                <div>
                  <span className="admin-detail-field-label">Declaraciones Juradas</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {generador.ddjj2025 && (
                      <span style={{
                        padding: '2px 8px',
                        background: 'rgba(34, 211, 238, 0.15)',
                        color: '#22d3ee',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        2025: {generador.ddjj2025}
                      </span>
                    )}
                    {generador.ddjj2024 && (
                      <span style={{
                        padding: '2px 8px',
                        background: 'rgba(100, 116, 139, 0.15)',
                        color: '#94a3b8',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        2024: {generador.ddjj2024}
                      </span>
                    )}
                    {generador.ddjj2023 && (
                      <span style={{
                        padding: '2px 8px',
                        background: 'rgba(100, 116, 139, 0.1)',
                        color: '#64748b',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        2023: {generador.ddjj2023}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Categorías Autorizadas */}
      <div className="actor-profile" style={{ marginTop: '24px' }}>
        <div className="actor-profile-header" style={{ borderLeft: '3px solid #fbbf24' }}>
          <AlertTriangle size={20} style={{ color: '#fbbf24' }} />
          <h2>Categorías Autorizadas de Residuos</h2>
        </div>
        <div className="actor-profile-content">
          {generador.categoria ? (
            <>
              <div style={{ marginBottom: '16px' }}>
                <CategoriaBadges
                  categorias={generador.categoria}
                  showPeligrosidad={true}
                  maxVisible={15}
                  size="md"
                />
              </div>
              <CategoriasDetalle categorias={generador.categoria} />
            </>
          ) : (
            <div style={{
              padding: '24px',
              background: 'rgba(100, 116, 139, 0.1)',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <AlertTriangle size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No hay categorías de residuos asignadas</p>
            </div>
          )}
        </div>
      </div>

      {/* Historial de Manifiestos */}
      {generador.manifiestos && generador.manifiestos.length > 0 && (
        <div className="actor-profile" style={{ marginTop: '24px' }}>
          <div className="actor-profile-header" style={{ borderLeft: '3px solid #22d3ee' }}>
            <FileText size={20} style={{ color: '#22d3ee' }} />
            <h2>Últimos Manifiestos</h2>
          </div>
          <div className="actor-profile-content">
            <div className="tratamientos-list">
              {generador.manifiestos.slice(0, 10).map((manifiesto) => (
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
                    style={{ color: '#22d3ee', marginLeft: '8px' }}
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

export default GeneradorDetalle;
