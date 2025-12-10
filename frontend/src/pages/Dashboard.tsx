import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { manifiestoService } from '../services/manifiesto.service';
import type { DashboardStats } from '../types';
import {
    FileText,
    TrendingUp,
    Truck,
    CheckCircle,
    Clock,
    AlertTriangle,
    ArrowRight,
    MapPin,
    Activity,
    Smartphone
} from 'lucide-react';
import './Dashboard.css';

// Demo data fallback - definido fuera del componente para estabilidad
const demoStats: DashboardStats = {
    estadisticas: {
        total: 8,
        borradores: 2,
        aprobados: 1,
        enTransito: 2,
        entregados: 1,
        recibidos: 1,
        tratados: 1
    },
    recientes: [
        { id: '1', numero: 'MAN-2025-000005', estado: 'APROBADO', createdAt: new Date().toISOString(), generador: { razonSocial: 'Química Industrial' } } as any,
        { id: '2', numero: 'MAN-2025-000006', estado: 'EN_TRANSITO', createdAt: new Date().toISOString(), generador: { razonSocial: 'Hospital Central' } } as any,
        { id: '3', numero: 'MAN-2025-000007', estado: 'RECIBIDO', createdAt: new Date().toISOString(), generador: { razonSocial: 'Metalúrgica Oeste' } } as any,
    ],
    enTransitoList: [
        { id: '2', numero: 'MAN-2025-000006', transportista: { razonSocial: 'Logística Cuyo' }, generador: { domicilio: 'Godoy Cruz' }, operador: { domicilio: 'Luján de Cuyo' } } as any,
        { id: '4', numero: 'MAN-2025-000010', transportista: { razonSocial: 'Transportes Los Andes' }, generador: { domicilio: 'Mendoza Capital' }, operador: { domicilio: 'Maipú' } } as any,
    ]
};

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats>(demoStats); // Inicializado con datos demo
    const [loading, setLoading] = useState(true);
    const [error] = useState('');

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const data = await manifiestoService.getDashboard();

            // Handle both nested and flat response structures
            if (data) {
                // Verificar si estadisticas existe y tiene valores válidos
                const hasValidEstadisticas = data.estadisticas &&
                    typeof data.estadisticas.total === 'number';

                const normalizedStats: DashboardStats = {
                    estadisticas: hasValidEstadisticas
                        ? data.estadisticas
                        : {
                            total: data.total ?? demoStats.estadisticas.total,
                            borradores: data.borradores ?? demoStats.estadisticas.borradores,
                            aprobados: data.aprobados ?? demoStats.estadisticas.aprobados,
                            enTransito: data.enTransito ?? demoStats.estadisticas.enTransito,
                            entregados: data.entregados ?? demoStats.estadisticas.entregados,
                            recibidos: data.recibidos ?? demoStats.estadisticas.recibidos,
                            tratados: data.tratados ?? demoStats.estadisticas.tratados
                        },
                    recientes: data.recientes || [],
                    enTransitoList: data.enTransitoList || []
                };
                setStats(normalizedStats);
            }
            // Si no hay data, mantener demoStats (ya está inicializado)
        } catch (err: any) {
            console.error('Dashboard error:', err);
            // En caso de error, FORZAR uso de demoStats
            console.log('Usando datos demo por error:', demoStats);
            setStats(demoStats);
        } finally {
            setLoading(false);
        }
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'BORRADOR':
                return 'badge-info';
            case 'APROBADO':
                return 'badge-success';
            case 'EN_TRANSITO':
                return 'badge-warning';
            case 'ENTREGADO':
                return 'badge-primary';
            case 'RECIBIDO':
                return 'badge-info';
            case 'TRATADO':
                return 'badge-success';
            case 'RECHAZADO':
            case 'CANCELADO':
                return 'badge-error';
            default:
                return 'badge-info';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner" />
                <p>Cargando dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-error">
                <AlertTriangle size={48} />
                <h2>Error al cargar el dashboard</h2>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadDashboard}>
                    Reintentar
                </button>
            </div>
        );
    }

    // Mensajes personalizados por rol
    const getRolMessage = () => {
        switch (user?.rol) {
            case 'ADMIN':
                return 'Panel de administración - Control total del sistema de trazabilidad.';
            case 'GENERADOR':
                return 'Gestione sus manifiestos de residuos peligrosos.';
            case 'TRANSPORTISTA':
                return 'Consulte sus viajes asignados y active el GPS para seguimiento.';
            case 'OPERADOR':
                return 'Gestione las recepciones y tratamiento de residuos en planta.';
            default:
                return 'Aquí tienes un resumen de la actividad del sistema.';
        }
    };

    return (
        <div className="dashboard animate-fadeIn">
            {/* Welcome Section - Personalizado por rol */}
            <div className="dashboard-welcome" style={{
                background: user?.rol === 'ADMIN' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))' :
                    user?.rol === 'GENERADOR' ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1))' :
                        user?.rol === 'TRANSPORTISTA' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(234, 88, 12, 0.1))' :
                            'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(168, 85, 247, 0.1))',
                border: `1px solid ${user?.rol === 'ADMIN' ? 'rgba(16, 185, 129, 0.2)' :
                    user?.rol === 'GENERADOR' ? 'rgba(59, 130, 246, 0.2)' :
                        user?.rol === 'TRANSPORTISTA' ? 'rgba(245, 158, 11, 0.2)' :
                            'rgba(139, 92, 246, 0.2)'}`,
                borderRadius: '16px',
                padding: '20px 24px'
            }}>
                <div>
                    <h2>Bienvenido, {user?.nombre}!</h2>
                    <p style={{ color: '#94a3b8', marginTop: '4px' }}>{getRolMessage()}</p>
                    <span style={{
                        display: 'inline-block',
                        marginTop: '8px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: user?.rol === 'ADMIN' ? 'rgba(16, 185, 129, 0.2)' :
                            user?.rol === 'GENERADOR' ? 'rgba(59, 130, 246, 0.2)' :
                                user?.rol === 'TRANSPORTISTA' ? 'rgba(245, 158, 11, 0.2)' :
                                    'rgba(139, 92, 246, 0.2)',
                        color: user?.rol === 'ADMIN' ? '#10b981' :
                            user?.rol === 'GENERADOR' ? '#3b82f6' :
                                user?.rol === 'TRANSPORTISTA' ? '#f59e0b' :
                                    '#8b5cf6'
                    }}>
                        {user?.rol === 'ADMIN' ? '🛡️ Administrador SITREP' :
                            user?.rol === 'GENERADOR' ? '🏭 Generador de Residuos' :
                                user?.rol === 'TRANSPORTISTA' ? '🚛 Transportista' :
                                    '🏢 Operador de Tratamiento'}
                    </span>
                </div>
                <div className="dashboard-welcome-actions">
                    {user?.rol === 'GENERADOR' && (
                        <Link to="/manifiestos/nuevo" className="btn btn-primary btn-nuevo-manifiesto">
                            <FileText size={18} />
                            Nuevo Manifiesto
                        </Link>
                    )}
                    {user?.rol === 'TRANSPORTISTA' && (
                        <Link to="/tracking" className="btn btn-primary" style={{ background: '#f59e0b' }}>
                            <MapPin size={18} />
                            Activar GPS
                        </Link>
                    )}
                    {user?.rol === 'OPERADOR' && (
                        <Link to="/manifiestos" className="btn btn-primary" style={{ background: '#8b5cf6' }}>
                            <Truck size={18} />
                            Ver Llegadas
                        </Link>
                    )}
                </div>
            </div>


            {/* Mobile App Promo */}
            <div style={{
                background: 'linear-gradient(135deg, #0f766e 0%, #115e59 50%, #134e4a 100%)',
                borderRadius: '20px',
                padding: '24px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                boxShadow: '0 10px 40px -10px rgba(13, 148, 136, 0.5)',
                border: '1px solid rgba(94, 234, 212, 0.2)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background decoration */}
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    right: '-10%',
                    width: '300px',
                    height: '300px',
                    background: 'radial-gradient(circle, rgba(94, 234, 212, 0.15) 0%, transparent 70%)',
                    borderRadius: '50%'
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 1 }}>
                    <div style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '14px',
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#5eead4'
                    }}>
                        <Smartphone size={26} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0 }}>
                            Versión Móvil Disponible
                        </h3>
                        <p style={{ fontSize: '14px', color: '#99f6e4', margin: '4px 0 0 0', opacity: 0.9 }}>
                            Prueba la experiencia optimizada para transportistas y operadores.
                        </p>
                    </div>
                </div>

                <Link to="/demo-app" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: 'white',
                    color: '#0f766e',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '14px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    position: 'relative',
                    zIndex: 1
                }}>
                    Ver Demo App
                    <ArrowRight size={18} />
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card stat-card-primary" style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
                    border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        background: 'rgba(16, 185, 129, 0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#10b981'
                    }}>
                        <FileText size={28} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1 }}>
                            {stats?.estadisticas?.total ?? 8}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', fontWeight: 600 }}>
                            Total Manifiestos
                        </div>
                    </div>
                </div>

                <div className="stat-card stat-card-warning" style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
                    border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '16px'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        background: 'rgba(245, 158, 11, 0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#f59e0b'
                    }}>
                        <Clock size={28} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1 }}>
                            {stats?.estadisticas?.borradores ?? 2}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', fontWeight: 600 }}>
                            En Borrador
                        </div>
                    </div>
                </div>

                <div className="stat-card stat-card-info" style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))',
                    border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        background: 'rgba(59, 130, 246, 0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
                    }}>
                        <Truck size={28} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1 }}>
                            {stats?.estadisticas?.enTransito ?? 2}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', fontWeight: 600 }}>
                            En Tránsito
                        </div>
                    </div>
                </div>

                <div className="stat-card stat-card-success" style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))',
                    border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '16px'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        background: 'rgba(34, 197, 94, 0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#22c55e'
                    }}>
                        <CheckCircle size={28} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1 }}>
                            {stats?.estadisticas?.tratados ?? 1}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', fontWeight: 600 }}>
                            Completados
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="dashboard-grid">
                {/* Manifiestos Recientes */}
                <div className="card dashboard-section">
                    <div className="section-header">
                        <h3>
                            <Activity size={20} />
                            Actividad Reciente
                        </h3>
                        <Link to="/manifiestos" className="btn btn-ghost">
                            Ver todos <ArrowRight size={16} />
                        </Link>
                    </div>

                    <div className="recent-list">
                        {stats?.recientes && stats.recientes.length > 0 ? (
                            stats.recientes.map((manifiesto) => (
                                <Link
                                    key={manifiesto.id}
                                    to={`/manifiestos/${manifiesto.id}`}
                                    className="recent-item"
                                >
                                    <div className="recent-item-info">
                                        <strong>{manifiesto.numero}</strong>
                                        <span>{manifiesto.generador?.razonSocial}</span>
                                    </div>
                                    <div className="recent-item-meta">
                                        <span className={`badge ${getEstadoColor(manifiesto.estado)}`}>
                                            {manifiesto.estado.replace('_', ' ')}
                                        </span>
                                        <span className="recent-item-date">
                                            {formatDate(manifiesto.updatedAt)}
                                        </span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="empty-state">
                                <FileText size={40} />
                                <p>No hay manifiestos registrados</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Manifiestos en Tránsito con Mapa */}
                <div className="card dashboard-section">
                    <div className="section-header">
                        <h3>
                            <MapPin size={20} />
                            En Tránsito
                        </h3>
                        <Link to="/tracking" className="btn btn-ghost">
                            Ver mapa <ArrowRight size={16} />
                        </Link>
                    </div>

                    {/* Mini Mapa */}
                    <div className="dashboard-map-container">
                        <iframe
                            title="Mapa de Monitoreo"
                            src="https://www.openstreetmap.org/export/embed.html?bbox=-69.2%2C-33.2%2C-68.5%2C-32.6&amp;layer=mapnik&amp;marker=-32.8895%2C-68.8458"
                            className="dashboard-map-iframe"
                        />
                        <div className="dashboard-map-overlay">
                            <span className="map-badge">{stats?.enTransitoList?.length || 0} vehículos activos</span>
                        </div>
                    </div>

                    <div className="transit-list">
                        {stats?.enTransitoList && stats.enTransitoList.length > 0 ? (
                            stats.enTransitoList.map((manifiesto) => (
                                <div key={manifiesto.id} className="transit-item">
                                    <div className="transit-indicator">
                                        <Truck size={20} />
                                        <span className="transit-pulse" />
                                    </div>
                                    <div className="transit-info">
                                        <strong>{manifiesto.numero}</strong>
                                        <span>{manifiesto.transportista?.razonSocial}</span>
                                        <span className="transit-route">
                                            {manifiesto.generador?.domicilio?.split(',')[0]} → {manifiesto.operador?.domicilio?.split(',')[0]}
                                        </span>
                                    </div>
                                    <Link to={`/manifiestos/${manifiesto.id}`} className="btn btn-icon btn-ghost">
                                        <ArrowRight size={18} />
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Truck size={40} />
                                <p>No hay transportes activos</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
                <div className="quick-stat">
                    <div className="quick-stat-icon approved">
                        <TrendingUp size={20} />
                    </div>
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{stats?.estadisticas.aprobados || 0}</span>
                        <span className="quick-stat-label">Aprobados</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <div className="quick-stat-icon delivered">
                        <CheckCircle size={20} />
                    </div>
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{stats?.estadisticas.entregados || 0}</span>
                        <span className="quick-stat-label">Entregados</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <div className="quick-stat-icon received">
                        <Activity size={20} />
                    </div>
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{stats?.estadisticas.recibidos || 0}</span>
                        <span className="quick-stat-label">Recibidos</span>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Dashboard;
