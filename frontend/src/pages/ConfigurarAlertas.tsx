import React, { useState, useEffect } from 'react';
import {
    Bell,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    AlertTriangle,
    CheckCircle,
    Clock,
    Truck,
    Scale,
    XCircle,
    Calendar,
    MapPin,
    Loader2,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import { alertaService, type ReglaAlerta } from '../services/notification.service';
import './ConfigurarAlertas.css';

const eventosDisponibles = [
    { value: 'CAMBIO_ESTADO', label: 'Cambio de Estado', icon: <CheckCircle size={16} /> },
    { value: 'INCIDENTE', label: 'Incidente Reportado', icon: <AlertTriangle size={16} /> },
    { value: 'DESVIO_RUTA', label: 'Desvío de Ruta', icon: <MapPin size={16} /> },
    { value: 'TIEMPO_EXCESIVO', label: 'Tiempo Excesivo', icon: <Clock size={16} /> },
    { value: 'DIFERENCIA_PESO', label: 'Diferencia de Peso', icon: <Scale size={16} /> },
    { value: 'RECHAZO_CARGA', label: 'Rechazo de Carga', icon: <XCircle size={16} /> },
    { value: 'VENCIMIENTO', label: 'Vencimiento Próximo', icon: <Calendar size={16} /> },
    { value: 'ANOMALIA_GPS', label: 'Anomalía GPS', icon: <Truck size={16} /> },
];

const rolesDisponibles = [
    { value: 'ADMIN', label: 'Administradores' },
    { value: 'GENERADOR', label: 'Generadores' },
    { value: 'TRANSPORTISTA', label: 'Transportistas' },
    { value: 'OPERADOR', label: 'Operadores' },
];

const ConfigurarAlertas: React.FC = () => {
    const [reglas, setReglas] = useState<ReglaAlerta[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState<ReglaAlerta | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

    // Form state
    const [form, setForm] = useState({
        nombre: '',
        descripcion: '',
        evento: '',
        destinatarios: [] as string[],
        activa: true,
        condiciones: {
            umbral: '',
            unidad: 'minutos'
        }
    });

    useEffect(() => {
        cargarReglas();
    }, []);

    const cargarReglas = async () => {
        setLoading(true);
        try {
            const data = await alertaService.getReglas();
            setReglas(data);
        } catch (error) {
            console.error('Error:', error);
            setMensaje({ tipo: 'error', texto: 'Error al cargar reglas' });
        } finally {
            setLoading(false);
        }
    };

    const abrirModal = (regla?: ReglaAlerta) => {
        if (regla) {
            setEditando(regla);
            const condicion = JSON.parse(regla.condicion || '{}');
            const destinatarios = JSON.parse(regla.destinatarios || '[]');
            setForm({
                nombre: regla.nombre,
                descripcion: regla.descripcion || '',
                evento: regla.evento,
                destinatarios,
                activa: regla.activa,
                condiciones: {
                    umbral: condicion.umbral || '',
                    unidad: condicion.unidad || 'minutos'
                }
            });
        } else {
            setEditando(null);
            setForm({
                nombre: '',
                descripcion: '',
                evento: '',
                destinatarios: ['ADMIN'],
                activa: true,
                condiciones: { umbral: '', unidad: 'minutos' }
            });
        }
        setModalOpen(true);
    };

    const cerrarModal = () => {
        setModalOpen(false);
        setEditando(null);
    };

    const guardarRegla = async () => {
        if (!form.nombre || !form.evento || form.destinatarios.length === 0) {
            setMensaje({ tipo: 'error', texto: 'Complete todos los campos requeridos' });
            return;
        }

        setGuardando(true);
        try {
            const data = {
                nombre: form.nombre,
                descripcion: form.descripcion,
                evento: form.evento,
                condicion: JSON.stringify(form.condiciones),
                destinatarios: JSON.stringify(form.destinatarios),
                activa: form.activa
            };

            if (editando) {
                await alertaService.actualizarRegla(editando.id, data);
                setMensaje({ tipo: 'success', texto: 'Regla actualizada correctamente' });
            } else {
                await alertaService.crearRegla(data);
                setMensaje({ tipo: 'success', texto: 'Regla creada correctamente' });
            }

            cerrarModal();
            cargarReglas();
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error al guardar la regla' });
        } finally {
            setGuardando(false);
        }
    };

    const toggleActiva = async (regla: ReglaAlerta) => {
        try {
            await alertaService.actualizarRegla(regla.id, { activa: !regla.activa });
            setReglas(prev =>
                prev.map(r => r.id === regla.id ? { ...r, activa: !r.activa } : r)
            );
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error al actualizar estado' });
        }
    };

    const eliminarRegla = async (id: string) => {
        if (!confirm('¿Eliminar esta regla de alerta?')) return;

        try {
            await alertaService.eliminarRegla(id);
            setReglas(prev => prev.filter(r => r.id !== id));
            setMensaje({ tipo: 'success', texto: 'Regla eliminada' });
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error al eliminar' });
        }
    };

    const toggleDestinatario = (rol: string) => {
        setForm(prev => ({
            ...prev,
            destinatarios: prev.destinatarios.includes(rol)
                ? prev.destinatarios.filter(r => r !== rol)
                : [...prev.destinatarios, rol]
        }));
    };

    return (
        <div className="alertas-page">
            <div className="page-header">
                <div>
                    <h1>Configurar Alertas</h1>
                    <p>Define reglas para generar alertas automáticas</p>
                </div>
                <button className="btn btn-primary" onClick={() => abrirModal()}>
                    <Plus size={18} />
                    Nueva Regla
                </button>
            </div>

            {mensaje && (
                <div className={`message ${mensaje.tipo}`}>
                    {mensaje.tipo === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {mensaje.texto}
                    <button className="message-close" onClick={() => setMensaje(null)}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {loading ? (
                <div className="loading-state">
                    <Loader2 size={40} className="spin" />
                    <p>Cargando reglas...</p>
                </div>
            ) : reglas.length === 0 ? (
                <div className="empty-state">
                    <Bell size={48} />
                    <h3>No hay reglas configuradas</h3>
                    <p>Crea tu primera regla de alerta para comenzar a monitorear eventos</p>
                    <button className="btn btn-primary" onClick={() => abrirModal()}>
                        <Plus size={18} />
                        Crear Regla
                    </button>
                </div>
            ) : (
                <div className="reglas-grid">
                    {reglas.map(regla => {
                        const eventoInfo = eventosDisponibles.find(e => e.value === regla.evento);
                        const destinatarios = JSON.parse(regla.destinatarios || '[]');

                        return (
                            <div key={regla.id} className={`regla-card ${!regla.activa ? 'inactiva' : ''}`}>
                                <div className="regla-header">
                                    <div className="regla-icon">
                                        {eventoInfo?.icon || <Bell size={20} />}
                                    </div>
                                    <div className="regla-info">
                                        <h3>{regla.nombre}</h3>
                                        <span className="evento-tag">{eventoInfo?.label || regla.evento}</span>
                                    </div>
                                    <button
                                        className="toggle-btn"
                                        onClick={() => toggleActiva(regla)}
                                        title={regla.activa ? 'Desactivar' : 'Activar'}
                                    >
                                        {regla.activa ? (
                                            <ToggleRight size={28} className="active" />
                                        ) : (
                                            <ToggleLeft size={28} />
                                        )}
                                    </button>
                                </div>

                                {regla.descripcion && (
                                    <p className="regla-descripcion">{regla.descripcion}</p>
                                )}

                                <div className="regla-destinatarios">
                                    <span className="label">Notificar a:</span>
                                    <div className="tags">
                                        {destinatarios.map((rol: string) => (
                                            <span key={rol} className="tag">{rol}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="regla-stats">
                                    <span>{regla._count?.alertasGeneradas || 0} alertas generadas</span>
                                </div>

                                <div className="regla-actions">
                                    <button className="btn-icon" onClick={() => abrirModal(regla)}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="btn-icon danger" onClick={() => eliminarRegla(regla.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>
                                <Bell size={20} />
                                {editando ? 'Editar Regla' : 'Nueva Regla de Alerta'}
                            </h3>
                            <button className="btn-close" onClick={cerrarModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Nombre de la Regla *</label>
                                <input
                                    type="text"
                                    value={form.nombre}
                                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                    placeholder="Ej: Alerta por tiempo excesivo"
                                />
                            </div>

                            <div className="form-group">
                                <label>Descripción</label>
                                <input
                                    type="text"
                                    value={form.descripcion}
                                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                                    placeholder="Descripción opcional de la regla"
                                />
                            </div>

                            <div className="form-group">
                                <label>Evento Disparador *</label>
                                <div className="evento-selector">
                                    {eventosDisponibles.map(evento => (
                                        <button
                                            key={evento.value}
                                            type="button"
                                            className={`evento-btn ${form.evento === evento.value ? 'selected' : ''}`}
                                            onClick={() => setForm({ ...form, evento: evento.value })}
                                        >
                                            {evento.icon}
                                            <span>{evento.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(form.evento === 'TIEMPO_EXCESIVO' || form.evento === 'DIFERENCIA_PESO') && (
                                <div className="form-group">
                                    <label>Umbral</label>
                                    <div className="umbral-input">
                                        <input
                                            type="number"
                                            value={form.condiciones.umbral}
                                            onChange={(e) => setForm({
                                                ...form,
                                                condiciones: { ...form.condiciones, umbral: e.target.value }
                                            })}
                                            placeholder="Valor"
                                        />
                                        <select
                                            value={form.condiciones.unidad}
                                            onChange={(e) => setForm({
                                                ...form,
                                                condiciones: { ...form.condiciones, unidad: e.target.value }
                                            })}
                                        >
                                            {form.evento === 'TIEMPO_EXCESIVO' ? (
                                                <>
                                                    <option value="minutos">Minutos</option>
                                                    <option value="horas">Horas</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="porcentaje">%</option>
                                                    <option value="kg">Kg</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Notificar a *</label>
                                <div className="destinatarios-selector">
                                    {rolesDisponibles.map(rol => (
                                        <button
                                            key={rol.value}
                                            type="button"
                                            className={`dest-btn ${form.destinatarios.includes(rol.value) ? 'selected' : ''}`}
                                            onClick={() => toggleDestinatario(rol.value)}
                                        >
                                            {form.destinatarios.includes(rol.value) ? (
                                                <CheckCircle size={16} />
                                            ) : (
                                                <div className="circle-empty" />
                                            )}
                                            {rol.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={cerrarModal}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={guardarRegla}
                                disabled={guardando}
                            >
                                {guardando ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                                {editando ? 'Guardar Cambios' : 'Crear Regla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfigurarAlertas;
