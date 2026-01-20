import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { manifiestoService } from '../services/manifiesto.service';
import { pdfService } from '../services/admin.service';
import type { Manifiesto } from '../types';
import {
    ArrowLeft,
    FileText,
    Truck,
    Factory,
    Building2,
    MapPin,
    Clock,
    CheckCircle,
    AlertTriangle,
    Edit3,
    Download,
    QrCode,
    ArrowRight,
    X,
    Award,
    Loader2,
    Map,
    Flame,
    Beaker,
    Droplets,
    Box,
    Recycle,
    Trash2,
    Leaf,
    MoreHorizontal,
    FlaskConical,
    RotateCcw
} from 'lucide-react';
import ManifiestoMap from '../components/mobile/ManifiestoMap';
import ReversionModal from '../components/ReversionModal';
import './ManifiestoDetalle.css';

const ManifiestoDetalle: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [manifiesto, setManifiesto] = useState<Manifiesto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [downloadingCert, setDownloadingCert] = useState(false);

    // CU-G07: Estados para modal de firma
    const [showFirmaModal, setShowFirmaModal] = useState(false);
    const [metodoFirma, setMetodoFirma] = useState<'USUARIO_PASSWORD' | 'TOKEN_PIN' | 'CODIGO_SMS' | 'CERTIFICADO_DIGITAL'>('USUARIO_PASSWORD');
    const [tokenPin, setTokenPin] = useState('');
    const [codigoSMS, setCodigoSMS] = useState('');

    // Estados para modal de tratamiento (OPERADOR)
    const [showTratamientoModal, setShowTratamientoModal] = useState(false);
    const [tipoTratamiento, setTipoTratamiento] = useState('');
    const [tratamientoLoading, setTratamientoLoading] = useState(false);
    const [enviandoSMS, setEnviandoSMS] = useState(false);
    const [smsEnviado, setSmsEnviado] = useState(false);
    const [firmaLoading, setFirmaLoading] = useState(false);

    // Estados para modal de reversión
    const [showReversionModal, setShowReversionModal] = useState(false);
    const [reversionType, setReversionType] = useState<'entrega' | 'recepcion' | 'certificado' | 'admin'>('entrega');

    useEffect(() => {
        if (id) {
            loadManifiesto();
        }
    }, [id]);

    const loadManifiesto = async () => {
        try {
            setLoading(true);
            const data = await manifiestoService.getManifiesto(id!);
            setManifiesto(data);
        } catch (err: any) {
            console.error('Error loading manifiesto:', err);
            setError('Error al cargar el detalle del manifiesto');
        } finally {
            setLoading(false);
        }
    };

    // CU-G07: Handler para firmar con método seleccionado
    const handleFirmarConMetodo = async () => {
        if (!manifiesto) return;

        setFirmaLoading(true);
        try {
            // Usar firmarManifiesto que es el endpoint que existe en el backend
            const updated = await manifiestoService.firmarManifiesto(manifiesto.id);

            if (updated) {
                setManifiesto(updated);
                setShowFirmaModal(false);
                resetFirmaForm();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al firmar el manifiesto');
        } finally {
            setFirmaLoading(false);
        }
    };

    // Handler para registrar tratamiento con tipo seleccionado
    const handleRegistrarTratamiento = async () => {
        if (!manifiesto || !tipoTratamiento) return;

        setTratamientoLoading(true);
        try {
            const updated = await manifiestoService.registrarTratamiento(manifiesto.id, {
                metodoTratamiento: tipoTratamiento
            });

            if (updated) {
                setManifiesto(updated);
                setShowTratamientoModal(false);
                setTipoTratamiento('');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al registrar tratamiento');
        } finally {
            setTratamientoLoading(false);
        }
    };

    const handleSolicitarSMS = async () => {
        if (!user?.telefono) {
            setError('No hay número de teléfono registrado en tu perfil');
            return;
        }
        setEnviandoSMS(true);
        try {
            const result = await manifiestoService.solicitarCodigoSMS(user.telefono);
            if (result.success) {
                setSmsEnviado(true);
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError('Error al enviar código SMS');
        } finally {
            setEnviandoSMS(false);
        }
    };

    const resetFirmaForm = () => {
        setMetodoFirma('USUARIO_PASSWORD');
        setTokenPin('');
        setCodigoSMS('');
        setSmsEnviado(false);
    };

    const handleAction = async (action: string) => {
        if (!manifiesto) return;

        // CU-G07: Abrir modal de firma en lugar de firmar directamente
        if (action === 'firmar') {
            setShowFirmaModal(true);
            return;
        }

        // Abrir modal de tratamiento para OPERADOR
        if (action === 'tratamiento') {
            setShowTratamientoModal(true);
            return;
        }

        // Abrir modal de reversión según tipo
        if (action === 'revertir-entrega') {
            setReversionType('entrega');
            setShowReversionModal(true);
            return;
        }
        if (action === 'revertir-recepcion') {
            setReversionType('recepcion');
            setShowReversionModal(true);
            return;
        }
        if (action === 'revertir-certificado') {
            setReversionType('certificado');
            setShowReversionModal(true);
            return;
        }

        setActionLoading(true);
        try {
            let updated: Manifiesto | null = null;
            switch (action) {
                case 'confirmar-retiro':
                    updated = await manifiestoService.confirmarRetiro(manifiesto.id, {
                        latitud: -32.8908,
                        longitud: -68.8272
                    });
                    break;
                case 'confirmar-entrega':
                    updated = await manifiestoService.confirmarEntrega(manifiesto.id, {
                        latitud: -32.9234,
                        longitud: -68.8456
                    });
                    break;
                case 'confirmar-recepcion':
                    updated = await manifiestoService.confirmarRecepcion(manifiesto.id, {});
                    break;
                case 'cerrar':
                    const resultado = await manifiestoService.cerrarManifiesto(manifiesto.id, {
                        observaciones: 'Ciclo completo'
                    });
                    updated = resultado.manifiesto;
                    break;
                default:
                    return;
            }
            if (updated) {
                setManifiesto(updated);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al ejecutar la acción');
        } finally {
            setActionLoading(false);
        }
    };

    const getEstadoInfo = (estado: string) => {
        const estados: Record<string, { class: string; label: string; icon: React.ReactNode }> = {
            BORRADOR: { class: 'badge-info', label: 'Borrador', icon: <Edit3 size={16} /> },
            PENDIENTE_APROBACION: { class: 'badge-warning', label: 'Pendiente Aprobación', icon: <Clock size={16} /> },
            APROBADO: { class: 'badge-success', label: 'Aprobado', icon: <CheckCircle size={16} /> },
            EN_TRANSITO: { class: 'badge-warning', label: 'En Tránsito', icon: <Truck size={16} /> },
            ENTREGADO: { class: 'badge-primary', label: 'Entregado', icon: <MapPin size={16} /> },
            RECIBIDO: { class: 'badge-info', label: 'Recibido', icon: <Building2 size={16} /> },
            EN_TRATAMIENTO: { class: 'badge-warning', label: 'En Tratamiento', icon: <Clock size={16} /> },
            TRATADO: { class: 'badge-success', label: 'Tratado', icon: <CheckCircle size={16} /> },
            CERRADO: { class: 'badge-success', label: 'Cerrado', icon: <Award size={16} /> },
        };
        return estados[estado] || { class: 'badge-info', label: estado, icon: <FileText size={16} /> };
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Obtener todas las acciones disponibles para el usuario según su rol y estado del manifiesto
    const getAvailableActions = () => {
        if (!manifiesto || !user) return [];
        const actions: Array<{ action: string; label: string; icon: React.ReactNode; variant?: 'primary' | 'secondary' }> = [];

        switch (manifiesto.estado) {
            case 'BORRADOR':
                if (user.rol === 'GENERADOR') {
                    actions.push({ action: 'firmar', label: 'Firmar Manifiesto', icon: <Edit3 size={18} />, variant: 'primary' });
                }
                break;
            case 'APROBADO':
                if (user.rol === 'TRANSPORTISTA') {
                    actions.push({ action: 'confirmar-retiro', label: 'Confirmar Retiro', icon: <Truck size={18} />, variant: 'primary' });
                }
                break;
            case 'EN_TRANSITO':
                if (user.rol === 'TRANSPORTISTA') {
                    actions.push({ action: 'confirmar-entrega', label: 'Confirmar Entrega', icon: <MapPin size={18} />, variant: 'primary' });
                }
                break;
            case 'ENTREGADO':
                if (user.rol === 'OPERADOR') {
                    actions.push({ action: 'confirmar-recepcion', label: 'Confirmar Recepción', icon: <Building2 size={18} />, variant: 'primary' });
                    // OPERADOR puede rechazar carga (revertir entrega)
                    actions.push({ action: 'revertir-entrega', label: 'Rechazar Carga', icon: <RotateCcw size={18} />, variant: 'secondary' });
                }
                // TRANSPORTISTA puede revertir entrega si operador rechazó
                if (user.rol === 'TRANSPORTISTA' || user.rol === 'ADMIN' || user.rol === 'ADMIN_TRANSPORTISTAS' || user.rol === 'ADMIN_OPERADORES') {
                    actions.push({ action: 'revertir-entrega', label: 'Revertir Entrega', icon: <RotateCcw size={18} />, variant: 'secondary' });
                }
                break;
            case 'RECIBIDO':
                if (user.rol === 'OPERADOR') {
                    // OPERADOR puede iniciar tratamiento (RECIBIDO → EN_TRATAMIENTO)
                    actions.push({ action: 'tratamiento', label: 'Iniciar Tratamiento', icon: <CheckCircle size={18} />, variant: 'primary' });
                }
                // OPERADOR puede revertir recepción
                if (user.rol === 'OPERADOR' || user.rol === 'ADMIN' || user.rol === 'ADMIN_OPERADORES') {
                    actions.push({ action: 'revertir-recepcion', label: 'Revertir Recepción', icon: <RotateCcw size={18} />, variant: 'secondary' });
                }
                break;
            case 'EN_TRATAMIENTO':
                if (user.rol === 'OPERADOR') {
                    // OPERADOR puede cerrar y emitir certificado (EN_TRATAMIENTO → TRATADO)
                    actions.push({ action: 'cerrar', label: 'Cerrar y Emitir Certificado', icon: <Award size={18} />, variant: 'primary' });
                    // OPERADOR puede revertir tratamiento (volver a RECIBIDO)
                    actions.push({ action: 'revertir-certificado', label: 'Revertir a Recibido', icon: <RotateCcw size={18} />, variant: 'secondary' });
                }
                // ADMIN puede revertir tratamiento
                if (user.rol === 'ADMIN' || user.rol === 'ADMIN_OPERADORES') {
                    actions.push({ action: 'revertir-certificado', label: 'Revertir Tratamiento', icon: <RotateCcw size={18} />, variant: 'secondary' });
                }
                break;
            case 'TRATADO':
                // OPERADOR puede revertir certificado
                if (user.rol === 'OPERADOR' || user.rol === 'ADMIN' || user.rol === 'ADMIN_OPERADORES') {
                    actions.push({ action: 'revertir-certificado', label: 'Revertir Certificado', icon: <RotateCcw size={18} />, variant: 'secondary' });
                }
                break;
        }
        return actions;
    };

    
    if (loading) {
        return (
            <div className="detalle-loading">
                <div className="spinner" />
                <p>Cargando manifiesto...</p>
            </div>
        );
    }

    if (error || !manifiesto) {
        return (
            <div className="detalle-error">
                <AlertTriangle size={48} />
                <h2>Error</h2>
                <p>{error || 'No se encontró el manifiesto'}</p>
                <button className="btn btn-primary" onClick={() => navigate('/manifiestos')}>
                    Volver a manifiestos
                </button>
            </div>
        );
    }

    const estadoInfo = getEstadoInfo(manifiesto.estado);

    return (
        <div className="detalle-page animate-fadeIn">
            {/* Header */}
            <div className="detalle-header">
                <button className="btn btn-ghost" onClick={() => navigate('/manifiestos')}>
                    <ArrowLeft size={18} />
                    Volver
                </button>
                <div className="detalle-title">
                    <h2>Manifiesto {manifiesto.numero}</h2>
                    <span className={`badge ${estadoInfo.class}`}>
                        {estadoInfo.icon}
                        {estadoInfo.label}
                    </span>
                </div>
                <div className="detalle-actions">
                    {manifiesto.qrCode && (
                        <button className="btn btn-secondary" onClick={() => setShowQR(true)}>
                            <QrCode size={18} />
                            Ver QR
                        </button>
                    )}
                    <button
                        className="btn btn-secondary"
                        onClick={async () => {
                            setDownloadingPDF(true);
                            try {
                                await pdfService.descargarManifiestoPDF(manifiesto.id);
                            } catch (err) {
                                setError('Error al descargar el PDF');
                            } finally {
                                setDownloadingPDF(false);
                            }
                        }}
                        disabled={downloadingPDF}
                    >
                        {downloadingPDF ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
                        Descargar PDF
                    </button>
                    {manifiesto.estado === 'TRATADO' && (
                        <button
                            className="btn btn-secondary"
                            onClick={async () => {
                                setDownloadingCert(true);
                                try {
                                    await pdfService.descargarCertificadoPDF(manifiesto.id);
                                } catch (err) {
                                    setError('Error al descargar el certificado');
                                } finally {
                                    setDownloadingCert(false);
                                }
                            }}
                            disabled={downloadingCert}
                        >
                            {downloadingCert ? <Loader2 size={18} className="spin" /> : <Award size={18} />}
                            Certificado
                        </button>
                    )}
                    {getAvailableActions().map((action) => (
                        <button
                            key={action.action}
                            className={`btn ${action.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => handleAction(action.action)}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <div className="spinner" style={{ width: 18, height: 18 }} />
                            ) : (
                                action.icon
                            )}
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* QR Modal */}
            {showQR && manifiesto.qrCode && (
                <div className="modal-overlay" onClick={() => setShowQR(false)}>
                    <div className="modal-content qr-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Código QR del Manifiesto</h3>
                            <button className="btn-close" onClick={() => setShowQR(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="qr-container">
                            <img src={manifiesto.qrCode} alt={`QR Manifiesto ${manifiesto.numero}`} />
                            <p className="qr-help">Escanea este código para verificar el manifiesto</p>
                        </div>
                    </div>
                </div>
            )}

            {/* CU-G07: Modal de Firma con Selector de Método */}
            {showFirmaModal && (
                <div className="modal-overlay" onClick={() => { setShowFirmaModal(false); resetFirmaForm(); }}>
                    <div className="modal-content firma-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Firmar Manifiesto</h3>
                            <button className="btn-close" onClick={() => { setShowFirmaModal(false); resetFirmaForm(); }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="firma-modal-body">
                            <p className="firma-info">
                                Manifiesto: <strong>#{manifiesto.numero}</strong>
                            </p>

                            <div className="metodos-firma">
                                <label className="metodo-option">
                                    <input
                                        type="radio"
                                        name="metodoFirma"
                                        value="USUARIO_PASSWORD"
                                        checked={metodoFirma === 'USUARIO_PASSWORD'}
                                        onChange={() => setMetodoFirma('USUARIO_PASSWORD')}
                                    />
                                    <div className="metodo-content">
                                        <span className="metodo-titulo">Firma con Usuario</span>
                                        <span className="metodo-desc">Usar tus credenciales de acceso</span>
                                    </div>
                                </label>

                                <label className="metodo-option">
                                    <input
                                        type="radio"
                                        name="metodoFirma"
                                        value="TOKEN_PIN"
                                        checked={metodoFirma === 'TOKEN_PIN'}
                                        onChange={() => setMetodoFirma('TOKEN_PIN')}
                                    />
                                    <div className="metodo-content">
                                        <span className="metodo-titulo">Token PIN</span>
                                        <span className="metodo-desc">Ingresar código de token</span>
                                    </div>
                                </label>

                                <label className="metodo-option">
                                    <input
                                        type="radio"
                                        name="metodoFirma"
                                        value="CODIGO_SMS"
                                        checked={metodoFirma === 'CODIGO_SMS'}
                                        onChange={() => setMetodoFirma('CODIGO_SMS')}
                                    />
                                    <div className="metodo-content">
                                        <span className="metodo-titulo">Código SMS</span>
                                        <span className="metodo-desc">Verificación por mensaje de texto</span>
                                    </div>
                                </label>

                                <label className="metodo-option">
                                    <input
                                        type="radio"
                                        name="metodoFirma"
                                        value="CERTIFICADO_DIGITAL"
                                        checked={metodoFirma === 'CERTIFICADO_DIGITAL'}
                                        onChange={() => setMetodoFirma('CERTIFICADO_DIGITAL')}
                                    />
                                    <div className="metodo-content">
                                        <span className="metodo-titulo">Certificado Digital</span>
                                        <span className="metodo-desc">Usar certificado de firma digital</span>
                                    </div>
                                </label>
                            </div>

                            {/* Inputs adicionales según método */}
                            {metodoFirma === 'TOKEN_PIN' && (
                                <div className="firma-input-group">
                                    <label>Ingrese su Token PIN</label>
                                    <input
                                        type="text"
                                        value={tokenPin}
                                        onChange={(e) => setTokenPin(e.target.value)}
                                        placeholder="123456"
                                        maxLength={6}
                                        className="firma-input"
                                    />
                                </div>
                            )}

                            {metodoFirma === 'CODIGO_SMS' && (
                                <div className="firma-input-group">
                                    {!smsEnviado ? (
                                        <button
                                            className="btn btn-secondary"
                                            onClick={handleSolicitarSMS}
                                            disabled={enviandoSMS}
                                        >
                                            {enviandoSMS ? (
                                                <>
                                                    <Loader2 size={18} className="spin" />
                                                    Enviando...
                                                </>
                                            ) : (
                                                'Enviar código a mi teléfono'
                                            )}
                                        </button>
                                    ) : (
                                        <>
                                            <label>Ingrese el código recibido</label>
                                            <input
                                                type="text"
                                                value={codigoSMS}
                                                onChange={(e) => setCodigoSMS(e.target.value)}
                                                placeholder="123456"
                                                maxLength={6}
                                                className="firma-input"
                                            />
                                            <p className="sms-enviado">Código enviado a tu teléfono</p>
                                        </>
                                    )}
                                </div>
                            )}

                            {metodoFirma === 'CERTIFICADO_DIGITAL' && (
                                <div className="firma-input-group">
                                    <p className="certificado-info">
                                        Se utilizará el certificado digital asociado a tu cuenta.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn btn-ghost"
                                onClick={() => { setShowFirmaModal(false); resetFirmaForm(); }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleFirmarConMetodo}
                                disabled={
                                    firmaLoading ||
                                    (metodoFirma === 'TOKEN_PIN' && !tokenPin) ||
                                    (metodoFirma === 'CODIGO_SMS' && !codigoSMS)
                                }
                            >
                                {firmaLoading ? (
                                    <>
                                        <Loader2 size={18} className="spin" />
                                        Firmando...
                                    </>
                                ) : (
                                    <>
                                        <Edit3 size={18} />
                                        Firmar Manifiesto
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Tratamiento (OPERADOR) - Mejorado */}
            {showTratamientoModal && (
                <div className="modal-overlay" onClick={() => setShowTratamientoModal(false)}>
                    <div className="modal-content tratamiento-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header tratamiento-header">
                            <div className="tratamiento-header-icon">
                                <FlaskConical size={24} />
                            </div>
                            <div className="tratamiento-header-text">
                                <h3>Registrar Tratamiento</h3>
                                <span className="tratamiento-manifiesto">Manifiesto #{manifiesto?.numero}</span>
                            </div>
                            <button className="btn-close" onClick={() => setShowTratamientoModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="tratamiento-body">
                            <p className="tratamiento-instruccion">Seleccione el tipo de tratamiento aplicado:</p>

                            <div className="tratamiento-grid">
                                {[
                                    { value: 'Incineración controlada', icon: Flame, color: '#ef4444', desc: 'Destrucción térmica' },
                                    { value: 'Tratamiento físico-químico', icon: Beaker, color: '#8b5cf6', desc: 'Procesos químicos' },
                                    { value: 'Neutralización', icon: Droplets, color: '#3b82f6', desc: 'Balance pH' },
                                    { value: 'Estabilización/Solidificación', icon: Box, color: '#6b7280', desc: 'Encapsulamiento' },
                                    { value: 'Reciclaje', icon: Recycle, color: '#10b981', desc: 'Recuperación' },
                                    { value: 'Disposición final', icon: Trash2, color: '#f59e0b', desc: 'Celda seguridad' },
                                    { value: 'Tratamiento biológico', icon: Leaf, color: '#22c55e', desc: 'Biodegradación' },
                                    { value: 'Otro', icon: MoreHorizontal, color: '#64748b', desc: 'Especificar' },
                                ].map((tratamiento) => {
                                    const IconComponent = tratamiento.icon;
                                    const isSelected = tipoTratamiento === tratamiento.value;
                                    return (
                                        <button
                                            key={tratamiento.value}
                                            className={`tratamiento-option ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setTipoTratamiento(tratamiento.value)}
                                            style={{ '--option-color': tratamiento.color } as React.CSSProperties}
                                        >
                                            <div className="tratamiento-option-icon">
                                                <IconComponent size={24} />
                                            </div>
                                            <div className="tratamiento-option-text">
                                                <span className="tratamiento-option-name">{tratamiento.value}</span>
                                                <span className="tratamiento-option-desc">{tratamiento.desc}</span>
                                            </div>
                                            {isSelected && (
                                                <div className="tratamiento-check">
                                                    <CheckCircle size={18} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {tipoTratamiento === 'Otro' && (
                                <div className="tratamiento-otro-input">
                                    <label>Especificar tratamiento:</label>
                                    <input
                                        type="text"
                                        placeholder="Describa el tipo de tratamiento aplicado"
                                        onChange={(e) => setTipoTratamiento(e.target.value || 'Otro')}
                                        className="form-input"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        <div className="tratamiento-footer">
                            <button
                                className="btn btn-ghost"
                                onClick={() => { setShowTratamientoModal(false); setTipoTratamiento(''); }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary btn-tratamiento"
                                onClick={handleRegistrarTratamiento}
                                disabled={tratamientoLoading || !tipoTratamiento}
                            >
                                {tratamientoLoading ? (
                                    <>
                                        <Loader2 size={18} className="spin" />
                                        Registrando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={18} />
                                        Confirmar Tratamiento
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Steps */}
            <div className="progress-steps">
                <div className={`progress-step ${['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'active' : ''} ${['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'complete' : ''}`}>
                    <div className="step-icon"><FileText size={20} /></div>
                    <span>Creado</span>
                </div>
                <div className="step-line" />
                <div className={`progress-step ${['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'active' : ''} ${['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'complete' : ''}`}>
                    <div className="step-icon"><Edit3 size={20} /></div>
                    <span>Firmado</span>
                </div>
                <div className="step-line" />
                <div className={`progress-step ${['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'active' : ''} ${['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'complete' : ''}`}>
                    <div className="step-icon"><Truck size={20} /></div>
                    <span>En Tránsito</span>
                </div>
                <div className="step-line" />
                <div className={`progress-step ${['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'active' : ''} ${['RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'complete' : ''}`}>
                    <div className="step-icon"><MapPin size={20} /></div>
                    <span>Entregado</span>
                </div>
                <div className="step-line" />
                <div className={`progress-step ${['RECIBIDO', 'TRATADO'].includes(manifiesto.estado) ? 'active' : ''} ${['TRATADO'].includes(manifiesto.estado) ? 'complete' : ''}`}>
                    <div className="step-icon"><Building2 size={20} /></div>
                    <span>Recibido</span>
                </div>
                <div className="step-line" />
                <div className={`progress-step ${['TRATADO'].includes(manifiesto.estado) ? 'active complete' : ''}`}>
                    <div className="step-icon"><CheckCircle size={20} /></div>
                    <span>Tratado</span>
                </div>
            </div>

            {/* Content Grid */}
            <div className="detalle-grid">
                {/* Actores */}
                <div className="card detalle-section">
                    <h3>Actores del Manifiesto</h3>

                    <div className="actor-card">
                        <div className="actor-icon generador">
                            <Factory size={20} />
                        </div>
                        <div className="actor-info">
                            <span className="actor-label">Generador</span>
                            <strong>{manifiesto.generador?.razonSocial}</strong>
                            <span>CUIT: {manifiesto.generador?.cuit}</span>
                            <span>{manifiesto.generador?.domicilio}</span>
                        </div>
                    </div>

                    <div className="actor-arrow">
                        <ArrowRight size={24} />
                    </div>

                    <div className="actor-card">
                        <div className="actor-icon transportista">
                            <Truck size={20} />
                        </div>
                        <div className="actor-info">
                            <span className="actor-label">Transportista</span>
                            <strong>{manifiesto.transportista?.razonSocial}</strong>
                            <span>CUIT: {manifiesto.transportista?.cuit}</span>
                            <span>Hab: {manifiesto.transportista?.numeroHabilitacion}</span>
                        </div>
                    </div>

                    <div className="actor-arrow">
                        <ArrowRight size={24} />
                    </div>

                    <div className="actor-card">
                        <div className="actor-icon operador">
                            <Building2 size={20} />
                        </div>
                        <div className="actor-info">
                            <span className="actor-label">Operador</span>
                            <strong>{manifiesto.operador?.razonSocial}</strong>
                            <span>CUIT: {manifiesto.operador?.cuit}</span>
                            <span>{manifiesto.operador?.domicilio}</span>
                        </div>
                    </div>
                </div>

                {/* Fechas y Timeline */}
                <div className="card detalle-section">
                    <h3>Cronología</h3>

                    <div className="timeline">
                        <div className="timeline-item">
                            <div className="timeline-dot" />
                            <div className="timeline-content">
                                <span className="timeline-label">Creación</span>
                                <span className="timeline-date">{formatDate(manifiesto.createdAt)}</span>
                            </div>
                        </div>
                        {manifiesto.fechaFirma && (
                            <div className="timeline-item">
                                <div className="timeline-dot" />
                                <div className="timeline-content">
                                    <span className="timeline-label">Firma Digital</span>
                                    <span className="timeline-date">{formatDate(manifiesto.fechaFirma)}</span>
                                </div>
                            </div>
                        )}
                        {manifiesto.fechaRetiro && (
                            <div className="timeline-item">
                                <div className="timeline-dot" />
                                <div className="timeline-content">
                                    <span className="timeline-label">Retiro de Carga</span>
                                    <span className="timeline-date">{formatDate(manifiesto.fechaRetiro)}</span>
                                </div>
                            </div>
                        )}
                        {manifiesto.fechaEntrega && (
                            <div className="timeline-item">
                                <div className="timeline-dot" />
                                <div className="timeline-content">
                                    <span className="timeline-label">Entrega en Destino</span>
                                    <span className="timeline-date">{formatDate(manifiesto.fechaEntrega)}</span>
                                </div>
                            </div>
                        )}
                        {manifiesto.fechaRecepcion && (
                            <div className="timeline-item">
                                <div className="timeline-dot" />
                                <div className="timeline-content">
                                    <span className="timeline-label">Recepción Confirmada</span>
                                    <span className="timeline-date">{formatDate(manifiesto.fechaRecepcion)}</span>
                                </div>
                            </div>
                        )}
                        {manifiesto.fechaCierre && (
                            <div className="timeline-item complete">
                                <div className="timeline-dot" />
                                <div className="timeline-content">
                                    <span className="timeline-label">Cierre del Manifiesto</span>
                                    <span className="timeline-date">{formatDate(manifiesto.fechaCierre)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mapa Origen/Destino */}
            <div className="card detalle-section map-section">
                <h3><Map size={20} /> Ubicación Geográfica</h3>
                <div className="map-description">
                    <span className="map-route-label">
                        <span className="origen-dot"></span>
                        {manifiesto.generador?.razonSocial || 'Generador'}
                    </span>
                    <ArrowRight size={16} />
                    <span className="map-route-label">
                        <span className="destino-dot"></span>
                        {manifiesto.operador?.razonSocial || 'Operador'}
                    </span>
                </div>
                <ManifiestoMap
                    origen={{
                        nombre: manifiesto.generador?.razonSocial || 'Generador',
                        direccion: manifiesto.generador?.domicilio,
                        coords: manifiesto.generador?.latitud && manifiesto.generador?.longitud
                            ? { lat: manifiesto.generador.latitud, lng: manifiesto.generador.longitud }
                            : undefined
                    }}
                    destino={{
                        nombre: manifiesto.operador?.razonSocial || 'Operador',
                        direccion: manifiesto.operador?.domicilio,
                        coords: manifiesto.operador?.latitud && manifiesto.operador?.longitud
                            ? { lat: manifiesto.operador.latitud, lng: manifiesto.operador.longitud }
                            : undefined
                    }}
                    altura="280px"
                    showRoute={true}
                />
            </div>

            {/* CORRECCIÓN 3: Observaciones del Manifiesto */}
            {manifiesto.observaciones && (
                <div className="card detalle-section observaciones-section">
                    <h3>Observaciones Generales</h3>
                    <div className="observaciones-content">
                        <p>{manifiesto.observaciones}</p>
                    </div>
                </div>
            )}

            {/* Residuos - CORRECCIÓN 3: Agregar columnas descripción y observaciones */}
            <div className="card detalle-section">
                <h3>Residuos Declarados</h3>

                {/* Mobile Cards - Visible solo en móvil */}
                <div className="residuos-mobile-cards">
                    {manifiesto.residuos?.map((residuo) => (
                        <div key={residuo.id} className="residuo-mobile-card">
                            <div className="residuo-card-header">
                                <span className="residuo-code">{residuo.tipoResiduo?.codigo}</span>
                                <span className={`badge badge-${residuo.tipoResiduo?.peligrosidad === 'ALTA' ? 'danger' : residuo.tipoResiduo?.peligrosidad === 'MEDIA' ? 'warning' : 'info'}`}>
                                    {residuo.tipoResiduo?.peligrosidad}
                                </span>
                            </div>
                            <div className="residuo-card-title">{residuo.tipoResiduo?.nombre}</div>
                            <div className="residuo-card-body">
                                <div className="residuo-card-detail">
                                    <span className="detail-label">Categoría</span>
                                    <span className="detail-value">{residuo.tipoResiduo?.categoria}</span>
                                </div>
                                <div className="residuo-card-detail highlight">
                                    <span className="detail-label">Cantidad</span>
                                    <span className="detail-value"><strong>{residuo.cantidad}</strong> {residuo.unidad}</span>
                                </div>
                            </div>
                            {(residuo.descripcion || residuo.observaciones) && (
                                <div className="residuo-card-extra">
                                    {residuo.descripcion && (
                                        <div className="residuo-card-detail">
                                            <span className="detail-label">Descripción</span>
                                            <span className="detail-value text-small">{residuo.descripcion}</span>
                                        </div>
                                    )}
                                    {residuo.observaciones && (
                                        <div className="residuo-card-detail">
                                            <span className="detail-label">Observaciones</span>
                                            <span className="detail-value text-small">{residuo.observaciones}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Desktop Table - Hidden en móvil */}
                <div className="residuos-table residuos-desktop-table">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Tipo de Residuo</th>
                                    <th>Categoría</th>
                                    <th>Peligrosidad</th>
                                    <th>Cantidad</th>
                                    <th>Unidad</th>
                                    <th>Descripción</th>
                                    <th>Observaciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {manifiesto.residuos?.map((residuo) => (
                                    <tr key={residuo.id}>
                                        <td><span className="residuo-code">{residuo.tipoResiduo?.codigo}</span></td>
                                        <td>{residuo.tipoResiduo?.nombre}</td>
                                        <td>{residuo.tipoResiduo?.categoria}</td>
                                        <td>
                                            <span className="badge badge-warning">{residuo.tipoResiduo?.peligrosidad}</span>
                                        </td>
                                        <td><strong>{residuo.cantidad}</strong></td>
                                        <td>{residuo.unidad}</td>
                                        <td className="descripcion-cell">{residuo.descripcion || '-'}</td>
                                        <td className="observaciones-cell">{residuo.observaciones || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Eventos */}
            {manifiesto.eventos && manifiesto.eventos.length > 0 && (
                <div className="card detalle-section">
                    <h3>Historial de Eventos</h3>
                    <div className="eventos-list">
                        {manifiesto.eventos.map((evento) => (
                            <div key={evento.id} className="evento-item">
                                <div className="evento-icon">
                                    <Clock size={16} />
                                </div>
                                <div className="evento-content">
                                    <strong>{evento.tipo}</strong>
                                    <p>{evento.descripcion}</p>
                                    <span className="evento-meta">
                                        {evento.usuario?.nombre} {evento.usuario?.apellido} • {formatDate(evento.createdAt)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal de Reversión */}
            {manifiesto && (
                <ReversionModal
                    isOpen={showReversionModal}
                    onClose={() => setShowReversionModal(false)}
                    manifiestoId={manifiesto.id}
                    manifiestoNumero={manifiesto.numero}
                    estadoActual={manifiesto.estado}
                    tipoReversion={reversionType}
                    onSuccess={() => {
                        setShowReversionModal(false);
                        loadManifiesto();
                    }}
                />
            )}
        </div>
    );
};

export default ManifiestoDetalle;
