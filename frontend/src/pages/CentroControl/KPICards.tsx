/**
 * KPI Cards Component
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    Users, FileText, Truck, Bell, AlertTriangle,
    Clock, TrendingUp
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
    return (
        <motion.div
            className="mega-kpis"
            initial="hidden"
            animate="show"
            variants={containerVariants}
        >
            <motion.div
                className="kpi-card"
                style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                variants={itemVariants}
            >
                <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                    <FileText size={24} />
                </div>
                <div className="kpi-content">
                    <div className="kpi-value" style={{ color: '#f8fafc' }}>
                        {stats.manifiestos.total.toLocaleString('es-AR')}
                    </div>
                    <span className="kpi-label">MANIFIESTOS</span>
                    <div className="kpi-trend" style={{ color: (tendencia?.manifiestos ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        <TrendingUp size={14} style={{ transform: (tendencia?.manifiestos ?? 0) < 0 ? 'rotate(180deg)' : 'none' }} />
                        <span>{(tendencia?.manifiestos ?? 0) >= 0 ? '+' : ''}{(tendencia?.manifiestos ?? 0).toFixed(1)}% vs período anterior</span>
                    </div>
                </div>
            </motion.div>

            <motion.div
                className="kpi-card"
                style={{ background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                variants={itemVariants}
            >
                <div className="kpi-icon" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4' }}>
                    <Truck size={24} />
                </div>
                <div className="kpi-content">
                    <div className="kpi-value" style={{ color: '#f8fafc' }}>
                        {stats.manifiestos.enTransito.toLocaleString('es-AR')}
                    </div>
                    <span className="kpi-label">EN RUTA</span>
                    <div className="kpi-live">
                        <span className="live-dot"></span>
                        <span>En vivo</span>
                    </div>
                </div>
            </motion.div>

            <motion.div
                className="kpi-card"
                style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                variants={itemVariants}
            >
                <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                    <Bell size={24} />
                </div>
                <div className="kpi-content">
                    <div className="kpi-value" style={{ color: '#f8fafc' }}>
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

            <motion.div
                className="kpi-card"
                style={{ background: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' }}
                variants={itemVariants}
            >
                <div className="kpi-icon" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}>
                    <Users size={24} />
                </div>
                <div className="kpi-content">
                    <div className="kpi-value" style={{ color: '#f8fafc' }}>
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
