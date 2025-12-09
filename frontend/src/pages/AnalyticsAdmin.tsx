import React, { useState, useEffect } from 'react';
import { analyticsService } from '../services/analytics.service';
import type { AnalyticsStats, AnalyticsEvent } from '../services/analytics.service';
import {
    BarChart3, Users, Eye, Activity, Download, Trash2,
    LogIn, Lock, Mail, LogOut, Clock, MapPin,
    Filter, RefreshCw
} from 'lucide-react';

// Auth credentials
const ADMIN_EMAIL = 'santosma@gmail.com';
const ADMIN_PASSWORD = 'mimica77';

const AnalyticsAdmin: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [allEvents, setAllEvents] = useState<AnalyticsEvent[]>([]);
    const [filterRole, setFilterRole] = useState<string>('');
    const [autoRefresh, setAutoRefresh] = useState(true);

    useEffect(() => {
        // Check if already authenticated
        const authToken = localStorage.getItem('analytics_admin_token');
        if (authToken === 'authenticated') {
            setIsAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadStats();
            const interval = autoRefresh ? setInterval(loadStats, 3000) : null;
            return () => {
                if (interval) clearInterval(interval);
            };
        }
    }, [isAuthenticated, autoRefresh]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            localStorage.setItem('analytics_admin_token', 'authenticated');
            setIsAuthenticated(true);
            setLoginError('');
        } else {
            setLoginError('Credenciales inválidas');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('analytics_admin_token');
        setIsAuthenticated(false);
    };

    const loadStats = () => {
        const newStats = analyticsService.getStats();
        setStats(newStats);
        setAllEvents(newStats.recentEvents);
    };

    const handleExport = () => {
        const data = analyticsService.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        if (confirm('¿Eliminar TODOS los datos de analytics? Esta acción no se puede deshacer.')) {
            analyticsService.clearData();
            loadStats();
        }
    };

    const filteredEvents = filterRole
        ? allEvents.filter(e => e.role === filterRole)
        : allEvents;

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Login Screen
    if (!isAuthenticated) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20
            }}>
                <div style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 24,
                    padding: 40,
                    width: '100%',
                    maxWidth: 400
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            borderRadius: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px'
                        }}>
                            <BarChart3 size={32} color="white" />
                        </div>
                        <h1 style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, margin: 0 }}>
                            Analytics Admin
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
                            Acceso exclusivo para administradores
                        </p>
                    </div>

                    <form onSubmit={handleLogin}>
                        {loginError && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 20,
                                color: '#ef4444',
                                fontSize: 14,
                                textAlign: 'center'
                            }}>
                                {loginError}
                            </div>
                        )}

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
                                <Mail size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@example.com"
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: 12,
                                    color: '#f8fafc',
                                    fontSize: 16,
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
                                <Lock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                Contraseña
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: 12,
                                    color: '#f8fafc',
                                    fontSize: 16,
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                borderRadius: 12,
                                color: 'white',
                                fontSize: 16,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                        >
                            <LogIn size={18} />
                            Iniciar Sesión
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Analytics Dashboard
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc'
        }}>
            {/* Header */}
            <header style={{
                background: 'rgba(15, 23, 42, 0.8)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '16px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <BarChart3 size={28} color="#10b981" />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Analytics Dashboard</h1>
                        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Monitoreo en tiempo real</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{
                            padding: '8px 16px',
                            background: autoRefresh ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${autoRefresh ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: 8,
                            color: autoRefresh ? '#10b981' : '#94a3b8',
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        <RefreshCw size={14} className={autoRefresh ? 'spin' : ''} />
                        Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
                    </button>
                    <button
                        onClick={handleExport}
                        style={{
                            padding: '8px 16px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: 8,
                            color: '#3b82f6',
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        <Download size={14} />
                        Exportar
                    </button>
                    <button
                        onClick={handleClear}
                        style={{
                            padding: '8px 16px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 8,
                            color: '#ef4444',
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        <Trash2 size={14} />
                        Limpiar
                    </button>
                    <button
                        onClick={handleLogout}
                        style={{
                            padding: '8px 16px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 8,
                            color: '#94a3b8',
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        <LogOut size={14} />
                        Salir
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div style={{ padding: 32 }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 20,
                    marginBottom: 32
                }}>
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 16,
                        padding: 24
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <Activity size={24} color="#10b981" />
                            <span style={{ color: '#94a3b8', fontSize: 14 }}>Total Eventos</span>
                        </div>
                        <div style={{ fontSize: 40, fontWeight: 800, color: '#10b981' }}>
                            {stats?.totalEvents || 0}
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: 16,
                        padding: 24
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <Eye size={24} color="#3b82f6" />
                            <span style={{ color: '#94a3b8', fontSize: 14 }}>Page Views</span>
                        </div>
                        <div style={{ fontSize: 40, fontWeight: 800, color: '#3b82f6' }}>
                            {stats?.pageViews || 0}
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: 16,
                        padding: 24
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <MapPin size={24} color="#f59e0b" />
                            <span style={{ color: '#94a3b8', fontSize: 14 }}>Acciones</span>
                        </div>
                        <div style={{ fontSize: 40, fontWeight: 800, color: '#f59e0b' }}>
                            {stats?.actions || 0}
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: 16,
                        padding: 24
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <Users size={24} color="#8b5cf6" />
                            <span style={{ color: '#94a3b8', fontSize: 14 }}>Roles Activos</span>
                        </div>
                        <div style={{ fontSize: 40, fontWeight: 800, color: '#8b5cf6' }}>
                            {Object.keys(stats?.roleUsage || {}).length}
                        </div>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
                    {/* Left: Usage by Role & Pages */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Role Usage */}
                        <div style={{
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: 16,
                            padding: 24
                        }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 0, marginBottom: 20 }}>
                                <Users size={20} color="#8b5cf6" />
                                Uso por Rol
                            </h3>
                            {Object.entries(stats?.roleUsage || {}).map(([role, count]) => (
                                <div key={role} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 0',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <span style={{
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        padding: '4px 12px',
                                        borderRadius: 6,
                                        fontSize: 13
                                    }}>{role}</span>
                                    <span style={{ fontWeight: 700, color: '#10b981' }}>{count}</span>
                                </div>
                            ))}
                        </div>

                        {/* Most Visited Pages */}
                        <div style={{
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: 16,
                            padding: 24
                        }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 0, marginBottom: 20 }}>
                                <BarChart3 size={20} color="#f59e0b" />
                                Páginas Más Visitadas
                            </h3>
                            {stats?.mostVisitedPages.slice(0, 8).map(({ page, count }) => (
                                <div key={page} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 0',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <span style={{ color: '#cbd5e1', fontSize: 14 }}>{page}</span>
                                    <span style={{ fontWeight: 700, color: '#f59e0b' }}>{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Event Log */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: 16,
                        padding: 24,
                        maxHeight: 600,
                        overflow: 'auto'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 20
                        }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                                <Clock size={20} color="#10b981" />
                                Log de Eventos
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Filter size={14} color="#64748b" />
                                <select
                                    value={filterRole}
                                    onChange={(e) => setFilterRole(e.target.value)}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: 6,
                                        color: '#f8fafc',
                                        padding: '6px 12px',
                                        fontSize: 13
                                    }}
                                >
                                    <option value="">Todos los roles</option>
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="GENERADOR">GENERADOR</option>
                                    <option value="TRANSPORTISTA">TRANSPORTISTA</option>
                                    <option value="OPERADOR">OPERADOR</option>
                                </select>
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>EVENTO</th>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>PÁGINA</th>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>USUARIO</th>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>IP</th>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>DEVICE</th>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>ROL</th>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>HORA</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEvents.map((event, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                        <td style={{ padding: '10px 8px' }}>
                                            <span style={{
                                                background: event.event === 'pageview'
                                                    ? 'rgba(59, 130, 246, 0.1)'
                                                    : event.event === 'login'
                                                        ? 'rgba(245, 158, 11, 0.1)'
                                                        : 'rgba(16, 185, 129, 0.1)',
                                                color: event.event === 'pageview' ? '#3b82f6' : event.event === 'login' ? '#f59e0b' : '#10b981',
                                                padding: '4px 8px',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 500
                                            }}>
                                                {event.event}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 8px', color: '#cbd5e1', fontSize: 12 }}>{event.page}</td>
                                        <td style={{ padding: '10px 8px', color: '#f8fafc', fontSize: 12, fontWeight: 500 }}>
                                            {event.username || '-'}
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <span style={{
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                color: '#818cf8',
                                                padding: '3px 6px',
                                                borderRadius: 4,
                                                fontSize: 10,
                                                fontFamily: 'monospace'
                                            }}>
                                                {event.ip || 'local'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 8px', color: '#94a3b8', fontSize: 11 }}>
                                            {event.device || 'Desktop'}
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                            {event.role && (
                                                <span style={{
                                                    background: 'rgba(139, 92, 246, 0.1)',
                                                    color: '#a78bfa',
                                                    padding: '4px 8px',
                                                    borderRadius: 4,
                                                    fontSize: 11
                                                }}>
                                                    {event.role}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', color: '#64748b', fontSize: 11 }}>
                                            {formatDate(event.timestamp)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredEvents.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                                No hay eventos registrados
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsAdmin;
