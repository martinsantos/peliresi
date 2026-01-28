/**
 * KPICards - Key Performance Indicator cards
 * SITREP Design System v5.0 - Dual Theme Support
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Users,
    Bell,
    Truck,
    AlertTriangle,
    Clock,
    TrendingUp
} from 'lucide-react';
import type { SystemStats } from './types';

interface KPICardsProps {
    stats: SystemStats;
    tendencia: { manifiestos: number; residuos: number };
}

const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export const KPICards: React.FC<KPICardsProps> = ({ stats, tendencia }) => {
    const trendDirection = (tendencia?.manifiestos ?? 0) >= 0;

    return (
        <motion.div
            className="mega-kpis"
            initial="hidden"
            animate="show"
            variants={containerVariants}
        >
            {/* Manifiestos KPI */}
            <motion.div
                className="kpi-card kpi-card--manifiestos"
                variants={itemVariants}
            >
                <div className="kpi-icon">
                    <FileText size={24} />
                </div>
                <div className="kpi-content">
                    <div className="kpi-value">
                        {stats.manifiestos.total.toLocaleString('es-AR')}
                    </div>
                    <span className="kpi-label">MANIFIESTOS</span>
                    <div className={`kpi-trend ${trendDirection ? 'up' : 'down'}`}>
                        <TrendingUp size={14} style={{ transform: !trendDirection ? 'rotate(180deg)' : 'none' }} />
                        <span>{trendDirection ? '+' : ''}{(tendencia?.manifiestos ?? 0).toFixed(1)}% vs período anterior</span>
                    </div>
                </div>
            </motion.div>

            {/* En Ruta KPI */}
            <motion.div
                className="kpi-card kpi-card--en-ruta"
                variants={itemVariants}
            >
                <div className="kpi-icon">
                    <Truck size={24} />
                </div>
                <div className="kpi-content">
                    <div className="kpi-value">
                        {stats.manifiestos.enTransito.toLocaleString('es-AR')}
                    </div>
                    <span className="kpi-label">EN RUTA</span>
                    <div className="kpi-live">
                        <span className="live-dot"></span>
                        <span>En vivo</span>
                    </div>
                </div>
            </motion.div>

            {/* Alertas KPI */}
            <motion.div
                className="kpi-card kpi-card--alertas"
                variants={itemVariants}
            >
                <div className="kpi-icon">
                    <Bell size={24} />
                </div>
                <div className="kpi-content">
                    <div className="kpi-value">
                        {stats.alertasActivas.toLocaleString('es-AR')}
                    </div>
                    <span className="kpi-label">ALERTAS</span>
                    {stats.alertasActivas > 0 && (
                        <div className="kpi-alert">
                            <AlertTriangle size={14} />
                            <span>Revisar</span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Usuarios KPI */}
            <motion.div
                className="kpi-card kpi-card--usuarios"
                variants={itemVariants}
            >
                <div className="kpi-icon">
                    <Users size={24} />
                </div>
                <div className="kpi-content">
                    <div className="kpi-value">
                        {stats.usuarios.activos.toLocaleString('es-AR')}
                    </div>
                    <span className="kpi-label">USUARIOS</span>
                    {stats.usuarios.pendientes > 0 && (
                        <div className="kpi-pending">
                            <Clock size={14} />
                            <span>{stats.usuarios.pendientes} pendientes</span>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default KPICards;
