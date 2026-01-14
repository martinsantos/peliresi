/**
 * ManifiestoDetail - Detalle de un manifiesto
 * Extraido de MobileApp.tsx para mejorar legibilidad
 */

import React from 'react';
import {
    FileText, Play, Navigation, Package, Command,
    Recycle, Award, RotateCcw
} from 'lucide-react';
import type { UserRole } from '../../types/mobile.types';
import { ESTADO_CONFIG } from '../../types/mobile.types';
import type { DisplayManifiesto, BackendManifiesto } from '../../utils/manifiestoUtils';
import ManifiestoMap from './ManifiestoMap';

interface ManifiestoDetailProps {
    manifiesto: DisplayManifiesto;
    role: UserRole;
    hayViajeActivo: boolean;
    // Handlers
    onIniciarViaje: (m: DisplayManifiesto) => void;
    onVerViajeActivo: () => void;
    onFirmar: () => Promise<void>;
    onRecibir: () => void;
    onRechazar: () => void;
    onTratamiento: () => void;
    onCerrar: () => Promise<void>;
    onRevertir: (tipo: 'entrega' | 'recepcion' | 'certificado') => void;
}

function getEstadoBadge(estado: string): React.ReactElement {
    const config = ESTADO_CONFIG[estado] || { bg: '#334155', color: '#94a3b8', label: estado };
    return (
        <span className="badge" style={{ background: config.bg, color: config.color }}>
            {config.label}
        </span>
    );
}

