/**
 * AdvertenciasGlobales - Banner de Alertas del Sistema
 * Muestra advertencias globales para administradores
 */

import React, { useState, useEffect } from 'react';
import {
    AlertTriangle,
    AlertCircle,
    Info,
    RefreshCw,
    Clock,
    Calendar,
    Activity,
    CheckCircle
} from 'lucide-react';
import { alertaService } from '../services/alerta.service';
import type { ResultadoEvaluacion } from '../services/alerta.service';

interface AdvertenciasGlobalesProps {
    autoRefresh?: boolean;
    refreshInterval?: number;
    maxVisible?: number;
    onResolverClick?: (alerta: ResultadoEvaluacion) => void;
}

const AdvertenciasGlobales: React.FC<AdvertenciasGlobalesProps> = ({
    autoRefresh = true,
    refreshInterval = 60000,
    maxVisible = 5,
    onResolverClick
}) => {
    const [advertencias, setAdvertencias] = useState<ResultadoEvaluacion[]>([]);
    const [tiemposExcesivos, setTiemposExcesivos] = useState<ResultadoEvaluacion[]>([]);
    const [vencimientos, setVencimientos] = useState<ResultadoEvaluacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [adv, tiempos, venc] = await Promise.all([
                alertaService.getAdvertenciasActivas(),
                alertaService.evaluarTiemposExcesivos(),
                alertaService.evaluarVencimientos()
            ]);
            setAdvertencias(adv);
            setTiemposExcesivos(tiempos);
            setVencimientos(venc);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Error cargando advertencias:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        cargarDatos();
        if (autoRefresh) {
            const interval = setInterval(cargarDatos, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refreshInterval]);

    const todasLasAlertas = [
        ...advertencias,
        ...tiemposExcesivos,
        ...vencimientos
    ].slice(0, maxVisible);

    const totalAlertas = advertencias.length + tiemposExcesivos.length + vencimientos.length;
    const alertasCriticas = todasLasAlertas.filter(a => a.severidad === 'CRITICAL').length;

    const getIcono = (severidad: string, evento: string) => {
        if (evento === 'TIEMPO_EXCESIVO') return <Clock size={18} />;
        if (evento === 'VENCIMIENTO') return <Calendar size={18} />;
        switch (severidad) {
            case 'CRITICAL':
                return <AlertCircle size={18} />;
            case 'WARNING':
                return <AlertTriangle size={18} />;
            default:
                return <Info size={18} />;
        }
    };

    const getColorFondo = (severidad: string) => {
        switch (severidad) {
            case 'CRITICAL':
                return 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)';
            case 'WARNING':
                return 'linear-gradient(135deg, #92400e 0%, #d97706 100%)';
            default:
                return 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)';
        }
    };

    if (loading && todasLasAlertas.length === 0) {
        return (
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#94a3b8'
            }}>
                <RefreshCw size={18} className="animate-spin" />
                <span>Evaluando estado del sistema...</span>
            </div>
        );
    }

    if (totalAlertas === 0) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#fff'
            }}>
                <CheckCircle size={20} />
                <div>
                    <strong>Sistema operando normalmente</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                        No hay alertas activas en este momento
                    </p>
                </div>
                {lastUpdate && (
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: '12px',
                        opacity: 0.7
                    }}>
                        Actualizado: {lastUpdate.toLocaleTimeString()}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div style={{
            background: '#151b24',
            borderRadius: '12px',
            overflow: 'hidden',
            border: alertasCriticas > 0 ? '1px solid #dc2626' : '1px solid #334155'
        }}>
            {/* Header */}
            <div
                style={{
                    background: alertasCriticas > 0
                        ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)'
                        : 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    color: '#fff'
                }}
                onClick={() => setCollapsed(!collapsed)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity size={20} />
                    <div>
                        <strong>
                            {totalAlertas} Alerta{totalAlertas !== 1 ? 's' : ''} Activa{totalAlertas !== 1 ? 's' : ''}
                        </strong>
                        {alertasCriticas > 0 && (
                            <span style={{
                                marginLeft: '8px',
                                background: '#fff',
                                color: '#dc2626',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: 700
                            }}>
                                {alertasCriticas} CRITICAS
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); cargarDatos(); }}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            color: '#fff'
                        }}
                        title="Actualizar"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Lista de alertas */}
            {!collapsed && (
                <div style={{ padding: '8px' }}>
                    {todasLasAlertas.map((alerta, index) => (
                        <div
                            key={`${alerta.reglaId}-${index}`}
                            style={{
                                background: getColorFondo(alerta.severidad),
                                borderRadius: '8px',
                                padding: '12px 16px',
                                marginBottom: index < todasLasAlertas.length - 1 ? '8px' : 0,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                color: '#fff',
                                cursor: onResolverClick ? 'pointer' : 'default'
                            }}
                            onClick={() => onResolverClick?.(alerta)}
                        >
                            <div style={{ flexShrink: 0, marginTop: '2px' }}>
                                {getIcono(alerta.severidad, alerta.evento)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px'
                                }}>
                                    <span style={{ fontWeight: 600, fontSize: '14px' }}>
                                        {alerta.reglaNombre}
                                    </span>
                                    <span style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        textTransform: 'uppercase'
                                    }}>
                                        {alerta.evento.replace('_', ' ')}
                                    </span>
                                </div>
                                <p style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    opacity: 0.95
                                }}>
                                    {alerta.descripcion}
                                </p>
                                {alerta.accionRequerida && (
                                    <p style={{
                                        margin: '6px 0 0',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        background: 'rgba(255,255,255,0.15)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        display: 'inline-block'
                                    }}>
                                        Accion requerida: {alerta.accionRequerida}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}

                    {totalAlertas > maxVisible && (
                        <div style={{
                            textAlign: 'center',
                            padding: '8px',
                            color: '#94a3b8',
                            fontSize: '13px'
                        }}>
                            +{totalAlertas - maxVisible} alertas mas
                        </div>
                    )}
                </div>
            )}

            {/* Footer con timestamp */}
            {lastUpdate && (
                <div style={{
                    padding: '8px 16px',
                    borderTop: '1px solid #334155',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: '#64748b'
                }}>
                    <span>Ultima actualizacion: {lastUpdate.toLocaleTimeString()}</span>
                    <span>Auto-refresh: {autoRefresh ? 'Activo' : 'Inactivo'}</span>
                </div>
            )}
        </div>
    );
};

export default AdvertenciasGlobales;
