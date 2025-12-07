import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { manifiestoService } from '../services/manifiesto.service';
import type { DashboardStats } from '../types';
import OnboardingTour from '../components/OnboardingTour';
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
    Smartphone,
    HelpCircle
} from 'lucide-react';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showTour, setShowTour] = useState(false);

    useEffect(() => {
        loadDashboard();
        // Mostrar tour si es la primera vez
        const tourCompleted = localStorage.getItem('tourCompleted');
        if (!tourCompleted) {
            setTimeout(() => setShowTour(true), 500);
        }
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const data = await manifiestoService.getDashboard();
            setStats(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al cargar el dashboard');
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

    return (
        <div className="dashboard animate-fadeIn">
            {/* Onboarding Tour */}
            <OnboardingTour
                userRole={user?.rol as 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR'}
                isOpen={showTour}
                onComplete={() => setShowTour(false)}
            />

            {/* Welcome Section */}
            <div className="dashboard-welcome">
                <div>
                    <h2>Bienvenido, {user?.nombre}!</h2>
                    <p>Aquí tienes un resumen de la actividad del sistema.</p>
                </div>
                <div className="dashboard-welcome-actions">
                    <button
                        className="btn btn-ghost btn-help"
                        onClick={() => {
                            localStorage.removeItem('tourCompleted');
                            setShowTour(true);
                        }}
                        title="Ver guía del sistema"
                    >
                        <HelpCircle size={18} />
                        Ayuda
                    </button>
                    {user?.rol === 'GENERADOR' && (
                        <Link to="/manifiestos/nuevo" className="btn btn-primary btn-nuevo-manifiesto">
                            <FileText size={18} />
                            Nuevo Manifiesto
                        </Link>
                    )}
                </div>
            </div>

            {/* Mobile App Promo */}
            <div className="mobile-promo-card">
                <div className="promo-content">
                    <div className="promo-icon">
                        <Smartphone size={28} />
                    </div>
                    <div className="promo-text">
                        <h3>Versión Móvil Disponible</h3>
                        <p>Prueba la experiencia optimizada para transportistas y operadores.</p>
                    </div>
                </div>
                <Link to="/demo-app" className="btn btn-light">
                    Ver Demo App
                    <ArrowRight size={18} />
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card stat-card-primary">
                    <div className="stat-icon">
                        <FileText />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats?.estadisticas.total || 0}</span>
                        <span className="stat-label">Total Manifiestos</span>
                    </div>
                </div>

                <div className="stat-card stat-card-warning">
                    <div className="stat-icon">
                        <Clock />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats?.estadisticas.borradores || 0}</span>
                        <span className="stat-label">En Borrador</span>
                    </div>
                </div>

                <div className="stat-card stat-card-info">
                    <div className="stat-icon">
                        <Truck />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats?.estadisticas.enTransito || 0}</span>
                        <span className="stat-label">En Tránsito</span>
                    </div>
                </div>

                <div className="stat-card stat-card-success">
                    <div className="stat-icon">
                        <CheckCircle />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats?.estadisticas.tratados || 0}</span>
                        <span className="stat-label">Completados</span>
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

                {/* Manifiestos en Tránsito */}
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
        </div>
    );
};

export default Dashboard;
