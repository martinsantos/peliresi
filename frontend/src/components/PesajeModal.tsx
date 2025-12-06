import React, { useState } from 'react';
import { X, Scale, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ManifiestoResiduo } from '../types';

interface PesajeModalProps {
    residuos: ManifiestoResiduo[];
    onClose: () => void;
    onSubmit: (data: { residuosPesados: Array<{ id: string; pesoReal: number }>; observaciones?: string }) => Promise<void>;
}

const PesajeModal: React.FC<PesajeModalProps> = ({ residuos, onClose, onSubmit }) => {
    const [pesos, setPesos] = useState<Record<string, string>>(
        residuos.reduce((acc, r) => ({ ...acc, [r.id]: '' }), {})
    );
    const [observaciones, setObservaciones] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

        setLoading(true);
        try {
            const residuosPesados = residuos.map(r => ({
                id: r.id,
                pesoReal: parseFloat(pesos[r.id])
            }));

            await onSubmit({ residuosPesados, observaciones: observaciones || undefined });
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
                                        color: Math.abs(parseFloat(porcentajeTotal)) > 5 ? 'var(--warning)' : 'var(--success)'
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
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: 18, height: 18 }} />
                                    Guardando...
                                </>
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
