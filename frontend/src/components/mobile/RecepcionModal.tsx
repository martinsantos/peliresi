/**
 * RecepcionModal - Flujo completo de recepción para Operador
 * Pasos: 1. Verificar datos → 2. Registrar pesaje → 3. Firmar recepción
 */

import React, { useState } from 'react';
import { X, FileText, Scale, Pen, Check, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import SignaturePad from '../SignaturePad';
import './RecepcionModal.css';

interface ManifiestoInfo {
    id: string;
    numero: string;
    estado?: string;
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

interface RecepcionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        pesoReal: number;
        diferenciaPorcentaje: number;
        observaciones?: string;
        firma: string;
    }) => Promise<void>;
    manifiesto: ManifiestoInfo;
}

type Step = 'verificar' | 'pesaje' | 'firma';

const RecepcionModal: React.FC<RecepcionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    manifiesto
}) => {
    const [currentStep, setCurrentStep] = useState<Step>('verificar');
    const [pesoReal, setPesoReal] = useState<string>('');
    const [observaciones, setObservaciones] = useState('');
    const [firma, setFirma] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const pesoDeclarado = manifiesto.pesoKg || 0;
    const pesoRealNum = parseFloat(pesoReal) || 0;
    const diferencia = pesoRealNum - pesoDeclarado;
    const diferenciaPorcentaje = pesoDeclarado > 0
        ? ((diferencia / pesoDeclarado) * 100)
        : 0;
    const diferenciaSignificativa = Math.abs(diferenciaPorcentaje) > 5;

    const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
        { id: 'verificar', label: 'Verificar', icon: <FileText size={18} /> },
        { id: 'pesaje', label: 'Pesaje', icon: <Scale size={18} /> },
        { id: 'firma', label: 'Firmar', icon: <Pen size={18} /> },
    ];

    const handleNext = () => {
        if (currentStep === 'verificar') {
            setCurrentStep('pesaje');
        } else if (currentStep === 'pesaje') {
            if (!pesoReal || pesoRealNum <= 0) {
                setError('Ingrese el peso real');
                return;
            }
            setError(null);
            setCurrentStep('firma');
        }
    };

    const handleBack = () => {
        if (currentStep === 'pesaje') {
            setCurrentStep('verificar');
        } else if (currentStep === 'firma') {
            setCurrentStep('pesaje');
        }
    };

    const handleSubmit = async () => {
        if (!firma) {
            setError('Debe firmar para confirmar la recepción');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onConfirm({
                pesoReal: pesoRealNum,
                diferenciaPorcentaje,
                observaciones: observaciones || undefined,
                firma
            });
            // Reset and close
            resetState();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al confirmar recepción');
        } finally {
            setSubmitting(false);
        }
    };

    const resetState = () => {
        setCurrentStep('verificar');
        setPesoReal('');
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

    const renderStepContent = () => {
        switch (currentStep) {
            case 'verificar':
                return (
                    <div className="step-content verificar">
                        <h3>Verificar Datos del Manifiesto</h3>
                        <div className="manifiesto-card">
                            <div className="card-header">
                                <FileText size={24} />
                                <span className="numero">#{manifiesto.numero}</span>
                            </div>
                            <div className="card-details">
                                <div className="detail">
                                    <span className="label">Generador</span>
                                    <span className="value">{manifiesto.generador?.razonSocial || 'N/A'}</span>
                                </div>
                                <div className="detail">
                                    <span className="label">Transportista</span>
                                    <span className="value">{manifiesto.transportista?.razonSocial || 'N/A'}</span>
                                </div>
                                <div className="detail">
                                    <span className="label">Tipo de Residuo</span>
                                    <span className="value">{manifiesto.tipoResiduo || 'N/A'}</span>
                                </div>
                                <div className="detail highlight">
                                    <span className="label">Peso Declarado</span>
                                    <span className="value">{pesoDeclarado.toLocaleString()} kg</span>
                                </div>
                            </div>
                        </div>
                        <p className="verificar-hint">
                            Verifique que los datos coincidan con la documentación física antes de continuar.
                        </p>
                    </div>
                );

            case 'pesaje':
                return (
                    <div className="step-content pesaje">
                        <h3>Registrar Pesaje Real</h3>

                        <div className="pesaje-comparison">
                            <div className="peso-box declarado">
                                <span className="label">Peso Declarado</span>
                                <span className="value">{pesoDeclarado.toLocaleString()}</span>
                                <span className="unit">kg</span>
                            </div>
                            <div className="peso-arrow">→</div>
                            <div className="peso-box real">
                                <span className="label">Peso Real</span>
                                <input
                                    type="number"
                                    value={pesoReal}
                                    onChange={(e) => setPesoReal(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    step="0.1"
                                />
                                <span className="unit">kg</span>
                            </div>
                        </div>

                        {pesoRealNum > 0 && (
                            <div className={`diferencia-box ${diferenciaSignificativa ? 'warning' : 'ok'}`}>
                                {diferenciaSignificativa ? (
                                    <AlertTriangle size={20} />
                                ) : (
                                    <Check size={20} />
                                )}
                                <div className="diferencia-info">
                                    <span className="diferencia-valor">
                                        {diferencia > 0 ? '+' : ''}{diferencia.toFixed(1)} kg
                                    </span>
                                    <span className="diferencia-porcentaje">
                                        ({diferenciaPorcentaje > 0 ? '+' : ''}{diferenciaPorcentaje.toFixed(1)}%)
                                    </span>
                                </div>
                                <span className="diferencia-label">
                                    {diferenciaSignificativa
                                        ? 'Diferencia significativa'
                                        : 'Diferencia aceptable'}
                                </span>
                            </div>
                        )}

                        {diferenciaSignificativa && pesoRealNum > 0 && (
                            <div className="observaciones-required">
                                <label>Observaciones (requerido por diferencia &gt;5%)</label>
                                <textarea
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    placeholder="Describa el motivo de la diferencia..."
                                    rows={3}
                                />
                            </div>
                        )}
                    </div>
                );

            case 'firma':
                return (
                    <div className="step-content firma">
                        <h3>Confirmar Recepción</h3>

                        <div className="resumen-recepcion">
                            <div className="resumen-item">
                                <span className="label">Manifiesto</span>
                                <span className="value">#{manifiesto.numero}</span>
                            </div>
                            <div className="resumen-item">
                                <span className="label">Peso Real</span>
                                <span className="value">{pesoRealNum.toLocaleString()} kg</span>
                            </div>
                            <div className="resumen-item">
                                <span className="label">Diferencia</span>
                                <span className={`value ${diferenciaSignificativa ? 'warning' : ''}`}>
                                    {diferenciaPorcentaje > 0 ? '+' : ''}{diferenciaPorcentaje.toFixed(1)}%
                                </span>
                            </div>
                            {observaciones && (
                                <div className="resumen-item observaciones">
                                    <span className="label">Observaciones</span>
                                    <span className="value">{observaciones}</span>
                                </div>
                            )}
                        </div>

                        {!firma ? (
                            <SignaturePad
                                onConfirm={(sig) => setFirma(sig)}
                                title="Firma de Recepción"
                                subtitle="Confirmo haber recibido la carga"
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
        <div className="recepcion-modal-overlay" onClick={handleClose}>
            <div className="recepcion-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="recepcion-header">
                    <h2>Recepción de Carga</h2>
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
                <div className="recepcion-content">
                    {renderStepContent()}
                </div>

                {/* Error */}
                {error && (
                    <div className="recepcion-error">
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="recepcion-actions">
                    {currentStep !== 'verificar' && (
                        <button
                            className="btn btn-ghost"
                            onClick={handleBack}
                            disabled={submitting}
                        >
                            <ChevronLeft size={18} />
                            Atrás
                        </button>
                    )}

                    {currentStep === 'verificar' && (
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
                                    <Check size={18} />
                                    Confirmar Recepción
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecepcionModal;
