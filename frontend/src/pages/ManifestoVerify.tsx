import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    CheckCircle, XCircle, Clock, Truck, Factory, Building2,
    FileText, MapPin, Scale, AlertTriangle, ArrowLeft, Loader2,
    Calendar, User, Package, Shield
} from 'lucide-react';
import './ManifestoVerify.css';

interface VerificacionData {
    manifiestoId: string;
    numero: string;
    estado: string;
    cadenaResponsabilidad: {
        generador: string;
        transportista: string;
        operador: string;
    };
    timeline: {
        creacion: string;
        firma: string;
        retiro: string;
        entrega: string;
        recepcion: string;
        cierre: string;
    };
    residuos: Array<{
        tipo: string;
        codigo: string;
        cantidad: number;
        unidad: string;
    }>;
    firmaDigital: string;
    eventos: Array<{
        tipo: string;
        descripcion: string;
        createdAt: string;
    }>;
    verificadoEn: string;
}

const estadoColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    BORRADOR: { bg: '#f1f5f9', text: '#64748b', icon: <FileText size={20} /> },
    APROBADO: { bg: '#dcfce7', text: '#16a34a', icon: <CheckCircle size={20} /> },
    EN_TRANSITO: { bg: '#fef3c7', text: '#d97706', icon: <Truck size={20} /> },
    ENTREGADO: { bg: '#dbeafe', text: '#2563eb', icon: <MapPin size={20} /> },
    RECIBIDO: { bg: '#e0e7ff', text: '#4f46e5', icon: <Building2 size={20} /> },
    EN_TRATAMIENTO: { bg: '#fce7f3', text: '#db2777', icon: <Scale size={20} /> },
    TRATADO: { bg: '#d1fae5', text: '#059669', icon: <Shield size={20} /> },
    RECHAZADO: { bg: '#fee2e2', text: '#dc2626', icon: <XCircle size={20} /> },
};

const ManifestoVerify: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<VerificacionData | null>(null);

    useEffect(() => {
        const fetchVerification = async () => {
            try {
                const response = await fetch(`/api/public/verify/${id}`);
                const result = await response.json();
                
                if (result.success) {
                    setData(result.verificacion);
                } else {
                    setError(result.error || 'Manifiesto no encontrado');
                }
            } catch (err) {
                setError('Error al verificar el manifiesto');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchVerification();
        }
    }, [id]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="verify-page">
                <div className="verify-loading">
                    <Loader2 size={48} className="spin" />
                    <p>Verificando manifiesto...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="verify-page">
                <div className="verify-error">
                    <AlertTriangle size={48} />
                    <h2>Error de Verificación</h2>
                    <p>{error}</p>
                    <Link to="/" className="btn-back">
                        <ArrowLeft size={18} />
                        Volver al Inicio
                    </Link>
                </div>
            </div>
        );
    }

    const estadoStyle = estadoColors[data.estado] || estadoColors.BORRADOR;

    return (
        <div className="verify-page">
            <div className="verify-container">
                {/* Header con Estado */}
                <div className="verify-header" style={{ background: estadoStyle.bg }}>
                    <div className="verify-badge" style={{ color: estadoStyle.text }}>
                        {estadoStyle.icon}
                        <span>{data.estado.replace('_', ' ')}</span>
                    </div>
                    <h1>Manifiesto {data.numero}</h1>
                    <p className="verify-time">
                        <Clock size={14} />
                        Verificado: {formatDate(data.verificadoEn)}
                    </p>
                </div>

                {/* Firma Digital */}
                <div className="verify-section">
                    <div className="signature-status" style={{ 
                        background: data.firmaDigital === 'FIRMADO DIGITALMENTE' ? '#dcfce7' : '#fef3c7' 
                    }}>
                        <Shield size={24} style={{ 
                            color: data.firmaDigital === 'FIRMADO DIGITALMENTE' ? '#16a34a' : '#d97706' 
                        }} />
                        <span>{data.firmaDigital}</span>
                    </div>
                </div>

                {/* Cadena de Responsabilidad */}
                <div className="verify-section">
                    <h3><User size={18} /> Cadena de Responsabilidad</h3>
                    <div className="responsibility-chain">
                        <div className="chain-item">
                            <div className="chain-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                                <Factory size={20} />
                            </div>
                            <div className="chain-info">
                                <span className="chain-role">Generador</span>
                                <span className="chain-name">{data.cadenaResponsabilidad.generador}</span>
                            </div>
                        </div>
                        <div className="chain-arrow">→</div>
                        <div className="chain-item">
                            <div className="chain-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                                <Truck size={20} />
                            </div>
                            <div className="chain-info">
                                <span className="chain-role">Transportista</span>
                                <span className="chain-name">{data.cadenaResponsabilidad.transportista}</span>
                            </div>
                        </div>
                        <div className="chain-arrow">→</div>
                        <div className="chain-item">
                            <div className="chain-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                                <Building2 size={20} />
                            </div>
                            <div className="chain-info">
                                <span className="chain-role">Operador</span>
                                <span className="chain-name">{data.cadenaResponsabilidad.operador}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                <div className="verify-section">
                    <h3><Calendar size={18} /> Timeline</h3>
                    <div className="timeline">
                        {[
                            { label: 'Creación', date: data.timeline.creacion },
                            { label: 'Firma', date: data.timeline.firma },
                            { label: 'Retiro', date: data.timeline.retiro },
                            { label: 'Entrega', date: data.timeline.entrega },
                            { label: 'Recepción', date: data.timeline.recepcion },
                            { label: 'Cierre', date: data.timeline.cierre },
                        ].filter(t => t.date).map((item, idx) => (
                            <div key={idx} className="timeline-item">
                                <div className="timeline-dot"></div>
                                <div className="timeline-content">
                                    <span className="timeline-label">{item.label}</span>
                                    <span className="timeline-date">{formatDate(item.date)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Residuos */}
                <div className="verify-section">
                    <h3><Package size={18} /> Residuos</h3>
                    <div className="residuos-list">
                        {data.residuos.map((residuo, idx) => (
                            <div key={idx} className="residuo-item">
                                <div className="residuo-code">{residuo.codigo}</div>
                                <div className="residuo-info">
                                    <span className="residuo-tipo">{residuo.tipo}</span>
                                    <span className="residuo-cantidad">
                                        {residuo.cantidad} {residuo.unidad}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Eventos Recientes */}
                {data.eventos.length > 0 && (
                    <div className="verify-section">
                        <h3><Clock size={18} /> Eventos Recientes</h3>
                        <div className="eventos-list">
                            {data.eventos.slice(0, 5).map((evento, idx) => (
                                <div key={idx} className="evento-item">
                                    <div className="evento-tipo">{evento.tipo}</div>
                                    <div className="evento-desc">{evento.descripcion}</div>
                                    <div className="evento-time">{formatDate(evento.createdAt)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="verify-footer">
                    <Link to="/" className="btn-back">
                        <ArrowLeft size={18} />
                        Ir al Sistema
                    </Link>
                    <div className="verify-branding">
                        <span>SITREP</span>
                        <span>Gobierno de Mendoza</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManifestoVerify;
