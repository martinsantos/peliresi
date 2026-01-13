/**
 * TransportistaModal - Modal de confirmación para Transportista
 * Acciones: Confirmar Retiro (inicio viaje) o Confirmar Entrega (fin viaje)
 */

import React, { useState } from 'react';
import { X, Truck, MapPin, Package, Clock, Check, AlertTriangle } from 'lucide-react';
import SignaturePad from '../SignaturePad';
import CameraCapture from './CameraCapture';
import './TransportistaModal.css';

type ModalAction = 'retiro' | 'entrega';

interface ManifiestoInfo {
    id: string;
    numero: string;
    estado?: string;
    generador?: { razonSocial: string };
    operador?: { razonSocial: string };
    tipoResiduo?: string;
    pesoKg?: number;
    direccionOrigen?: string;
    direccionDestino?: string;
}

interface TransportistaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        action: ModalAction;
        firma: string;
        observaciones?: string;
        fotoEvidencia?: string;
        ubicacion?: { lat: number; lng: number };
    }) => Promise<void>;
    manifiesto: ManifiestoInfo;
    action: ModalAction;
    ubicacionActual?: { lat: number; lng: number };
}

const TransportistaModal: React.FC<TransportistaModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    manifiesto,
    action,
    ubicacionActual
}) => {
    const [firma, setFirma] = useState<string | null>(null);
    const [observaciones, setObservaciones] = useState('');
    const [fotoEvidencia, setFotoEvidencia] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const isRetiro = action === 'retiro';
    const title = isRetiro ? 'Confirmar Retiro' : 'Confirmar Entrega';
    const subtitle = isRetiro
        ? 'Confirme que ha retirado la carga del generador'
        : 'Confirme que ha entregado la carga al operador';
    const destinatario = isRetiro
        ? manifiesto.generador?.razonSocial
        : manifiesto.operador?.razonSocial;
    const direccion = isRetiro
        ? manifiesto.direccionOrigen
        : manifiesto.direccionDestino;

    const handleSubmit = async () => {
        if (!firma) {
            setError('Debe firmar para confirmar');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onConfirm({
                action,
                firma,
                observaciones: observaciones || undefined,
                fotoEvidencia: fotoEvidencia || undefined,
                ubicacion: ubicacionActual
            });
            resetState();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al confirmar');
        } finally {
            setSubmitting(false);
        }
    };

    const resetState = () => {
        setFirma(null);
        setObservaciones('');
        setFotoEvidencia(null);
        setError(null);
    };

    const handleClose = () => {
        if (!submitting) {
            resetState();
            onClose();
        }
    };

    // Captura de foto real con cámara
    const handleFotoCapturada = (imageData: string) => {
        setFotoEvidencia(imageData);
    };

    return (
        <div className="transportista-modal-overlay" onClick={handleClose}>
            <div className="transportista-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={`transportista-header ${isRetiro ? 'retiro' : 'entrega'}`}>
                    <div className="header-icon">
                        {isRetiro ? <Package size={24} /> : <Truck size={24} />}
                    </div>
                    <div className="header-content">
                        <h2>{title}</h2>
                        <p>{subtitle}</p>
                    </div>
                    <button className="close-btn" onClick={handleClose} disabled={submitting}>
                        <X size={24} />
                    </button>
                </div>

                {/* Info del Manifiesto */}
                <div className="manifiesto-info">
                    <div className="info-row main">
                        <span className="numero">#{manifiesto.numero}</span>
                        <span className="estado">{manifiesto.estado}</span>
                    </div>
                    <div className="info-row">
                        <MapPin size={16} />
                        <span className="label">{isRetiro ? 'Origen' : 'Destino'}:</span>
                        <span className="value">{destinatario || 'N/A'}</span>
                    </div>
                    {direccion && (
                        <div className="info-row direccion">
                            <span>{direccion}</span>
                        </div>
                    )}
                    <div className="info-row">
                        <Package size={16} />
                        <span className="label">Residuo:</span>
                        <span className="value">{manifiesto.tipoResiduo || 'N/A'}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">Peso:</span>
                        <span className="value highlight">{manifiesto.pesoKg?.toLocaleString() || 0} kg</span>
                    </div>
                </div>

                {/* Ubicación Actual */}
                {ubicacionActual && (
                    <div className="ubicacion-actual">
                        <MapPin size={16} />
                        <span>Ubicación registrada</span>
                        <span className="coords">
                            {ubicacionActual.lat.toFixed(4)}, {ubicacionActual.lng.toFixed(4)}
                        </span>
                    </div>
                )}

                {/* Foto Evidencia (Opcional) */}
                <div className="evidencia-section">
                    <label>Foto de Evidencia (opcional)</label>
                    {fotoEvidencia ? (
                        <div className="foto-preview">
                            <img src={fotoEvidencia} alt="Evidencia" />
                            <button onClick={() => setFotoEvidencia(null)}>Cambiar</button>
                        </div>
                    ) : (
                        <CameraCapture
                            onCapture={handleFotoCapturada}
                            label="Capturar Evidencia"
                            maxWidth={1024}
                            quality={0.75}
                        />
                    )}
                </div>

                {/* Observaciones */}
                <div className="observaciones-section">
                    <label>Observaciones (opcional)</label>
                    <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder={isRetiro
                            ? "Notas sobre el estado de la carga al momento del retiro..."
                            : "Notas sobre la entrega realizada..."
                        }
                        rows={2}
                    />
                </div>

                {/* Firma */}
                <div className="firma-section">
                    {!firma ? (
                        <SignaturePad
                            onConfirm={(sig) => setFirma(sig)}
                            title={isRetiro ? "Firma de Retiro" : "Firma de Entrega"}
                            subtitle={isRetiro
                                ? "Confirmo haber retirado la carga"
                                : "Confirmo haber entregado la carga"
                            }
                        />
                    ) : (
                        <div className="firma-preview">
                            <div className="preview-header">
                                <Check size={18} />
                                <span>Firma capturada</span>
                                <button onClick={() => setFirma(null)}>Cambiar</button>
                            </div>
                            <img src={firma} alt="Firma" />
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="transportista-error">
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="transportista-actions">
                    <button
                        className="btn btn-ghost"
                        onClick={handleClose}
                        disabled={submitting}
                    >
                        Cancelar
                    </button>
                    <button
                        className={`btn ${isRetiro ? 'btn-retiro' : 'btn-entrega'}`}
                        onClick={handleSubmit}
                        disabled={!firma || submitting}
                    >
                        {submitting ? (
                            <>
                                <span className="spinner" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                {isRetiro ? 'Confirmar Retiro' : 'Confirmar Entrega'}
                            </>
                        )}
                    </button>
                </div>

                {/* Timestamp */}
                <div className="timestamp-footer">
                    <Clock size={14} />
                    <span>{new Date().toLocaleString('es-AR')}</span>
                </div>
            </div>
        </div>
    );
};

export default TransportistaModal;
