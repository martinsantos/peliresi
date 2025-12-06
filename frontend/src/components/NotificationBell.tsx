import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    Check,
    CheckCheck,
    FileText,
    Truck,
    AlertTriangle,
    Info,
    X
} from 'lucide-react';
import { notificationService, type Notificacion } from '../services/notification.service';
import './NotificationBell.css';

const NotificationBell: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
    const [noLeidas, setNoLeidas] = useState(0);
    const [loading, setLoading] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        cargarNotificaciones();
        // Polling cada 30 segundos
        const interval = setInterval(cargarNotificaciones, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const cargarNotificaciones = async () => {
        try {
            const data = await notificationService.getNotificaciones({ limit: 10 });
            setNotificaciones(data.notificaciones);
            setNoLeidas(data.noLeidas);
        } catch (error) {
            console.error('Error al cargar notificaciones:', error);
        }
    };

    const marcarLeida = async (id: string) => {
        try {
            await notificationService.marcarLeida(id);
            setNotificaciones(prev =>
                prev.map(n => n.id === id ? { ...n, leida: true } : n)
            );
            setNoLeidas(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const marcarTodasLeidas = async () => {
        setLoading(true);
        try {
            await notificationService.marcarTodasLeidas();
            setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
            setNoLeidas(0);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const eliminarNotificacion = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await notificationService.eliminar(id);
            setNotificaciones(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleNotificacionClick = (notif: Notificacion) => {
        if (!notif.leida) marcarLeida(notif.id);
        if (notif.manifiestoId) {
            navigate(`/manifiestos/${notif.manifiestoId}`);
            setOpen(false);
        }
    };

    const getIcon = (tipo: string) => {
        switch (tipo) {
            case 'MANIFIESTO_FIRMADO':
            case 'MANIFIESTO_TRATADO':
                return <FileText size={16} className="icon-success" />;
            case 'MANIFIESTO_EN_TRANSITO':
            case 'MANIFIESTO_ENTREGADO':
                return <Truck size={16} className="icon-info" />;
            case 'MANIFIESTO_RECHAZADO':
            case 'INCIDENTE_REPORTADO':
            case 'ANOMALIA_DETECTADA':
                return <AlertTriangle size={16} className="icon-warning" />;
            default:
                return <Info size={16} className="icon-default" />;
        }
    };

    const getPrioridadClass = (prioridad: string) => {
        switch (prioridad) {
            case 'URGENTE': return 'urgente';
            case 'ALTA': return 'alta';
            default: return '';
        }
    };

    const formatFecha = (fecha: string) => {
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

    return (
        <div className="notification-bell" ref={menuRef}>
            <button
                className={`bell-button ${noLeidas > 0 ? 'has-notifications' : ''}`}
                onClick={() => setOpen(!open)}
            >
                <Bell size={20} />
                {noLeidas > 0 && (
                    <span className="badge">{noLeidas > 9 ? '9+' : noLeidas}</span>
                )}
            </button>

            {open && (
                <div className="notification-dropdown">
                    <div className="dropdown-header">
                        <h4>Notificaciones</h4>
                        {noLeidas > 0 && (
                            <button
                                className="mark-all-btn"
                                onClick={marcarTodasLeidas}
                                disabled={loading}
                            >
                                <CheckCheck size={16} />
                                Marcar todas
                            </button>
                        )}
                    </div>

                    <div className="notification-list">
                        {notificaciones.length === 0 ? (
                            <div className="empty-state">
                                <Bell size={32} />
                                <p>No tienes notificaciones</p>
                            </div>
                        ) : (
                            notificaciones.map(notif => (
                                <div
                                    key={notif.id}
                                    className={`notification-item ${!notif.leida ? 'unread' : ''} ${getPrioridadClass(notif.prioridad)}`}
                                    onClick={() => handleNotificacionClick(notif)}
                                >
                                    <div className="notif-icon">
                                        {getIcon(notif.tipo)}
                                    </div>
                                    <div className="notif-content">
                                        <p className="notif-title">{notif.titulo}</p>
                                        <p className="notif-message">{notif.mensaje}</p>
                                        <span className="notif-time">{formatFecha(notif.createdAt)}</span>
                                    </div>
                                    <div className="notif-actions">
                                        {!notif.leida && (
                                            <button
                                                className="action-btn"
                                                onClick={(e) => { e.stopPropagation(); marcarLeida(notif.id); }}
                                                title="Marcar como leída"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button
                                            className="action-btn delete"
                                            onClick={(e) => eliminarNotificacion(notif.id, e)}
                                            title="Eliminar"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {notificaciones.length > 0 && (
                        <div className="dropdown-footer">
                            <button onClick={() => { setOpen(false); navigate('/notificaciones'); }}>
                                Ver todas las notificaciones
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