export default function ManifiestoDetail({
    manifiesto,
    role,
    hayViajeActivo,
    onIniciarViaje,
    onVerViajeActivo,
    onFirmar,
    onRecibir,
    onRechazar,
    onTratamiento,
    onCerrar,
    onRevertir
}: ManifiestoDetailProps): React.ReactElement | null {
    if (!manifiesto) return null;

    const originalData = manifiesto._original as BackendManifiesto;
    const allResiduos = originalData?.residuos || [];

    return (
        <div className="section">
            <h3>Manifiesto #{manifiesto.numero}</h3>

            <div className="detail-card">
                <div className="detail-row">
                    <label>Estado:</label>
                    {getEstadoBadge(manifiesto.estado)}
                </div>
                <div className="detail-row">
                    <label>Generador:</label>
                    <span>{manifiesto.generador}</span>
                </div>
                <div className="detail-row">
                    <label>Transportista:</label>
                    <span>{manifiesto.transportista}</span>
                </div>
                <div className="detail-row">
                    <label>Operador:</label>
                    <span>{manifiesto.operador}</span>
                </div>
                <div className="detail-row">
                    <label>Fecha:</label>
                    <span>{manifiesto.fecha}</span>
                </div>
            </div>

            {/* Mapa origen/destino */}
            <div style={{ margin: '12px 0' }}>
                <ManifiestoMap
                    origen={{
                        nombre: manifiesto.generador,
                        direccion: originalData?.generador?.domicilio,
                        coords: originalData?.generador?.latitud
                            ? { lat: originalData.generador.latitud, lng: originalData.generador.longitud! }
                            : undefined
                    }}
                    destino={{
                        nombre: manifiesto.operador,
                        direccion: originalData?.operador?.domicilio,
                        coords: originalData?.operador?.latitud
                            ? { lat: originalData.operador.latitud, lng: originalData.operador.longitud! }
                            : undefined
                    }}
                    altura="180px"
                />
            </div>

            {/* Residuos */}
            <div className="detail-card" style={{ marginTop: '12px' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--ind-cyan)' }}>
                    Residuos ({allResiduos.length || 1})
                </h4>
                {allResiduos.length > 0 ? (
                    allResiduos.map((r, idx) => (
                        <div key={idx} className="residuo-detail-item">
                            <div className="residuo-detail-header">
                                <span className="residuo-codigo">{r.tipoResiduo?.codigo || 'N/A'}</span>
                                <span className="residuo-cantidad">{r.cantidad} {r.unidad}</span>
                            </div>
                            <div className="residuo-nombre">{r.tipoResiduo?.nombre || 'Residuo'}</div>
                            {r.descripcion && (
                                <div className="residuo-descripcion">
                                    <strong>Descripcion:</strong> {r.descripcion}
                                </div>
                            )}
                            {r.observaciones && (
                                <div className="residuo-observaciones">
                                    <strong>Obs:</strong> {r.observaciones}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="residuo-detail-item">
                        <div className="residuo-nombre">{manifiesto.residuo}</div>
                        <div className="residuo-cantidad">{manifiesto.cantidad}</div>
                    </div>
                )}
            </div>

            {/* Observaciones generales */}
            {originalData?.observaciones && (
                <div className="detail-card" style={{ marginTop: '12px' }}>
                    <h4 style={{ margin: '0 0 8px', color: 'var(--ind-yellow)' }}>Observaciones</h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {originalData.observaciones}
                    </p>
                </div>
            )}

            {/* Acciones segun rol y estado */}
            <ManifiestoActions
                estado={manifiesto.estado}
                role={role}
                hayViajeActivo={hayViajeActivo}
                manifiesto={manifiesto}
                onIniciarViaje={onIniciarViaje}
                onVerViajeActivo={onVerViajeActivo}
                onFirmar={onFirmar}
                onRecibir={onRecibir}
                onRechazar={onRechazar}
                onTratamiento={onTratamiento}
                onCerrar={onCerrar}
                onRevertir={onRevertir}
            />
        </div>
    );
}

// Componente interno para las acciones
interface ManifiestoActionsProps {
    estado: string;
    role: UserRole;
    hayViajeActivo: boolean;
    manifiesto: DisplayManifiesto;
    onIniciarViaje: (m: DisplayManifiesto) => void;
    onVerViajeActivo: () => void;
    onFirmar: () => Promise<void>;
    onRecibir: () => void;
    onRechazar: () => void;
    onTratamiento: () => void;
    onCerrar: () => Promise<void>;
    onRevertir: (tipo: 'entrega' | 'recepcion' | 'certificado') => void;
}

function ManifiestoActions({
    estado,
    role,
    hayViajeActivo,
    manifiesto,
    onIniciarViaje,
    onVerViajeActivo,
    onFirmar,
    onRecibir,
    onRechazar,
    onTratamiento,
    onCerrar,
    onRevertir
}: ManifiestoActionsProps): React.ReactElement | null {
    const buttonStyle = { width: '100%', padding: '14px', fontSize: '16px' };
    const warningButtonStyle = { ...buttonStyle, background: 'linear-gradient(135deg, #f59e0b, #d97706)' };
    const successButtonStyle = { ...buttonStyle, background: 'linear-gradient(135deg, #22c55e, #16a34a)' };
    const dangerButtonStyle = { ...buttonStyle, background: 'linear-gradient(135deg, #ef4444, #dc2626)' };

    // GENERADOR: Firmar borrador
    if (role === 'GENERADOR' && estado === 'BORRADOR') {
        return (
            <div className="form-actions" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn btn-primary" onClick={onFirmar} style={buttonStyle}>
                    <FileText size={20} style={{ marginRight: '8px' }} />
                    Firmar Manifiesto
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    La firma digital valida el manifiesto y lo envia a aprobacion
                </p>
            </div>
        );
    }

    // GENERADOR: Pendiente aprobacion
    if (role === 'GENERADOR' && estado === 'PENDIENTE_APROBACION') {
        return (
            <div className="form-actions" style={{ marginTop: '16px' }}>
                <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                    color: '#f59e0b'
                }}>
                    Esperando aprobacion de la autoridad competente (DGFA)
                </div>
            </div>
        );
    }

    // TRANSPORTISTA: Iniciar viaje
    if (role === 'TRANSPORTISTA' && estado === 'APROBADO') {
        if (hayViajeActivo) {
            return (
                <div className="form-actions" style={{ marginTop: '16px' }}>
                    <div className="warning-box" style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid #f59e0b',
                        borderRadius: '8px',
                        padding: '12px',
                        textAlign: 'center',
                        color: '#f59e0b'
                    }}>
                        Ya tienes un viaje en transito. Finalizalo antes de iniciar otro.
                    </div>
                </div>
            );
        }
        return (
            <div className="form-actions" style={{ marginTop: '16px' }}>
                <button
                    className="btn btn-primary"
                    onClick={() => onIniciarViaje(manifiesto)}
                    style={buttonStyle}
                >
                    <Play size={20} style={{ marginRight: '8px' }} />
                    Iniciar Transporte
                </button>
            </div>
        );
    }

    // TRANSPORTISTA: Ver viaje activo
    if (role === 'TRANSPORTISTA' && estado === 'EN_TRANSITO') {
        return (
            <div className="form-actions" style={{ marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={onVerViajeActivo} style={buttonStyle}>
                    <Navigation size={20} style={{ marginRight: '8px' }} />
                    Ver Viaje Activo
                </button>
            </div>
        );
    }

    // TRANSPORTISTA: Revertir entrega
    if (role === 'TRANSPORTISTA' && estado === 'ENTREGADO') {
        return (
            <div className="form-actions" style={{ marginTop: '16px' }}>
                <button className="btn btn-warning" onClick={() => onRevertir('entrega')} style={warningButtonStyle}>
                    <RotateCcw size={20} style={{ marginRight: '8px' }} />
                    Revertir Entrega
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                    Use esta opcion si el operador rechazo la carga
                </p>
            </div>
        );
    }

    // OPERADOR: Recibir o rechazar
    if (role === 'OPERADOR' && estado === 'ENTREGADO') {
        return (
            <div className="form-actions" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={onRecibir} style={{ flex: 1, padding: '14px', fontSize: '16px' }}>
                        <Package size={20} style={{ marginRight: '8px' }} />
                        Recibir
                    </button>
                    <button className="btn btn-danger" onClick={onRechazar} style={{ ...dangerButtonStyle, flex: 1 }}>
                        <Command size={20} style={{ marginRight: '8px' }} />
                        Rechazar
                    </button>
                </div>
                <button
                    className="btn btn-warning"
                    onClick={() => onRevertir('entrega')}
                    style={{ ...warningButtonStyle, padding: '12px', fontSize: '14px' }}
                >
                    <RotateCcw size={18} style={{ marginRight: '8px' }} />
                    Rechazar Carga (Revertir Entrega)
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Use esta opcion si necesita devolver la carga al transportista
                </p>
            </div>
        );
    }

    // OPERADOR: Registrar tratamiento
    if (role === 'OPERADOR' && estado === 'RECIBIDO') {
        return (
            <div className="form-actions" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn btn-success" onClick={onTratamiento} style={successButtonStyle}>
                    <Recycle size={20} style={{ marginRight: '8px' }} />
                    Registrar Tratamiento
                </button>
                <button
                    className="btn btn-warning"
                    onClick={() => onRevertir('recepcion')}
                    style={{ ...warningButtonStyle, padding: '12px', fontSize: '14px' }}
                >
                    <RotateCcw size={18} style={{ marginRight: '8px' }} />
                    Revertir Recepcion
                </button>
            </div>
        );
    }

    // OPERADOR: Cerrar o revertir en tratamiento
    if (role === 'OPERADOR' && estado === 'EN_TRATAMIENTO') {
        return (
            <div className="form-actions" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn btn-success" onClick={onCerrar} style={successButtonStyle}>
                    <Award size={20} style={{ marginRight: '8px' }} />
                    Cerrar y Emitir Certificado
                </button>
                <button
                    className="btn btn-warning"
                    onClick={() => onRevertir('certificado')}
                    style={{ ...warningButtonStyle, padding: '12px', fontSize: '14px' }}
                >
                    <RotateCcw size={18} style={{ marginRight: '8px' }} />
                    Revertir a Recibido
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    El tratamiento esta en curso. Puede cerrar el manifiesto o revertir si es necesario.
                </p>
            </div>
        );
    }

    // OPERADOR: Revertir tratado
    if (role === 'OPERADOR' && estado === 'TRATADO') {
        return (
            <div className="form-actions" style={{ marginTop: '16px' }}>
                <button className="btn btn-warning" onClick={() => onRevertir('certificado')} style={warningButtonStyle}>
                    <RotateCcw size={20} style={{ marginRight: '8px' }} />
                    Revertir Certificado
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                    Use esta opcion para corregir el certificado de tratamiento
                </p>
            </div>
        );
    }

    return null;
}
