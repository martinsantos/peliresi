import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { manifiestoService } from '../services/manifiesto.service';
import { usuarioService } from '../services/admin.service';
import { offlineStorage } from '../services/offlineStorage';
import { demoStats } from '../data/demoDashboard';
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
    Smartphone,
    Users,
    UserCheck,
    Shield,
    Factory,
    Building2,
    Edit,
    Award,
    Package,
    Recycle,
    Navigation,
    QrCode,
    History,
    BarChart3
} from 'lucide-react';
import ActiveTripBanner from '../components/ActiveTripBanner';
import './Dashboard.css';

// ============================================
// CONFIGURACIÓN UNIFICADA POR ROL
// ============================================

interface StatCardConfig {
    label: string;
    value: number;
    icon: React.ComponentType<{ size: number }>;
    color: string;
    bgColor: string;
    borderColor: string;
}

interface QuickActionConfig {
    label: string;
    icon: React.ComponentType<{ size: number }>;
    to: string;
    color: string;
}

// Función para obtener estadísticas específicas por rol
const getStatCardsByRole = (
    role: string | undefined,
    stats: DashboardStats['estadisticas']
): StatCardConfig[] => {
    const s = stats || demoStats.estadisticas;

    switch (role) {
        case 'ADMIN':
            return [
                {
                    label: 'TOTAL SISTEMA',
                    value: s.total ?? 0,
                    icon: FileText,
                    color: '#10b981',
                    bgColor: 'rgba(16, 185, 129, 0.15)',
                    borderColor: 'rgba(16, 185, 129, 0.3)'
                },
                {
                    label: 'PENDIENTES DGFA',
                    value: s.pendientesAprobacion ?? s.borradores ?? 0,
                    icon: Clock,
                    color: '#f59e0b',
                    bgColor: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                },
                {
                    label: 'EN PROCESO',
                    value: (s.aprobados ?? 0) + (s.enTransito ?? 0) + (s.entregados ?? 0) + (s.recibidos ?? 0),
                    icon: TrendingUp,
                    color: '#3b82f6',
                    bgColor: 'rgba(59, 130, 246, 0.15)',
                    borderColor: 'rgba(59, 130, 246, 0.3)'
                },
                {
                    label: 'COMPLETADOS',
                    value: s.tratados ?? 0,
                    icon: CheckCircle,
                    color: '#22c55e',
                    bgColor: 'rgba(34, 197, 94, 0.15)',
                    borderColor: 'rgba(34, 197, 94, 0.3)'
                }
            ];

        case 'GENERADOR':
            return [
                {
                    label: 'MIS MANIFIESTOS',
                    value: s.total ?? 0,
                    icon: FileText,
                    color: '#3b82f6',
                    bgColor: 'rgba(59, 130, 246, 0.15)',
                    borderColor: 'rgba(59, 130, 246, 0.3)'
                },
                {
                    label: 'POR FIRMAR',
                    value: s.borradores ?? 0,
                    icon: Edit,
                    color: '#f59e0b',
                    bgColor: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                },
                {
                    label: 'EN PROCESO',
                    // Sincronizado con APP: incluye pendientesAprobacion y enTratamiento
                    value: (s.pendientesAprobacion ?? 0) + (s.aprobados ?? 0) + (s.enTransito ?? 0) + (s.entregados ?? 0) + (s.recibidos ?? 0) + (s.enTratamiento ?? 0),
                    icon: Truck,
                    color: '#f97316',
                    bgColor: 'rgba(249, 115, 22, 0.15)',
                    borderColor: 'rgba(249, 115, 22, 0.3)'
                },
                {
                    label: 'COMPLETADOS',
                    value: s.tratados ?? 0,
                    icon: Award,
                    color: '#22c55e',
                    bgColor: 'rgba(34, 197, 94, 0.15)',
                    borderColor: 'rgba(34, 197, 94, 0.3)'
                }
            ];

        case 'TRANSPORTISTA':
            return [
                {
                    label: 'ASIGNADOS',
                    value: s.total ?? 0,
                    icon: FileText,
                    color: '#06b6d4',
                    bgColor: 'rgba(6, 182, 212, 0.15)',
                    borderColor: 'rgba(6, 182, 212, 0.3)'
                },
                {
                    label: 'POR RETIRAR',
                    value: s.aprobados ?? 0,
                    icon: Clock,
                    color: '#f59e0b',
                    bgColor: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                },
                {
                    label: 'EN RUTA',
                    value: s.enTransito ?? 0,
                    icon: Truck,
                    color: '#f97316',
                    bgColor: 'rgba(249, 115, 22, 0.15)',
                    borderColor: 'rgba(249, 115, 22, 0.3)'
                },
                {
                    label: 'ENTREGADOS',
                    // Sincronizado con APP: incluye enTratamiento
                    value: (s.entregados ?? 0) + (s.recibidos ?? 0) + (s.enTratamiento ?? 0) + (s.tratados ?? 0),
                    icon: CheckCircle,
                    color: '#22c55e',
                    bgColor: 'rgba(34, 197, 94, 0.15)',
                    borderColor: 'rgba(34, 197, 94, 0.3)'
                }
            ];

        case 'OPERADOR':
            return [
                {
                    label: 'ENTRANTES',
                    value: s.total ?? 0,
                    icon: FileText,
                    color: '#8b5cf6',
                    bgColor: 'rgba(139, 92, 246, 0.15)',
                    borderColor: 'rgba(139, 92, 246, 0.3)'
                },
                {
                    label: 'POR RECIBIR',
                    value: s.entregados ?? 0,
                    icon: Package,
                    color: '#f59e0b',
                    bgColor: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                },
                {
                    label: 'EN TRATAMIENTO',
                    value: (s.recibidos ?? 0) + (s.enTratamiento ?? 0),
                    icon: Recycle,
                    color: '#f97316',
                    bgColor: 'rgba(249, 115, 22, 0.15)',
                    borderColor: 'rgba(249, 115, 22, 0.3)'
                },
                {
                    label: 'PROCESADOS',
                    value: s.tratados ?? 0,
                    icon: Award,
                    color: '#22c55e',
                    bgColor: 'rgba(34, 197, 94, 0.15)',
                    borderColor: 'rgba(34, 197, 94, 0.3)'
                }
            ];

        default:
            return [
                {
                    label: 'TOTAL',
                    value: s.total ?? 0,
                    icon: FileText,
                    color: '#10b981',
                    bgColor: 'rgba(16, 185, 129, 0.15)',
                    borderColor: 'rgba(16, 185, 129, 0.3)'
                },
                {
                    label: 'PENDIENTES',
                    value: s.borradores ?? 0,
                    icon: Clock,
                    color: '#f59e0b',
                    bgColor: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                },
                {
                    label: 'EN CURSO',
                    value: s.enTransito ?? 0,
                    icon: Truck,
                    color: '#3b82f6',
                    bgColor: 'rgba(59, 130, 246, 0.15)',
                    borderColor: 'rgba(59, 130, 246, 0.3)'
                },
                {
                    label: 'COMPLETADOS',
                    value: s.tratados ?? 0,
                    icon: CheckCircle,
                    color: '#22c55e',
                    bgColor: 'rgba(34, 197, 94, 0.15)',
                    borderColor: 'rgba(34, 197, 94, 0.3)'
                }
            ];
    }
};

