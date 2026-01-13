import React, { useState, useEffect } from 'react';
import { UserCheck, UserX, Clock, Building, Mail, Phone, AlertCircle, RefreshCw } from 'lucide-react';
import './AprobacionUsuarios.css';

const API_URL = import.meta.env.VITE_API_URL || '';

interface UsuarioPendiente {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  rol: string;
  empresa?: string;
  cuit?: string;
  telefono?: string;
  fechaSolicitud: string;
  motivoSolicitud?: string;
}

const AprobacionUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [modalRechazo, setModalRechazo] = useState<string | null>(null);

  const token = localStorage.getItem('accessToken');

  const fetchPendientes = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/admin/usuarios/pendientes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Error del servidor');

      setUsuarios(data?.data?.pendientes || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendientes();
  }, []);

  const aprobar = async (id: string) => {
    setProcesando(id);
    try {
      const response = await fetch(`${API_URL}/admin/usuarios/${id}/aprobar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      
      setUsuarios(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  };

  const rechazar = async (id: string) => {
    setProcesando(id);
    try {
      const response = await fetch(`${API_URL}/admin/usuarios/${id}/rechazar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ motivo: motivoRechazo }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      
      setUsuarios(prev => prev.filter(u => u.id !== id));
      setModalRechazo(null);
      setMotivoRechazo('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  };

  const getRolLabel = (rol: string) => {
    const labels: Record<string, string> = {
      GENERADOR: 'Generador',
      TRANSPORTISTA: 'Transportista',
      OPERADOR: 'Operador',
      ADMIN: 'Administrador',
    };
    return labels[rol] || rol;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="aprobacion-container">
      <div className="page-header">
        <div>
          <h1>Aprobación de Usuarios</h1>
          <p>Gestione las solicitudes de acceso al sistema</p>
        </div>
        <button className="btn-refresh" onClick={fetchPendientes} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loader"></div>
          <p>Cargando solicitudes...</p>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="empty-state">
          <UserCheck size={64} />
          <h3>No hay solicitudes pendientes</h3>
          <p>Todas las solicitudes de acceso han sido procesadas</p>
        </div>
      ) : (
        <div className="usuarios-grid">
          {usuarios.map(usuario => (
            <div key={usuario.id} className="usuario-card">
              <div className="card-header">
                <div className="user-avatar">
                  {usuario.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <h3>{usuario.nombre} {usuario.apellido}</h3>
                  <span className={`rol-badge ${usuario.rol.toLowerCase()}`}>
                    {getRolLabel(usuario.rol)}
                  </span>
                </div>
              </div>

              <div className="card-body">
                <div className="info-row">
                  <Mail size={16} />
                  <span>{usuario.email}</span>
                </div>
                {usuario.empresa && (
                  <div className="info-row">
                    <Building size={16} />
                    <span>{usuario.empresa}</span>
                  </div>
                )}
                {usuario.telefono && (
                  <div className="info-row">
                    <Phone size={16} />
                    <span>{usuario.telefono}</span>
                  </div>
                )}
                {usuario.cuit && (
                  <div className="info-row">
                    <span className="label">CUIT:</span>
                    <span>{usuario.cuit}</span>
                  </div>
                )}
                <div className="info-row">
                  <Clock size={16} />
                  <span>{formatDate(usuario.fechaSolicitud)}</span>
                </div>
                {usuario.motivoSolicitud && (
                  <div className="motivo">
                    <strong>Motivo:</strong>
                    <p>{usuario.motivoSolicitud}</p>
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="btn-aprobar"
                  onClick={() => aprobar(usuario.id)}
                  disabled={procesando === usuario.id}
                >
                  <UserCheck size={18} />
                  Aprobar
                </button>
                <button
                  className="btn-rechazar"
                  onClick={() => setModalRechazo(usuario.id)}
                  disabled={procesando === usuario.id}
                >
                  <UserX size={18} />
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de rechazo */}
      {modalRechazo && (
        <div className="modal-overlay" onClick={() => setModalRechazo(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Rechazar Solicitud</h3>
            <p>Indique el motivo del rechazo (opcional):</p>
            <textarea
              value={motivoRechazo}
              onChange={e => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo..."
              rows={3}
            />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setModalRechazo(null)}>
                Cancelar
              </button>
              <button
                className="btn-confirm-reject"
                onClick={() => rechazar(modalRechazo)}
                disabled={procesando === modalRechazo}
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AprobacionUsuarios;
