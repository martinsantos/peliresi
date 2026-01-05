/**
 * MobileApp - Refactored Version
 * 
 * Original: 1781 lines
 * Refactored: ~450 lines (75% reduction)
 * 
 * Components extracted to:
 * - components/mobile/RoleSelector.tsx
 * - components/mobile/TripTracker.tsx
 * - components/mobile/TripModals.tsx
 * - components/mobile/QRScannerView.tsx
 * 
 * Logic extracted to:
 * - hooks/useTripTracking.ts
 * - hooks/useQRScanner.ts
 * 
 * Data extracted to:
 * - data/demoMobile.ts
 * - types/mobile.types.ts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Home, FileText, MapPin, Bell, Settings, User, Menu,
    Package, QrCode,
    Navigation, Wifi, WifiOff,
    BarChart3, Users,
    ChevronRight, ChevronLeft, Plus, Search, LogOut,
    Play, RefreshCw
} from 'lucide-react';

// Hooks
import { useConnectivity } from '../hooks/useConnectivity';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTripTracking } from '../hooks/useTripTracking';
import { useQRScanner } from '../hooks/useQRScanner';

// Services
import { analyticsService } from '../services/analytics.service';

// Components
import RoleSelector from '../components/mobile/RoleSelector';
import TripTracker from '../components/mobile/TripTracker';
import QRScannerView from '../components/mobile/QRScannerView';
import { IncidentModal, ParadaModal } from '../components/mobile/TripModals';

// Types and Data
import type { UserRole, Screen, MenuItem } from '../types/mobile.types';
import { ROLE_COLORS, ROLE_NAMES, ESTADO_CONFIG } from '../types/mobile.types';
import { DEMO_MANIFIESTOS, DEMO_ALERTAS } from '../data/demoMobile';

import './MobileApp.css';

// Expose analytics globally for debugging
if (typeof window !== 'undefined') {
    (window as any).analyticsService = analyticsService;
}

const MobileApp: React.FC = () => {
    // ========== ROLE MANAGEMENT ==========
    const getSavedRole = (): UserRole | null => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sitrep_mobile_role');
            if (saved && ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(saved)) {
                return saved as UserRole;
            }
        }
        return null;
    };

    const [role, setRole] = useState<UserRole | null>(getSavedRole);
    const [currentScreen, setCurrentScreen] = useState<Screen>('home');
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectedManifiesto, setSelectedManifiesto] = useState<any>(null);
    
    // Toast state
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    
    // Modal state
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [showParadaModal, setShowParadaModal] = useState(false);
    const [incidentText, setIncidentText] = useState('');
    const [paradaText, setParadaText] = useState('');

    // ========== HOOKS ==========
    const { isOnline, syncPending } = useConnectivity();
    const { promptInstall, canInstall, isIOS } = usePWAInstall();
    
    const showToastMessage = useCallback((message: string) => {
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, []);
    
    const trip = useTripTracking({ 
        role: role || undefined, 
        onToast: showToastMessage 
    });
    
    const qr = useQRScanner({ 
        onToast: showToastMessage 
    });

    // Save role to localStorage
    useEffect(() => {
        if (role) {
            localStorage.setItem('sitrep_mobile_role', role);
        }
    }, [role]);

    // ========== HANDLERS ==========
    const handleChangeRole = useCallback(() => {
        localStorage.removeItem('sitrep_mobile_role');
        qr.stopCamera();
        setRole(null);
        setCurrentScreen('home');
        setMenuOpen(false);
    }, [qr]);

    const handleSelectManifiesto = useCallback((m: any) => {
        setSelectedManifiesto(m);
        setCurrentScreen('detalle');
    }, []);

    const handleConfirmIncident = useCallback(() => {
        if (!incidentText.trim()) {
            showToastMessage('⚠️ Describa el incidente');
            return;
        }
        trip.registrarIncidente(incidentText);
        setShowIncidentModal(false);
        setIncidentText('');
    }, [incidentText, trip, showToastMessage]);

    const handleConfirmParada = useCallback(() => {
        trip.registrarParada(paradaText);
        setShowParadaModal(false);
        setParadaText('');
    }, [paradaText, trip]);

    const handleIniciarViaje = useCallback(() => {
        trip.iniciarViaje();
        setCurrentScreen('viaje');
    }, [trip]);

    // ========== MENU CONFIGURATION ==========
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

    const getRoleColor = (): string => role ? ROLE_COLORS[role] : '#64748b';
    const getRoleName = (): string => role ? ROLE_NAMES[role] : 'Usuario';
    
    const getEstadoBadge = (estado: string) => {
        const s = ESTADO_CONFIG[estado] || { bg: '#334155', color: '#94a3b8', label: estado };
        return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
    };

    const menuItems = getMenuItems();

    // ========== ROLE SELECTION SCREEN ==========
    if (!role) {
        return (
            <RoleSelector
                onSelectRole={setRole}
                isOnline={isOnline}
                canInstall={canInstall}
                isIOS={isIOS}
                onInstall={promptInstall}
            />
        );
    }

    // ========== RENDER CONTENT ==========
    const renderContent = () => {
        switch (currentScreen) {
            case 'escanear':
                return (
                    <QRScannerView
                        cameraActive={qr.cameraActive}
                        scannedQR={qr.scannedQR}
                        videoRef={qr.videoRef}
                        canvasRef={qr.canvasRef}
                        onStartCamera={qr.startCamera}
                        onStopCamera={qr.stopCamera}
                        onBack={() => setCurrentScreen('home')}
                    />
                );

            case 'viaje':
                return (
                    <TripTracker
                        viajePausado={trip.viajePausado}
                        tiempoViaje={trip.tiempoViaje}
                        gpsPosition={trip.gpsPosition}
                        viajeEventos={trip.viajeEventos}
                        viajeRutaCount={trip.viajeRuta.length}
                        onFinalizar={() => { trip.finalizarViaje(); setCurrentScreen('home'); }}
                        onOpenIncidentModal={() => setShowIncidentModal(true)}
                        onOpenParadaModal={() => setShowParadaModal(true)}
                        onReanudar={trip.reanudarViaje}
                        onBack={() => setCurrentScreen('home')}
                        formatTime={trip.formatTime}
                    />
                );

            case 'home':
                return (
                    <>
                        {/* Connectivity Status */}
                        <div className={`connectivity-bar ${isOnline ? 'online' : 'offline'}`}>
                            {syncPending ? (
                                <><RefreshCw size={14} className="spinning" /><span>Sincronizando...</span></>
                            ) : (
                                <>{isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}<span>{isOnline ? 'Conectado' : 'Modo Offline'}</span></>
                            )}
                        </div>

                        {/* Active Trip Banner */}
                        {trip.viajeActivo && role === 'TRANSPORTISTA' && (
                            <div className="viaje-banner" onClick={() => setCurrentScreen('viaje')}>
                                <div className="viaje-pulse"></div>
                                <Navigation size={18} />
                                <div className="viaje-info">
                                    <span className="viaje-status">Viaje en curso</span>
                                    <span className="viaje-timer">{trip.formatTime(trip.tiempoViaje)}</span>
                                </div>
                                <ChevronRight size={18} />
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="stat-card">
                                <div className="stat-value">{DEMO_MANIFIESTOS.filter(m => m.estado === 'APROBADO').length}</div>
                                <div className="stat-label">Pendientes</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{DEMO_MANIFIESTOS.filter(m => m.estado === 'EN_TRANSITO').length}</div>
                                <div className="stat-label">En Curso</div>
                            </div>
                        </div>

                        {/* Quick Actions for Transportista */}
                        {role === 'TRANSPORTISTA' && (
                            <div className="section">
                                <h3>Acciones</h3>
                                <div className="actions-grid">
                                    <button className="action-card primary" onClick={() => setCurrentScreen('escanear')}>
                                        <QrCode size={24} />
                                        <span>Escanear QR</span>
                                    </button>
                                    <button 
                                        className={`action-card ${trip.viajeActivo ? 'active' : ''}`}
                                        onClick={trip.viajeActivo ? () => setCurrentScreen('viaje') : handleIniciarViaje}
                                    >
                                        {trip.viajeActivo ? <Navigation size={24} /> : <Play size={24} />}
                                        <span>{trip.viajeActivo ? 'Ver Viaje' : 'Iniciar Viaje'}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Recent Manifiestos */}
                        <div className="section">
                            <h3>Manifiestos Recientes</h3>
                            <div className="list">
                                {DEMO_MANIFIESTOS.slice(0, 4).map(m => (
                                    <div key={m.id} className="list-item" onClick={() => handleSelectManifiesto(m)}>
                                        <div className="list-icon"><FileText size={18} /></div>
                                        <div className="list-content">
                                            <div className="list-title">#{m.numero}</div>
                                            <div className="list-sub">{m.generador}</div>
                                        </div>
                                        {getEstadoBadge(m.estado)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                );

            case 'manifiestos':
                return (
                    <div className="section">
                        <div className="search-bar">
                            <Search size={18} />
                            <input type="text" placeholder="Buscar manifiestos..." />
                        </div>
                        <div className="list">
                            {DEMO_MANIFIESTOS.map(m => (
                                <div key={m.id} className="list-item" onClick={() => handleSelectManifiesto(m)}>
                                    <div className="list-icon"><FileText size={18} /></div>
                                    <div className="list-content">
                                        <div className="list-title">#{m.numero}</div>
                                        <div className="list-sub">{m.generador} → {m.operador}</div>
                                    </div>
                                    {getEstadoBadge(m.estado)}
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'alertas':
                return (
                    <div className="section">
                        <h3>Alertas y Notificaciones</h3>
                        <div className="list">
                            {DEMO_ALERTAS.map(a => (
                                <div key={a.id} className={`list-item alert-${a.tipo}`}>
                                    <div className="list-content">
                                        <div className="list-title">{a.mensaje}</div>
                                        <div className="list-sub">Hace {a.tiempo}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'perfil':
                return (
                    <div className="section">
                        <div className="profile-card">
                            <div className="profile-avatar"><User size={32} /></div>
                            <h3>Usuario Demo</h3>
                            <p>{getRoleName()}</p>
                        </div>
                        <div className="settings-list">
                            <button className="settings-item"><BarChart3 size={18} /><span>Estadísticas</span></button>
                            <button className="settings-item"><Settings size={18} /><span>Configuración</span></button>
                            <button className="settings-item logout" onClick={handleChangeRole}>
                                <LogOut size={18} /><span>Cambiar Rol</span>
                            </button>
                        </div>
                    </div>
                );

            case 'detalle':
                if (!selectedManifiesto) return null;
                return (
                    <div className="section">
                        <h3>Manifiesto #{selectedManifiesto.numero}</h3>
                        <div className="detail-card">
                            <div className="detail-row"><label>Estado:</label>{getEstadoBadge(selectedManifiesto.estado)}</div>
                            <div className="detail-row"><label>Residuo:</label><span>{selectedManifiesto.residuo}</span></div>
                            <div className="detail-row"><label>Cantidad:</label><span>{selectedManifiesto.cantidad}</span></div>
                            <div className="detail-row"><label>Generador:</label><span>{selectedManifiesto.generador}</span></div>
                            <div className="detail-row"><label>Operador:</label><span>{selectedManifiesto.operador}</span></div>
                        </div>
                    </div>
                );

            default:
                return <div className="section"><p>Pantalla: {currentScreen}</p></div>;
        }
    };

    // ========== MAIN RENDER ==========
    return (
        <div className="app-container">
            {/* Toast */}
            {showToast && <div className="toast">{toastMessage}</div>}

            {/* Modals */}
            <IncidentModal
                isOpen={showIncidentModal}
                text={incidentText}
                onTextChange={setIncidentText}
                onConfirm={handleConfirmIncident}
                onClose={() => setShowIncidentModal(false)}
            />
            <ParadaModal
                isOpen={showParadaModal}
                text={paradaText}
                onTextChange={setParadaText}
                onConfirm={handleConfirmParada}
                onClose={() => setShowParadaModal(false)}
            />

            {/* Header */}
            <header className="app-header" style={{ background: getRoleColor() }}>
                <button className="header-btn" onClick={() => 
                    ['detalle', 'viaje', 'actores'].includes(currentScreen) 
                        ? setCurrentScreen('home') 
                        : setMenuOpen(!menuOpen)
                }>
                    {['detalle', 'viaje', 'actores'].includes(currentScreen) ? <ChevronLeft size={20} /> : <Menu size={20} />}
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

            {/* Side Menu */}
            {menuOpen && (
                <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
                    <div className="side-menu" onClick={e => e.stopPropagation()}>
                        <div className="menu-user" style={{ background: getRoleColor() }}>
                            <div className="menu-avatar"><User size={24} /></div>
                            <span className="menu-name">Usuario Demo</span>
                            <span className="menu-role">{getRoleName()}</span>
                        </div>
                        <div className="menu-nav">
                            {menuItems.map(item => (
                                <button
                                    key={item.id}
                                    className={`menu-link ${currentScreen === item.id ? 'active' : ''}`}
                                    onClick={() => { setCurrentScreen(item.id); setMenuOpen(false); }}
                                >
                                    {item.icon}<span>{item.label}</span>
                                </button>
                            ))}
                            {role === 'ADMIN' && (
                                <button className="menu-link" onClick={() => { setCurrentScreen('actores'); setMenuOpen(false); }}>
                                    <Users size={20} /><span>Actores</span>
                                </button>
                            )}
                            <div className="menu-sep" />
                            <button className="menu-link logout" onClick={handleChangeRole}>
                                <LogOut size={20} /><span>Cambiar Rol</span>
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
                {menuItems.map(item => (
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