// Función para obtener acciones rápidas por rol
const getQuickActionsByRole = (role: string | undefined): QuickActionConfig[] => {
    switch (role) {
        case 'ADMIN':
            return [
                { label: 'Cola de Aprobación', icon: Clock, to: '/admin/aprobaciones', color: '#f59e0b' },
                { label: 'Centro de Control', icon: Activity, to: '/admin/centro-control', color: '#10b981' },
                { label: 'Gestión Usuarios', icon: Users, to: '/usuarios', color: '#3b82f6' }
            ];
        case 'GENERADOR':
            return [
                { label: 'Nuevo Manifiesto', icon: FileText, to: '/manifiestos/nuevo', color: '#3b82f6' },
                { label: 'Mis Manifiestos', icon: FileText, to: '/manifiestos', color: '#8b5cf6' },
                { label: 'Seguimiento', icon: MapPin, to: '/seguimiento', color: '#06b6d4' }
            ];
        case 'TRANSPORTISTA':
            return [
                { label: 'Iniciar Viaje', icon: Navigation, to: '/tracking', color: '#f59e0b' },
                { label: 'Escanear QR', icon: QrCode, to: '/escanear', color: '#06b6d4' },
                { label: 'Historial Viajes', icon: History, to: '/historial-viajes', color: '#8b5cf6' }
            ];
        case 'OPERADOR':
            return [
                { label: 'Ver Llegadas', icon: Package, to: '/manifiestos', color: '#8b5cf6' },
                { label: 'Escanear QR', icon: QrCode, to: '/escanear', color: '#06b6d4' },
                { label: 'Reportes Planta', icon: BarChart3, to: '/reportes', color: '#10b981' }
            ];
        default:
            return [];
    }
};

// Demo data fallback - ahora importado de ../data/demoDashboard

interface AdminStats {
    usuarios: {
        total: number;
        activos: number;
        pendientes: number;
        porRol: Record<string, number>;
    };
    manifiestos: {
        total: number;
        porEstado: Record<string, number>;
    };
}

