/**
 * VehiculosChoferes - Gestión de flota para Admin
 * CU-A15: Gestionar vehículos y choferes de transportistas
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actorService } from '../services/admin.service';
import type { Transportista } from '../services/admin.service';
import {
    ArrowLeft,
    Truck,
    User,
    Plus,
    Search,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Check,
    X,
    RefreshCw
} from 'lucide-react';
import './VehiculosChoferes.css';

const VehiculosChoferes: React.FC = () => {
    const navigate = useNavigate();
    const [transportistas, setTransportistas] = useState<Transportista[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedTransportista, setExpandedTransportista] = useState<string | null>(null);
    const [showVehiculoModal, setShowVehiculoModal] = useState(false);
    const [showChoferModal, setShowChoferModal] = useState(false);
    const [selectedTransportista, setSelectedTransportista] = useState<Transportista | null>(null);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Form states
    const [vehiculoForm, setVehiculoForm] = useState({
        patente: '',
        marca: '',
        modelo: '',
        anio: new Date().getFullYear(),
        capacidadKg: 0,
        tipoVehiculo: 'CAMION'
    });

    const [choferForm, setChoferForm] = useState({
        nombre: '',
        apellido: '',
        dni: '',
        licencia: '',
        vencimientoLicencia: ''
    });

    useEffect(() => {
        loadTransportistas();
    }, []);

    const loadTransportistas = async () => {
        try {
            setLoading(true);
            const result = await actorService.getTransportistas();
            setTransportistas(result.transportistas || []);
        } catch (err: any) {
            console.error('Error loading transportistas:', err);
            setError('Error al cargar la lista de transportistas');
        } finally {
            setLoading(false);
        }
    };

    const handleAddVehiculo = async () => {
        if (!selectedTransportista) return;

        setSaving(true);
        try {
            await actorService.addVehiculo(selectedTransportista.id, vehiculoForm);
            setSuccessMessage('Vehículo agregado correctamente');
            setShowVehiculoModal(false);
            setVehiculoForm({
                patente: '',
                marca: '',
                modelo: '',
                anio: new Date().getFullYear(),
                capacidadKg: 0,
                tipoVehiculo: 'CAMION'
            });
            loadTransportistas();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Error al agregar vehículo');
        } finally {
            setSaving(false);
        }
    };

    const handleAddChofer = async () => {
        if (!selectedTransportista) return;

        setSaving(true);
        try {
            await actorService.addChofer(selectedTransportista.id, choferForm);
            setSuccessMessage('Chofer agregado correctamente');
            setShowChoferModal(false);
            setChoferForm({
                nombre: '',
                apellido: '',
                dni: '',
                licencia: '',
                vencimientoLicencia: ''
            });
            loadTransportistas();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Error al agregar chofer');
        } finally {
            setSaving(false);
        }
    };

    const filteredTransportistas = transportistas.filter(t =>
        t.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.cuit.includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="vehiculos-loading">
                <RefreshCw size={32} className="spin" />
                <p>Cargando transportistas...</p>
            </div>
        );
    }

    return (
        <div className="vehiculos-page">
            {/* Header */}
            <div className="vehiculos-header">
                <button className="btn-back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <div className="header-info">
                    <h1>Gestión de Flota</h1>
                    <p>Vehículos y choferes de transportistas</p>
                </div>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="success-banner">
                    <Check size={18} />
                    {successMessage}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="error-banner">
                    <AlertTriangle size={18} />
                    {error}
                    <button onClick={() => setError('')}><X size={16} /></button>
                </div>
            )}

            {/* Search */}
            <div className="vehiculos-search">
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Buscar transportista por nombre o CUIT..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Transportistas List */}
            <div className="transportistas-list">
                {filteredTransportistas.length > 0 ? (
                    filteredTransportistas.map(transportista => (
                        <div key={transportista.id} className="transportista-card">
                            <div
                                className="transportista-header"
                                onClick={() => setExpandedTransportista(
                                    expandedTransportista === transportista.id ? null : transportista.id
                                )}
                            >
                                <div className="transportista-info">
                                    <Truck size={24} />
                                    <div>
                                        <h3>{transportista.razonSocial}</h3>
                                        <span className="cuit">CUIT: {transportista.cuit}</span>
                                    </div>
                                </div>
                                <div className="transportista-stats">
                                    <span className="stat">
                                        <Truck size={14} />
                                        {transportista.vehiculos?.length || 0}
                                    </span>
                                    <span className="stat">
                                        <User size={14} />
                                        {transportista.choferes?.length || 0}
                                    </span>
                                    {expandedTransportista === transportista.id ? (
                                        <ChevronUp size={20} />
                                    ) : (
                                        <ChevronDown size={20} />
                                    )}
                                </div>
                            </div>

                            {expandedTransportista === transportista.id && (
                                <div className="transportista-content">
                                    {/* Vehículos */}
                                    <div className="section-header">
                                        <h4><Truck size={18} /> Vehículos</h4>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => {
                                                setSelectedTransportista(transportista);
                                                setShowVehiculoModal(true);
                                            }}
                                        >
                                            <Plus size={16} />
                                            Agregar
                                        </button>
                                    </div>
                                    {(transportista.vehiculos?.length ?? 0) > 0 ? (
                                        <div className="items-grid">
                                            {transportista.vehiculos?.map(vehiculo => (
                                                <div key={vehiculo.id} className="item-card vehiculo">
                                                    <div className="item-header">
                                                        <span className="patente">{vehiculo.patente}</span>
                                                        <span className={`status ${vehiculo.habilitado ? 'activo' : 'inactivo'}`}>
                                                            {vehiculo.habilitado ? 'Habilitado' : 'No habilitado'}
                                                        </span>
                                                    </div>
                                                    <div className="item-body">
                                                        <p>{vehiculo.marca} {vehiculo.modelo} ({vehiculo.anio})</p>
                                                        <p className="detail">
                                                            {vehiculo.tipoVehiculo} - {vehiculo.capacidadKg?.toLocaleString()} kg
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="empty-message">No hay vehículos registrados</p>
                                    )}

                                    {/* Choferes */}
                                    <div className="section-header">
                                        <h4><User size={18} /> Choferes</h4>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => {
                                                setSelectedTransportista(transportista);
                                                setShowChoferModal(true);
                                            }}
                                        >
                                            <Plus size={16} />
                                            Agregar
                                        </button>
                                    </div>
                                    {(transportista.choferes?.length ?? 0) > 0 ? (
                                        <div className="items-grid">
                                            {transportista.choferes?.map(chofer => (
                                                <div key={chofer.id} className="item-card chofer">
                                                    <div className="item-header">
                                                        <span className="nombre">{chofer.nombre} {chofer.apellido}</span>
                                                        <span className={`status ${chofer.habilitado ? 'activo' : 'inactivo'}`}>
                                                            {chofer.habilitado ? 'Habilitado' : 'No habilitado'}
                                                        </span>
                                                    </div>
                                                    <div className="item-body">
                                                        <p>DNI: {chofer.dni}</p>
                                                        <p className="detail">
                                                            Licencia: {chofer.licencia}
                                                            {chofer.vencimientoLicencia && (
                                                                <> - Vence: {new Date(chofer.vencimientoLicencia).toLocaleDateString('es-AR')}</>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="empty-message">No hay choferes registrados</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <Truck size={48} />
                        <h3>No hay transportistas</h3>
                        <p>No se encontraron transportistas con los criterios de búsqueda</p>
                    </div>
                )}
            </div>

            {/* Modal Agregar Vehículo */}
            {showVehiculoModal && (
                <div className="modal-overlay" onClick={() => setShowVehiculoModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Agregar Vehículo</h2>
                            <button onClick={() => setShowVehiculoModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-subtitle">
                                Transportista: <strong>{selectedTransportista?.razonSocial}</strong>
                            </p>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Patente *</label>
                                    <input
                                        type="text"
                                        value={vehiculoForm.patente}
                                        onChange={e => setVehiculoForm({ ...vehiculoForm, patente: e.target.value.toUpperCase() })}
                                        placeholder="ABC123"
                                        maxLength={7}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Tipo de Vehículo</label>
                                    <select
                                        value={vehiculoForm.tipoVehiculo}
                                        onChange={e => setVehiculoForm({ ...vehiculoForm, tipoVehiculo: e.target.value })}
                                    >
                                        <option value="CAMION">Camión</option>
                                        <option value="SEMIRREMOLQUE">Semirremolque</option>
                                        <option value="CISTERNA">Cisterna</option>
                                        <option value="FURGON">Furgón</option>
                                        <option value="OTRO">Otro</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Marca *</label>
                                    <input
                                        type="text"
                                        value={vehiculoForm.marca}
                                        onChange={e => setVehiculoForm({ ...vehiculoForm, marca: e.target.value })}
                                        placeholder="Mercedes Benz"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Modelo *</label>
                                    <input
                                        type="text"
                                        value={vehiculoForm.modelo}
                                        onChange={e => setVehiculoForm({ ...vehiculoForm, modelo: e.target.value })}
                                        placeholder="Atego 1726"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Año</label>
                                    <input
                                        type="number"
                                        value={vehiculoForm.anio}
                                        onChange={e => setVehiculoForm({ ...vehiculoForm, anio: parseInt(e.target.value) })}
                                        min={1990}
                                        max={new Date().getFullYear() + 1}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Capacidad (kg)</label>
                                    <input
                                        type="number"
                                        value={vehiculoForm.capacidadKg}
                                        onChange={e => setVehiculoForm({ ...vehiculoForm, capacidadKg: parseInt(e.target.value) })}
                                        min={0}
                                        placeholder="15000"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setShowVehiculoModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleAddVehiculo}
                                disabled={saving || !vehiculoForm.patente || !vehiculoForm.marca || !vehiculoForm.modelo}
                            >
                                {saving ? <RefreshCw size={18} className="spin" /> : <Plus size={18} />}
                                Agregar Vehículo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Agregar Chofer */}
            {showChoferModal && (
                <div className="modal-overlay" onClick={() => setShowChoferModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Agregar Chofer</h2>
                            <button onClick={() => setShowChoferModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-subtitle">
                                Transportista: <strong>{selectedTransportista?.razonSocial}</strong>
                            </p>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Nombre *</label>
                                    <input
                                        type="text"
                                        value={choferForm.nombre}
                                        onChange={e => setChoferForm({ ...choferForm, nombre: e.target.value })}
                                        placeholder="Juan"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Apellido *</label>
                                    <input
                                        type="text"
                                        value={choferForm.apellido}
                                        onChange={e => setChoferForm({ ...choferForm, apellido: e.target.value })}
                                        placeholder="Pérez"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>DNI *</label>
                                    <input
                                        type="text"
                                        value={choferForm.dni}
                                        onChange={e => setChoferForm({ ...choferForm, dni: e.target.value })}
                                        placeholder="12345678"
                                        maxLength={8}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>N° Licencia *</label>
                                    <input
                                        type="text"
                                        value={choferForm.licencia}
                                        onChange={e => setChoferForm({ ...choferForm, licencia: e.target.value })}
                                        placeholder="123456789"
                                    />
                                </div>
                                <div className="form-group full-width">
                                    <label>Vencimiento Licencia</label>
                                    <input
                                        type="date"
                                        value={choferForm.vencimientoLicencia}
                                        onChange={e => setChoferForm({ ...choferForm, vencimientoLicencia: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setShowChoferModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleAddChofer}
                                disabled={saving || !choferForm.nombre || !choferForm.apellido || !choferForm.dni || !choferForm.licencia}
                            >
                                {saving ? <RefreshCw size={18} className="spin" /> : <Plus size={18} />}
                                Agregar Chofer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehiculosChoferes;
