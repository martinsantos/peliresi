import React, { useState, useEffect } from 'react';
import { actorService } from '../services/admin.service';
import type { Generador, Transportista, Operador } from '../services/admin.service';
import { demoGeneradores, demoTransportistas, demoOperadores } from '../data/demoActores';
import {
    Factory,
    Truck,
    Building2,
    Plus,
    Search,
    Edit2,
    Trash2,
    X,
    Save,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Check
} from 'lucide-react';
import './GestionActores.css';

type ActorType = 'generadores' | 'transportistas' | 'operadores';

interface ModalState {
    open: boolean;
    mode: 'create' | 'edit';
    type: ActorType;
    data: any;
}

const GestionActores: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActorType>('generadores');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [generadores, setGeneradores] = useState<Generador[]>([]);
    const [transportistas, setTransportistas] = useState<Transportista[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
    const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create', type: 'generadores', data: {} });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Demo data fallback - ahora importados de ../data/demoActores

    useEffect(() => {
        cargarDatos();
    }, [activeTab, pagination.page]);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const params = { search, page: pagination.page, limit: pagination.limit };

            if (activeTab === 'generadores') {
                const result = await actorService.getGeneradores(params);
                setGeneradores(result?.generadores || []);
                setPagination(prev => ({ ...prev, ...(result?.pagination || {}) }));
            } else if (activeTab === 'transportistas') {
                const result = await actorService.getTransportistas(params);
                setTransportistas(result?.transportistas || []);
                setPagination(prev => ({ ...prev, ...(result?.pagination || {}) }));
            } else {
                const result = await actorService.getOperadores(params);
                setOperadores(result?.operadores || []);
                setPagination(prev => ({ ...prev, ...(result?.pagination || {}) }));
            }
        } catch (error) {
            console.error('Error loading actores, using demo data:', error);
            // Usar datos demo en caso de error
            if (activeTab === 'generadores') {
                setGeneradores(demoGeneradores);
                setPagination(prev => ({ ...prev, total: demoGeneradores.length, pages: 1 }));
            } else if (activeTab === 'transportistas') {
                setTransportistas(demoTransportistas);
                setPagination(prev => ({ ...prev, total: demoTransportistas.length, pages: 1 }));
            } else {
                setOperadores(demoOperadores);
                setPagination(prev => ({ ...prev, total: demoOperadores.length, pages: 1 }));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPagination(prev => ({ ...prev, page: 1 }));
        cargarDatos();
    };

    const openModal = (mode: 'create' | 'edit', data: any = {}) => {
        setModal({ open: true, mode, type: activeTab, data });
    };

    const closeModal = () => {
        setModal({ open: false, mode: 'create', type: 'generadores', data: {} });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (modal.mode === 'create') {
                if (activeTab === 'generadores') {
                    const result = await actorService.createGenerador(modal.data);
                    setMessage({ type: 'success', text: result.message || 'Generador creado' });
                } else if (activeTab === 'transportistas') {
                    const result = await actorService.createTransportista(modal.data);
                    setMessage({ type: 'success', text: result.message || 'Transportista creado' });
                } else {
                    const result = await actorService.createOperador(modal.data);
                    setMessage({ type: 'success', text: result.message || 'Operador creado' });
                }
            } else {
                if (activeTab === 'generadores') {
                    await actorService.updateGenerador(modal.data.id, modal.data);
                } else if (activeTab === 'transportistas') {
                    await actorService.updateTransportista(modal.data.id, modal.data);
                } else {
                    await actorService.updateOperador(modal.data.id, modal.data);
                }
                setMessage({ type: 'success', text: 'Actualizado correctamente' });
            }
            closeModal();
            cargarDatos();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Error al guardar' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar este registro?')) return;

        try {
            if (activeTab === 'generadores') {
                await actorService.deleteGenerador(id);
            } else if (activeTab === 'operadores') {
                await actorService.deleteOperador(id);
            }
            setMessage({ type: 'success', text: 'Eliminado correctamente' });
            cargarDatos();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Error al eliminar' });
        }
    };

    const updateModalData = (field: string, value: any) => {
        setModal(prev => ({
            ...prev,
            data: { ...prev.data, [field]: value }
        }));
    };

    const getTabIcon = (type: ActorType) => {
        switch (type) {
            case 'generadores': return <Factory size={18} />;
            case 'transportistas': return <Truck size={18} />;
            case 'operadores': return <Building2 size={18} />;
        }
    };

    const getTabLabel = (type: ActorType) => {
        switch (type) {
            case 'generadores': return 'Generadores';
            case 'transportistas': return 'Transportistas';
            case 'operadores': return 'Operadores';
        }
    };

    return (
        <div className="gestion-page animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Gestión de Actores</h1>
                    <p>Administra generadores, transportistas y operadores del sistema</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal('create')}>
                    <Plus size={18} />
                    Nuevo {getTabLabel(activeTab).slice(0, -2)}
                </button>
            </div>

            {/* Message */}
            {message && (
                <div className={`message ${message.type}`}>
                    {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    {message.text}
                    <button className="message-close" onClick={() => setMessage(null)}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="actor-tabs">
                {(['generadores', 'transportistas', 'operadores'] as ActorType[]).map(type => (
                    <button
                        key={type}
                        className={`tab-btn ${activeTab === type ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab(type);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    >
                        {getTabIcon(type)}
                        {getTabLabel(type)}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="search-bar">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por razón social o CUIT..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                <button className="btn btn-secondary" onClick={handleSearch}>
                    Buscar
                </button>
            </div>

            {/* Table */}
            <div className="table-card">
                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={32} className="spin" />
                        <p>Cargando...</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards View */}
                        <div className="actor-cards">
                            {activeTab === 'generadores' && generadores.map(g => (
                                <div key={g.id} className="actor-card">
                                    <div className="actor-card-header">
                                        <div className="actor-card-icon generador">
                                            <Factory size={20} />
                                        </div>
                                        <div className="actor-card-title">
                                            <span className="actor-name">{g.razonSocial}</span>
                                            <span className="actor-cuit">{g.cuit}</span>
                                        </div>
                                        <span className={`badge ${g.activo ? 'badge-success' : 'badge-warning'}`}>
                                            {g.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                    <div className="actor-card-body">
                                        <div className="actor-details-grid">
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Email</span>
                                                <span className="actor-detail-value">{g.email || '—'}</span>
                                            </div>
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Teléfono</span>
                                                <span className="actor-detail-value">{g.telefono || '—'}</span>
                                            </div>
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Manifiestos</span>
                                                <span className="actor-detail-value">{g._count?.manifiestos || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="actor-card-actions">
                                        <button className="actor-action-btn primary" onClick={() => openModal('edit', g)}>
                                            <Edit2 size={18} />
                                            <span>Editar</span>
                                        </button>
                                        <button className="actor-action-btn danger" onClick={() => handleDelete(g.id)}>
                                            <Trash2 size={18} />
                                            <span>Eliminar</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {activeTab === 'transportistas' && transportistas.map(t => (
                                <div key={t.id} className="actor-card">
                                    <div className="actor-card-header">
                                        <div className="actor-card-icon transportista">
                                            <Truck size={20} />
                                        </div>
                                        <div className="actor-card-title">
                                            <span className="actor-name">{t.razonSocial}</span>
                                            <span className="actor-cuit">{t.cuit}</span>
                                        </div>
                                        <span className={`badge ${t.activo ? 'badge-success' : 'badge-warning'}`}>
                                            {t.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                    <div className="actor-card-body">
                                        <div className="actor-details-grid">
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Email</span>
                                                <span className="actor-detail-value">{t.email || '—'}</span>
                                            </div>
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Teléfono</span>
                                                <span className="actor-detail-value">{t.telefono || '—'}</span>
                                            </div>
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Flota</span>
                                                <span className="actor-detail-value">
                                                    {t.vehiculos?.length || 0} vehículos
                                                    <small>{t.choferes?.length || 0} choferes</small>
                                                </span>
                                            </div>
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Manifiestos</span>
                                                <span className="actor-detail-value">{t._count?.manifiestos || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="actor-card-actions">
                                        <button className="actor-action-btn primary" onClick={() => openModal('edit', t)}>
                                            <Edit2 size={18} />
                                            <span>Editar</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {activeTab === 'operadores' && operadores.map(o => (
                                <div key={o.id} className="actor-card">
                                    <div className="actor-card-header">
                                        <div className="actor-card-icon operador">
                                            <Building2 size={20} />
                                        </div>
                                        <div className="actor-card-title">
                                            <span className="actor-name">{o.razonSocial}</span>
                                            <span className="actor-cuit">{o.cuit}</span>
                                        </div>
                                        <span className={`badge ${o.activo ? 'badge-success' : 'badge-warning'}`}>
                                            {o.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                    <div className="actor-card-body">
                                        <div className="actor-details-grid">
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Email</span>
                                                <span className="actor-detail-value">{o.email || '—'}</span>
                                            </div>
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Teléfono</span>
                                                <span className="actor-detail-value">{o.telefono || '—'}</span>
                                            </div>
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Categoría</span>
                                                <span className="actor-detail-value">{o.categoria || '—'}</span>
                                            </div>
                                            <div className="actor-detail">
                                                <span className="actor-detail-label">Manifiestos</span>
                                                <span className="actor-detail-value">{o._count?.manifiestos || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="actor-card-actions">
                                        <button className="actor-action-btn primary" onClick={() => openModal('edit', o)}>
                                            <Edit2 size={18} />
                                            <span>Editar</span>
                                        </button>
                                        <button className="actor-action-btn danger" onClick={() => handleDelete(o.id)}>
                                            <Trash2 size={18} />
                                            <span>Eliminar</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Razón Social</th>
                                        <th>CUIT</th>
                                        <th>Email</th>
                                        <th>Teléfono</th>
                                        <th>Estado</th>
                                        <th>Manifiestos</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeTab === 'generadores' && generadores.map(g => (
                                        <tr key={g.id}>
                                            <td><strong>{g.razonSocial}</strong></td>
                                            <td>{g.cuit}</td>
                                            <td>{g.email}</td>
                                            <td>{g.telefono}</td>
                                            <td>
                                                <span className={`badge ${g.activo ? 'badge-success' : 'badge-warning'}`}>
                                                    {g.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>{g._count?.manifiestos || 0}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-icon" onClick={() => openModal('edit', g)}>
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button className="btn-icon danger" onClick={() => handleDelete(g.id)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {activeTab === 'transportistas' && transportistas.map(t => (
                                        <tr key={t.id}>
                                            <td>
                                                <strong>{t.razonSocial}</strong>
                                                <br />
                                                <small>{t.vehiculos?.length || 0} vehículos, {t.choferes?.length || 0} choferes</small>
                                            </td>
                                            <td>{t.cuit}</td>
                                            <td>{t.email}</td>
                                            <td>{t.telefono}</td>
                                            <td>
                                                <span className={`badge ${t.activo ? 'badge-success' : 'badge-warning'}`}>
                                                    {t.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>{t._count?.manifiestos || 0}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-icon" onClick={() => openModal('edit', t)}>
                                                        <Edit2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {activeTab === 'operadores' && operadores.map(o => (
                                        <tr key={o.id}>
                                            <td>
                                                <strong>{o.razonSocial}</strong>
                                                <br />
                                                <small>{o.categoria}</small>
                                            </td>
                                            <td>{o.cuit}</td>
                                            <td>{o.email}</td>
                                            <td>{o.telefono}</td>
                                            <td>
                                                <span className={`badge ${o.activo ? 'badge-success' : 'badge-warning'}`}>
                                                    {o.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>{o._count?.manifiestos || 0}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-icon" onClick={() => openModal('edit', o)}>
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button className="btn-icon danger" onClick={() => handleDelete(o.id)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="pagination">
                            <span className="pagination-info">
                                Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                            </span>
                            <div className="pagination-controls">
                                <button
                                    className="btn btn-ghost"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span>Página {pagination.page} de {pagination.pages}</span>
                                <button
                                    className="btn btn-ghost"
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal */}
            {modal.open && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {getTabIcon(activeTab)}
                                {modal.mode === 'create' ? 'Nuevo' : 'Editar'} {getTabLabel(activeTab).slice(0, -2)}
                            </h3>
                            <button className="btn-close" onClick={closeModal}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Razón Social *</label>
                                    <input
                                        type="text"
                                        value={modal.data.razonSocial || ''}
                                        onChange={(e) => updateModalData('razonSocial', e.target.value)}
                                        placeholder="Nombre de la empresa"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>CUIT *</label>
                                    <input
                                        type="text"
                                        value={modal.data.cuit || ''}
                                        onChange={(e) => updateModalData('cuit', e.target.value)}
                                        placeholder="XX-XXXXXXXX-X"
                                        disabled={modal.mode === 'edit'}
                                    />
                                </div>
                                <div className="form-group full-width">
                                    <label>Domicilio *</label>
                                    <input
                                        type="text"
                                        value={modal.data.domicilio || ''}
                                        onChange={(e) => updateModalData('domicilio', e.target.value)}
                                        placeholder="Dirección completa"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={modal.data.email || ''}
                                        onChange={(e) => updateModalData('email', e.target.value)}
                                        placeholder="correo@empresa.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Teléfono *</label>
                                    <input
                                        type="text"
                                        value={modal.data.telefono || ''}
                                        onChange={(e) => updateModalData('telefono', e.target.value)}
                                        placeholder="+54 XXX XXXXXXX"
                                    />
                                </div>

                                {activeTab === 'generadores' && (
                                    <>
                                        <div className="form-group">
                                            <label>N° Inscripción</label>
                                            <input
                                                type="text"
                                                value={modal.data.numeroInscripcion || ''}
                                                onChange={(e) => updateModalData('numeroInscripcion', e.target.value)}
                                                placeholder="Número de inscripción"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Categoría</label>
                                            <select
                                                value={modal.data.categoria || ''}
                                                onChange={(e) => updateModalData('categoria', e.target.value)}
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="GRAN_GENERADOR">Gran Generador</option>
                                                <option value="MEDIANO_GENERADOR">Mediano Generador</option>
                                                <option value="PEQUEÑO_GENERADOR">Pequeño Generador</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                {(activeTab === 'transportistas' || activeTab === 'operadores') && (
                                    <div className="form-group">
                                        <label>N° Habilitación</label>
                                        <input
                                            type="text"
                                            value={modal.data.numeroHabilitacion || ''}
                                            onChange={(e) => updateModalData('numeroHabilitacion', e.target.value)}
                                            placeholder="Número de habilitación"
                                        />
                                    </div>
                                )}

                                {activeTab === 'operadores' && (
                                    <div className="form-group">
                                        <label>Categoría</label>
                                        <select
                                            value={modal.data.categoria || ''}
                                            onChange={(e) => updateModalData('categoria', e.target.value)}
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="TRATAMIENTO">Tratamiento</option>
                                            <option value="DISPOSICION_FINAL">Disposición Final</option>
                                            <option value="RECICLAJE">Reciclaje</option>
                                        </select>
                                    </div>
                                )}

                                {modal.mode === 'edit' && (
                                    <div className="form-group">
                                        <label>Estado</label>
                                        <select
                                            value={modal.data.activo ? 'true' : 'false'}
                                            onChange={(e) => updateModalData('activo', e.target.value === 'true')}
                                        >
                                            <option value="true">Activo</option>
                                            <option value="false">Inactivo</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={closeModal}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                                {modal.mode === 'create' ? 'Crear' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionActores;
