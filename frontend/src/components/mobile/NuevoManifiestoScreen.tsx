/**
 * NuevoManifiestoScreen - Formulario para crear manifiestos desde la app movil
 * Sincronizado con WEB: Usa los mismos servicios (manifiestoService, catalogoService)
 * Control Room 2077 Design System - Neon Mobile Edition
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    FileText, Truck, Building2, Package,
    Plus, Minus, AlertCircle, Check, Loader2, Scale
} from 'lucide-react';
import { manifiestoService, catalogoService } from '../../services/manifiesto.service';
import type { TipoResiduo, Transportista, Operador } from '../../types';

interface NuevoManifiestoScreenProps {
    onBack: () => void;
    onSuccess: () => void;
    onToast: (message: string) => void;
}

interface ResiduoItem {
    tipoResiduoId: string;
    cantidad: number;
    unidad: string;
    descripcion: string;
}

const UNIDADES = ['kg', 'lt', 'm3', 'unidades'];

export default function NuevoManifiestoScreen({
    onBack,
    onSuccess,
    onToast
}: NuevoManifiestoScreenProps): React.ReactElement {
    // Catalogos
    const [tiposResiduos, setTiposResiduos] = useState<TipoResiduo[]>([]);
    const [transportistas, setTransportistas] = useState<Transportista[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [transportistaId, setTransportistaId] = useState('');
    const [operadorId, setOperadorId] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [residuos, setResiduos] = useState<ResiduoItem[]>([
        { tipoResiduoId: '', cantidad: 0, unidad: 'kg', descripcion: '' }
    ]);

    // Validation
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Cargar catalogos al montar
    useEffect(() => {
        async function loadCatalogos() {
            setLoading(true);
            try {
                const [tipos, trans, ops] = await Promise.all([
                    catalogoService.getTiposResiduos(),
                    catalogoService.getTransportistas(),
                    catalogoService.getOperadores()
                ]);
                setTiposResiduos(tipos);
                setTransportistas(trans);
                setOperadores(ops);
            } catch (error) {
                console.error('[NuevoManifiestoScreen] Error cargando catalogos:', error);
                onToast('Error cargando datos. Reintente.');
            } finally {
                setLoading(false);
            }
        }
        loadCatalogos();
    }, []);

    // Handlers para residuos
    const addResiduo = () => {
        setResiduos([...residuos, { tipoResiduoId: '', cantidad: 0, unidad: 'kg', descripcion: '' }]);
    };

    const removeResiduo = (index: number) => {
        if (residuos.length > 1) {
            setResiduos(residuos.filter((_, i) => i !== index));
        }
    };

    const updateResiduo = (index: number, field: keyof ResiduoItem, value: string | number) => {
        const updated = [...residuos];
        updated[index] = { ...updated[index], [field]: value };
        setResiduos(updated);
    };

    // Validacion
    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!transportistaId) {
            newErrors.transportista = 'Seleccione un transportista';
        }
        if (!operadorId) {
            newErrors.operador = 'Seleccione un operador de destino';
        }

        // Validar residuos
        residuos.forEach((r, i) => {
            if (!r.tipoResiduoId) {
                newErrors[`residuo_${i}_tipo`] = 'Seleccione tipo de residuo';
            }
            if (!r.cantidad || r.cantidad <= 0) {
                newErrors[`residuo_${i}_cantidad`] = 'Cantidad debe ser mayor a 0';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Submit
    const handleSubmit = async () => {
        if (!validate()) {
            onToast('Complete los campos requeridos');
            return;
        }

        setSubmitting(true);
        try {
            const data = {
                transportistaId,
                operadorId,
                observaciones: observaciones || undefined,
                residuos: residuos.map(r => ({
                    tipoResiduoId: r.tipoResiduoId,
                    cantidad: Number(r.cantidad),
                    unidad: r.unidad,
                    descripcion: r.descripcion || undefined
                }))
            };

            const manifiesto = await manifiestoService.createManifiesto(data);
            if (manifiesto) {
                onToast(`Manifiesto #${manifiesto.numero} creado exitosamente`);
                onSuccess();
            } else {
                onToast('Error al crear manifiesto');
            }
        } catch (error: any) {
            console.error('[NuevoManifiestoScreen] Error creando manifiesto:', error);
            const message = error.response?.data?.message || error.message || 'Error de conexion';
            onToast(`Error: ${message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="section" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Loader2 size={40} className="spin" style={{ color: 'var(--neon-cyan)' }} />
                <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Cargando catalogos...</p>
            </div>
        );
    }

    return (
        <motion.div
            className="nuevo-manifiesto-screen"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header info */}
            <div className="section">
                <div className="form-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'linear-gradient(135deg, rgba(0, 255, 242, 0.1), rgba(0, 255, 242, 0.02))',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 255, 242, 0.2)'
                }}>
                    <FileText size={24} style={{ color: 'var(--neon-cyan, #00fff2)' }} />
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--neon-cyan, #00fff2)' }}>Nuevo Manifiesto</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Complete los datos del residuo a transportar</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="section">
                {/* Transportista */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <Truck size={16} style={{ color: 'var(--neon-amber, #ffb800)' }} />
                        Transportista *
                    </label>
                    <select
                        className={`form-select ${errors.transportista ? 'error' : ''}`}
                        value={transportistaId}
                        onChange={(e) => {
                            setTransportistaId(e.target.value);
                            setErrors({ ...errors, transportista: '' });
                        }}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'var(--ind-panel, #1a1a2e)',
                            border: errors.transportista ? '1px solid #ff3366' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '14px'
                        }}
                    >
                        <option value="">Seleccione transportista...</option>
                        {transportistas.map(t => (
                            <option key={t.id} value={t.id}>{t.razonSocial}</option>
                        ))}
                    </select>
                    {errors.transportista && (
                        <span className="error-text" style={{ fontSize: '11px', color: '#ff3366', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} /> {errors.transportista}
                        </span>
                    )}
                </div>

                {/* Operador de destino */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <Building2 size={16} style={{ color: 'var(--neon-purple, #a855f7)' }} />
                        Operador de Destino *
                    </label>
                    <select
                        className={`form-select ${errors.operador ? 'error' : ''}`}
                        value={operadorId}
                        onChange={(e) => {
                            setOperadorId(e.target.value);
                            setErrors({ ...errors, operador: '' });
                        }}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'var(--ind-panel, #1a1a2e)',
                            border: errors.operador ? '1px solid #ff3366' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '14px'
                        }}
                    >
                        <option value="">Seleccione operador...</option>
                        {operadores.map(o => (
                            <option key={o.id} value={o.id}>{o.razonSocial}</option>
                        ))}
                    </select>
                    {errors.operador && (
                        <span className="error-text" style={{ fontSize: '11px', color: '#ff3366', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} /> {errors.operador}
                        </span>
                    )}
                </div>

                {/* Residuos */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Package size={16} style={{ color: 'var(--neon-green, #22ff66)' }} />
                            Residuos *
                        </span>
                        <button
                            type="button"
                            onClick={addResiduo}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                background: 'rgba(34, 255, 102, 0.15)',
                                border: '1px solid rgba(34, 255, 102, 0.3)',
                                borderRadius: '6px',
                                color: 'var(--neon-green, #22ff66)',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            <Plus size={14} /> Agregar
                        </button>
                    </label>

                    {residuos.map((residuo, index) => (
                        <motion.div
                            key={index}
                            className="residuo-card"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                padding: '12px',
                                marginBottom: '12px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    RESIDUO #{index + 1}
                                </span>
                                {residuos.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeResiduo(index)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '4px',
                                            background: 'rgba(255, 51, 102, 0.15)',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: '#ff3366',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Minus size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Tipo de residuo */}
                            <select
                                value={residuo.tipoResiduoId}
                                onChange={(e) => updateResiduo(index, 'tipoResiduoId', e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'var(--ind-panel, #1a1a2e)',
                                    border: errors[`residuo_${index}_tipo`] ? '1px solid #ff3366' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    marginBottom: '8px'
                                }}
                            >
                                <option value="">Tipo de residuo...</option>
                                {tiposResiduos.map(t => (
                                    <option key={t.id} value={t.id}>{t.codigo} - {t.nombre}</option>
                                ))}
                            </select>

                            {/* Cantidad y Unidad */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ position: 'relative' }}>
                                    <Scale size={14} style={{
                                        position: 'absolute',
                                        left: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-muted)'
                                    }} />
                                    <input
                                        type="number"
                                        placeholder="Cantidad"
                                        value={residuo.cantidad || ''}
                                        onChange={(e) => updateResiduo(index, 'cantidad', parseFloat(e.target.value) || 0)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 10px 10px 32px',
                                            background: 'var(--ind-panel, #1a1a2e)',
                                            border: errors[`residuo_${index}_cantidad`] ? '1px solid #ff3366' : '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '13px'
                                        }}
                                    />
                                </div>
                                <select
                                    value={residuo.unidad}
                                    onChange={(e) => updateResiduo(index, 'unidad', e.target.value)}
                                    style={{
                                        padding: '10px',
                                        background: 'var(--ind-panel, #1a1a2e)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '6px',
                                        color: 'var(--text-primary)',
                                        fontSize: '13px'
                                    }}
                                >
                                    {UNIDADES.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Descripcion opcional */}
                            <input
                                type="text"
                                placeholder="Descripcion (opcional)"
                                value={residuo.descripcion}
                                onChange={(e) => updateResiduo(index, 'descripcion', e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'var(--ind-panel, #1a1a2e)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px'
                                }}
                            />
                        </motion.div>
                    ))}
                </div>

                {/* Observaciones */}
                <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Observaciones
                    </label>
                    <textarea
                        placeholder="Notas adicionales sobre el manifiesto..."
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'var(--ind-panel, #1a1a2e)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            resize: 'none'
                        }}
                    />
                </div>

                {/* Actions */}
                <div className="form-actions" style={{ display: 'flex', gap: '12px' }}>
                    <button
                        type="button"
                        onClick={onBack}
                        disabled={submitting}
                        style={{
                            flex: 1,
                            padding: '14px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            color: 'var(--text-secondary)',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <motion.button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            flex: 2,
                            padding: '14px',
                            background: 'linear-gradient(135deg, var(--neon-cyan, #00fff2), var(--neon-green, #22ff66))',
                            border: 'none',
                            borderRadius: '10px',
                            color: '#0a0a14',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            opacity: submitting ? 0.7 : 1
                        }}
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={18} className="spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Crear Manifiesto
                            </>
                        )}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
}
