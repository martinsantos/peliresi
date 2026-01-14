/**
 * PesajeModal - Registro de pesaje con detección de anomalías
 * CU-O04: Registrar pesaje
 * CU-O06: Registrar anomalía de peso
 */

import React, { useState } from 'react';
import { X, Scale, AlertTriangle, CheckCircle, FileWarning, ClipboardCheck } from 'lucide-react';
import type { ManifiestoResiduo } from '../types';

interface PesajeModalProps {
    residuos: ManifiestoResiduo[];
    onClose: () => void;
    onSubmit: (data: {
        residuosPesados: Array<{ id: string; pesoReal: number }>;
        observaciones?: string;
        anomalia?: {
            tipo: 'EXCEDENTE' | 'FALTANTE';
            porcentaje: number;
            motivo: string;
            justificacion: string;
        };
    }) => Promise<void>;
    toleranciaPeso?: number; // Default 5%
}

const MOTIVOS_ANOMALIA = [
    { id: 'MEDICION_ORIGEN', label: 'Error en medición de origen' },
    { id: 'PERDIDA_TRANSPORTE', label: 'Pérdida durante transporte' },
    { id: 'CONTAMINACION', label: 'Material contaminado' },
    { id: 'HUMEDAD', label: 'Diferencia por humedad' },
    { id: 'CARGA_ADICIONAL', label: 'Carga adicional no declarada' },
    { id: 'OTRO', label: 'Otro motivo' }
];

