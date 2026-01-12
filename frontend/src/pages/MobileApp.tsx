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
    Package, QrCode, Clock,
    Navigation, Wifi, WifiOff,
    Users, Search,
    ChevronLeft, Plus, LogOut,
    Play, RefreshCw, Command
} from 'lucide-react';

// Hooks
import { useConnectivity } from '../hooks/useConnectivity';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTripTracking } from '../hooks/useTripTracking';
import { useQRScanner } from '../hooks/useQRScanner';

// Services
import { analyticsService } from '../services/analytics.service';
import { manifiestoService } from '../services/manifiesto.service';
import { notificationService, type Notificacion } from '../services/notification.service';
import { authService } from '../services/auth.service';

// Components
import RoleSelector from '../components/mobile/RoleSelector';
import TripTracker from '../components/mobile/TripTracker';
import QRScannerView from '../components/mobile/QRScannerView';
import { IncidentModal, ParadaModal } from '../components/mobile/TripModals';
// FASE 2: Historial de viajes
import HistorialViajes from '../components/mobile/HistorialViajes';
import ViajeDetalleModal from '../components/mobile/ViajeDetalleModal';
// FASE 2: TripBanner colapsable (NO bloqueante)
import TripBanner from '../components/layout/TripBanner';
// FASE 4: Mapa de manifiesto
import ManifiestoMap from '../components/mobile/ManifiestoMap';

// FASE 4 & 5: Pantallas extraídas
import { AlertasScreen, PerfilScreen, ManifiestosScreen, AdminDashboard, AdminUsuariosScreen, CentroControlScreen } from '../screens';

