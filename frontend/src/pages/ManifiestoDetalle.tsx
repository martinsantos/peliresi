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

    const handleAction = async (action: string) => {
        if (!manifiesto) return;

        setActionLoading(true);
        try {
            let updated: Manifiesto;
            switch (action) {
                case 'firmar':
                    updated = await manifiestoService.firmarManifiesto(manifiesto.id);
                    break;
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
                    updated = await manifiestoService.cerrarManifiesto(manifiesto.id, {
                        metodoTratamiento: 'Incineración controlada'
                    });
                    break;
                default:
                    return;
            }
            setManifiesto(updated);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al ejecutar la acción');
        } finally {
            setActionLoading(false);
        }
    };

    const getEstadoInfo = (estado: string) => {
        const estados: Record<string, { class: string; label: string; icon: React.ReactNode }> = {
            BORRADOR: { class: 'badge-info', label: 'Borrador', icon: <Edit3 size={16} /> },
            APROBADO: { class: 'badge-success', label: 'Aprobado', icon: <CheckCircle size={16} /> },
            EN_TRANSITO: { class: 'badge-warning', label: 'En Tránsito', icon: <Truck size={16} /> },
            ENTREGADO: { class: 'badge-primary', label: 'Entregado', icon: <MapPin size={16} /> },
            RECIBIDO: { class: 'badge-info', label: 'Recibido', icon: <Building2 size={16} /> },
            TRATADO: { class: 'badge-success', label: 'Tratado', icon: <CheckCircle size={16} /> },
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
