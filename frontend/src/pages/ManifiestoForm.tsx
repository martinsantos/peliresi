import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogoService, manifiestoService } from '../services/manifiesto.service';
import type { TipoResiduo, Transportista, Operador, Generador } from '../types';
import { useAuth } from '../context/AuthContext';
import {
    Save,
    ArrowLeft,
    AlertTriangle,
    Plus,
    Trash2
} from 'lucide-react';
import './ManifiestoForm.css';

// Field error interface
interface FieldErrors {
    generadorId?: string;
    transportistaId?: string;
    operadorId?: string;
    residuos?: { [index: number]: { tipoResiduoId?: string; cantidad?: string } };
}

// Warnings (non-blocking)
interface Warnings {
    compatibility?: string[];
}

const ManifiestoForm: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.rol === 'ADMIN';

    // Debug log for admin detection
    console.log('[ManifiestoForm] User:', user?.email, 'Role:', user?.rol, 'isAdmin:', isAdmin);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
    const [warnings, setWarnings] = useState<Warnings>({});

    // Catálogos
    const [tiposResiduos, setTiposResiduos] = useState<TipoResiduo[]>([]);
    const [transportistas, setTransportistas] = useState<Transportista[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [generadores, setGeneradores] = useState<Generador[]>([]);
    const [catalogosLoading, setCatalogosLoading] = useState(true);

    // Form Data
    const [formData, setFormData] = useState({
        generadorId: '',
        transportistaId: '',
        operadorId: '',
        observaciones: '',
        residuos: [
            { tipoResiduoId: '', cantidad: 0, unidad: 'kg', descripcion: '', observaciones: '' }
        ]
    });

    // Validation constants
    const MAX_CANTIDAD = 100000;
    const MIN_CANTIDAD = 0.01;

    useEffect(() => {
        loadCatalogos();
    }, []);

    const loadCatalogos = async () => {
        try {
            const promises: Promise<any>[] = [
                catalogoService.getTiposResiduos(),
                catalogoService.getTransportistas(),
                catalogoService.getOperadores()
            ];

            // Solo cargar generadores si es admin
            if (isAdmin) {
                promises.push(catalogoService.getGeneradores());
            }

            const results = await Promise.all(promises);
            setTiposResiduos(results[0]);
            setTransportistas(results[1]);
            setOperadores(results[2]);

            if (isAdmin && results[3]) {
                setGeneradores(results[3]);
            }
        } catch (err) {
            setError('Error al cargar catálogos. Por favor recargue la página.');
        } finally {
            setCatalogosLoading(false);
        }
    };

    const handleResiduoChange = (index: number, field: string, value: any) => {
        const newResiduos = [...formData.residuos];
        newResiduos[index] = { ...newResiduos[index], [field]: value };
        setFormData({ ...formData, residuos: newResiduos });
    };

    const addResiduo = () => {
        setFormData({
            ...formData,
            residuos: [...formData.residuos, { tipoResiduoId: '', cantidad: 0, unidad: 'kg', descripcion: '', observaciones: '' }]
        });
    };

    const removeResiduo = (index: number) => {
        if (formData.residuos.length === 1) return;
        const newResiduos = formData.residuos.filter((_, i) => i !== index);
        setFormData({ ...formData, residuos: newResiduos });
    };

    // Validate entire form (returns errors that block submission)
    const validateForm = (): { isValid: boolean; errors: FieldErrors; warnings: Warnings; errorMessage: string } => {
        const errors: FieldErrors = { residuos: {} };
        const formWarnings: Warnings = { compatibility: [] };
        const messages: string[] = [];

        // Validate generador (only for Admin)
        if (isAdmin && !formData.generadorId) {
            errors.generadorId = 'Seleccione un generador';
            messages.push('Generador requerido');
        }

        // Validate transportista
        if (!formData.transportistaId) {
            errors.transportistaId = 'Seleccione un transportista';
            messages.push('Transportista requerido');
        }

        // Validate operador
        if (!formData.operadorId) {
            errors.operadorId = 'Seleccione un operador de destino';
            messages.push('Operador requerido');
        }

        // Validate residuos
        if (formData.residuos.length === 0) {
            messages.push('Debe agregar al menos un residuo');
        }

        formData.residuos.forEach((residuo, index) => {
            const residuoErrors: { tipoResiduoId?: string; cantidad?: string } = {};

            if (!residuo.tipoResiduoId) {
                residuoErrors.tipoResiduoId = 'Seleccione tipo de residuo';
                messages.push(`Residuo #${index + 1}: tipo requerido`);
            }

            if (!residuo.cantidad || residuo.cantidad <= 0) {
                residuoErrors.cantidad = 'Cantidad debe ser mayor a 0';
                messages.push(`Residuo #${index + 1}: cantidad inválida`);
            } else if (residuo.cantidad < MIN_CANTIDAD) {
                residuoErrors.cantidad = `Mínimo ${MIN_CANTIDAD} ${residuo.unidad}`;
                messages.push(`Residuo #${index + 1}: cantidad muy pequeña`);
            } else if (residuo.cantidad > MAX_CANTIDAD) {
                residuoErrors.cantidad = `Máximo ${MAX_CANTIDAD.toLocaleString()} ${residuo.unidad}`;
                messages.push(`Residuo #${index + 1}: cantidad excede límite`);
            }

            if (Object.keys(residuoErrors).length > 0) {
                errors.residuos![index] = residuoErrors;
            }
        });

        // Check operador compatibility with residuo types (WARNING only - does not block)
        if (formData.operadorId) {
            const selectedOperador = operadores.find(o => o.id === formData.operadorId);
            if (selectedOperador && selectedOperador.tratamientos && selectedOperador.tratamientos.length > 0) {
                const tiposAutorizados = selectedOperador.tratamientos.map(t => t.tipoResiduoId);
                formData.residuos.forEach((residuo) => {
                    if (residuo.tipoResiduoId && !tiposAutorizados.includes(residuo.tipoResiduoId)) {
                        const tipoResiduo = tiposResiduos.find(t => t.id === residuo.tipoResiduoId);
                        formWarnings.compatibility!.push(
                            `${tipoResiduo?.nombre || 'Residuo'} puede no estar autorizado para ${selectedOperador.razonSocial}. Verifique la habilitación del operador.`
                        );
                    }
                });
            }
        }

        const isValid = !errors.generadorId && !errors.transportistaId && !errors.operadorId &&
            Object.keys(errors.residuos || {}).length === 0;

        return {
            isValid,
            errors,
            warnings: formWarnings,
            errorMessage: messages.length > 0 ? messages[0] : ''
        };
    };

    // Mark field as touched on blur
    const handleBlur = (fieldName: string) => {
        setTouched(prev => ({ ...prev, [fieldName]: true }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Mark all fields as touched
        const allTouched: { [key: string]: boolean } = {
            generadorId: true,
            transportistaId: true,
            operadorId: true
        };
        formData.residuos.forEach((_, idx) => {
            allTouched[`residuo-${idx}-tipo`] = true;
            allTouched[`residuo-${idx}-cantidad`] = true;
        });
        setTouched(allTouched);

        // Validate
        const { isValid, errors, warnings: formWarnings, errorMessage } = validateForm();
        setFieldErrors(errors);
        setWarnings(formWarnings);

        if (!isValid) {
            setError(errorMessage);
            return;
        }

        setLoading(true);

        try {
            // Preparar datos - solo incluir generadorId si es Admin
            const submitData: any = {
                transportistaId: formData.transportistaId,
                operadorId: formData.operadorId,
                observaciones: formData.observaciones,
                residuos: formData.residuos
            };

            // Solo incluir generadorId si es Admin y tiene valor
            if (isAdmin && formData.generadorId) {
                submitData.generadorId = formData.generadorId;
            }

            const nuevoManifiesto = await manifiestoService.createManifiesto(submitData);
            navigate(`/manifiestos/${nuevoManifiesto.id}`);
        } catch (err: any) {
            // Extraer el mensaje de error del backend (axios pone la respuesta en err.response)
            const backendMessage = err.response?.data?.message;
            setError(backendMessage || err.message || 'Error al crear el manifiesto');
        } finally {
            setLoading(false);
        }
    };

    if (catalogosLoading) {
        return (
            <div className="form-loading">
                <div className="spinner" />
                <p>Cargando catálogos...</p>
            </div>
        );
    }

    return (
        <div className="form-page animate-fadeIn">
            <div className="form-header">
                <button className="btn btn-ghost" onClick={() => navigate('/manifiestos')}>
                    <ArrowLeft size={18} />
                    Volver
                </button>
                <h2>Nuevo Manifiesto</h2>
            </div>

            {error && (
                <div className="form-error">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            {warnings.compatibility && warnings.compatibility.length > 0 && (
                <div className="form-warning">
                    <AlertTriangle size={20} />
                    <div>
                        <strong>Advertencias (no bloquean la creación):</strong>
                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                            {warnings.compatibility.map((w, i) => (
                                <li key={i} style={{ fontSize: '0.85rem' }}>{w}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="manifiesto-form">
                {/* Generador (solo visible para Admin) */}
                {isAdmin && (
                    <div className="card form-section">
                        <h3>Generador del Manifiesto</h3>
                        <div className="form-grid">
                            <div className={`form-group span-full ${touched.generadorId && fieldErrors.generadorId ? 'has-error' : ''}`}>
                                <label>Generador *</label>
                                <select
                                    value={formData.generadorId}
                                    onChange={(e) => setFormData({ ...formData, generadorId: e.target.value })}
                                    onBlur={() => handleBlur('generadorId')}
                                    className={touched.generadorId && fieldErrors.generadorId ? 'input-error' : ''}
                                    required
                                >
                                    <option value="">Seleccione el generador que declara los residuos</option>
                                    {generadores.map(g => (
                                        <option key={g.id} value={g.id}>{g.razonSocial} (CUIT: {g.cuit})</option>
                                    ))}
                                </select>
                                {touched.generadorId && fieldErrors.generadorId && (
                                    <span className="field-error">{fieldErrors.generadorId}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Actores */}
                <div className="card form-section">
                    <h3>Transportista y Operador</h3>
                    <div className="form-grid">
                        <div className={`form-group ${touched.transportistaId && fieldErrors.transportistaId ? 'has-error' : ''}`}>
                            <label>Transportista *</label>
                            <select
                                value={formData.transportistaId}
                                onChange={(e) => setFormData({ ...formData, transportistaId: e.target.value })}
                                onBlur={() => handleBlur('transportistaId')}
                                className={touched.transportistaId && fieldErrors.transportistaId ? 'input-error' : ''}
                                required
                            >
                                <option value="">Seleccione un transportista</option>
                                {transportistas.map(t => (
                                    <option key={t.id} value={t.id}>{t.razonSocial} (Hab: {t.numeroHabilitacion})</option>
                                ))}
                            </select>
                            {touched.transportistaId && fieldErrors.transportistaId && (
                                <span className="field-error">{fieldErrors.transportistaId}</span>
                            )}
                        </div>

                        <div className={`form-group ${touched.operadorId && fieldErrors.operadorId ? 'has-error' : ''}`}>
                            <label>Operador de Destino *</label>
                            <select
                                value={formData.operadorId}
                                onChange={(e) => setFormData({ ...formData, operadorId: e.target.value })}
                                onBlur={() => handleBlur('operadorId')}
                                className={touched.operadorId && fieldErrors.operadorId ? 'input-error' : ''}
                                required
                            >
                                <option value="">Seleccione un operador</option>
                                {operadores.map(o => (
                                    <option key={o.id} value={o.id}>{o.razonSocial} (Cat: {o.categoria})</option>
                                ))}
                            </select>
                            {touched.operadorId && fieldErrors.operadorId && (
                                <span className="field-error">{fieldErrors.operadorId}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Residuos */}
                <div className="card form-section">
                    <div className="section-header">
                        <h3>Residuos a Declarar</h3>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={addResiduo}>
                            <Plus size={16} />
                            Agregar Residuo
                        </button>
                    </div>

                    <div className="residuos-list">
                        {formData.residuos.map((residuo, index) => (
                            <div key={index} className="residuo-item">
                                <div className="residuo-header">
                                    <span>Residuo #{index + 1}</span>
                                    {formData.residuos.length > 1 && (
                                        <button type="button" className="btn-icon danger" onClick={() => removeResiduo(index)}>
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                                <div className="form-grid">
                                    <div className={`form-group span-2 ${touched[`residuo-${index}-tipo`] && fieldErrors.residuos?.[index]?.tipoResiduoId ? 'has-error' : ''}`}>
                                        <label>Tipo de Residuo *</label>
                                        <select
                                            value={residuo.tipoResiduoId}
                                            onChange={(e) => handleResiduoChange(index, 'tipoResiduoId', e.target.value)}
                                            onBlur={() => handleBlur(`residuo-${index}-tipo`)}
                                            className={touched[`residuo-${index}-tipo`] && fieldErrors.residuos?.[index]?.tipoResiduoId ? 'input-error' : ''}
                                            required
                                        >
                                            <option value="">Seleccione tipo</option>
                                            {tiposResiduos.map(t => (
                                                <option key={t.id} value={t.id}>{t.codigo} - {t.nombre}</option>
                                            ))}
                                        </select>
                                        {touched[`residuo-${index}-tipo`] && fieldErrors.residuos?.[index]?.tipoResiduoId && (
                                            <span className="field-error">{fieldErrors.residuos[index].tipoResiduoId}</span>
                                        )}
                                    </div>
                                    <div className={`form-group ${touched[`residuo-${index}-cantidad`] && fieldErrors.residuos?.[index]?.cantidad ? 'has-error' : ''}`}>
                                        <label>Cantidad *</label>
                                        <input
                                            type="number"
                                            min={MIN_CANTIDAD}
                                            max={MAX_CANTIDAD}
                                            step="0.01"
                                            value={residuo.cantidad || ''}
                                            onChange={(e) => handleResiduoChange(index, 'cantidad', parseFloat(e.target.value) || 0)}
                                            onBlur={() => handleBlur(`residuo-${index}-cantidad`)}
                                            className={touched[`residuo-${index}-cantidad`] && fieldErrors.residuos?.[index]?.cantidad ? 'input-error' : ''}
                                            placeholder="0.00"
                                            required
                                        />
                                        {touched[`residuo-${index}-cantidad`] && fieldErrors.residuos?.[index]?.cantidad && (
                                            <span className="field-error">{fieldErrors.residuos[index].cantidad}</span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Unidad</label>
                                        <select
                                            value={residuo.unidad}
                                            onChange={(e) => handleResiduoChange(index, 'unidad', e.target.value)}
                                        >
                                            <option value="kg">Kilogramos (kg)</option>
                                            <option value="tn">Toneladas (tn)</option>
                                            <option value="lt">Litros (lt)</option>
                                            <option value="m3">Metros Cúbicos (m3)</option>
                                        </select>
                                    </div>
                                    <div className="form-group span-full">
                                        <label>Descripción Adicional</label>
                                        <input
                                            type="text"
                                            value={residuo.descripcion}
                                            onChange={(e) => handleResiduoChange(index, 'descripcion', e.target.value)}
                                            placeholder="Detalles específicos del contenedor, estado, etc."
                                        />
                                    </div>
                                    {/* FASE 6 (P9): Campo observaciones del residuo */}
                                    <div className="form-group span-full">
                                        <label>Observaciones del Residuo</label>
                                        <textarea
                                            value={residuo.observaciones || ''}
                                            onChange={(e) => handleResiduoChange(index, 'observaciones', e.target.value)}
                                            placeholder="Observaciones especiales, precauciones, instrucciones de manejo..."
                                            rows={2}
                                            style={{ resize: 'vertical', minHeight: '60px' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Observaciones */}
                <div className="card form-section">
                    <h3>Observaciones Generales</h3>
                    <div className="form-group">
                        <textarea
                            value={formData.observaciones}
                            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                            rows={3}
                            placeholder="Observaciones adicionales sobre el manifiesto..."
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => navigate('/manifiestos')}>
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
                                <Save size={18} />
                                Crear Borrador
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ManifiestoForm;
