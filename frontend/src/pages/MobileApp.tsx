import React, { useState, useEffect, useRef } from 'react';
import {
    Home, FileText, MapPin, Bell, Settings, User, Menu,
    Truck, Package, Factory, Building2, QrCode, Camera,
    CheckCircle, AlertTriangle, Navigation, Wifi, WifiOff,
    Download, BarChart3, Users, Shield, Eye, RefreshCw,
    ChevronRight, ChevronLeft, Plus, Search, LogOut,
    Play, Pause, MapPinned, Clock, Scale
} from 'lucide-react';
import { useConnectivity } from '../hooks/useConnectivity';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { analyticsService } from '../services/analytics.service';
import './MobileApp.css';

type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
type Screen = 'home' | 'manifiestos' | 'tracking' | 'alertas' | 'perfil' | 'detalle' | 'nuevo' | 'escanear' | 'actores' | 'viaje';

interface MenuItem {
    id: Screen;
    label: string;
    icon: React.ReactNode;
}

// Expose analytics globally for debugging
if (typeof window !== 'undefined') {
    (window as any).analyticsService = analyticsService;
}

const MobileApp: React.FC = () => {
    const [role, setRole] = useState<UserRole | null>(null);
    const [currentScreen, setCurrentScreen] = useState<Screen>('home');
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectedManifiesto, setSelectedManifiesto] = useState<any>(null);
    const [viajeActivo, setViajeActivo] = useState(false);
    const [tiempoViaje, setTiempoViaje] = useState(0);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const intervalRef = useRef<number | null>(null);

    const { isOnline, syncPending } = useConnectivity();
    const { promptInstall, canInstall, isIOS } = usePWAInstall();

    // Timer for active trip
    useEffect(() => {
        if (viajeActivo) {
            intervalRef.current = window.setInterval(() => {
                setTiempoViaje(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [viajeActivo]);

    // Format time
    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Show toast notification
    const showToastMessage = (message: string) => {
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    // Demo data - Aumentado para testing completo
    const manifiestos = [
        { id: 'm1', numero: '2025-000005', estado: 'APROBADO', generador: 'Química Industrial Mendoza', operador: 'Centro Tratamiento Cuyo', residuo: 'Y1 - Ácido Clorhídrico', cantidad: '150 kg', fecha: '07/12' },
        { id: 'm2', numero: '2025-000006', estado: 'EN_TRANSITO', generador: 'Hospital Central', operador: 'Planta Este', residuo: 'Y3 - Medicamentos', cantidad: '80 kg', fecha: '07/12', eta: '14:30' },
        { id: 'm3', numero: '2025-000004', estado: 'RECIBIDO', generador: 'Petroandina S.A.', operador: 'Centro Tratamiento Cuyo', residuo: 'Y8 - Aceites', cantidad: '1200 L', fecha: '06/12' },
        { id: 'm4', numero: '2025-000001', estado: 'TRATADO', generador: 'Química Industrial', operador: 'Centro Tratamiento', residuo: 'Y1 - Desechos', cantidad: '250 kg', fecha: '01/12' },
        { id: 'm5', numero: '2025-000007', estado: 'APROBADO', generador: 'Metalúrgica del Oeste', operador: 'Centro Tratamiento Cuyo', residuo: 'Y12 - Pinturas y barnices', cantidad: '95 kg', fecha: '08/12' },
        { id: 'm6', numero: '2025-000008', estado: 'EN_TRANSITO', generador: 'Farmacéutica Los Andes', operador: 'Planta Este', residuo: 'Y4 - Reactivos químicos', cantidad: '120 L', fecha: '08/12', eta: '16:45' },
        { id: 'm7', numero: '2025-000009', estado: 'APROBADO', generador: 'Laboratorio Análisis SA', operador: 'Centro Tratamiento Cuyo', residuo: 'Y6 - Solventes halogenados', cantidad: '65 L', fecha: '08/12' },
        { id: 'm8', numero: '2025-000003', estado: 'RECIBIDO', generador: 'Automotriz Cuyo', operador: 'Planta Este', residuo: 'Y9 - Aceites hidráulicos', cantidad: '450 L', fecha: '05/12' },
    ];

    const actores = [
        { id: 'g1', tipo: 'GENERADOR', nombre: 'Química Industrial Mendoza', cuit: '30-12345678-9', estado: 'ACTIVO' },
        { id: 'g2', tipo: 'GENERADOR', nombre: 'Hospital Central Mendoza', cuit: '30-87654321-0', estado: 'ACTIVO' },
        { id: 't1', tipo: 'TRANSPORTISTA', nombre: 'Transportes Los Andes', cuit: '30-11111111-1', estado: 'ACTIVO', vehiculos: 5 },
        { id: 't2', tipo: 'TRANSPORTISTA', nombre: 'Logística Cuyo S.A.', cuit: '30-22222222-2', estado: 'ACTIVO', vehiculos: 8 },
        { id: 'o1', tipo: 'OPERADOR', nombre: 'Centro Tratamiento Cuyo', cuit: '30-33333333-3', estado: 'ACTIVO' },
        { id: 'o2', tipo: 'OPERADOR', nombre: 'Planta Este Residuos', cuit: '30-44444444-4', estado: 'ACTIVO' },
    ];

    const alertas = [
        { id: 'a1', tipo: 'warning', mensaje: 'Manifiesto #000006 demora en ruta', tiempo: '15 min' },
        { id: 'a2', tipo: 'info', mensaje: 'Nuevo manifiesto asignado', tiempo: '1h' },
        { id: 'a3', tipo: 'success', mensaje: 'Recepción confirmada', tiempo: '3h' },
        { id: 'a4', tipo: 'warning', mensaje: 'Vehículo ABC-123 requiere mantenimiento', tiempo: '4h' },
        { id: 'a5', tipo: 'info', mensaje: 'Actualización de sistema disponible', tiempo: '1d' },
    ];

    const handleChangeRole = () => {
        setRole(null);
        setCurrentScreen('home');
        setMenuOpen(false);
        setViajeActivo(false);
        setTiempoViaje(0);
    };

    const handleIniciarViaje = () => {
        setViajeActivo(true);
        setCurrentScreen('viaje');
        showToastMessage('🚛 Viaje iniciado - GPS activado');
        analyticsService.trackAction('iniciar_viaje', 'viaje', role || undefined);
    };

    const handleFinalizarViaje = () => {
        setViajeActivo(false);
        setTiempoViaje(0);
        setCurrentScreen('home');
        showToastMessage('✅ Viaje finalizado correctamente');
        analyticsService.trackAction('finalizar_viaje', 'viaje', role || undefined, { duracion: tiempoViaje });
    };

    // Role selection screen
    if (!role) {
        return (
            <div className="app-container">
                {/* Connectivity indicator in role selection */}
                <div className="connectivity-float">
                    <div className={`conn-badge ${isOnline ? 'online' : 'offline'}`}>
                        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                        <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                </div>

                <div className="role-selection">
                    <div className="role-logo" style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)'
                    }}>
                        <Shield size={36} strokeWidth={2} />
                    </div>
                    <h1 style={{ color: '#ffffff' }}>SITREP</h1>
                    <p style={{ color: '#94a3b8' }}>Sistema de Trazabilidad</p>

                    <div className="role-list">
                        {[
                            { role: 'ADMIN' as UserRole, icon: <Shield size={30} strokeWidth={2.5} />, title: 'Administrador', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
                            { role: 'GENERADOR' as UserRole, icon: <Factory size={30} strokeWidth={2.5} />, title: 'Generador', gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
                            { role: 'TRANSPORTISTA' as UserRole, icon: <Truck size={30} strokeWidth={2.5} />, title: 'Transportista', gradient: 'linear-gradient(135deg, #f59e0b, #ea580c)' },
                            { role: 'OPERADOR' as UserRole, icon: <Building2 size={30} strokeWidth={2.5} />, title: 'Operador', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
                        ].map((item) => (
                            <button
                                key={item.role}
                                className="role-btn"
                                onClick={() => {
                                    setRole(item.role);
                                    analyticsService.trackRoleSelection(item.role);
                                    analyticsService.trackPageView('home', item.role);
                                }}
                            >
                                <span className="role-icon" style={{
                                    background: item.gradient,
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                                }}>
                                    <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                                    }}>
                                        {item.icon}
                                    </span>
                                </span>
                                <span className="role-name" style={{ color: '#ffffff', fontWeight: 600 }}>{item.title}</span>
                                <ChevronRight size={22} style={{ color: '#94a3b8' }} />
                            </button>
                        ))}
                    </div>

                    <button className="install-hint" onClick={promptInstall} style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#10b981'
                    }}>
                        <Download size={18} />
                        <span>{canInstall ? 'Instalar App' : isIOS ? 'Agregar a Inicio' : 'Instalar App'}</span>
                    </button>
                </div>
            </div>
        );
    }

    const getMenuItems = (): MenuItem[] => {
        switch (role) {
            case 'ADMIN':
                return [
                    { id: 'home', label: 'Dashboard', icon: <Home size={20} /> },
                    { id: 'manifiestos', label: 'Manifiestos', icon: <FileText size={20} /> },
                    { id: 'tracking', label: 'Monitoreo', icon: <MapPin size={20} /> },
                    { id: 'alertas', label: 'Alertas', icon: <Bell size={20} /> },
                    { id: 'perfil', label: 'Sistema', icon: <Settings size={20} /> },
                ];
            case 'GENERADOR':
                return [
                    { id: 'home', label: 'Inicio', icon: <Home size={20} /> },
                    { id: 'manifiestos', label: 'Manifiestos', icon: <FileText size={20} /> },
                    { id: 'nuevo', label: 'Nuevo', icon: <Plus size={20} /> },
                    { id: 'alertas', label: 'Alertas', icon: <Bell size={20} /> },
                    { id: 'perfil', label: 'Perfil', icon: <User size={20} /> },
                ];
            case 'TRANSPORTISTA':
                return [
                    { id: 'home', label: 'Ruta', icon: <Home size={20} /> },
                    { id: 'escanear', label: 'QR', icon: <QrCode size={20} /> },
                    { id: 'tracking', label: 'Viaje', icon: <Navigation size={20} /> },
                    { id: 'alertas', label: 'Alertas', icon: <Bell size={20} /> },
                    { id: 'perfil', label: 'Perfil', icon: <User size={20} /> },
                ];
            case 'OPERADOR':
                return [
                    { id: 'home', label: 'Entrantes', icon: <Home size={20} /> },
                    { id: 'escanear', label: 'QR', icon: <QrCode size={20} /> },
                    { id: 'manifiestos', label: 'Recibidos', icon: <Package size={20} /> },
                    { id: 'alertas', label: 'Alertas', icon: <Bell size={20} /> },
                    { id: 'perfil', label: 'Perfil', icon: <User size={20} /> },
                ];
            default:
                return [];
        }
    };

    const getRoleColor = (): string => {
        const colors: Record<UserRole, string> = {
            'ADMIN': '#3b82f6',
            'GENERADOR': '#8b5cf6',
            'TRANSPORTISTA': '#f59e0b',
            'OPERADOR': '#10b981'
        };
        return colors[role];
    };

    const getRoleName = (): string => {
        const names: Record<UserRole, string> = {
            'ADMIN': 'Administrador',
            'GENERADOR': 'Generador',
            'TRANSPORTISTA': 'Transportista',
            'OPERADOR': 'Operador'
        };
        return names[role];
    };

    const getEstadoBadge = (estado: string) => {
        const config: Record<string, { bg: string; color: string; label: string }> = {
            'APROBADO': { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
            'EN_TRANSITO': { bg: '#dbeafe', color: '#1e40af', label: 'En Tránsito' },
            'RECIBIDO': { bg: '#d1fae5', color: '#065f46', label: 'Recibido' },
            'TRATADO': { bg: '#10b981', color: '#fff', label: 'Completado' },
        };
        const s = config[estado] || { bg: '#334155', color: '#94a3b8', label: estado };
        return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
    };

    const getActorIcon = (tipo: string) => {
        switch (tipo) {
            case 'GENERADOR': return <Factory size={18} />;
            case 'TRANSPORTISTA': return <Truck size={18} />;
            case 'OPERADOR': return <Building2 size={18} />;
            default: return <User size={18} />;
        }
    };

    const menuItems = getMenuItems();

    const renderContent = () => {
        switch (currentScreen) {
            case 'home':
                return (
                    <>
                        {/* Connectivity Status Bar */}
                        <div className={`connectivity-bar ${isOnline ? 'online' : 'offline'}`}>
                            {syncPending ? (
                                <>
                                    <RefreshCw size={14} className="spinning" />
                                    <span>Sincronizando...</span>
                                </>
                            ) : (
                                <>
                                    {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                                    <span>{isOnline ? 'Conectado' : 'Modo Offline'}</span>
                                </>
                            )}
                        </div>

                        {/* Active Trip Banner */}
                        {viajeActivo && role === 'TRANSPORTISTA' && (
                            <div className="viaje-banner" onClick={() => setCurrentScreen('viaje')}>
                                <div className="viaje-pulse"></div>
                                <Navigation size={18} />
                                <div className="viaje-info">
                                    <span className="viaje-status">Viaje en curso</span>
                                    <span className="viaje-timer">{formatTime(tiempoViaje)}</span>
                                </div>
                                <ChevronRight size={18} />
                            </div>
                        )}

                        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(30, 41, 59, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '16px',
                                padding: '24px 16px',
                                minHeight: '100px'
                            }}>
                                <div style={{ fontSize: '48px', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
                                    {manifiestos.filter(m => m.estado === 'APROBADO').length}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: '8px' }}>
                                    Pendientes
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(30, 41, 59, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '16px',
                                padding: '24px 16px',
                                minHeight: '100px'
                            }}>
                                <div style={{ fontSize: '48px', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
                                    {manifiestos.filter(m => m.estado === 'EN_TRANSITO').length}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: '8px' }}>
                                    En Curso
                                </div>
                            </div>
                        </div>

                        <div className="section">
                            <h3>Acciones</h3>
                            <div className="actions-grid">
                                {role === 'TRANSPORTISTA' && (
                                    <>
                                        <button className="action-card primary" onClick={() => setCurrentScreen('escanear')}>
                                            <QrCode size={24} />
                                            <span>Escanear QR</span>
                                        </button>
                                        <button
                                            className={`action-card ${viajeActivo ? 'active' : ''}`}
                                            onClick={viajeActivo ? () => setCurrentScreen('viaje') : handleIniciarViaje}
                                        >
                                            {viajeActivo ? <Pause size={24} /> : <Play size={24} />}
                                            <span>{viajeActivo ? 'Ver Viaje' : 'Iniciar Viaje'}</span>
                                        </button>
                                    </>
                                )}
                                {role === 'OPERADOR' && (
                                    <>
                                        <button className="action-card primary" onClick={() => setCurrentScreen('escanear')}>
                                            <Camera size={24} />
                                            <span>Recepción</span>
                                        </button>
                                        <button className="action-card" onClick={() => setCurrentScreen('manifiestos')}>
                                            <Scale size={24} />
                                            <span>Pesaje</span>
                                        </button>
                                    </>
                                )}
                                {role === 'GENERADOR' && (
                                    <>
                                        <button className="action-card primary" onClick={() => setCurrentScreen('nuevo')}>
                                            <Plus size={24} />
                                            <span>Nuevo</span>
                                        </button>
                                        <button className="action-card" onClick={() => setCurrentScreen('manifiestos')}>
                                            <FileText size={24} />
                                            <span>Historial</span>
                                        </button>
                                    </>
                                )}
                                {role === 'ADMIN' && (
                                    <>
                                        <button className="action-card primary" onClick={() => setCurrentScreen('tracking')}>
                                            <BarChart3 size={24} />
                                            <span>Reportes</span>
                                        </button>
                                        <button className="action-card" onClick={() => setCurrentScreen('actores')}>
                                            <Users size={24} />
                                            <span>Actores</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="section">
                            <h3>Recientes</h3>
                            <div className="list">
                                {manifiestos.slice(0, 3).map((m) => (
                                    <div key={m.id} className="list-item" onClick={() => {
                                        setSelectedManifiesto(m);
                                        setCurrentScreen('detalle');
                                    }}>
                                        <div className="item-main">
                                            <span className="item-id">#{m.numero.split('-')[1]}</span>
                                            {getEstadoBadge(m.estado)}
                                        </div>
                                        <div className="item-sub">{m.residuo}</div>
                                        <div className="item-meta">
                                            <span>{m.generador}</span>
                                            <span>{m.fecha}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                );

            case 'viaje':
                return (
                    <div className="viaje-screen">
                        <div className="viaje-header">
                            <div className={`viaje-status-big ${viajeActivo ? 'active' : ''}`}>
                                {viajeActivo ? (
                                    <>
                                        <div className="pulse-ring"></div>
                                        <Navigation size={32} />
                                    </>
                                ) : (
                                    <CheckCircle size={32} />
                                )}
                            </div>
                            <h2>{viajeActivo ? 'Viaje en Curso' : 'Sin Viaje Activo'}</h2>
                            <div className="viaje-timer-big">{formatTime(tiempoViaje)}</div>
                        </div>

                        {viajeActivo && (
                            <>
                                <div className="viaje-map-placeholder">
                                    <MapPinned size={40} />
                                    <span>GPS Activo</span>
                                    <small>Lat: -32.8895, Lng: -68.8458</small>
                                </div>

                                <div className="viaje-info-cards">
                                    <div className="info-card">
                                        <MapPin size={18} />
                                        <div>
                                            <label>Origen</label>
                                            <span>Química Industrial</span>
                                        </div>
                                    </div>
                                    <div className="info-card">
                                        <Building2 size={18} />
                                        <div>
                                            <label>Destino</label>
                                            <span>Centro Tratamiento Cuyo</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="viaje-actions">
                                    <button className="btn-warning full">
                                        <AlertTriangle size={18} />
                                        Registrar Incidente
                                    </button>
                                    <button className="btn-secondary full">
                                        <Clock size={18} />
                                        Registrar Parada
                                    </button>
                                    <button className="btn-primary full" onClick={handleFinalizarViaje}>
                                        <CheckCircle size={18} />
                                        Confirmar Entrega
                                    </button>
                                </div>
                            </>
                        )}

                        {!viajeActivo && (
                            <button className="btn-primary full" onClick={handleIniciarViaje}>
                                <Play size={18} />
                                Iniciar Nuevo Viaje
                            </button>
                        )}
                    </div>
                );

            case 'actores':
                return (
                    <>
                        <div className="search-box">
                            <Search size={16} />
                            <input placeholder="Buscar actor..." />
                        </div>

                        <div className="filter-tabs">
                            <button className="filter-tab active">Todos</button>
                            <button className="filter-tab">Generadores</button>
                            <button className="filter-tab">Transportistas</button>
                            <button className="filter-tab">Operadores</button>
                        </div>

                        <div className="list">
                            {actores.map((actor) => (
                                <div key={actor.id} className="list-item actor-item">
                                    <div className="actor-icon" style={{
                                        background: actor.tipo === 'GENERADOR' ? '#8b5cf6' :
                                            actor.tipo === 'TRANSPORTISTA' ? '#f59e0b' : '#10b981'
                                    }}>
                                        {getActorIcon(actor.tipo)}
                                    </div>
                                    <div className="actor-info">
                                        <span className="actor-name">{actor.nombre}</span>
                                        <span className="actor-cuit">{actor.cuit}</span>
                                        {actor.vehiculos && <span className="actor-detail">{actor.vehiculos} vehículos</span>}
                                    </div>
                                    <span className={`status-dot ${actor.estado.toLowerCase()}`}></span>
                                </div>
                            ))}
                        </div>
                    </>
                );

            case 'manifiestos':
                return (
                    <>
                        <div className="search-box">
                            <Search size={16} />
                            <input placeholder="Buscar..." />
                        </div>
                        <div className="list">
                            {manifiestos.map((m) => (
                                <div key={m.id} className="list-item" onClick={() => {
                                    setSelectedManifiesto(m);
                                    setCurrentScreen('detalle');
                                }}>
                                    <div className="item-main">
                                        <span className="item-id">#{m.numero.split('-')[1]}</span>
                                        {getEstadoBadge(m.estado)}
                                    </div>
                                    <div className="item-sub">{m.residuo}</div>
                                    <div className="item-meta">
                                        <span>{m.cantidad}</span>
                                        <span>{m.fecha}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                );

            case 'escanear':
                return (
                    <div className="center-content">
                        <div className="qr-scanner-box">
                            <div className="qr-corners">
                                <span className="qr-corner top-left"></span>
                                <span className="qr-corner top-right"></span>
                                <span className="qr-corner bottom-left"></span>
                                <span className="qr-corner bottom-right"></span>
                            </div>
                            <div className="qr-scan-area">
                                <QrCode size={70} strokeWidth={1.5} color="#64748b" />
                            </div>
                            <div className="qr-laser"></div>
                        </div>
                        <p className="hint-text">Escanea el código QR del manifiesto</p>
                        <button className="btn-primary">
                            <Camera size={18} />
                            Activar Cámara
                        </button>
                        <button className="btn-secondary">
                            Ingresar Manual
                        </button>
                    </div>
                );

            case 'tracking':
                return (
                    <>
                        <div className="mini-map-container">
                            <iframe
                                title="Mapa de Monitoreo"
                                src="https://www.openstreetmap.org/export/embed.html?bbox=-68.9500%2C-33.0000%2C-68.7500%2C-32.8000&amp;layer=mapnik&amp;marker=-32.8895%2C-68.8458"
                                className="mini-map-iframe"
                            />
                            <div className="map-overlay">
                                <span className="map-label"><MapPin size={14} /> 2 vehículos en ruta</span>
                            </div>
                        </div>
                        <div className="section">
                            <h3>En Tránsito</h3>
                            <div className="list">
                                {manifiestos.filter(m => m.estado === 'EN_TRANSITO').map((m) => (
                                    <div key={m.id} className="list-item">
                                        <div className="item-main">
                                            <span className="item-id">#{m.numero.split('-')[1]}</span>
                                            <span className="eta">ETA: {m.eta}</span>
                                        </div>
                                        <div className="route">
                                            <span className="from">{m.generador}</span>
                                            <Navigation size={14} />
                                            <span className="to">{m.operador}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                );

            case 'alertas':
                return (
                    <div className="list">
                        {alertas.map((a) => (
                            <div key={a.id} className={`alert-item ${a.tipo}`}>
                                <div className="alert-icon">
                                    {a.tipo === 'warning' && <AlertTriangle size={18} />}
                                    {a.tipo === 'info' && <Bell size={18} />}
                                    {a.tipo === 'success' && <CheckCircle size={18} />}
                                </div>
                                <div className="alert-body">
                                    <p>{a.mensaje}</p>
                                    <span>{a.tiempo}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                );

            case 'nuevo':
                return (
                    <div className="form-container">
                        <div className="form-field">
                            <label>Tipo de Residuo</label>
                            <select>
                                <option>Y1 - Desechos clínicos</option>
                                <option>Y3 - Medicamentos</option>
                                <option>Y8 - Aceites</option>
                            </select>
                        </div>
                        <div className="form-field">
                            <label>Cantidad</label>
                            <div className="input-row">
                                <input type="number" placeholder="0" />
                                <select style={{ width: '80px' }}>
                                    <option>kg</option>
                                    <option>L</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-field">
                            <label>Transportista</label>
                            <select>
                                <option>Transportes Los Andes</option>
                            </select>
                        </div>
                        <div className="form-field">
                            <label>Operador</label>
                            <select>
                                <option>Centro Tratamiento Cuyo</option>
                            </select>
                        </div>
                        <button className="btn-primary full">
                            <CheckCircle size={18} />
                            Crear Manifiesto
                        </button>
                    </div>
                );

            case 'perfil':
                return (
                    <div className="profile-content">
                        <div className="profile-card">
                            <div className="avatar-large">
                                <User size={32} />
                            </div>
                            <h3>Usuario Demo</h3>
                            <p>{getRoleName()}</p>
                        </div>

                        <div className="menu-options">
                            <button className="menu-option">
                                <User size={18} />
                                <span>Mi Perfil</span>
                                <ChevronRight size={16} />
                            </button>
                            <button className="menu-option">
                                <Bell size={18} />
                                <span>Notificaciones</span>
                                <ChevronRight size={16} />
                            </button>
                            <button className="menu-option">
                                <Eye size={18} />
                                <span>Auditoría</span>
                                <ChevronRight size={16} />
                            </button>
                            <button className="menu-option" onClick={handleChangeRole}>
                                <LogOut size={18} />
                                <span>Cambiar Rol</span>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                );

            case 'detalle':
                if (!selectedManifiesto) return null;
                return (
                    <div className="detail-content">
                        <div className="detail-header-card">
                            <span className="detail-num">#{selectedManifiesto.numero.split('-')[1]}</span>
                            {getEstadoBadge(selectedManifiesto.estado)}
                        </div>

                        <div className="detail-info">
                            <div className="info-block">
                                <label>Residuo</label>
                                <p>{selectedManifiesto.residuo}</p>
                                <strong>{selectedManifiesto.cantidad}</strong>
                            </div>
                            <div className="info-block">
                                <label>Origen</label>
                                <p>{selectedManifiesto.generador}</p>
                            </div>
                            <div className="info-block">
                                <label>Destino</label>
                                <p>{selectedManifiesto.operador}</p>
                            </div>
                        </div>

                        <div className="detail-actions">
                            {role === 'TRANSPORTISTA' && selectedManifiesto.estado === 'APROBADO' && (
                                <button className="btn-primary full" onClick={handleIniciarViaje}>
                                    <Truck size={18} />
                                    Iniciar Retiro
                                </button>
                            )}
                            {role === 'TRANSPORTISTA' && selectedManifiesto.estado === 'EN_TRANSITO' && (
                                <>
                                    <button className="btn-primary full" onClick={handleFinalizarViaje}>
                                        <CheckCircle size={18} />
                                        Confirmar Entrega
                                    </button>
                                    <button className="btn-warning full">
                                        <AlertTriangle size={18} />
                                        Incidente
                                    </button>
                                </>
                            )}
                            {role === 'OPERADOR' && selectedManifiesto.estado === 'EN_TRANSITO' && (
                                <button className="btn-primary full">
                                    <Package size={18} />
                                    Confirmar Recepción
                                </button>
                            )}
                            <button className="btn-secondary full">
                                <Download size={18} />
                                Descargar PDF
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="app-container">
            {/* Toast Notification */}
            {showToast && (
                <div className="toast-notification">
                    {toastMessage}
                </div>
            )}

            {/* Header */}
            <header className="app-header" style={{ background: getRoleColor() }}>
                <button className="header-btn" onClick={() => currentScreen === 'detalle' || currentScreen === 'viaje' || currentScreen === 'actores' ? setCurrentScreen('home') : setMenuOpen(!menuOpen)}>
                    {currentScreen === 'detalle' || currentScreen === 'viaje' || currentScreen === 'actores' ? <ChevronLeft size={20} /> : <Menu size={20} />}
                </button>
                <span className="header-title">
                    {currentScreen === 'viaje' ? 'Viaje Activo' :
                        currentScreen === 'actores' ? 'Actores' :
                            menuItems.find(m => m.id === currentScreen)?.label || 'Detalle'}
                </span>
                <div className="header-right">
                    <div className={`conn-indicator ${isOnline ? 'online' : 'offline'}`}>
                        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    </div>
                    <button className="header-btn" onClick={handleChangeRole} title="Cambiar Rol">
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* Side Menu Overlay */}
            {menuOpen && (
                <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
                    <div className="side-menu" onClick={(e) => e.stopPropagation()}>
                        <div className="menu-user" style={{ background: getRoleColor() }}>
                            <div className="menu-avatar"><User size={24} /></div>
                            <span className="menu-name">Usuario Demo</span>
                            <span className="menu-role">{getRoleName()}</span>
                        </div>
                        <div className="menu-nav">
                            {menuItems.map((item) => (
                                <button
                                    key={item.id}
                                    className={`menu-link ${currentScreen === item.id ? 'active' : ''}`}
                                    onClick={() => { setCurrentScreen(item.id); setMenuOpen(false); }}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            ))}
                            {role === 'ADMIN' && (
                                <button
                                    className={`menu-link ${currentScreen === 'actores' ? 'active' : ''}`}
                                    onClick={() => { setCurrentScreen('actores'); setMenuOpen(false); }}
                                >
                                    <Users size={20} />
                                    <span>Actores</span>
                                </button>
                            )}
                            <div className="menu-sep" />
                            <button className="menu-link logout" onClick={handleChangeRole}>
                                <LogOut size={20} />
                                <span>Cambiar Rol</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="app-content">
                {renderContent()}
            </main>

            {/* Bottom Navigation */}
            <nav className="app-nav">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        className={`nav-btn ${currentScreen === item.id ? 'active' : ''}`}
                        onClick={() => {
                            const previousScreen = currentScreen;
                            setCurrentScreen(item.id);
                            analyticsService.trackNavigation(item.id, previousScreen, role || undefined);
                            analyticsService.trackPageView(item.id, role || undefined);
                        }}
                        style={currentScreen === item.id ? { color: getRoleColor() } : {}}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default MobileApp;
