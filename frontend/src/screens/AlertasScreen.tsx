/**
 * AlertasScreen - FASE 4
 * Pantalla de alertas y notificaciones extraída de MobileApp.tsx
 */

import React from 'react';
import { Bell } from 'lucide-react';
import type { Notificacion } from '../services/notification.service';

interface AlertasScreenProps {
    notificaciones: Notificacion[];
    noLeidas: number;
    onMarcarLeida: (id: string) => void;
    onEliminar: (id: string) => void;
    onMarcarTodasLeidas: () => void;
}

// Helper: Formato de fecha relativa
const formatFechaRelativa = (fecha: string): string => {
    const d = new Date(fecha);
    const ahora = new Date();
    const diff = ahora.getTime() - d.getTime();
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);
    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `Hace ${minutos}m`;
    if (horas < 24) return `Hace ${horas}h`;
    if (dias < 7) return `Hace ${dias}d`;
    return d.toLocaleDateString('es-AR');
};

// Helper: Color por prioridad
const getPrioridadColor = (prioridad: string): string => {
    switch (prioridad) {
        case 'URGENTE': return 'var(--ind-red-bright)';
        case 'ALTA': return 'var(--ind-orange)';
        case 'NORMAL': return 'var(--ind-yellow)';
        default: return 'var(--ind-text-mid)';
    }
};

const AlertasScreen: React.FC<AlertasScreenProps> = ({
    notificaciones,
    noLeidas,
    onMarcarLeida,
    onEliminar,
    onMarcarTodasLeidas
}) => {
    return (
        <div className="section">
            <div className="alertas-header">
                <h3>Alertas y Notificaciones</h3>
                {noLeidas > 0 && (
                    <button className="btn btn-secondary btn-sm" onClick={onMarcarTodasLeidas}>
                        Marcar todas leidas ({noLeidas})
                    </button>
                )}
            </div>
            <div className="list">
                {notificaciones.length > 0 ? (
                    notificaciones.map(n => (
                        <div
                            key={n.id}
                            className={`list-item alerta-item ${!n.leida ? 'unread' : ''}`}
                            style={{ borderLeftColor: getPrioridadColor(n.prioridad) }}
                        >
                            <div className="list-body">
                                <div className="alerta-titulo">
                                    {!n.leida && <span className="unread-dot" />}
                                    {n.titulo}
                                </div>
                                <div className="list-sub">{n.mensaje}</div>
                                <div className="alerta-meta">
                                    <span className={`prioridad-badge ${n.prioridad.toLowerCase()}`}>
                                        {n.prioridad}
                                    </span>
                                    <span>{formatFechaRelativa(n.createdAt)}</span>
                                </div>
                            </div>
                            <div className="alerta-actions">
                                {!n.leida && (
                                    <button
                                        className="action-btn-small"
                                        onClick={(e) => { e.stopPropagation(); onMarcarLeida(n.id); }}
                                        title="Marcar leida"
                                    >
                                        ✓
                                    </button>
                                )}
                                <button
                                    className="action-btn-small delete"
                                    onClick={(e) => { e.stopPropagation(); onEliminar(n.id); }}
                                    title="Eliminar"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <Bell size={32} />
                        <p>No tienes notificaciones</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertasScreen;
