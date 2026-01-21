/**
 * Viajes Activos Panel Component
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, Clock, Pause, AlertTriangle } from 'lucide-react';
import type { ViajeActivo } from './types';

interface ViajeTimerProps {
    initialSeconds: number;
    isPaused: boolean;
}

const ViajeTimer: React.FC<ViajeTimerProps> = ({ initialSeconds, isPaused }) => {
    const [seconds, setSeconds] = useState(initialSeconds);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [isPaused]);

    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return <span className="viaje-timer-value">{formatTime(seconds)}</span>;
};

interface ViajesActivosPanelProps {
    viajesActivos: ViajeActivo[];
}

export const ViajesActivosPanel: React.FC<ViajesActivosPanelProps> = ({ viajesActivos }) => {
    const viajesEnRuta = viajesActivos.filter(v => !v.isPaused && v.estado !== 'INCIDENTE').length;
    const viajesPausados = viajesActivos.filter(v => v.isPaused || v.estado === 'PAUSADO').length;
    const viajesIncidentes = viajesActivos.filter(v => v.estado === 'INCIDENTE').length;

    if (viajesActivos.length === 0) {
        return null;
    }

    return (
        <motion.div
            className="mega-panel viajes-activos-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
        >
            <div className="panel-header">
                <h3><Truck size={18} /> Viajes en Tiempo Real</h3>
                <div className="viajes-count-badges">
                    <span className="viaje-badge en-curso">
                        {viajesEnRuta} en ruta
                    </span>
                    <span className="viaje-badge pausado">
                        {viajesPausados} pausados
                    </span>
                    {viajesIncidentes > 0 && (
                        <span className="viaje-badge incidente">
                            {viajesIncidentes} incidentes
                        </span>
                    )}
                </div>
            </div>
            <div className="viajes-activos-grid">
                {viajesActivos.map(viaje => (
                    <motion.div
                        key={viaje.id}
                        className={`viaje-activo-card ${viaje.isPaused ? 'pausado' : ''} ${viaje.estado === 'INCIDENTE' ? 'incidente' : ''}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                    >
                        <div className="viaje-icon-wrapper">
                            {viaje.isPaused ? (
                                <Pause size={20} className="icon-pausado" />
                            ) : viaje.estado === 'INCIDENTE' ? (
                                <AlertTriangle size={20} className="icon-incidente" />
                            ) : (
                                <>
                                    <Truck size={20} className="icon-en-ruta" />
                                    <div className="pulse-indicator" />
                                </>
                            )}
                        </div>
                        <div className="viaje-info">
                            <span className="viaje-numero">{viaje.manifiestoNumero}</span>
                            <span className="viaje-transportista">{viaje.transportistaRazonSocial}</span>
                        </div>
                        <div className="viaje-timer-wrapper">
                            <Clock size={14} />
                            <ViajeTimer
                                initialSeconds={viaje.elapsedSeconds}
                                isPaused={viaje.isPaused}
                            />
                        </div>
                        <span className={`viaje-estado-badge ${viaje.estado.toLowerCase()}`}>
                            {viaje.isPaused ? 'PAUSADO' :
                             viaje.estado === 'INCIDENTE' ? 'INCIDENTE' : 'EN RUTA'}
                        </span>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};
