/**
 * TratamientoModal - Registro de tratamiento para Operador
 * CU-O07/O08: Iniciar y registrar tratamiento de residuos
 * Pasos: 1. Seleccionar método → 2. Detalles → 3. Firmar
 */

import React, { useState } from 'react';
import { X, Recycle, FileText, Pen, Check, ChevronRight, ChevronLeft, AlertTriangle, Beaker } from 'lucide-react';
import SignaturePad from '../SignaturePad';
import './TratamientoModal.css';

interface ManifiestoInfo {
    id: string;
    numero: string;
    generador?: { razonSocial: string };
    transportista?: { razonSocial: string };
    tipoResiduo?: string;
    pesoKg?: number;
}

interface TratamientoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        metodoTratamiento: string;
        fechaTratamiento: string;
        observaciones?: string;
        firma: string;
    }) => Promise<void>;
    manifiesto: ManifiestoInfo;
}

type Step = 'metodo' | 'detalle' | 'firma';

const METODOS_TRATAMIENTO = [
    { id: 'INCINERACION', label: 'Incineración', icon: '🔥', descripcion: 'Destrucción térmica controlada' },
    { id: 'NEUTRALIZACION', label: 'Neutralización', icon: '⚗️', descripcion: 'Tratamiento químico para neutralizar' },
    { id: 'ESTABILIZACION', label: 'Estabilización', icon: '🧱', descripcion: 'Solidificación y encapsulamiento' },
    { id: 'BIODEGRADACION', label: 'Biodegradación', icon: '🌱', descripcion: 'Tratamiento biológico' },
    { id: 'RECICLAJE', label: 'Reciclaje', icon: '♻️', descripcion: 'Recuperación de materiales' },
    { id: 'DISPOSICION_FINAL', label: 'Disposición Final', icon: '📦', descripcion: 'Celda de seguridad' },
    { id: 'OTRO', label: 'Otro método', icon: '🔬', descripcion: 'Especificar en observaciones' },
];

