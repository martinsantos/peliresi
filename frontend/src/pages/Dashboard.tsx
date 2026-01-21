import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { manifiestoService } from '../services/manifiesto.service';
import { demoStats } from '../data/demoDashboard';
import type { DashboardStats } from '../types';
import {
    FileText,
    Truck,
    CheckCircle,
    Clock,
    ArrowRight,
    MapPin,
    Activity
} from 'lucide-react';
import './Dashboard.css';

// ==============================================
// VERSIÓN DE EMERGENCIA - SIN RECHARTS/MOTION
// Para diagnosticar crash RESULT_CODE_KILLED_BAD_MESSAGE
// ==============================================

const Dashboard: React.FC = () => {
    const { user, effectiveRole, effectiveUserName } = useAuth();
    const [stats, setStats] = useState<DashboardStats>(demoStats);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const data = await manifiestoService.getDashboard();
            if (data) {
                const hasValidEstadisticas = data.estadisticas && typeof data.estadisticas.total === 'number';
                const normalizedStats: DashboardStats = {
                    estadisticas: hasValidEstadisticas
                        ? data.estadisticas
                        : {
                            total: data.total ?? demoStats.estadisticas.total,
                            borradores: data.borradores ?? demoStats.estadisticas.borradores,
                            pendientesAprobacion: data.pendientesAprobacion ?? 0,
                            aprobados: data.aprobados ?? demoStats.estadisticas.aprobados,
                            enTransito: data.enTransito ?? demoStats.estadisticas.enTransito,
                            entregados: data.entregados ?? demoStats.estadisticas.entregados,
                            recibidos: data.recibidos ?? demoStats.estadisticas.recibidos,
                            enTratamiento: data.enTratamiento ?? 0,
                            tratados: data.tratados ?? demoStats.estadisticas.tratados
                        },
                    recientes: data.recientes || [],
                    enTransitoList: data.enTransitoList || []
                };
                setStats(normalizedStats);
            }
        } catch (err: any) {
            console.error('Dashboard error:', err);
            setStats(demoStats);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner" />
                <p>Cargando dashboard...</p>
            </div>
        );
    }

    const s = stats?.estadisticas || demoStats.estadisticas;

    return (
        <div className="dashboard">
            {/* Welcome Section */}
            <div className="dashboard-welcome" style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '16px',
                padding: '20px 24px',
                marginBottom: '24px'
            }}>
                <h2>Bienvenido, {effectiveUserName || user?.nombre}!</h2>
                <p style={{ color: '#94a3b8', marginTop: '4px' }}>
                    Panel de {effectiveRole || 'Usuario'}
                </p>
            </div>

            {/* Stats Grid - SIN MOTION */}
            <div className="stats-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }}>
                <div className="stat-card" style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileText size={24} style={{ color: '#10b981' }} />
                        <div>
                            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc' }}>
                                {s.total}
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>TOTAL</div>
                        </div>
                    </div>
                </div>

                <div className="stat-card" style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Clock size={24} style={{ color: '#f59e0b' }} />
                        <div>
                            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc' }}>
                                {s.borradores}
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>PENDIENTES</div>
                        </div>
                    </div>
                </div>

                <div className="stat-card" style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Truck size={24} style={{ color: '#3b82f6' }} />
                        <div>
                            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc' }}>
                                {s.enTransito}
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>EN TRÁNSITO</div>
                        </div>
                    </div>
                </div>

                <div className="stat-card" style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CheckCircle size={24} style={{ color: '#22c55e' }} />
                        <div>
                            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc' }}>
                                {s.tratados}
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>COMPLETADOS</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }}>
                <Link to="/manifiestos" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px 20px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: '#f8fafc'
                }}>
                    <FileText size={20} style={{ color: '#3b82f6' }} />
                    <span>Ver Manifiestos</span>
                    <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
                </Link>

                <Link to="/tracking" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px 20px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: '#f8fafc'
                }}>
                    <MapPin size={20} style={{ color: '#f59e0b' }} />
                    <span>Tracking GPS</span>
                    <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
                </Link>
            </div>

            {/* Actividad Reciente - SIMPLIFICADA */}
            <div className="card" style={{
                background: 'var(--bg-secondary, #1e293b)',
                border: '1px solid var(--border-color, rgba(148, 163, 184, 0.1))',
                borderRadius: '16px',
                padding: '20px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#f8fafc' }}>
                        <Activity size={20} />
                        Actividad Reciente
                    </h3>
                    <Link to="/manifiestos" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px' }}>
                        Ver todos
                    </Link>
                </div>

                {stats?.recientes && stats.recientes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.recientes.slice(0, 5).map((m) => (
                            <Link
                                key={m.id}
                                to={`/manifiestos/${m.id}`}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: 'rgba(148, 163, 184, 0.05)',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    color: '#f8fafc'
                                }}
                            >
                                <div>
                                    <strong>{m.numero}</strong>
                                    <span style={{ color: '#94a3b8', marginLeft: '8px', fontSize: '13px' }}>
                                        {m.generador?.razonSocial}
                                    </span>
                                </div>
                                <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: m.estado === 'TRATADO' ? 'rgba(34, 197, 94, 0.2)' :
                                              m.estado === 'EN_TRANSITO' ? 'rgba(245, 158, 11, 0.2)' :
                                              'rgba(59, 130, 246, 0.2)',
                                    color: m.estado === 'TRATADO' ? '#22c55e' :
                                           m.estado === 'EN_TRANSITO' ? '#f59e0b' : '#3b82f6'
                                }}>
                                    {m.estado.replace('_', ' ')}
                                </span>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        <FileText size={40} style={{ marginBottom: '8px', opacity: 0.5 }} />
                        <p>No hay manifiestos registrados</p>
                    </div>
                )}
            </div>

            {/* Debug info */}
            <div style={{
                marginTop: '24px',
                padding: '12px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#64748b'
            }}>
                <strong>DEBUG:</strong> Dashboard v9.0 EMERGENCY - Sin Recharts/Motion/WebSocket
            </div>
        </div>
    );
};

export default Dashboard;