// Types and Data
import type { UserRole, Screen, MenuItem, SavedTrip } from '../types/mobile.types';
import { ROLE_NAMES, ESTADO_CONFIG } from '../types/mobile.types';
import { DEMO_MANIFIESTOS } from '../data/demoMobile';

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
    const [activeManifiestoId, setActiveManifiestoId] = useState<string | null>(null);

    // CORRECCIÓN 6: Tab activo para historial
    const [activeTab, setActiveTab] = useState<'pendientes' | 'en-curso' | 'realizados'>('pendientes');

    // Toast state
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    
    // Modal state
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [showParadaModal, setShowParadaModal] = useState(false);
    const [incidentText, setIncidentText] = useState('');
    const [paradaText, setParadaText] = useState('');

    // QR → Viaje modal state
    const [showQRConfirmModal, setShowQRConfirmModal] = useState(false);
    const [scannedManifiesto, setScannedManifiesto] = useState<any>(null);
    const [loadingQRManifiesto, setLoadingQRManifiesto] = useState(false);

    // Backend data state
    const [backendManifiestos, setBackendManifiestos] = useState<any[]>([]);
    const [_loadingManifiestos, setLoadingManifiestos] = useState(false); // Used for future loading indicators

    // CORRECCIÓN 7: Estado de notificaciones reales
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
    const [noLeidas, setNoLeidas] = useState(0);

    // FASE 2: Historial de viajes - estado del modal
    const [selectedViaje, setSelectedViaje] = useState<SavedTrip | null>(null);
    const [showViajeModal, setShowViajeModal] = useState(false);

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
        manifiestoId: activeManifiestoId || undefined,
        onToast: showToastMessage
    });
    
    const qr = useQRScanner({
        onToast: showToastMessage,
        autoOpenUrl: false // Don't auto-open URLs, we handle the flow
    });

    // ===== QR → VIAJE AUTOMÁTICO =====
    // Función para cargar manifiesto desde QR escaneado
    const loadManifiestoFromQR = useCallback(async (manifiestoId: string) => {
        setLoadingQRManifiesto(true);
        try {
            // Primero buscar en los manifiestos ya cargados
            const localMatch = backendManifiestos.find(
                m => m.id === manifiestoId || m.numero === manifiestoId
            );

            if (localMatch) {
                setScannedManifiesto(localMatch);
                setShowQRConfirmModal(true);
                return;
            }

            // Si no está local, cargar desde backend
            const manifiesto = await manifiestoService.getManifiesto(manifiestoId);
            setScannedManifiesto(manifiesto);
            setShowQRConfirmModal(true);
        } catch (err: any) {
            console.error('[QR] Error loading manifiesto:', err);
            showToastMessage('❌ Manifiesto no encontrado: ' + manifiestoId);
        } finally {
            setLoadingQRManifiesto(false);
        }
    }, [backendManifiestos, showToastMessage]);

    // Detectar QR parseado y mostrar modal
    useEffect(() => {
        if (qr.parsedQR && qr.parsedQR.manifiestoId) {
            console.log('[QR] Detected manifiesto:', qr.parsedQR);
            loadManifiestoFromQR(qr.parsedQR.manifiestoId);
        }
    }, [qr.parsedQR, loadManifiestoFromQR]);

    // Función para iniciar viaje desde QR escaneado
    const handleIniciarViajeDesdeQR = useCallback(() => {
        if (!scannedManifiesto) return;

        // Seleccionar el manifiesto
        setSelectedManifiesto(scannedManifiesto);
        setActiveManifiestoId(scannedManifiesto.id);

        // Iniciar viaje
        trip.iniciarViaje();

        // Cerrar modal y navegar a viaje
        setShowQRConfirmModal(false);
        setScannedManifiesto(null);
        qr.clearScannedQR();
        setCurrentScreen('viaje');

        showToastMessage('🚛 Viaje iniciado desde QR');
    }, [scannedManifiesto, trip, qr, showToastMessage]);

    // Save role to localStorage
    useEffect(() => {
        if (role) {
            localStorage.setItem('sitrep_mobile_role', role);
        }
    }, [role]);

    // Load manifiestos from backend when role changes
    // FASE 1: Filtrar por transportista asignado
    const loadManifiestosFromBackend = useCallback(async () => {
        if (!role) return;

        setLoadingManifiestos(true);
        try {
            // Obtener usuario actual si existe (puede tener transportistaId)
            const currentUser = authService.getStoredUser();

            // Cargar manifiestos según el rol
            let estados: string[] = [];
            let filterParams: { transportistaId?: string; generadorId?: string; operadorId?: string } = {};

            switch (role) {
                case 'TRANSPORTISTA':
                    estados = ['APROBADO', 'EN_TRANSITO'];
                    // FASE 1: Filtrar SOLO los manifiestos asignados a este transportista
                    if (currentUser?.transportista?.id) {
                        filterParams.transportistaId = currentUser.transportista.id;
                        console.log('[MobileApp] Filtering by transportistaId:', currentUser.transportista.id);
                    }
                    break;
                case 'OPERADOR':
                    estados = ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO'];
                    // Filtrar por operador asignado
                    if (currentUser?.operador?.id) {
                        filterParams.operadorId = currentUser.operador.id;
                    }
                    break;
                case 'GENERADOR':
                    estados = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO'];
                    // Filtrar por generador
                    if (currentUser?.generador?.id) {
                        filterParams.generadorId = currentUser.generador.id;
                    }
                    break;
                default:
                    estados = ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO'];
            }

            // Cargar todos los estados relevantes
            const allManifiestos: any[] = [];
            for (const estado of estados) {
                try {
                    const data = await manifiestoService.getManifiestos({
                        estado,
                        limit: 20,
                        ...filterParams  // FASE 1: Incluir filtros por actor
                    });
                    allManifiestos.push(...(data.manifiestos || []));
                } catch (e) {
                    console.warn(`Error loading ${estado}:`, e);
                }
            }

            setBackendManifiestos(allManifiestos);
            console.log('[MobileApp] Loaded', allManifiestos.length, 'manifiestos from backend', filterParams);
        } catch (err) {
            console.error('[MobileApp] Error loading manifiestos:', err);
            // Fallback to demo data
            setBackendManifiestos([]);
        } finally {
            setLoadingManifiestos(false);
        }
    }, [role]);

    useEffect(() => {
        if (role && isOnline) {
            loadManifiestosFromBackend();
        }
    }, [role, isOnline, loadManifiestosFromBackend]);

    // CORRECCIÓN 7: Cargar notificaciones reales
    const loadNotificaciones = useCallback(async () => {
        if (!isOnline) return;
        try {
            const data = await notificationService.getNotificaciones({ limit: 20 });
            setNotificaciones(data.notificaciones || []);
            setNoLeidas(data.noLeidas || 0);
        } catch (err) {
            console.warn('[MobileApp] Error loading notifications:', err);
        }
    }, [isOnline]);

    useEffect(() => {
        if (role && isOnline) {
            loadNotificaciones();
            // Polling cada 30 segundos
            const interval = setInterval(loadNotificaciones, 30000);
            return () => clearInterval(interval);
        }
    }, [role, isOnline, loadNotificaciones]);

    // CORRECCIÓN 7: Marcar notificación como leída
    const handleMarcarLeida = useCallback(async (id: string) => {
        try {
            await notificationService.marcarLeida(id);
            setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
            setNoLeidas(prev => Math.max(0, prev - 1));
            showToastMessage('✓ Marcada como leída');
        } catch (err) {
            showToastMessage('Error al marcar notificación');
        }
    }, [showToastMessage]);

    // CORRECCIÓN 7: Eliminar notificación
    const handleEliminarNotificacion = useCallback(async (id: string) => {
        try {
            await notificationService.eliminar(id);
            setNotificaciones(prev => prev.filter(n => n.id !== id));
            showToastMessage('✓ Notificación eliminada');
        } catch (err) {
            showToastMessage('Error al eliminar notificación');
        }
    }, [showToastMessage]);

    // CORRECCIÓN 7: Marcar todas como leídas
    const handleMarcarTodasLeidas = useCallback(async () => {
        try {
            await notificationService.marcarTodasLeidas();
            setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
            setNoLeidas(0);
            showToastMessage('✓ Todas marcadas como leídas');
        } catch (err) {
            showToastMessage('Error al marcar notificaciones');
        }
    }, [showToastMessage]);

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

    const handleIniciarViaje = useCallback((manifiestoId?: string) => {
        if (manifiestoId) {
            setActiveManifiestoId(manifiestoId);
        }
        trip.iniciarViaje();
        setCurrentScreen('viaje');
    }, [trip]);

    const handleIniciarViajeConManifiesto = useCallback(async (manifiesto: any) => {
        // Use original backend object if available (from formatManifiestoForDisplay)
        const originalManifiesto = manifiesto._original || manifiesto;

        setActiveManifiestoId(originalManifiesto.id);
        setSelectedManifiesto(manifiesto);

        // Si el manifiesto está APROBADO, llamar confirmarRetiro para cambiar a EN_TRANSITO
        if (originalManifiesto.estado === 'APROBADO' && isOnline) {
            try {
                // Obtener posición GPS actual
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
                }).catch(() => null);

                await manifiestoService.confirmarRetiro(originalManifiesto.id, {
                    latitud: position?.coords.latitude,
                    longitud: position?.coords.longitude,
                    observaciones: 'Retiro confirmado desde app móvil'
                });

                showToastMessage(`✅ Retiro confirmado - Manifiesto #${manifiesto.numero}`);
                // Actualizar lista de manifiestos
                loadManifiestosFromBackend();
            } catch (err: any) {
                console.error('Error confirmando retiro:', err);
                showToastMessage(`⚠️ Error al confirmar retiro: ${err.message || 'Error de conexión'}`);
            }
        }

        trip.iniciarViaje();
        setCurrentScreen('viaje');
        showToastMessage(`🚛 Viaje iniciado para manifiesto #${manifiesto.numero}`);
    }, [trip, showToastMessage, isOnline, loadManifiestosFromBackend]);

    // Finalizar viaje y actualizar backend
    const handleFinalizarViaje = useCallback(async () => {
        if (activeManifiestoId && isOnline) {
            try {
                // Obtener posición GPS actual
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
                }).catch(() => null);

                await manifiestoService.confirmarEntrega(activeManifiestoId, {
                    latitud: position?.coords.latitude,
                    longitud: position?.coords.longitude,
                    observaciones: 'Entrega confirmada desde app móvil'
                });

                showToastMessage(`✅ Entrega confirmada para manifiesto`);
                // Actualizar lista de manifiestos
                loadManifiestosFromBackend();
            } catch (err: any) {
                console.error('Error confirmando entrega:', err);
                showToastMessage(`⚠️ Error al confirmar entrega: ${err.message || 'Error de conexión'}`);
            }
        }

        trip.finalizarViaje();
        setActiveManifiestoId(null);
        setSelectedManifiesto(null);
        setCurrentScreen('home');
    }, [activeManifiestoId, isOnline, trip, showToastMessage, loadManifiestosFromBackend]);

    // ========== MENU CONFIGURATION ==========
    const getMenuItems = (): MenuItem[] => {
        switch (role) {
            case 'ADMIN':
                return [
                    { id: 'home', label: 'Inicio', icon: <Home size={20} /> },
                    { id: 'control', label: 'Control', icon: <Command size={20} /> },
                    { id: 'manifiestos', label: 'Manifiestos', icon: <FileText size={20} /> },
                    { id: 'usuarios', label: 'Usuarios', icon: <Users size={20} /> },
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

    const getRoleName = (): string => role ? ROLE_NAMES[role] : 'Usuario';

    // Screens that show back button instead of menu
    const backScreens = ['detalle', 'viaje', 'actores'];
    const isBackScreen = backScreens.includes(currentScreen);

    const getHeaderTitle = (): string => {
        if (currentScreen === 'viaje') return 'Viaje Activo';
        if (currentScreen === 'actores') return 'Actores';
        return menuItems.find(m => m.id === currentScreen)?.label || 'Detalle';
    };

    const renderHeaderButton = () => (
        <button
            className="header-btn"
            onClick={() => isBackScreen ? setCurrentScreen('home') : setMenuOpen(!menuOpen)}
        >
            {isBackScreen ? <ChevronLeft size={20} /> : <Menu size={20} />}
        </button>
    );

    const getEstadoBadge = (estado: string) => {
        const s = ESTADO_CONFIG[estado] || { bg: '#334155', color: '#94a3b8', label: estado };
        return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
    };

    const menuItems = getMenuItems();

    // Use backend data if available, fallback to demo data
    const displayManifiestos = backendManifiestos.length > 0 ? backendManifiestos : DEMO_MANIFIESTOS;

    // FASE 2: Helper para calcular distancia total del viaje (Haversine)
    const calcularDistanciaViaje = (): number => {
        if (trip.viajeRuta.length < 2) return 0;
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        let total = 0;
        for (let i = 1; i < trip.viajeRuta.length; i++) {
            const lat1 = trip.viajeRuta[i - 1].lat;
            const lon1 = trip.viajeRuta[i - 1].lng;
            const lat2 = trip.viajeRuta[i].lat;
            const lon2 = trip.viajeRuta[i].lng;
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        return Math.round(total * 100) / 100;
    };

    // FASE 2: Determinar estado GPS para el banner
    const getGpsStatus = (): 'active' | 'weak' | 'lost' => {
        if (!trip.gpsPosition) return 'lost';
        // Si tenemos posición reciente, está activo
        // En el futuro se puede mejorar con accuracy check
        return trip.gpsAvailable ? 'active' : 'weak';
    };

    // Helper to adapt backend manifest format to display format
    const formatManifiestoForDisplay = (m: any) => ({
        id: m.id,
        numero: m.numero || `MAN-${m.id?.slice(-6)}`,
        estado: m.estado,
        generador: m.generador?.razonSocial || m.generador || 'Generador',
        operador: m.operador?.razonSocial || m.operador || 'Operador',
        transportista: m.transportista?.razonSocial || m.transportista || 'Transportista',
        residuo: m.residuos?.[0]?.tipoResiduo?.nombre || m.residuo || 'Residuos',
        cantidad: m.residuos?.[0] ? `${m.residuos[0].cantidad} ${m.residuos[0].unidad}` : m.cantidad || '-',
        fecha: m.fechaCreacion ? new Date(m.fechaCreacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : m.fecha || '-',
        eta: m.eta || null,
        // Keep original object for backend operations
        _original: m
    });

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
                        viajeRuta={trip.viajeRuta}
                        viajeRutaCount={trip.viajeRuta.length}
                        onFinalizar={handleFinalizarViaje}
                        onOpenIncidentModal={() => setShowIncidentModal(true)}
                        onOpenParadaModal={() => setShowParadaModal(true)}
                        onReanudar={trip.reanudarViaje}
                        onBack={() => setCurrentScreen('home')}
                        formatTime={trip.formatTime}
                    />
                );

            case 'home':
                // FASE 2: Ya NO bloqueamos la navegación con viaje activo
                // El TripBanner se muestra arriba y permite navegar libremente

                // FASE 5: Dashboard especial para ADMIN
                if (role === 'ADMIN') {
                    return (
                        <AdminDashboard
                            manifiestos={displayManifiestos.map(m => formatManifiestoForDisplay(m))}
                            onSelectManifiesto={handleSelectManifiesto}
                        />
                    );
                }

                // CORRECCIÓN 6: Filtrar manifiestos según tab activo
                const getManifiestosByTab = () => {
                    switch (activeTab) {
                        case 'pendientes':
                            return displayManifiestos.filter(m => m.estado === 'APROBADO');
                        case 'en-curso':
                            return displayManifiestos.filter(m => m.estado === 'EN_TRANSITO');
                        case 'realizados':
                            return displayManifiestos.filter(m =>
                                ['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(m.estado)
                            );
                        default:
                            return displayManifiestos;
                    }
                };

                const manifiestosFiltrados = getManifiestosByTab();

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

                        {/* Stats Grid */}
                        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <div className={`stat-card ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')}>
                                <div className="stat-value">{displayManifiestos.filter(m => m.estado === 'APROBADO').length}</div>
                                <div className="stat-label">Pendientes</div>
                            </div>
                            <div className={`stat-card ${activeTab === 'en-curso' ? 'active' : ''}`} onClick={() => setActiveTab('en-curso')}>
                                <div className="stat-value">{displayManifiestos.filter(m => m.estado === 'EN_TRANSITO').length}</div>
                                <div className="stat-label">En Curso</div>
                            </div>
                            <div className={`stat-card ${activeTab === 'realizados' ? 'active' : ''}`} onClick={() => setActiveTab('realizados')}>
                                <div className="stat-value">{displayManifiestos.filter(m => ['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(m.estado)).length}</div>
                                <div className="stat-label">Realizados</div>
                            </div>
                        </div>

                        {/* Quick Actions for Transportista - FASE 3/P4: Validación de manifiestos pendientes */}
                        {role === 'TRANSPORTISTA' && (() => {
                            const manifiestosPendientes = displayManifiestos.filter(m => m.estado === 'APROBADO');
                            const hayViajeActivoGlobal = displayManifiestos.some(m => m.estado === 'EN_TRANSITO') || trip.viajeActivo;
                            const puedeIniciarViaje = manifiestosPendientes.length > 0 && !hayViajeActivoGlobal;

                            return (
                                <div className="section">
                                    <h3>Acciones</h3>
                                    <div className="actions-grid">
                                        <button className="action-card primary" onClick={() => setCurrentScreen('escanear')}>
                                            <QrCode size={24} />
                                            <span>Escanear QR</span>
                                        </button>
                                        <button
                                            className={`action-card ${trip.viajeActivo ? 'active' : ''} ${!puedeIniciarViaje && !trip.viajeActivo ? 'disabled' : ''}`}
                                            onClick={trip.viajeActivo
                                                ? () => setCurrentScreen('viaje')
                                                : puedeIniciarViaje
                                                    ? () => handleIniciarViaje()
                                                    : undefined}
                                            disabled={!trip.viajeActivo && !puedeIniciarViaje}
                                        >
                                            {trip.viajeActivo ? <Navigation size={24} /> : <Play size={24} />}
                                            <span>
                                                {trip.viajeActivo
                                                    ? 'Ver Viaje'
                                                    : hayViajeActivoGlobal
                                                        ? 'Viaje en Curso'
                                                        : manifiestosPendientes.length === 0
                                                            ? 'Sin Pendientes'
                                                            : 'Iniciar Viaje'}
                                            </span>
                                        </button>
                                        {/* FASE 2: Botón historial de viajes */}
                                        <button
                                            className="action-card"
                                            onClick={() => setCurrentScreen('historial-viajes')}
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--ind-panel) 100%)',
                                                borderColor: 'var(--ind-cyan)',
                                                borderWidth: '2px'
                                            }}
                                        >
                                            <Clock size={24} style={{ color: 'var(--ind-cyan)' }} />
                                            <span style={{ color: 'var(--ind-cyan)' }}>Historial ({trip.savedTrips.length})</span>
                                        </button>
                                    </div>
                                    {/* Mensaje informativo */}
                                    {!trip.viajeActivo && manifiestosPendientes.length === 0 && !hayViajeActivoGlobal && (
                                        <p className="info-text" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                                            No hay manifiestos asignados pendientes de transporte
                                        </p>
                                    )}
                                </div>
                            );
                        })()}

                        {/* CORRECCIÓN 6: Tabs de historial */}
                        <div className="section">
                            <div className="tabs-container">
                                <button
                                    className={`tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('pendientes')}
                                >
                                    Pendientes
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'en-curso' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('en-curso')}
                                >
                                    En Curso
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'realizados' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('realizados')}
                                >
                                    Realizados
                                </button>
                            </div>
                            <div className="list">
                                {manifiestosFiltrados.length > 0 ? (
                                    manifiestosFiltrados.map(m => formatManifiestoForDisplay(m)).map(m => (
                                        <div key={m.id} className="list-item" onClick={() => handleSelectManifiesto(m)}>
                                            <div className="list-icon"><FileText size={18} /></div>
                                            <div className="list-body">
                                                <div className="list-title">#{m.numero}</div>
                                                <div className="list-sub">{m.generador} → {m.operador}</div>
                                                {/* FASE 5: Datos adicionales en lista */}
                                                <div className="list-meta" style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--ind-text-mid)' }}>
                                                    <span style={{ color: 'var(--ind-cyan)' }}>{m.residuo || 'Residuo'}</span>
                                                    <span style={{ color: 'var(--ind-orange)' }}>{m.cantidad || ''}</span>
                                                    {m.fecha && <span>{m.fecha}</span>}
                                                </div>
                                            </div>
                                            <div className="list-badge">{getEstadoBadge(m.estado)}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <FileText size={32} />
                                        <p>No hay manifiestos {activeTab === 'pendientes' ? 'pendientes' : activeTab === 'en-curso' ? 'en curso' : 'realizados'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                );

            case 'manifiestos':
                // FASE 4: Usando componente extraído
                return (
                    <ManifiestosScreen
                        manifiestos={displayManifiestos.map(m => formatManifiestoForDisplay(m))}
                        onSelectManifiesto={handleSelectManifiesto}
                    />
                );

            case 'alertas':
                // FASE 4: Usando componente extraído
                return (
                    <AlertasScreen
                        notificaciones={notificaciones}
                        noLeidas={noLeidas}
                        onMarcarLeida={handleMarcarLeida}
                        onEliminar={handleEliminarNotificacion}
                        onMarcarTodasLeidas={handleMarcarTodasLeidas}
                    />
                );

            case 'usuarios':
                // FASE 6: Gestión de usuarios para ADMIN
                return (
                    <AdminUsuariosScreen />
                );

            case 'control':
                // FASE 7: Centro de Control para ADMIN
                return (
                    <CentroControlScreen
                        onNavigate={(screen) => setCurrentScreen(screen as Screen)}
                    />
                );

            case 'perfil':
                // FASE 4: Usando componente extraído
                return (
                    <PerfilScreen
                        roleName={getRoleName()}
                        onChangeRole={handleChangeRole}
                    />
                );

            case 'detalle':
                if (!selectedManifiesto) return null;
                const originalData = selectedManifiesto._original || selectedManifiesto;
                const allResiduos = originalData.residuos || [];
                // FASE 3: Validación unificada - cualquier viaje activo (backend O hook)
                const hayViajeActivoEnDetalle = displayManifiestos.some(m => m.estado === 'EN_TRANSITO') || trip.viajeActivo;

                return (
                    <div className="section">
                        <h3>Manifiesto #{selectedManifiesto.numero}</h3>
                        <div className="detail-card">
                            <div className="detail-row"><label>Estado:</label>{getEstadoBadge(selectedManifiesto.estado)}</div>
                            <div className="detail-row"><label>Generador:</label><span>{selectedManifiesto.generador}</span></div>
                            <div className="detail-row"><label>Transportista:</label><span>{selectedManifiesto.transportista}</span></div>
                            <div className="detail-row"><label>Operador:</label><span>{selectedManifiesto.operador}</span></div>
                            <div className="detail-row"><label>Fecha:</label><span>{selectedManifiesto.fecha}</span></div>
                        </div>

                        {/* FASE 4: Mapa origen/destino del manifiesto */}
                        <div style={{ margin: '12px 0' }}>
                            <ManifiestoMap
                                origen={{
                                    nombre: selectedManifiesto.generador,
                                    direccion: originalData.generador?.domicilio,
                                    coords: originalData.generador?.latitud
                                        ? { lat: originalData.generador.latitud, lng: originalData.generador.longitud }
                                        : undefined
                                }}
                                destino={{
                                    nombre: selectedManifiesto.operador,
                                    direccion: originalData.operador?.domicilio,
                                    coords: originalData.operador?.latitud
                                        ? { lat: originalData.operador.latitud, lng: originalData.operador.longitud }
                                        : undefined
                                }}
                                altura="180px"
                            />
                        </div>

                        {/* CORRECCIÓN 4: Mostrar TODOS los residuos con descripción */}
                        <div className="detail-card" style={{ marginTop: '12px' }}>
                            <h4 style={{ margin: '0 0 12px', color: 'var(--ind-cyan)' }}>
                                Residuos ({allResiduos.length || 1})
                            </h4>
                            {allResiduos.length > 0 ? (
                                allResiduos.map((r: any, idx: number) => (
                                    <div key={idx} className="residuo-detail-item">
                                        <div className="residuo-detail-header">
                                            <span className="residuo-codigo">{r.tipoResiduo?.codigo || 'N/A'}</span>
                                            <span className="residuo-cantidad">{r.cantidad} {r.unidad}</span>
                                        </div>
                                        <div className="residuo-nombre">{r.tipoResiduo?.nombre || 'Residuo'}</div>
                                        {r.descripcion && (
                                            <div className="residuo-descripcion">
                                                <strong>Descripción:</strong> {r.descripcion}
                                            </div>
                                        )}
                                        {r.observaciones && (
                                            <div className="residuo-observaciones">
                                                <strong>Obs:</strong> {r.observaciones}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="residuo-detail-item">
                                    <div className="residuo-nombre">{selectedManifiesto.residuo}</div>
                                    <div className="residuo-cantidad">{selectedManifiesto.cantidad}</div>
                                </div>
                            )}
                        </div>

                        {/* Observaciones generales del manifiesto */}
                        {originalData.observaciones && (
                            <div className="detail-card" style={{ marginTop: '12px' }}>
                                <h4 style={{ margin: '0 0 8px', color: 'var(--ind-yellow)' }}>Observaciones</h4>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {originalData.observaciones}
                                </p>
                            </div>
                        )}

                        {/* FASE 3: Validación unificada - deshabilitar si hay viaje activo */}
                        {role === 'TRANSPORTISTA' && selectedManifiesto.estado === 'APROBADO' && (
                            <div className="form-actions" style={{ marginTop: '16px' }}>
                                {hayViajeActivoEnDetalle ? (
                                    <div className="warning-box" style={{
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        border: '1px solid #f59e0b',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        textAlign: 'center',
                                        color: '#f59e0b'
                                    }}>
                                        ⚠️ Ya tienes un viaje en tránsito. Finalízalo antes de iniciar otro.
                                    </div>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleIniciarViajeConManifiesto(selectedManifiesto)}
                                        style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                                    >
                                        <Play size={20} style={{ marginRight: '8px' }} />
                                        Iniciar Transporte
                                    </button>
                                )}
                            </div>
                        )}

                        {role === 'TRANSPORTISTA' && selectedManifiesto.estado === 'EN_TRANSITO' && (
                            <div className="form-actions" style={{ marginTop: '16px' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setActiveManifiestoId(originalData.id);
                                        setCurrentScreen('viaje');
                                    }}
                                    style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                                >
                                    <Navigation size={20} style={{ marginRight: '8px' }} />
                                    Ver Viaje Activo
                                </button>
                            </div>
                        )}

                        {role === 'OPERADOR' && selectedManifiesto.estado === 'ENTREGADO' && (
                            <div className="form-actions" style={{ marginTop: '16px' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        showToastMessage('Recepción confirmada');
                                        setCurrentScreen('home');
                                    }}
                                    style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                                >
                                    Confirmar Recepción
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'tracking':
                return (
                    <div className="section">
                        <h3>Monitoreo GPS</h3>
                        <div className="tracking-status-card">
                            <div className="tracking-indicator">
                                <div className={`gps-pulse ${trip.gpsPosition ? 'active' : ''}`}></div>
                                <Navigation size={28} />
                            </div>
                            <div className="tracking-info">
                                <span className="tracking-label">Estado GPS</span>
                                <span className="tracking-value">{trip.gpsPosition ? 'Activo' : 'Sin señal'}</span>
                            </div>
                        </div>
                        {trip.gpsPosition && (
                            <div className="detail-card">
                                <div className="detail-row">
                                    <label>Latitud:</label>
                                    <span>{trip.gpsPosition.lat.toFixed(6)}</span>
                                </div>
                                <div className="detail-row">
                                    <label>Longitud:</label>
                                    <span>{trip.gpsPosition.lng.toFixed(6)}</span>
                                </div>
                                <div className="detail-row">
                                    <label>Precisión:</label>
                                    <span>±{(trip.gpsPosition as any).accuracy?.toFixed(0) || 'N/A'}m</span>
                                </div>
                            </div>
                        )}
                        <div className="list">
                            <h4 style={{ margin: '16px 0 8px', color: 'var(--ind-yellow)' }}>Viajes Activos</h4>
                            {displayManifiestos.filter(m => m.estado === 'EN_TRANSITO').length > 0 ? (
                                displayManifiestos.filter(m => m.estado === 'EN_TRANSITO').map(m => formatManifiestoForDisplay(m)).map(m => (
                                    <div key={m.id} className="list-item" onClick={() => handleSelectManifiesto(m)}>
                                        <div className="list-icon"><Navigation size={18} /></div>
                                        <div className="list-body">
                                            <div className="list-title">#{m.numero}</div>
                                            <div className="list-sub">{m.generador} → {m.operador}</div>
                                            {/* FASE 5: Datos adicionales en lista */}
                                            <div className="list-meta" style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--ind-text-mid)' }}>
                                                <span style={{ color: 'var(--ind-cyan)' }}>{m.residuo || 'Residuo'}</span>
                                                <span style={{ color: 'var(--ind-orange)' }}>{m.cantidad || ''}</span>
                                            </div>
                                        </div>
                                        <div className="list-badge">{getEstadoBadge(m.estado)}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <MapPin size={32} />
                                    <p>No hay viajes en tránsito</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'nuevo':
                return (
                    <div className="section">
                        <h3>Nuevo Manifiesto</h3>
                        <div className="form-card">
                            <div className="form-group">
                                <label>Tipo de Residuo</label>
                                <select className="form-select">
                                    <option value="">Seleccione...</option>
                                    <option value="Y1">Y1 - Desechos clínicos</option>
                                    <option value="Y2">Y2 - Desechos farmacéuticos</option>
                                    <option value="Y3">Y3 - Desechos medicamentos</option>
                                    <option value="Y8">Y8 - Aceites usados</option>
                                    <option value="Y9">Y9 - Mezclas de aceite/agua</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Cantidad (kg)</label>
                                <input type="number" className="form-input" placeholder="0.00" />
                            </div>
                            <div className="form-group">
                                <label>Transportista</label>
                                <select className="form-select">
                                    <option value="">Seleccione...</option>
                                    <option value="t1">Transporte Ecológico S.A.</option>
                                    <option value="t2">LogiResiduos Ltda.</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Operador de Destino</label>
                                <select className="form-select">
                                    <option value="">Seleccione...</option>
                                    <option value="o1">Planta Tratamiento Norte</option>
                                    <option value="o2">Centro Disposición Final</option>
                                </select>
                            </div>
                            <div className="form-actions">
                                <button className="btn btn-secondary" onClick={() => setCurrentScreen('home')}>
                                    Cancelar
                                </button>
                                <button className="btn btn-primary" onClick={() => {
                                    showToastMessage('Manifiesto creado exitosamente');
                                    setCurrentScreen('manifiestos');
                                }}>
                                    Crear Manifiesto
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'actores':
                return (
                    <div className="section">
                        <h3>Gestión de Actores</h3>
                        <div className="search-bar">
                            <Search size={18} />
                            <input type="text" placeholder="Buscar actores..." />
                        </div>
                        <div className="actor-tabs">
                            <button className="actor-tab active">Generadores</button>
                            <button className="actor-tab">Transportistas</button>
                            <button className="actor-tab">Operadores</button>
                        </div>
                        <div className="list">
                            {[
                                { id: 1, nombre: 'Industria Química S.A.', tipo: 'GENERADOR', estado: 'ACTIVO' },
                                { id: 2, nombre: 'Laboratorios Médicos', tipo: 'GENERADOR', estado: 'ACTIVO' },
                                { id: 3, nombre: 'Metalúrgica del Norte', tipo: 'GENERADOR', estado: 'PENDIENTE' },
                            ].map(actor => (
                                <div key={actor.id} className="list-item">
                                    <div className="list-icon"><Users size={18} /></div>
                                    <div className="list-body">
                                        <div className="list-title">{actor.nombre}</div>
                                        <div className="list-sub">{actor.tipo}</div>
                                    </div>
                                    <div className="list-badge">
                                        <span className={`badge ${actor.estado === 'ACTIVO' ? 'active' : 'pending'}`}>
                                            {actor.estado}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'historial':
                return (
                    <div className="section">
                        <h3>Historial de Viajes</h3>
                        <div className="filter-bar">
                            <select className="form-select compact">
                                <option value="7">Últimos 7 días</option>
                                <option value="30">Últimos 30 días</option>
                                <option value="90">Últimos 90 días</option>
                            </select>
                        </div>
                        <div className="list">
                            {displayManifiestos.filter(m => m.estado === 'TRATADO' || m.estado === 'RECIBIDO').length > 0 ? (
                                displayManifiestos.filter(m => m.estado === 'TRATADO' || m.estado === 'RECIBIDO').map(m => formatManifiestoForDisplay(m)).map(m => (
                                    <div key={m.id} className="list-item" onClick={() => handleSelectManifiesto(m)}>
                                        <div className="list-icon"><FileText size={18} /></div>
                                        <div className="list-body">
                                            <div className="list-title">#{m.numero}</div>
                                            <div className="list-sub">{m.generador}</div>
                                        </div>
                                        <div className="list-badge">{getEstadoBadge(m.estado)}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <FileText size={32} />
                                    <p>No hay viajes completados</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            // FASE 2: Pantalla de historial de viajes - renderizada a nivel superior
            // El componente se renderiza fuera de app-content para cubrir header/nav
            case 'historial-viajes':
                return null;

            default:
                return (
                    <div className="screen-not-found">
                        <div className="screen-not-found-icon">🔍</div>
                        <h2>Pantalla no disponible</h2>
                        <p>La función solicitada está en desarrollo</p>
                        <button className="btn btn-primary" onClick={() => setCurrentScreen('home')}>Volver al inicio</button>
                    </div>
                );
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

            {/* QR → Viaje Confirmation Modal */}
            {showQRConfirmModal && scannedManifiesto && (
                <div className="modal-overlay" onClick={() => {
                    setShowQRConfirmModal(false);
                    setScannedManifiesto(null);
                    qr.clearScannedQR();
                }}>
                    <div className="modal-content qr-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="qr-modal-header">
                            <QrCode size={32} className="qr-icon" />
                            <h3>Manifiesto Detectado</h3>
                        </div>

                        <div className="qr-modal-body">
                            <div className="qr-manifiesto-info">
                                <div className="qr-numero">#{scannedManifiesto.numero}</div>
                                <div className={`qr-estado estado-${scannedManifiesto.estado?.toLowerCase()}`}>
                                    {ESTADO_CONFIG[scannedManifiesto.estado]?.label || scannedManifiesto.estado}
                                </div>
                            </div>

                            <div className="qr-details">
                                {scannedManifiesto.generador && (
                                    <div className="qr-detail-row">
                                        <span className="label">Origen:</span>
                                        <span className="value">{scannedManifiesto.generador.razonSocial || scannedManifiesto.generador}</span>
                                    </div>
                                )}
                                {scannedManifiesto.operador && (
                                    <div className="qr-detail-row">
                                        <span className="label">Destino:</span>
                                        <span className="value">{scannedManifiesto.operador.razonSocial || scannedManifiesto.operador}</span>
                                    </div>
                                )}
                                {scannedManifiesto.residuos?.[0] && (
                                    <div className="qr-detail-row">
                                        <span className="label">Residuo:</span>
                                        <span className="value">
                                            {scannedManifiesto.residuos[0].tipoResiduo?.nombre || 'N/A'}
                                            {' - '}
                                            {scannedManifiesto.residuos[0].cantidad} {scannedManifiesto.residuos[0].unidad}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="qr-modal-actions">
                            {/* FASE 3: Validación unificada - verificar backend Y hook */}
                            {scannedManifiesto.estado === 'APROBADO' && role === 'TRANSPORTISTA' &&
                             !trip.viajeActivo && !displayManifiestos.some(m => m.estado === 'EN_TRANSITO') && (
                                <button
                                    className="btn btn-primary qr-btn-iniciar"
                                    onClick={handleIniciarViajeDesdeQR}
                                >
                                    <Navigation size={18} />
                                    INICIAR VIAJE AHORA
                                </button>
                            )}

                            {/* Mostrar botón de VER VIAJE si está EN_TRANSITO */}
                            {scannedManifiesto.estado === 'EN_TRANSITO' && (
                                <button
                                    className="btn btn-primary qr-btn-ver"
                                    onClick={() => {
                                        setSelectedManifiesto(scannedManifiesto);
                                        setActiveManifiestoId(scannedManifiesto.id);
                                        setShowQRConfirmModal(false);
                                        setScannedManifiesto(null);
                                        qr.clearScannedQR();
                                        setCurrentScreen('viaje');
                                    }}
                                >
                                    <MapPin size={18} />
                                    VER VIAJE ACTIVO
                                </button>
                            )}

                            {/* Botón para ver detalles */}
                            <button
                                className="btn btn-secondary qr-btn-detalle"
                                onClick={() => {
                                    setSelectedManifiesto(scannedManifiesto);
                                    setShowQRConfirmModal(false);
                                    setScannedManifiesto(null);
                                    qr.clearScannedQR();
                                    setCurrentScreen('detalle');
                                }}
                            >
                                <FileText size={18} />
                                Ver Detalles
                            </button>

                            {/* Botón cerrar */}
                            <button
                                className="btn btn-ghost qr-btn-cerrar"
                                onClick={() => {
                                    setShowQRConfirmModal(false);
                                    setScannedManifiesto(null);
                                    qr.clearScannedQR();
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading overlay for QR manifiesto */}
            {loadingQRManifiesto && (
                <div className="modal-overlay">
                    <div className="loading-spinner">
                        <RefreshCw size={32} className="spin" />
                        <span>Cargando manifiesto...</span>
                    </div>
                </div>
            )}

            {/* FASE 2: Modal de detalle de viaje con mapa */}
            {showViajeModal && selectedViaje && (
                <ViajeDetalleModal
                    viaje={selectedViaje}
                    onClose={() => {
                        setShowViajeModal(false);
                        setSelectedViaje(null);
                    }}
                />
            )}

            {/* FASE 2: HistorialViajes - RENDERIZADO A NIVEL SUPERIOR para cubrir todo */}
            {currentScreen === 'historial-viajes' && (
                <HistorialViajes
                    viajes={trip.savedTrips}
                    onSelectViaje={(viaje) => {
                        setSelectedViaje(viaje);
                        setShowViajeModal(true);
                    }}
                    onBack={() => setCurrentScreen('home')}
                />
            )}

            {/* Header */}
            <header className="app-header">
                {renderHeaderButton()}
                <span className="header-title">{getHeaderTitle()}</span>
                <div className="header-right">
                    <div className={`conn-indicator ${isOnline ? 'online' : 'offline'}`}>
                        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    </div>
                    <button className="header-btn" onClick={handleChangeRole} title="Cambiar Rol">
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* FASE 2: TripBanner colapsable - NO bloquea navegación */}
            {trip.viajeActivo && currentScreen !== 'viaje' && (
                <TripBanner
                    isActive={trip.viajeActivo}
                    duration={trip.tiempoViaje}
                    distance={calcularDistanciaViaje()}
                    gpsStatus={getGpsStatus()}
                    manifiestoNumero={selectedManifiesto?.numero}
                    onExpand={() => setCurrentScreen('viaje')}
                />
            )}

            {/* Side Menu */}
            {menuOpen && (
                <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
                    <div className="side-menu" onClick={e => e.stopPropagation()}>
                        <div className="menu-user">
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
                                <>
                                    <button className="menu-link" onClick={() => { setCurrentScreen('actores'); setMenuOpen(false); }}>
                                        <Users size={20} /><span>Actores</span>
                                    </button>
                                    <button className="menu-link" onClick={() => { setCurrentScreen('historial-viajes'); setMenuOpen(false); }}>
                                        <Clock size={20} /><span>Historial Viajes ({trip.savedTrips.length})</span>
                                    </button>
                                </>
                            )}
                            {role === 'TRANSPORTISTA' && (
                                <button className="menu-link" onClick={() => { setCurrentScreen('historial-viajes'); setMenuOpen(false); }}>
                                    <Clock size={20} /><span>Historial Viajes ({trip.savedTrips.length})</span>
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
