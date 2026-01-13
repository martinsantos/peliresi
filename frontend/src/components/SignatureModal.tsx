/**
 * SignatureModal - Modal reutilizable para firma de manifiestos
 * Usado en: confirmar retiro, confirmar entrega, confirmar recepción
 */

import React, { useState } from 'react';
import { X, FileText, MapPin, Clock, AlertCircle } from 'lucide-react';
import SignaturePad from './SignaturePad';
import './SignatureModal.css';

interface ManifiestoInfo {
    id: string;
    numero: string;
    estado?: string;
    generador?: { razonSocial: string };
    transportista?: { razonSocial: string };
    operador?: { razonSocial: string };
    tipoResiduo?: string;
    pesoKg?: number;
}

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (signatureBase64: string, observaciones?: string) => Promise<void>;
    manifiesto: ManifiestoInfo;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    showObservaciones?: boolean;
    loading?: boolean;
}

const SignatureModal: React.FC<SignatureModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    manifiesto,
    title,
    subtitle,
    actionLabel = 'Confirmar con Firma',
    showObservaciones = true,
    loading = false
}) => {
    const [signature, setSignature] = useState<string | null>(null);
    const [observaciones, setObservaciones] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSignatureConfirm = (signatureBase64: string) => {
        setSignature(signatureBase64);
        setError(null);
    };

    const handleSubmit = async () => {
        if (!signature) {
            setError('Debe firmar para continuar');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onConfirm(signature, observaciones || undefined);
            // Reset state on success
            setSignature(null);
            setObservaciones('');
        } catch (err: any) {
            setError(err.message || 'Error al procesar la firma');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!submitting) {
            setSignature(null);
            setObservaciones('');
            setError(null);
            onClose();
        }
    };

    return (
        <div className="signature-modal-overlay" onClick={handleClose}>
            <div className="signature-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="signature-modal-header">
                    <div className="header-content">
                        <h2>{title}</h2>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button
                        className="close-btn"
                        onClick={handleClose}
                        disabled={submitting}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Manifiesto Info */}
                <div className="manifiesto-summary">
                    <div className="summary-header">
                        <FileText size={20} />
                        <span className="manifiesto-numero">#{manifiesto.numero}</span>
                        {manifiesto.estado && (
                            <span className={`estado-badge ${manifiesto.estado.toLowerCase()}`}>
                                {manifiesto.estado}
                            </span>
                        )}
                    </div>

                    <div className="summary-details">
                        {manifiesto.generador && (
                            <div className="detail-row">
                                <span className="label">Generador:</span>
                                <span className="value">{manifiesto.generador.razonSocial}</span>
                            </div>
                        )}
                        {manifiesto.transportista && (
                            <div className="detail-row">
                                <span className="label">Transportista:</span>
                                <span className="value">{manifiesto.transportista.razonSocial}</span>
                            </div>
                        )}
                        {manifiesto.operador && (
                            <div className="detail-row">
                                <span className="label">Operador:</span>
                                <span className="value">{manifiesto.operador.razonSocial}</span>
                            </div>
                        )}
                        {manifiesto.tipoResiduo && (
                            <div className="detail-row">
                                <span className="label">Residuo:</span>
                                <span className="value">{manifiesto.tipoResiduo}</span>
                            </div>
                        )}
                        {manifiesto.pesoKg && (
                            <div className="detail-row">
                                <span className="label">Peso:</span>
                                <span className="value">{manifiesto.pesoKg.toLocaleString()} kg</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Signature Area */}
                <div className="signature-area">
                    {!signature ? (
                        <SignaturePad
                            onConfirm={handleSignatureConfirm}
                            title="Firma Digital"
                            subtitle="Firme en el área blanca para confirmar"
                        />
                    ) : (
                        <div className="signature-preview">
                            <div className="preview-header">
                                <span>Firma capturada</span>
                                <button
                                    className="change-signature-btn"
                                    onClick={() => setSignature(null)}
                                    disabled={submitting}
                                >
                                    Cambiar firma
                                </button>
                            </div>
                            <img src={signature} alt="Firma" className="signature-image" />
                        </div>
                    )}
                </div>

                {/* Observaciones */}
                {showObservaciones && (
                    <div className="observaciones-section">
                        <label htmlFor="observaciones">Observaciones (opcional)</label>
                        <textarea
                            id="observaciones"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Ingrese observaciones adicionales..."
                            rows={3}
                            disabled={submitting}
                        />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="error-message">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="signature-modal-actions">
                    <button
                        className="btn btn-ghost"
                        onClick={handleClose}
                        disabled={submitting}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={!signature || submitting || loading}
                    >
                        {submitting ? (
                            <>
                                <span className="spinner-small" />
                                Procesando...
                            </>
                        ) : (
                            actionLabel
                        )}
                    </button>
                </div>

                {/* Timestamp */}
                <div className="signature-timestamp">
                    <Clock size={14} />
                    <span>{new Date().toLocaleString('es-AR')}</span>
                    <MapPin size={14} />
                    <span>Ubicación GPS activa</span>
                </div>
            </div>
        </div>
    );
};

export default SignatureModal;
