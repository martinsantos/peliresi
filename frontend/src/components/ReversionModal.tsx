import React, { useState } from 'react';
import { X, AlertTriangle, RotateCcw, History } from 'lucide-react';
import axios from 'axios';
import './ReversionModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface ReversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  manifiestoId: string;
  manifiestoNumero: string;
  estadoActual: string;
  tipoReversion: 'entrega' | 'recepcion' | 'certificado' | 'admin';
  estadoDestino?: string;
}

interface HistorialReversion {
  id: string;
  estadoAnterior: string;
  estadoNuevo: string;
  motivo: string;
  tipoReversion: string;
  rolUsuario: string;
  createdAt: string;
  usuario: {
    nombre: string;
    apellido: string;
    email: string;
  };
}

const ReversionModal: React.FC<ReversionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  manifiestoId,
  manifiestoNumero,
  estadoActual,
  tipoReversion,
  estadoDestino
}) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialReversion[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  const getTitulo = () => {
    switch (tipoReversion) {
      case 'entrega':
        return 'Revertir Entrega';
      case 'recepcion':
        return 'Rechazar Recepcion';
      case 'certificado':
        return 'Revertir Certificado';
      case 'admin':
        return 'Revertir Estado (Admin)';
      default:
        return 'Revertir Estado';
    }
  };

  const getDescripcion = () => {
    switch (tipoReversion) {
      case 'entrega':
        return `El manifiesto volvera a estado EN_TRANSITO. Use esta opcion si el operador rechazo la carga.`;
      case 'recepcion':
        return `El manifiesto volvera a estado ENTREGADO. Use esta opcion si hubo un error en la recepcion.`;
      case 'certificado':
        return `El manifiesto volvera a un estado anterior para corregir el certificado o tratamiento.`;
      case 'admin':
        return `Como administrador, puede revertir el manifiesto a ${estadoDestino || 'cualquier estado anterior'}.`;
      default:
        return '';
    }
  };

  const getEndpoint = () => {
    switch (tipoReversion) {
      case 'entrega':
        return `${API_URL}/manifiestos/${manifiestoId}/revertir-entrega`;
      case 'recepcion':
        return `${API_URL}/manifiestos/${manifiestoId}/rechazar-recepcion`;
      case 'certificado':
        return `${API_URL}/manifiestos/${manifiestoId}/revertir-certificado`;
      case 'admin':
        return `${API_URL}/manifiestos/${manifiestoId}/revertir-estado`;
      default:
        return '';
    }
  };

  const cargarHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const response = await axios.get(
        `${API_URL}/manifiestos/${manifiestoId}/reversiones`,
        { headers: getHeaders() }
      );
      setHistorial(response.data.data.reversiones || []);
      setShowHistorial(true);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (motivo.trim().length < 20) {
      setError('El motivo debe tener al menos 20 caracteres');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: any = { motivo: motivo.trim() };
      if (tipoReversion === 'admin' && estadoDestino) {
        body.estadoNuevo = estadoDestino;
      }

      await axios.post(getEndpoint(), body, { headers: getHeaders() });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al revertir el estado');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="reversion-modal-overlay" onClick={onClose}>
      <div className="reversion-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reversion-modal-header">
          <div className="reversion-modal-title">
            <AlertTriangle className="icon-warning" />
            <h2>{getTitulo()}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="reversion-modal-body">
          <div className="reversion-info">
            <div className="info-row">
              <span className="label">Manifiesto:</span>
              <span className="value">{manifiestoNumero}</span>
            </div>
            <div className="info-row">
              <span className="label">Estado Actual:</span>
              <span className="value estado-badge">{estadoActual}</span>
            </div>
            {estadoDestino && (
              <div className="info-row">
                <span className="label">Estado Destino:</span>
                <span className="value estado-badge destino">{estadoDestino}</span>
              </div>
            )}
          </div>

          <div className="reversion-warning">
            <AlertTriangle size={16} />
            <p>{getDescripcion()}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="motivo">
                Motivo de la Reversion <span className="required">*</span>
              </label>
              <textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explique detalladamente el motivo de esta reversion (minimo 20 caracteres)..."
                rows={4}
                required
                minLength={20}
              />
              <span className="char-count">
                {motivo.length}/20 caracteres minimos
                {motivo.length >= 20 && <span className="valid"> (Valido)</span>}
              </span>
            </div>

            {error && (
              <div className="error-message">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn-historial"
                onClick={cargarHistorial}
                disabled={loadingHistorial}
              >
                <History size={16} />
                {loadingHistorial ? 'Cargando...' : 'Ver Historial'}
              </button>

              <div className="action-buttons">
                <button type="button" className="btn-cancel" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-revert"
                  disabled={loading || motivo.trim().length < 20}
                >
                  <RotateCcw size={16} />
                  {loading ? 'Procesando...' : 'Confirmar Reversion'}
                </button>
              </div>
            </div>
          </form>

          {showHistorial && historial.length > 0 && (
            <div className="historial-section">
              <h3>Historial de Reversiones</h3>
              <div className="historial-list">
                {historial.map((rev) => (
                  <div key={rev.id} className="historial-item">
                    <div className="historial-header">
                      <span className="tipo-badge">{rev.tipoReversion}</span>
                      <span className="fecha">
                        {new Date(rev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="historial-estados">
                      <span className="estado-anterior">{rev.estadoAnterior}</span>
                      <span className="arrow">→</span>
                      <span className="estado-nuevo">{rev.estadoNuevo}</span>
                    </div>
                    <p className="historial-motivo">{rev.motivo}</p>
                    <span className="historial-usuario">
                      Por: {rev.usuario.nombre} {rev.usuario.apellido} ({rev.rolUsuario})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showHistorial && historial.length === 0 && (
            <div className="historial-empty">
              No hay reversiones anteriores para este manifiesto.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReversionModal;
