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
    Map
} from 'lucide-react';
import ManifiestoMap from '../components/mobile/ManifiestoMap';
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
    const [enviandoSMS, setEnviandoSMS] = useState(false);
    const [smsEnviado, setSmsEnviado] = useState(false);
    const [firmaLoading, setFirmaLoading] = useState(false);



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
            const result = await manifiestoService.firmarConToken(manifiesto.id, {
                metodoFirma,
                tokenPin: metodoFirma === 'TOKEN_PIN' ? tokenPin : undefined,
                codigoSMS: metodoFirma === 'CODIGO_SMS' ? codigoSMS : undefined
            });

            if (result.manifiesto) {
                setManifiesto(result.manifiesto);
                setShowFirmaModal(false);
                resetFirmaForm();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al firmar el manifiesto');
        } finally {
            setFirmaLoading(false);
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
                case 'tratamiento':
                    updated = await manifiestoService.registrarTratamiento(manifiesto.id, {
                        metodoTratamiento: 'Incineración controlada'
                    });
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

    const getAvailableAction = () => {
        if (!manifiesto || !user) return null;

        switch (manifiesto.estado) {
            case 'BORRADOR':
                if (user.rol === 'GENERADOR') {
                    return { action: 'firmar', label: 'Firmar Manifiesto', icon: <Edit3 size={18} /> };
                }
                break;
            case 'APROBADO':
                if (user.rol === 'TRANSPORTISTA') {
                    return { action: 'confirmar-retiro', label: 'Confirmar Retiro', icon: <Truck size={18} /> };
                }
                break;
            case 'EN_TRANSITO':
                if (user.rol === 'TRANSPORTISTA') {
                    return { action: 'confirmar-entrega', label: 'Confirmar Entrega', icon: <MapPin size={18} /> };
                }
                break;
            case 'ENTREGADO':
                if (user.rol === 'OPERADOR') {
                    return { action: 'confirmar-recepcion', label: 'Confirmar Recepción', icon: <Building2 size={18} /> };
                }
                break;
            case 'RECIBIDO':
                if (user.rol === 'OPERADOR') {
                    return { action: 'cerrar', label: 'Cerrar Manifiesto', icon: <CheckCircle size={18} /> };
                }
                break;
        }
        return null;
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
    const availableAction = getAvailableAction();

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
                    {availableAction && (
                        <button
                            className="btn btn-primary"
                            onClick={() => handleAction(availableAction.action)}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <div className="spinner" style={{ width: 18, height: 18 }} />
                            ) : (
                                availableAction.icon
                            )}
                            {availableAction.label}
                        </button>
                    )}
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
                <div className="residuos-table">
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
        </div>
    );
};

export default ManifiestoDetalle;
