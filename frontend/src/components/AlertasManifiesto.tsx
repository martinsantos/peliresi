/**
 * AlertasManifiesto - Componente de Advertencias Visuales
 * Muestra alertas y advertencias relacionadas con un manifiesto
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import { alertaService } from '../services/alerta.service';
import type { ResultadoEvaluacion, EvaluacionManifiesto } from '../services/alerta.service';

interface AlertasManifiestoProps {
    manifiestoId: string;
    onAlertaClick?: (alerta: ResultadoEvaluacion) => void;
    compact?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

const AlertasManifiesto: React.FC<AlertasManifiestoProps> = ({
    manifiestoId,
    onAlertaClick,
    compact = false,
    autoRefresh = false,
    refreshInterval = 30000
}) => {
    const [evaluacion, setEvaluacion] = useState<EvaluacionManifiesto | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(!compact);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        const cargarEvaluacion = async () => {
            setLoading(true);
            const resultado = await alertaService.evaluarManifiesto(manifiestoId);
            setEvaluacion(resultado);
            setLoading(false);
        };

        cargarEvaluacion();

        if (autoRefresh) {
            const interval = setInterval(cargarEvaluacion, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [manifiestoId, autoRefresh, refreshInterval]);

    const getIcono = (severidad: string) => {
        switch (severidad) {
            case 'CRITICAL':
                return <AlertCircle size={18} />;
            case 'WARNING':
                return <AlertTriangle size={18} />;
            default:
                return <Info size={18} />;
        }
    };

    const getEstilo = (severidad: string) => {
        const colores = alertaService.getSeveridadColor(severidad);
        return {
            backgroundColor: colores.bg,
            borderLeft: `4px solid ${colores.color}`,
            color: colores.color
        };
    };

    const handleDismiss = (reglaId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDismissed(prev => new Set([...prev, reglaId]));
    };

    const alertasVisibles = evaluacion?.advertencias.filter(
        a => !dismissed.has(a.reglaId)
    ) || [];

    if (loading) {
        return (
            <div style={{
                padding: '12px',
                background: '#1e293b',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#94a3b8'
            }}>
                <Bell size={16} className="animate-pulse" />
                <span>Evaluando alertas...</span>
            </div>
        );
    }

    if (!evaluacion?.hayAlertas || alertasVisibles.length === 0) {
        return null;
    }

    if (compact) {
        return (
            <div style={{
                padding: '8px 12px',
                background: evaluacion.alertasCriticas > 0 ? '#fef2f2' : '#fffbeb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                cursor: 'pointer'
            }}
            onClick={() => setExpanded(!expanded)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {evaluacion.alertasCriticas > 0 ? (
                        <AlertCircle size={18} color="#dc2626" />
                    ) : (
                        <AlertTriangle size={18} color="#d97706" />
                    )}
                    <span style={{
                        fontWeight: 600,
                        color: evaluacion.alertasCriticas > 0 ? '#dc2626' : '#d97706'
                    }}>
                        {alertasVisibles.length} alerta{alertasVisibles.length !== 1 ? 's' : ''}
                    </span>
                </div>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '16px'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={18} color="#f59e0b" />
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                        Alertas del Manifiesto
                    </span>
                    <span style={{
                        background: evaluacion.alertasCriticas > 0 ? '#dc2626' : '#f59e0b',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600
                    }}>
                        {alertasVisibles.length}
                    </span>
                </div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        padding: '4px'
                    }}
                >
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
            </div>

            {/* Alertas */}
            {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {alertasVisibles.map((alerta, index) => (
                        <div
                            key={`${alerta.reglaId}-${index}`}
                            style={{
                                ...getEstilo(alerta.severidad),
                                padding: '12px 16px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                cursor: onAlertaClick ? 'pointer' : 'default'
                            }}
                            onClick={() => onAlertaClick?.(alerta)}
                        >
                            <div style={{ flexShrink: 0, marginTop: '2px' }}>
                                {getIcono(alerta.severidad)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px'
                                }}>
                                    <span style={{
                                        fontWeight: 600,
                                        fontSize: '13px'
                                    }}>
                                        {alerta.reglaNombre}
                                    </span>
                                    <span style={{
                                        fontSize: '11px',
                                        opacity: 0.8
                                    }}>
                                        {alertaService.getEventoIcono(alerta.evento)}
                                    </span>
                                </div>
                                <p style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    opacity: 0.9
                                }}>
                                    {alerta.descripcion}
                                </p>
                                {alerta.accionRequerida && (
                                    <p style={{
                                        margin: '8px 0 0',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        Accion: {alerta.accionRequerida}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={(e) => handleDismiss(alerta.reglaId, e)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    opacity: 0.6,
                                    padding: '4px',
                                    flexShrink: 0
                                }}
                                title="Descartar"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AlertasManifiesto;