const TratamientoModal: React.FC<TratamientoModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    manifiesto
}) => {
    const [currentStep, setCurrentStep] = useState<Step>('metodo');
    const [metodoSeleccionado, setMetodoSeleccionado] = useState<string>('');
    const [fechaTratamiento, setFechaTratamiento] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [observaciones, setObservaciones] = useState('');
    const [firma, setFirma] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
        { id: 'metodo', label: 'Método', icon: <Beaker size={18} /> },
        { id: 'detalle', label: 'Detalle', icon: <FileText size={18} /> },
        { id: 'firma', label: 'Firmar', icon: <Pen size={18} /> },
    ];

    const handleNext = () => {
        if (currentStep === 'metodo') {
            if (!metodoSeleccionado) {
                setError('Seleccione un método de tratamiento');
                return;
            }
            setError(null);
            setCurrentStep('detalle');
        } else if (currentStep === 'detalle') {
            if (!fechaTratamiento) {
                setError('Indique la fecha de tratamiento');
                return;
            }
            if (metodoSeleccionado === 'OTRO' && !observaciones.trim()) {
                setError('Describa el método de tratamiento aplicado');
                return;
            }
            setError(null);
            setCurrentStep('firma');
        }
    };

    const handleBack = () => {
        if (currentStep === 'detalle') {
            setCurrentStep('metodo');
        } else if (currentStep === 'firma') {
            setCurrentStep('detalle');
        }
    };

    const handleSubmit = async () => {
        if (!firma) {
            setError('Debe firmar para confirmar el tratamiento');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onConfirm({
                metodoTratamiento: metodoSeleccionado,
                fechaTratamiento,
                observaciones: observaciones || undefined,
                firma
            });
            resetState();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al registrar tratamiento');
        } finally {
            setSubmitting(false);
        }
    };

    const resetState = () => {
        setCurrentStep('metodo');
        setMetodoSeleccionado('');
        setFechaTratamiento(new Date().toISOString().split('T')[0]);
        setObservaciones('');
        setFirma(null);
        setError(null);
    };

    const handleClose = () => {
        if (!submitting) {
            resetState();
            onClose();
        }
    };

    const getMetodoInfo = (id: string) => {
        return METODOS_TRATAMIENTO.find(m => m.id === id);
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 'metodo':
                return (
                    <div className="step-content metodo">
                        <h3>Método de Tratamiento</h3>
                        <div className="manifiesto-info-compact tratamiento">
                            <Recycle size={20} />
                            <span>Manifiesto #{manifiesto.numero}</span>
                        </div>
                        <div className="metodos-grid">
                            {METODOS_TRATAMIENTO.map((metodo) => (
                                <button
                                    key={metodo.id}
                                    className={`metodo-card ${metodoSeleccionado === metodo.id ? 'selected' : ''}`}
                                    onClick={() => setMetodoSeleccionado(metodo.id)}
                                >
                                    <span className="metodo-icon">{metodo.icon}</span>
                                    <span className="metodo-label">{metodo.label}</span>
                                    <span className="metodo-desc">{metodo.descripcion}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'detalle':
                const metodoInfo = getMetodoInfo(metodoSeleccionado);
                return (
                    <div className="step-content detalle">
                        <h3>Detalles del Tratamiento</h3>

                        <div className="metodo-selected-box">
                            <span className="icon">{metodoInfo?.icon}</span>
                            <div className="info">
                                <span className="label">{metodoInfo?.label}</span>
                                <span className="desc">{metodoInfo?.descripcion}</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Fecha de Tratamiento *</label>
                            <input
                                type="date"
                                value={fechaTratamiento}
                                onChange={(e) => setFechaTratamiento(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>

                        <div className="residuo-info">
                            <div className="info-row">
                                <span className="label">Tipo de Residuo</span>
                                <span className="value">{manifiesto.tipoResiduo || 'N/A'}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Cantidad</span>
                                <span className="value">{manifiesto.pesoKg?.toLocaleString() || 0} kg</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Generador</span>
                                <span className="value">{manifiesto.generador?.razonSocial || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>
                                Observaciones {metodoSeleccionado === 'OTRO' ? '*' : '(opcional)'}
                            </label>
                            <textarea
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                placeholder={metodoSeleccionado === 'OTRO'
                                    ? "Describa el método de tratamiento aplicado..."
                                    : "Observaciones adicionales sobre el tratamiento..."}
                                rows={3}
                            />
                        </div>
                    </div>
                );

            case 'firma':
                const metodo = getMetodoInfo(metodoSeleccionado);
                return (
                    <div className="step-content firma">
                        <h3>Confirmar Tratamiento</h3>

                        <div className="resumen-tratamiento">
                            <div className="resumen-header">
                                <Recycle size={24} />
                                <span>Tratamiento Completado</span>
                            </div>
                            <div className="resumen-items">
                                <div className="resumen-item">
                                    <span className="label">Manifiesto</span>
                                    <span className="value">#{manifiesto.numero}</span>
                                </div>
                                <div className="resumen-item">
                                    <span className="label">Método</span>
                                    <span className="value">{metodo?.icon} {metodo?.label}</span>
                                </div>
                                <div className="resumen-item">
                                    <span className="label">Fecha</span>
                                    <span className="value">
                                        {new Date(fechaTratamiento).toLocaleDateString('es-AR')}
                                    </span>
                                </div>
                                <div className="resumen-item">
                                    <span className="label">Cantidad Tratada</span>
                                    <span className="value">{manifiesto.pesoKg?.toLocaleString() || 0} kg</span>
                                </div>
                                {observaciones && (
                                    <div className="resumen-item descripcion">
                                        <span className="label">Observaciones</span>
                                        <span className="value">{observaciones}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="tratamiento-notice">
                            <AlertTriangle size={18} />
                            <span>Al firmar, se actualizará el estado del manifiesto a TRATADO</span>
                        </div>

                        {!firma ? (
                            <SignaturePad
                                onConfirm={(sig) => setFirma(sig)}
                                title="Firma de Tratamiento"
                                subtitle="Confirmo que el residuo fue tratado correctamente"
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
        <div className="tratamiento-modal-overlay" onClick={handleClose}>
            <div className="tratamiento-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="tratamiento-header">
                    <h2>Registrar Tratamiento</h2>
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
                <div className="tratamiento-content">
                    {renderStepContent()}
                </div>

                {/* Error */}
                {error && (
                    <div className="tratamiento-error">
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="tratamiento-actions">
                    {currentStep !== 'metodo' && (
                        <button
                            className="btn btn-ghost"
                            onClick={handleBack}
                            disabled={submitting}
                        >
                            <ChevronLeft size={18} />
                            Atrás
                        </button>
                    )}

                    {currentStep === 'metodo' && (
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
                            className="btn btn-success"
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
                                    <Recycle size={18} />
                                    Confirmar Tratamiento
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TratamientoModal;
