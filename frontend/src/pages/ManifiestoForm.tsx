import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogoService, manifiestoService } from '../services/manifiesto.service';
import type { TipoResiduo, Transportista, Operador } from '../types';
import {
    Save,
    ArrowLeft,
    AlertTriangle,
    Plus,
    Trash2
} from 'lucide-react';
import './ManifiestoForm.css';

const ManifiestoForm: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Catálogos
    const [tiposResiduos, setTiposResiduos] = useState<TipoResiduo[]>([]);
    const [transportistas, setTransportistas] = useState<Transportista[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [catalogosLoading, setCatalogosLoading] = useState(true);

    // Form Data
    const [formData, setFormData] = useState({
        transportistaId: '',
        operadorId: '',
        observaciones: '',
        residuos: [
            { tipoResiduoId: '', cantidad: 0, unidad: 'kg', descripcion: '' }
        ]
    });

    useEffect(() => {
        loadCatalogos();
    }, []);

    const loadCatalogos = async () => {
        try {
            const [residuosData, transportistasData, operadoresData] = await Promise.all([
                catalogoService.getTiposResiduos(),
                catalogoService.getTransportistas(),
                catalogoService.getOperadores()
            ]);
            setTiposResiduos(residuosData);
            setTransportistas(transportistasData);
            setOperadores(operadoresData);
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
            residuos: [...formData.residuos, { tipoResiduoId: '', cantidad: 0, unidad: 'kg', descripcion: '' }]
        });
    };

    const removeResiduo = (index: number) => {
        if (formData.residuos.length === 1) return;
        const newResiduos = formData.residuos.filter((_, i) => i !== index);
        setFormData({ ...formData, residuos: newResiduos });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Validaciones básicas
            if (!formData.transportistaId || !formData.operadorId) {
                throw new Error('Debe seleccionar un transportista y un operador');
            }

            if (formData.residuos.some(r => !r.tipoResiduoId || r.cantidad <= 0)) {
                throw new Error('Todos los residuos deben tener tipo y cantidad válida');
            }

            const nuevoManifiesto = await manifiestoService.createManifiesto(formData);
            navigate(`/manifiestos/${nuevoManifiesto.id}`);
        } catch (err: any) {
            setError(err.message || err.response?.data?.message || 'Error al crear el manifiesto');
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

            <form onSubmit={handleSubmit} className="manifiesto-form">
                {/* Actores */}
                <div className="card form-section">
                    <h3>Actores Involucrados</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Transportista</label>
                            <select
                                value={formData.transportistaId}
                                onChange={(e) => setFormData({ ...formData, transportistaId: e.target.value })}
                                required
                            >
                                <option value="">Seleccione un transportista</option>
                                {transportistas.map(t => (
                                    <option key={t.id} value={t.id}>{t.razonSocial} (Hab: {t.numeroHabilitacion})</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Operador de Destino</label>
                            <select
                                value={formData.operadorId}
                                onChange={(e) => setFormData({ ...formData, operadorId: e.target.value })}
                                required
                            >
                                <option value="">Seleccione un operador</option>
                                {operadores.map(o => (
                                    <option key={o.id} value={o.id}>{o.razonSocial} (Cat: {o.categoria})</option>
                                ))}
                            </select>
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
                                    <div className="form-group span-2">
                                        <label>Tipo de Residuo</label>
                                        <select
                                            value={residuo.tipoResiduoId}
                                            onChange={(e) => handleResiduoChange(index, 'tipoResiduoId', e.target.value)}
                                            required
                                        >
                                            <option value="">Seleccione tipo</option>
                                            {tiposResiduos.map(t => (
                                                <option key={t.id} value={t.id}>{t.codigo} - {t.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Cantidad</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={residuo.cantidad}
                                            onChange={(e) => handleResiduoChange(index, 'cantidad', parseFloat(e.target.value))}
                                            required
                                        />
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
