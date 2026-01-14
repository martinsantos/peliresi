/**
 * RechazoModal - Flujo de rechazo de carga para Operador
 * CU-O05: Rechazar carga (total o parcial)
 * Pasos: 1. Seleccionar motivo → 2. Detallar rechazo → 3. Firmar
 */

import React, { useState } from 'react';
import { X, AlertTriangle, FileText, Pen, Check, ChevronRight, ChevronLeft, XCircle } from 'lucide-react';
import SignaturePad from '../SignaturePad';
import './RechazoModal.css';

interface ManifiestoInfo {
    id: string;
    numero: string;
    generador?: { razonSocial: string };
    transportista?: { razonSocial: string };
    tipoResiduo?: string;
    pesoKg?: number;
    residuos?: Array<{
        id: string;
        tipoResiduo?: { nombre: string };
        cantidad: number;
        unidad: string;
    }>;
}

interface RechazoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        motivo: string;
        descripcion: string;
        cantidadRechazada?: number;
        esRechazoTotal: boolean;
        firma: string;
    }) => Promise<void>;
    manifiesto: ManifiestoInfo;
}

type Step = 'motivo' | 'detalle' | 'firma';

const MOTIVOS_RECHAZO = [
    { id: 'DOCUMENTACION_INCORRECTA', label: 'Documentación incorrecta o incompleta' },
    { id: 'RESIDUO_NO_COINCIDE', label: 'Residuo no coincide con lo declarado' },
    { id: 'CANTIDAD_EXCEDE', label: 'Cantidad excede lo autorizado' },
    { id: 'EMBALAJE_DEFICIENTE', label: 'Embalaje deficiente o dañado' },
    { id: 'CONDICIONES_PELIGROSAS', label: 'Condiciones de transporte peligrosas' },
    { id: 'SIN_CAPACIDAD', label: 'Sin capacidad de tratamiento actual' },
    { id: 'OTRO', label: 'Otro motivo (especificar)' },
];

