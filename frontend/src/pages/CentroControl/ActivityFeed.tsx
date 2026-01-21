/**
 * Activity Feed Component
 */

import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Activity, FileText, CheckCircle, Truck, MapPin,
    Package, ChevronRight
} from 'lucide-react';
import type { Actividad } from '../../services/admin.service';

interface ActivityFeedProps {
    actividades: Actividad[];
}

const formatRelativeTime = (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
};

const getActionIcon = (accion: string) => {
    if (accion.includes('CREAR') || accion.includes('NUEVO')) return <FileText size={14} />;
    if (accion.includes('APROBAR')) return <CheckCircle size={14} />;
    if (accion.includes('RETIRO') || accion.includes('TRANSITO')) return <Truck size={14} />;
    if (accion.includes('ENTREGA')) return <MapPin size={14} />;
    if (accion.includes('RECEP')) return <Package size={14} />;
    if (accion.includes('TRAT')) return <CheckCircle size={14} />;
    return <Activity size={14} />;
};

const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
    hidden: { x: -20, opacity: 0 },
    show: { x: 0, opacity: 1, transition: { duration: 0.3 } }
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ actividades }) => {
    const activityRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activityRef.current && actividades.length > 0) {
            activityRef.current.scrollTop = 0;
        }
    }, [actividades]);

    return (
        <div className="mega-panel activity-panel">
            <div className="panel-header">
                <h3><Activity size={18} /> Actividad en Vivo</h3>
                <div className="activity-stats">
                    <span className="activity-count">{actividades.length} eventos</span>
                    <Link to="/admin/actividad" className="view-more">
                        Ver todo <ChevronRight size={14} />
                    </Link>
                </div>
            </div>
            <motion.div
                className="activity-feed"
                ref={activityRef}
                initial="hidden"
                animate="show"
                variants={containerVariants}
            >
                {actividades.length === 0 ? (
                    <div className="activity-empty">
                        <Activity size={32} />
                        <p>Sin actividad reciente</p>
                    </div>
                ) : (
                    actividades.slice(0, 15).map((act, index) => (
                        <motion.div
                            key={act.id}
                            className={`activity-item ${index === 0 ? 'newest' : ''}`}
                            variants={itemVariants}
                            whileHover={{ scale: 1.02, x: 4 }}
                        >
                            <div className={`activity-icon ${act.accion.includes('ERROR') || act.accion.includes('RECHAZ') ? 'error' : ''}`}>
                                {getActionIcon(act.accion)}
                            </div>
                            <div className="activity-content">
                                <span className="activity-action">{act.accion.replace(/_/g, ' ')}</span>
                                <span className="activity-desc">{act.descripcion?.slice(0, 60) || 'Sin descripción'}</span>
                            </div>
                            <div className="activity-meta">
                                <span className="activity-time">{formatRelativeTime(act.fecha)}</span>
                                {index === 0 && (
                                    <motion.span
                                        className="new-badge"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                    >
                                        NUEVO
                                    </motion.span>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </motion.div>
        </div>
    );
};