const PesajeModal: React.FC<PesajeModalProps> = ({ residuos, onClose, onSubmit, toleranciaPeso = 5 }) => {
    const [pesos, setPesos] = useState<Record<string, string>>(
        residuos.reduce((acc, r) => ({ ...acc, [r.id]: '' }), {})
    );
    const [observaciones, setObservaciones] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // CU-O06: Estado para registro de anomalía
    const [showAnomaliaForm, setShowAnomaliaForm] = useState(false);
    const [motivoAnomalia, setMotivoAnomalia] = useState('');
    const [justificacionAnomalia, setJustificacionAnomalia] = useState('');
    const [confirmarAnomalia, setConfirmarAnomalia] = useState(false);

    const calcularDiferencia = (residuo: ManifiestoResiduo) => {
        const pesoReal = parseFloat(pesos[residuo.id] || '0');
        if (!pesoReal) return null;

        const diferencia = pesoReal - residuo.cantidad;
        const porcentaje = ((diferencia / residuo.cantidad) * 100).toFixed(1);

        return {
            diferencia,
            porcentaje: parseFloat(porcentaje),
            tipo: diferencia > 0 ? 'EXCEDENTE' : diferencia < 0 ? 'FALTANTE' : 'NINGUNA'
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validar que todos los pesos estén ingresados
        const faltantes = residuos.filter(r => !pesos[r.id] || parseFloat(pesos[r.id]) <= 0);
        if (faltantes.length > 0) {
            setError('Debe ingresar el peso recibido para todos los residuos');
            return;
        }

        // CU-O06: Si hay anomalía y no se ha registrado, mostrar formulario
        const porcentaje = Math.abs(parseFloat(porcentajeTotal));
        if (porcentaje > toleranciaPeso && !showAnomaliaForm && !confirmarAnomalia) {
            setShowAnomaliaForm(true);
            return;
        }

        // CU-O06: Validar que la anomalía esté registrada si es requerida
        if (showAnomaliaForm && !confirmarAnomalia) {
            if (!motivoAnomalia) {
                setError('Debe seleccionar un motivo para la anomalía');
                return;
            }
            if (motivoAnomalia === 'OTRO' && !justificacionAnomalia.trim()) {
                setError('Debe proporcionar una justificación para la anomalía');
                return;
            }
        }

        setLoading(true);
        try {
            const residuosPesados = residuos.map(r => ({
                id: r.id,
                pesoReal: parseFloat(pesos[r.id])
            }));

            // CU-O06: Incluir datos de anomalía si aplica
            const anomaliaData = showAnomaliaForm && confirmarAnomalia ? {
                tipo: tipoAnomalia as 'EXCEDENTE' | 'FALTANTE',
                porcentaje: parseFloat(porcentajeTotal),
                motivo: motivoAnomalia,
                justificacion: justificacionAnomalia || MOTIVOS_ANOMALIA.find(m => m.id === motivoAnomalia)?.label || ''
            } : undefined;

            await onSubmit({
                residuosPesados,
                observaciones: observaciones || undefined,
                anomalia: anomaliaData
            });
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al registrar pesaje');
        } finally {
            setLoading(false);
        }
    };

    const totalDeclarado = residuos.reduce((sum, r) => sum + r.cantidad, 0);
    const totalReal = residuos.reduce((sum, r) => sum + (parseFloat(pesos[r.id]) || 0), 0);
    const diferenciaTotal = totalReal - totalDeclarado;
    const porcentajeTotal = totalDeclarado > 0 ? ((diferenciaTotal / totalDeclarado) * 100).toFixed(1) : '0';

    const tipoAnomalia = diferenciaTotal > 0 ? 'EXCEDENTE' : 'FALTANTE';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3><Scale size={24} /> Registrar Pesaje</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            Ingrese el peso real recibido para cada tipo de residuo
                        </p>
                    </div>
                    <button className="btn-close" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {error && (
                            <div className="message error" style={{ marginBottom: '1rem' }}>
                                <AlertTriangle size={18} />
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {residuos.map(residuo => {
                                const diff = calcularDiferencia(residuo);
                                const tieneDiferencia = diff && Math.abs(diff.porcentaje) > 5;

                                return (
                                    <div key={residuo.id} className="card" style={{ padding: '1rem' }}>
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <strong>{residuo.tipoResiduo?.nombre}</strong>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                Código: {residuo.tipoResiduo?.codigo} | Categoría: {residuo.tipoResiduo?.categoria}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                                            <div>
                                                <label className="form-label">Peso Declarado</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={`${residuo.cantidad} ${residuo.unidad}`}
                                                    disabled
                                                    style={{ background: 'var(--bg-secondary)' }}
                                                />
                                            </div>

                                            <div>
                                                <label className="form-label">Peso Real Recibido *</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="form-input"
                                                    placeholder={`Ingrese peso en ${residuo.unidad}`}
                                                    value={pesos[residuo.id]}
                                                    onChange={(e) => setPesos({ ...pesos, [residuo.id]: e.target.value })}
                                                    required
                                                />
                                            </div>

                                            <div>
                                                {diff && (
                                                    <div style={{
                                                        padding: '0.5rem',
                                                        borderRadius: '6px',
                                                        background: tieneDiferencia ? 'var(--warning-bg)' : 'var(--success-bg)',
                                                        border: `1px solid ${tieneDiferencia ? 'var(--warning)' : 'var(--success)'}`,
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        <div style={{ fontWeight: 600 }}>
                                                            {diff.tipo === 'EXCEDENTE' ? '+' : ''}{diff.diferencia.toFixed(2)} {residuo.unidad}
                                                        </div>
                                                        <div style={{ color: 'var(--text-secondary)' }}>
                                                            ({diff.porcentaje > 0 ? '+' : ''}{diff.porcentaje}%)
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {tieneDiferencia && (
                                            <div style={{
                                                marginTop: '0.75rem',
                                                padding: '0.75rem',
                                                background: 'var(--warning-bg)',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                gap: '0.5rem',
                                                fontSize: '0.85rem'
                                            }}>
                                                <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                                                <span>
                                                    Diferencia significativa detectada. Se generará un registro de discrepancia.
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Resumen Total */}
                        <div className="card" style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-tertiary)' }}>
                            <h4 style={{ marginBottom: '0.75rem' }}>Resumen Total</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.9rem' }}>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Total Declarado</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{totalDeclarado.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Total Real</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{totalReal.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Diferencia</div>
                                    <div style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 600,
                                        color: Math.abs(parseFloat(porcentajeTotal)) > toleranciaPeso ? 'var(--warning)' : 'var(--success)'
                                    }}>
                                        {diferenciaTotal > 0 ? '+' : ''}{diferenciaTotal.toFixed(2)} ({porcentajeTotal}%)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <label className="form-label">Observaciones</label>
                            <textarea
                                className="form-input"
                                rows={3}
                                placeholder="Ingrese observaciones sobre el pesaje (opcional)"
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                            />
                        </div>

                        {/* CU-O06: Formulario de registro de anomalía */}
                        {showAnomaliaForm && (
                            <div style={{
                                marginTop: '1.5rem',
                                padding: '1.25rem',
                                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1))',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '12px'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    marginBottom: '1rem'
                                }}>
                                    <FileWarning size={24} style={{ color: '#ef4444' }} />
                                    <div>
                                        <h4 style={{ margin: 0, color: '#ef4444', fontSize: '1rem' }}>
                                            Registro de Anomalía de Peso
                                        </h4>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            Se detectó una diferencia de {Math.abs(parseFloat(porcentajeTotal))}% ({tipoAnomalia.toLowerCase()})
                                        </p>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Motivo de la anomalía *</label>
                                    <select
                                        className="form-input"
                                        value={motivoAnomalia}
                                        onChange={(e) => setMotivoAnomalia(e.target.value)}
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">Seleccione un motivo...</option>
                                        {MOTIVOS_ANOMALIA.map(motivo => (
                                            <option key={motivo.id} value={motivo.id}>
                                                {motivo.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {motivoAnomalia === 'OTRO' && (
                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label className="form-label">Justificación detallada *</label>
                                        <textarea
                                            className="form-input"
                                            rows={2}
                                            placeholder="Describa el motivo de la diferencia de peso..."
                                            value={justificacionAnomalia}
                                            onChange={(e) => setJustificacionAnomalia(e.target.value)}
                                        />
                                    </div>
                                )}

                                <label style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    padding: '12px',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={confirmarAnomalia}
                                        onChange={(e) => setConfirmarAnomalia(e.target.checked)}
                                        style={{ marginTop: '2px' }}
                                    />
                                    <span>
                                        <strong style={{ display: 'block', marginBottom: '4px' }}>
                                            Confirmo el registro de esta anomalía
                                        </strong>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            Esta información quedará registrada en el sistema y podrá ser auditada por la DGFA.
                                        </span>
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={`btn ${showAnomaliaForm && !confirmarAnomalia ? 'btn-warning' : 'btn-primary'}`}
                            disabled={loading || (showAnomaliaForm && !confirmarAnomalia && !motivoAnomalia)}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: 18, height: 18 }} />
                                    Guardando...
                                </>
                            ) : showAnomaliaForm ? (
                                confirmarAnomalia ? (
                                    <>
                                        <ClipboardCheck size={18} />
                                        Confirmar con Anomalía
                                    </>
                                ) : (
                                    <>
                                        <FileWarning size={18} />
                                        Registrar Anomalía
                                    </>
                                )
                            ) : (
                                <>
                                    <CheckCircle size={18} />
                                    Confirmar Pesaje
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PesajeModal;