// Interfaz para viaje activo
interface ViajeActivo {
    manifiesto: {
        id: string;
        numero: string;
        generador?: { razonSocial: string };
        operador?: { razonSocial: string };
    };
    startTime: number;
    ubicacionActual?: { lat: number; lng: number };
}

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats>(demoStats);
    const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error] = useState('');
    const [viajeActivo, setViajeActivo] = useState<ViajeActivo | null>(null);

    useEffect(() => {
        loadDashboard();
        if (user?.rol === 'ADMIN') {
            loadAdminStats();
        }
        // Cargar viaje activo para TRANSPORTISTA
        if (user?.rol === 'TRANSPORTISTA') {
            loadViajeActivo();
        }
    }, [user?.rol]);

    // Cargar viaje activo desde IndexedDB (sincronizado con APP) o API
    const loadViajeActivo = async () => {
        try {
            // Primero intentar cargar de IndexedDB (sincronizado con APP móvil)
            const activeTrip = await offlineStorage.getActiveTrip();
            if (activeTrip) {
                // Obtener detalles del manifiesto desde API
                try {
                    const manifiestoData = await manifiestoService.getManifiesto(activeTrip.manifiestoId);
                    if (manifiestoData) {
                        const tripData: ViajeActivo = {
                            manifiesto: {
                                id: manifiestoData.id,
                                numero: manifiestoData.numero,
                                generador: manifiestoData.generador,
                                operador: manifiestoData.operador
                            },
                            startTime: activeTrip.startTimestamp,
                            ubicacionActual: activeTrip.routePoints?.length > 0
                                ? {
                                    lat: activeTrip.routePoints[activeTrip.routePoints.length - 1].lat,
                                    lng: activeTrip.routePoints[activeTrip.routePoints.length - 1].lng
                                }
                                : undefined
                        };
                        setViajeActivo(tripData);
                        console.log('[Dashboard] Viaje activo cargado desde IndexedDB:', tripData.manifiesto.numero);
                        return;
                    }
                } catch (e) {
                    console.warn('[Dashboard] Error obteniendo detalles del manifiesto:', e);
                }
            }

            // Si no hay en IndexedDB, buscar manifiestos EN_TRANSITO del transportista actual
            const response = await manifiestoService.getManifiestos({ estado: 'EN_TRANSITO', limit: 1 });
            if (response?.manifiestos && response.manifiestos.length > 0) {
                const manifiesto = response.manifiestos[0];
                const tripData: ViajeActivo = {
                    manifiesto: {
                        id: manifiesto.id,
                        numero: manifiesto.numero,
                        generador: manifiesto.generador,
                        operador: manifiesto.operador
                    },
                    startTime: new Date(manifiesto.fechaRetiro || manifiesto.updatedAt).getTime(),
                    ubicacionActual: undefined
                };
                setViajeActivo(tripData);
                console.log('[Dashboard] Viaje activo cargado desde API:', tripData.manifiesto.numero);
            }
        } catch (err) {
            console.error('Error cargando viaje activo:', err);
        }
    };

    // Handlers para el banner de viaje activo
    const handleVerMapa = () => {
        navigate('/tracking');
    };

    const handleFinalizarViaje = async () => {
        if (!viajeActivo) return;
        try {
            await manifiestoService.confirmarEntrega(viajeActivo.manifiesto.id, {
                latitud: viajeActivo.ubicacionActual?.lat,
                longitud: viajeActivo.ubicacionActual?.lng
            });
            // Limpiar viaje activo de IndexedDB
            await offlineStorage.clearActiveTrip();
            setViajeActivo(null);
            loadDashboard(); // Recargar stats
        } catch (err) {
            console.error('Error finalizando viaje:', err);
            alert('Error al finalizar el viaje. Intente nuevamente.');
        }
    };

    const handleCerrarBanner = () => {
        setViajeActivo(null);
    };

    const loadAdminStats = async () => {
        try {
            const data = await usuarioService.getEstadisticas();
            setAdminStats(data);
        } catch (err) {
            console.error('Error loading admin stats:', err);
        }
    };

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
            {/* Banner de Viaje Activo - Solo para TRANSPORTISTA */}
            {user?.rol === 'TRANSPORTISTA' && viajeActivo && (
                <ActiveTripBanner
                    manifiesto={viajeActivo.manifiesto}
                    startTime={viajeActivo.startTime}
                    ubicacionActual={viajeActivo.ubicacionActual}
                    onVerMapa={handleVerMapa}
                    onFinalizarViaje={handleFinalizarViaje}
                    onCerrar={handleCerrarBanner}
                />
            )}

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

            {/* Stats Grid - Dinámico por rol */}
            <div className="stats-grid">
                {getStatCardsByRole(user?.rol, stats?.estadisticas).map((card, index) => {
                    const IconComponent = card.icon;
                    return (
                        <div key={index} className="stat-card" style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                            background: `linear-gradient(135deg, ${card.bgColor}, ${card.bgColor.replace('0.15', '0.05')})`,
                            border: `1px solid ${card.borderColor}`, borderRadius: '16px'
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '14px',
                                background: card.bgColor.replace('0.15', '0.2'), display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: card.color
                            }}>
                                <IconComponent size={28} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <div style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1 }}>
                                    {card.value}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', fontWeight: 600 }}>
                                    {card.label}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Acciones Rápidas - Dinámico por rol */}
            {getQuickActionsByRole(user?.rol).length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    marginBottom: '24px'
                }}>
                    {getQuickActionsByRole(user?.rol).map((action, index) => {
                        const IconComponent = action.icon;
                        return (
                            <Link
                                key={index}
                                to={action.to}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '16px 20px',
                                    background: `linear-gradient(135deg, ${action.color}20, ${action.color}10)`,
                                    border: `1px solid ${action.color}40`,
                                    borderRadius: '12px',
                                    textDecoration: 'none',
                                    color: '#f8fafc',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = `0 8px 25px ${action.color}30`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: `${action.color}30`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: action.color
                                }}>
                                    <IconComponent size={20} />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '14px' }}>{action.label}</span>
                            </Link>
                        );
                    })}
                </div>
            )}

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
                        <span className="quick-stat-value">{stats?.estadisticas?.aprobados || 0}</span>
                        <span className="quick-stat-label">Aprobados</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <div className="quick-stat-icon delivered">
                        <CheckCircle size={20} />
                    </div>
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{stats?.estadisticas?.entregados || 0}</span>
                        <span className="quick-stat-label">Entregados</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <div className="quick-stat-icon received">
                        <Activity size={20} />
                    </div>
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{stats?.estadisticas?.recibidos || 0}</span>
                        <span className="quick-stat-label">Recibidos</span>
                    </div>
                </div>
            </div>

            {/* Admin Panel - Solo visible para ADMIN */}
            {user?.rol === 'ADMIN' && adminStats && (
                <div className="admin-panel" style={{ marginTop: '24px' }}>
                    <div className="section-header" style={{ marginBottom: '16px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#f8fafc' }}>
                            <Users size={20} />
                            Panel de Administración
                        </h3>
                        <Link to="/admin/usuarios-panel" className="btn btn-ghost">
                            Gestionar Usuarios <ArrowRight size={16} />
                        </Link>
                    </div>

                    <div className="admin-stats-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '16px',
                        marginBottom: '24px'
                    }}>
                        {/* Total Usuarios */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
                            border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: '#10b981'
                            }}>
                                <Users size={24} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc' }}>
                                    {adminStats.usuarios.total}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                                    Total Usuarios
                                </div>
                            </div>
                        </div>

                        {/* Usuarios Activos */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))',
                            border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: 'rgba(59, 130, 246, 0.2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
                            }}>
                                <UserCheck size={24} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc' }}>
                                    {adminStats.usuarios.activos}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                                    Activos
                                </div>
                            </div>
                        </div>

                        {/* Pendientes */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
                            border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '16px'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: 'rgba(245, 158, 11, 0.2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: '#f59e0b'
                            }}>
                                <Clock size={24} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc' }}>
                                    {adminStats.usuarios.pendientes}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                                    Pendientes
                                </div>
                            </div>
                            {adminStats.usuarios.pendientes > 0 && (
                                <Link to="/admin/usuarios" style={{
                                    marginLeft: 'auto', padding: '6px 12px', background: '#f59e0b',
                                    color: '#000', borderRadius: '8px', fontSize: '12px', fontWeight: 600
                                }}>
                                    Aprobar
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Distribución por Rol */}
                    <div style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        borderRadius: '16px', padding: '20px'
                    }}>
                        <h4 style={{ margin: '0 0 16px', color: '#f8fafc', fontSize: '14px' }}>
                            Usuarios por Rol
                        </h4>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Shield size={16} style={{ color: '#10b981' }} />
                                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Admin:</span>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                                    {adminStats.usuarios.porRol['ADMIN'] || 0}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Factory size={16} style={{ color: '#3b82f6' }} />
                                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Generadores:</span>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                                    {adminStats.usuarios.porRol['GENERADOR'] || 0}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Truck size={16} style={{ color: '#f59e0b' }} />
                                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Transportistas:</span>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                                    {adminStats.usuarios.porRol['TRANSPORTISTA'] || 0}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Building2 size={16} style={{ color: '#8b5cf6' }} />
                                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Operadores:</span>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                                    {adminStats.usuarios.porRol['OPERADOR'] || 0}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Link a Actividad Global */}
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                        <Link to="/admin/actividad" style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 20px', background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)', borderRadius: '10px',
                            color: '#10b981', textDecoration: 'none', fontSize: '14px', fontWeight: 500
                        }}>
                            <Activity size={18} />
                            Ver Actividad Global
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Dashboard;