const RechazoModal: React.FC<RechazoModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    manifiesto
}) => {
    const [currentStep, setCurrentStep] = useState<Step>('motivo');
    const [motivoSeleccionado, setMotivoSeleccionado] = useState<string>('');
    const [descripcion, setDescripcion] = useState('');
    const [esRechazoTotal, setEsRechazoTotal] = useState(true);
    const [cantidadRechazada, setCantidadRechazada] = useState<string>('');
    const [firma, setFirma] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const pesoDeclarado = manifiesto.pesoKg || manifiesto.residuos?.[0]?.cantidad || 0;
    const cantidadRechazadaNum = parseFloat(cantidadRechazada) || 0;

    const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
        { id: 'motivo', label: 'Motivo', icon: <AlertTriangle size={18} /> },
        { id: 'detalle', label: 'Detalle', icon: <FileText size={18} /> },
        { id: 'firma', label: 'Firmar', icon: <Pen size={18} /> },
    ];

    const handleNext = () => {
        if (currentStep === 'motivo') {
            if (!motivoSeleccionado) {
                setError('Seleccione un motivo de rechazo');
                return;
            }
            setError(null);
            setCurrentStep('detalle');
        } else if (currentStep === 'detalle') {
            if (!descripcion.trim()) {
                setError('Describa el motivo del rechazo');
                return;
            }
            if (!esRechazoTotal && (!cantidadRechazada || cantidadRechazadaNum <= 0)) {
                setError('Indique la cantidad rechazada');
                return;
            }
            setError(null);
            setCurrentStep('firma');
        }
    };

    const handleBack = () => {
        if (currentStep === 'detalle') {
            setCurrentStep('motivo');
        } else if (currentStep === 'firma') {
            setCurrentStep('detalle');
        }
    };

    const handleSubmit = async () => {
        if (!firma) {
            setError('Debe firmar para confirmar el rechazo');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onConfirm({
                motivo: motivoSeleccionado,
                descripcion,
                cantidadRechazada: esRechazoTotal ? undefined : cantidadRechazadaNum,
                esRechazoTotal,
                firma
            });
            resetState();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al registrar rechazo');
        } finally {
            setSubmitting(false);
        }
    };

    const resetState = () => {
        setCurrentStep('motivo');
        setMotivoSeleccionado('');
        setDescripcion('');
        setEsRechazoTotal(true);
        setCantidadRechazada('');
        setFirma(null);
        setError(null);
    };

    const handleClose = () => {
        if (!submitting) {
            resetState();
            onClose();
        }
    };

    const getMotivoLabel = (id: string) => {
        return MOTIVOS_RECHAZO.find(m => m.id === id)?.label || id;
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 'motivo':
                return (
                    <div className="step-content motivo">
                        <h3>Motivo del Rechazo</h3>
                        <div className="manifiesto-info-compact">
                            <XCircle size={20} />
                            <span>Manifiesto #{manifiesto.numero}</span>
                        </div>
                        <div className="motivos-list">
                            {MOTIVOS_RECHAZO.map((motivo) => (
                                <button
                                    key={motivo.id}
                                    className={`motivo-option ${motivoSeleccionado === motivo.id ? 'selected' : ''}`}
                                    onClick={() => setMotivoSeleccionado(motivo.id)}
                                >
                                    <div className="motivo-radio">
                                        {motivoSeleccionado === motivo.id && <Check size={14} />}
                                    </div>
                                    <span>{motivo.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'detalle':
                return (
                    <div className="step-content detalle">
                        <h3>Detalle del Rechazo</h3>

                        <div className="motivo-selected-box">
                            <AlertTriangle size={18} />
                            <span>{getMotivoLabel(motivoSeleccionado)}</span>
                        </div>

                        <div className="rechazo-tipo-selector">
                            <button
                                className={`tipo-btn ${esRechazoTotal ? 'selected' : ''}`}
                                onClick={() => setEsRechazoTotal(true)}
                            >
                                <XCircle size={18} />
                                <span>Rechazo Total</span>
                            </button>
                            <button
                                className={`tipo-btn ${!esRechazoTotal ? 'selected' : ''}`}
                                onClick={() => setEsRechazoTotal(false)}
                            >
                                <AlertTriangle size={18} />
                                <span>Rechazo Parcial</span>
                            </button>
                        </div>

                        {!esRechazoTotal && (
                            <div className="cantidad-rechazo">
                                <label>Cantidad Rechazada (de {pesoDeclarado} kg declarados)</label>
                                <div className="cantidad-input-wrapper">
                                    <input
                                        type="number"
                                        value={cantidadRechazada}
                                        onChange={(e) => setCantidadRechazada(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        max={pesoDeclarado}
                                        step="0.1"
                                    />
                                    <span className="unit">kg</span>
                                </div>
                            </div>
                        )}

                        <div className="descripcion-rechazo">
                            <label>Descripción detallada del rechazo *</label>
                            <textarea
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                placeholder="Describa en detalle el motivo del rechazo, incluyendo observaciones sobre el estado de la carga, documentación, etc."
                                rows={4}
                            />
                        </div>
                    </div>
                );

            case 'firma':
                return (
                    <div className="step-content firma">
                        <h3>Confirmar Rechazo</h3>

                        <div className="resumen-rechazo">
                            <div className="resumen-header">
                                <XCircle size={24} />
                                <span>Rechazo {esRechazoTotal ? 'Total' : 'Parcial'}</span>
                            </div>
                            <div className="resumen-items">
                                <div className="resumen-item">
                                    <span className="label">Manifiesto</span>
                                    <span className="value">#{manifiesto.numero}</span>
                                </div>
                                <div className="resumen-item">
                                    <span className="label">Generador</span>
                                    <span className="value">{manifiesto.generador?.razonSocial || 'N/A'}</span>
                                </div>
                                <div className="resumen-item">
                                    <span className="label">Motivo</span>
                                    <span className="value">{getMotivoLabel(motivoSeleccionado)}</span>
                                </div>
                                {!esRechazoTotal && (
                                    <div className="resumen-item highlight">
                                        <span className="label">Cantidad Rechazada</span>
                                        <span className="value">{cantidadRechazadaNum} kg de {pesoDeclarado} kg</span>
                                    </div>
                                )}
                                <div className="resumen-item descripcion">
                                    <span className="label">Descripción</span>
                                    <span className="value">{descripcion}</span>
                                </div>
                            </div>
                        </div>

                        <div className="firma-warning">
                            <AlertTriangle size={18} />
                            <span>Esta acción notificará al generador y transportista sobre el rechazo</span>
                        </div>

                        {!firma ? (
                            <SignaturePad
                                onConfirm={(sig) => setFirma(sig)}
                                title="Firma de Rechazo"
                                subtitle="Confirmo el rechazo de la carga"
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
                );
        }
    };

    return (
        <div className="rechazo-modal-overlay" onClick={handleClose}>
            <div className="rechazo-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="rechazo-header">
                    <h2>Rechazar Carga</h2>
                    <button className="close-btn" onClick={handleClose} disabled={submitting}>
                        <X size={24} />
                    </button>
                </div>

                {/* Steps indicator */}
                <div className="steps-indicator">
                    {steps.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`step ${currentStep === step.id ? 'active' : ''} ${
                                steps.findIndex(s => s.id === currentStep) > index ? 'completed' : ''
                            }`}>
                                <div className="step-icon">{step.icon}</div>
                                <span className="step-label">{step.label}</span>
                            </div>
                            {index < steps.length - 1 && <div className="step-line" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="rechazo-content">
                    {renderStepContent()}
                </div>

                {/* Error */}
                {error && (
                    <div className="rechazo-error">
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="rechazo-actions">
                    {currentStep !== 'motivo' && (
                        <button
                            className="btn btn-ghost"
                            onClick={handleBack}
                            disabled={submitting}
                        >
                            <ChevronLeft size={18} />
                            Atrás
                        </button>
                    )}

                    {currentStep === 'motivo' && (
                        <button className="btn btn-ghost" onClick={handleClose}>
                            Cancelar
                        </button>
                    )}

                    {currentStep !== 'firma' ? (
                        <button
                            className="btn btn-primary"
                            onClick={handleNext}
                        >
                            Continuar
                            <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button
                            className="btn btn-danger"
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
                                    <XCircle size={18} />
                                    Confirmar Rechazo
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RechazoModal;
