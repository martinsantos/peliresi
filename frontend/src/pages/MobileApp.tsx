/**
 * MobileApp - Refactored Version v2
 *
 * Simplificaciones realizadas:
 * - Extraida logica de manifiestos a utils/manifiestoUtils.ts
 * - Extraida carga de manifiestos a hooks/useManifiestos.ts
 * - Extraida logica de notificaciones a hooks/useNotificaciones.ts
 * - Extraido HomeScreen a components/mobile/HomeScreen.tsx
 * - Extraido ManifiestoDetail a components/mobile/ManifiestoDetail.tsx
 * - Consolidados handlers de modales
 * - Eliminado codigo duplicado
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Home, FileText, MapPin, Bell, Settings, User, Menu,
    Package, QrCode, Clock,
    Navigation, Wifi, WifiOff,
    Users,
    ChevronLeft, Plus, LogOut,
    RefreshCw, Command
} from 'lucide-react';

// Hooks
import { useConnectivity } from '../hooks/useConnectivity';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTripTracking } from '../hooks/useTripTracking';
import { useQRScanner } from '../hooks/useQRScanner';
import { useManifiestos } from '../hooks/useManifiestos';
import { useNotificaciones } from '../hooks/useNotificaciones';

// Services
import { analyticsService } from '../services/analytics.service';
import { manifiestoService } from '../services/manifiesto.service';
import { authService } from '../services/auth.service';
import { offlineStorage } from '../services/offlineStorage';
import { viajesService } from '../services/viajes.service';

// Components
import RoleSelector from '../components/mobile/RoleSelector';
import TripTracker from '../components/mobile/TripTracker';
import QRScannerView from '../components/mobile/QRScannerView';
import { IncidentModal, ParadaModal } from '../components/mobile/TripModals';
import HomeScreen from '../components/mobile/HomeScreen';
import ManifiestoDetail from '../components/mobile/ManifiestoDetail';
import HistorialViajes from '../components/mobile/HistorialViajes';
import ViajeDetalleModal from '../components/mobile/ViajeDetalleModal';
import TripBanner from '../components/layout/TripBanner';
import ActoresScreen from '../components/mobile/ActoresScreen';
import RecepcionModal from '../components/mobile/RecepcionModal';
import TransportistaModal from '../components/mobile/TransportistaModal';
import RechazoModal from '../components/mobile/RechazoModal';
import TratamientoModal from '../components/mobile/TratamientoModal';
import PushNotificationPrompt from '../components/PushNotificationPrompt';
import ReversionModal from '../components/ReversionModal';
import TripRecoveryModal from '../components/mobile/TripRecoveryModal';
import ActiveTripOverlay from '../components/mobile/ActiveTripOverlay';
import SyncIndicator from '../components/mobile/SyncIndicator';
import NuevoManifiestoScreen from '../components/mobile/NuevoManifiestoScreen';

// Screens
import { AlertasScreen, PerfilScreen, ManifiestosScreen, AdminDashboard, AdminUsuariosScreen, CentroControlScreen } from '../screens';

// Types and Utils
import type { UserRole, Screen, MenuItem, SavedTrip } from '../types/mobile.types';
import { ROLE_NAMES, ESTADO_CONFIG } from '../types/mobile.types';
import {
    formatManifiestoForDisplay,
    hasManifiestoEnTransito,
    findManifiestoEnTransito,
    calcularDistanciaRuta,
    getCurrentPosition,
    type DisplayManifiesto
} from '../utils/manifiestoUtils';

import './MobileApp.css';

// Expose analytics globally for debugging
if (typeof window !== 'undefined') {
    (window as any).analyticsService = analyticsService;
}

// ========== HELPER FUNCTIONS ==========

function getSavedRole(): UserRole | null {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('sitrep_mobile_role');
    if (saved && ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(saved)) {
        return saved as UserRole;
    }
    return null;
}

function getEstadoBadge(estado: string): React.ReactElement {
    const config = ESTADO_CONFIG[estado] || { bg: '#334155', color: '#94a3b8', label: estado };
    return <span className="badge" style={{ background: config.bg, color: config.color }}>{config.label}</span>;
}

// ========== MAIN COMPONENT ==========

const MobileApp: React.FC = () => {
    // ========== STATE ==========
    const [role, setRole] = useState<UserRole | null>(getSavedRole);
    const [currentScreen, setCurrentScreen] = useState<Screen>('home');
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectedManifiesto, setSelectedManifiesto] = useState<DisplayManifiesto | null>(null);
    const [activeManifiestoId, setActiveManifiestoId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'pendientes' | 'en-curso' | 'realizados'>('pendientes');

    // Dashboard stats para sincronizar con WEB (usa mismo endpoint /api/manifiestos/dashboard)
    const [dashboardStats, setDashboardStats] = useState<{
        total: number;
        borradores: number;
        pendientesAprobacion?: number;
        aprobados: number;
        enTransito: number;
        entregados: number;
        recibidos: number;
        enTratamiento?: number;
        tratados: number;
    } | null>(null);

    // Toast state
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Modal states
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [showParadaModal, setShowParadaModal] = useState(false);
    const [incidentText, setIncidentText] = useState('');
    const [paradaText, setParadaText] = useState('');

    // QR modal state
    const [showQRConfirmModal, setShowQRConfirmModal] = useState(false);
    const [scannedManifiesto, setScannedManifiesto] = useState<any>(null);
    const [loadingQRManifiesto, setLoadingQRManifiesto] = useState(false);

    // Modales de operaciones
    const [showRecepcionModal, setShowRecepcionModal] = useState(false);
    const [showTransportistaModal, setShowTransportistaModal] = useState(false);
    const [transportistaModalAction, _setTransportistaModalAction] = useState<'retiro' | 'entrega'>('retiro');
    const [manifiestoParaModal, setManifiestoParaModal] = useState<any>(null);
    const [showRechazoModal, setShowRechazoModal] = useState(false);
    const [showTratamientoModal, setShowTratamientoModal] = useState(false);
    const [showReversionModal, setShowReversionModal] = useState(false);
    const [reversionType, setReversionType] = useState<'entrega' | 'recepcion' | 'certificado' | 'admin'>('entrega');

    // Historial y viaje
    const [selectedViaje, setSelectedViaje] = useState<SavedTrip | null>(null);
    const [showViajeModal, setShowViajeModal] = useState(false);
    const [showTripRecoveryModal, setShowTripRecoveryModal] = useState(false);
    const [pendingRestoreTrip, setPendingRestoreTrip] = useState<any>(null);
    const [showActiveTripOverlay, setShowActiveTripOverlay] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<Screen | null>(null);

    // Ref para evitar sincronizacion multiple
    const syncedManifiestoRef = useRef<string | null>(null);

    // ========== HOOKS ==========
    const { isOnline, syncPending, manualSync, isReallyOnline } = useConnectivity();
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

    const { manifiestos: backendManifiestos, reload: loadManifiestosFromBackend } = useManifiestos({
        role,
        isOnline
    });

    const {
        notificaciones,
        noLeidas,
        marcarLeida: handleMarcarLeida,
        eliminar: handleEliminarNotificacion,
        marcarTodasLeidas: handleMarcarTodasLeidas
    } = useNotificaciones({
        isOnline,
        enabled: !!role
    });

    const qr = useQRScanner({
        onToast: showToastMessage,
        autoOpenUrl: false
    });

    // ========== DERIVED STATE ==========
    const hayManifiestoEnTransito = hasManifiestoEnTransito(backendManifiestos);
    const debeBloquearNavegacion = trip.viajeActivo || hayManifiestoEnTransito;
    const displayManifiestos = backendManifiestos || [];

    // ========== EFFECTS ==========

    // Save role to localStorage
    useEffect(() => {
        if (role) {
            localStorage.setItem('sitrep_mobile_role', role);
        }
    }, [role]);

    // Cargar dashboard stats del backend (sincroniza con WEB)
    useEffect(() => {
        async function loadDashboardStats() {
            if (!role || !isOnline) return;
            try {
                const data = await manifiestoService.getDashboard();
                if (data?.estadisticas) {
                    setDashboardStats(data.estadisticas);
                    console.log('[MobileApp] Dashboard stats loaded:', data.estadisticas);
                }
            } catch (error) {
                console.warn('[MobileApp] Error loading dashboard stats:', error);
            }
        }
        loadDashboardStats();
    }, [role, isOnline]);

    // Verificar viaje activo guardado al iniciar
    useEffect(() => {
        async function checkActiveTrip(): Promise<void> {
            if (!role || role !== 'TRANSPORTISTA') return;

            if (trip.viajeActivo && currentScreen !== 'viaje') {
                setCurrentScreen('viaje');
                return;
            }

            try {
                const savedTrip = await offlineStorage.getActiveTrip();
                if (savedTrip && !trip.viajeActivo) {
                    setPendingRestoreTrip(savedTrip);
                    setShowTripRecoveryModal(true);
                }
            } catch (err) {
                console.error('[MobileApp] Error verificando viaje activo:', err);
            }
        }

        checkActiveTrip();
    }, [role, trip.viajeActivo]);

    // Redirigir a viaje cuando hay manifiesto EN_TRANSITO
    useEffect(() => {
        if (role === 'TRANSPORTISTA' && hayManifiestoEnTransito && currentScreen !== 'viaje') {
            setCurrentScreen('viaje');
        }
    }, [role, hayManifiestoEnTransito, currentScreen]);

    // Auto-sincronizar hook con estado backend
    useEffect(() => {
        if (role !== 'TRANSPORTISTA' && role !== 'ADMIN') return;
        if (!hayManifiestoEnTransito) return;

        const manifiestoEnTransito = findManifiestoEnTransito(backendManifiestos);
        if (!manifiestoEnTransito) return;

        if (syncedManifiestoRef.current === manifiestoEnTransito.id) return;

        syncedManifiestoRef.current = manifiestoEnTransito.id;
        setActiveManifiestoId(manifiestoEnTransito.id);
        setSelectedManifiesto(formatManifiestoForDisplay(manifiestoEnTransito));
        trip.sincronizarConBackend(manifiestoEnTransito);
    }, [role, hayManifiestoEnTransito, backendManifiestos]);

    // Auto-mostrar overlay si hay viaje activo y se navega fuera
    useEffect(() => {
        if (debeBloquearNavegacion && role === 'TRANSPORTISTA' && currentScreen !== 'viaje') {
            const timer = setTimeout(() => setShowActiveTripOverlay(true), 300);
            return () => clearTimeout(timer);
        }
        setShowActiveTripOverlay(false);
    }, [currentScreen, debeBloquearNavegacion, role]);

    // QR → Cargar manifiesto escaneado
    useEffect(() => {
        if (qr.parsedQR?.manifiestoId) {
            loadManifiestoFromQR(qr.parsedQR.manifiestoId);
        }
    }, [qr.parsedQR]);

    // ========== HANDLERS ==========

    async function loadManifiestoFromQR(manifiestoId: string): Promise<void> {
        setLoadingQRManifiesto(true);
        try {
            const localMatch = backendManifiestos.find(
                m => m.id === manifiestoId || m.numero === manifiestoId
            );

            if (localMatch) {
                setScannedManifiesto(localMatch);
                setShowQRConfirmModal(true);
                return;
            }

            const manifiesto = await manifiestoService.getManifiesto(manifiestoId);
            setScannedManifiesto(manifiesto);
            setShowQRConfirmModal(true);
        } catch (err: any) {
            showToastMessage('Manifiesto no encontrado: ' + manifiestoId);
        } finally {
            setLoadingQRManifiesto(false);
        }
    }

    async function handleIniciarViajeDesdeQR(): Promise<void> {
        if (!scannedManifiesto) return;

        setShowQRConfirmModal(false);
        qr.clearScannedQR();

        setActiveManifiestoId(scannedManifiesto.id);
        setSelectedManifiesto(scannedManifiesto);

        if (scannedManifiesto.estado === 'APROBADO' && isOnline) {
            try {
                const position = await getCurrentPosition();
                await manifiestoService.confirmarRetiro(scannedManifiesto.id, {
                    latitud: position?.coords.latitude,
                    longitud: position?.coords.longitude,
                    observaciones: 'Retiro confirmado desde QR'
                });
                showToastMessage(`Retiro confirmado - Manifiesto #${scannedManifiesto.numero}`);
            } catch (err: any) {
                showToastMessage(`Error al confirmar retiro: ${err.message || 'Error de conexion'}`);
                setScannedManifiesto(null);
                return;
            }
        }

        // Registrar inicio de viaje en backend para sincronización entre dispositivos
        if (isOnline) {
            try {
                await viajesService.iniciarViaje({
                    manifiestoId: scannedManifiesto.id,
                    appVersion: '2.1.0'
                });
                console.log('[MobileApp] Viaje registrado en backend desde QR');
            } catch (err) {
                console.warn('[MobileApp] Error registrando viaje en backend:', err);
            }
        }

        trip.iniciarViaje();
        setCurrentScreen('viaje');
        setScannedManifiesto(null);
        showToastMessage(`Viaje iniciado desde QR - #${scannedManifiesto.numero}`);
    }

    const handleChangeRole = useCallback(() => {
        localStorage.removeItem('sitrep_mobile_role');
        qr.stopCamera();
        setRole(null);
        setCurrentScreen('home');
        setMenuOpen(false);
    }, [qr]);

    const handleSelectManifiesto = useCallback((m: DisplayManifiesto) => {
        setSelectedManifiesto(m);
        setCurrentScreen('detalle');
    }, []);

    const handleConfirmIncident = useCallback(() => {
        if (!incidentText.trim()) {
            showToastMessage('Describa el incidente');
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

    async function handleIniciarViajeConManifiesto(manifiesto: DisplayManifiesto): Promise<void> {
        const originalManifiesto = manifiesto._original || manifiesto;

        setActiveManifiestoId(originalManifiesto.id);
        setSelectedManifiesto(manifiesto);

        if (originalManifiesto.estado === 'APROBADO' && isOnline) {
            try {
                const position = await getCurrentPosition();
                await manifiestoService.confirmarRetiro(originalManifiesto.id, {
                    latitud: position?.coords.latitude,
                    longitud: position?.coords.longitude,
                    observaciones: 'Retiro confirmado desde app movil'
                });
                showToastMessage(`Retiro confirmado - Manifiesto #${manifiesto.numero}`);
                loadManifiestosFromBackend();
            } catch (err: any) {
                showToastMessage(`Error al confirmar retiro: ${err.message || 'Error de conexion'}`);
                return;
            }
        }

        // Registrar inicio de viaje en backend para sincronización entre dispositivos
        if (isOnline) {
            try {
                await viajesService.iniciarViaje({
                    manifiestoId: originalManifiesto.id,
                    appVersion: '2.1.0'
                });
                console.log('[MobileApp] Viaje registrado en backend');
            } catch (err) {
                console.warn('[MobileApp] Error registrando viaje en backend:', err);
                // Continuar aunque falle - el viaje se sincronizará después
            }
        }

        trip.iniciarViaje();
        setCurrentScreen('viaje');
        showToastMessage(`Viaje iniciado para manifiesto #${manifiesto.numero}`);
    }

    async function handleFinalizarViaje(): Promise<void> {
        const currentUser = authService.getStoredUser();
        const userTransportistaId = currentUser?.transportista?.id;

        let manifiestoId = activeManifiestoId;
        let manifiestoNumero = selectedManifiesto?.numero || '';

        if (!manifiestoId) {
            const manifiestoEnTransito = backendManifiestos.find(m => {
                const isEnTransito = m.estado === 'EN_TRANSITO';
                const belongsToUser = !userTransportistaId || m.transportistaId === userTransportistaId;
                return isEnTransito && belongsToUser;
            });

            if (manifiestoEnTransito) {
                manifiestoId = manifiestoEnTransito.id;
                manifiestoNumero = manifiestoEnTransito.numero || '';
            }
        }

        if (manifiestoId && isOnline) {
            try {
                const position = await getCurrentPosition();
                await manifiestoService.confirmarEntrega(manifiestoId, {
                    latitud: position?.coords.latitude,
                    longitud: position?.coords.longitude,
                    observaciones: 'Entrega confirmada desde app movil'
                });

                showToastMessage(`Entrega confirmada - Manifiesto #${manifiestoNumero} actualizado a ENTREGADO`);
                finalizarViajeLocal();
                loadManifiestosFromBackend();
            } catch (err: any) {
                const errorCode = err.response?.status || '';
                const errorMsg = err.response?.data?.message || err.message || 'Error de conexion';
                if (errorCode === 403) {
                    showToastMessage(`Error 403: No tienes permiso para este manifiesto.`);
                } else {
                    showToastMessage(`Error ${errorCode}: ${errorMsg}`);
                }
            }
        } else if (!isOnline) {
            showToastMessage(`Offline - Entrega se sincronizara cuando haya conexion`);
            finalizarViajeLocal();
        } else {
            showToastMessage(`No se encontro manifiesto para confirmar entrega`);
            finalizarViajeLocal();
        }
    }

    function finalizarViajeLocal(): void {
        trip.finalizarViaje();
        setActiveManifiestoId(null);
        setSelectedManifiesto(null);
        syncedManifiestoRef.current = null;
        setCurrentScreen('home');
    }

    async function handleIniciarViajeAutomatico(): Promise<void> {
        const manifiestosPendientes = backendManifiestos.filter(m => m.estado === 'APROBADO');

        if (manifiestosPendientes.length === 0) {
            showToastMessage('No hay manifiestos pendientes asignados');
            return;
        }

        if (manifiestosPendientes.length === 1) {
            await handleIniciarViajeConManifiesto(formatManifiestoForDisplay(manifiestosPendientes[0]));
        } else {
            setActiveTab('pendientes');
            showToastMessage('Selecciona un manifiesto de la lista para iniciar el viaje');
        }
    }

    const handleNavigationWithActiveTrip = useCallback((targetScreen: Screen): boolean => {
        if (debeBloquearNavegacion && targetScreen !== 'viaje' && role === 'TRANSPORTISTA') {
            setPendingNavigation(targetScreen);
            setShowActiveTripOverlay(true);
            return false;
        }
        setCurrentScreen(targetScreen);
        return true;
    }, [debeBloquearNavegacion, role]);

    const handleResumeTrip = useCallback(() => {
        if (pendingRestoreTrip) {
            trip.restoreFromSaved(pendingRestoreTrip);
            setActiveManifiestoId(pendingRestoreTrip.manifiestoId || null);
            setCurrentScreen('viaje');
            setShowTripRecoveryModal(false);
            setPendingRestoreTrip(null);
            showToastMessage('Viaje restaurado correctamente');
        }
    }, [pendingRestoreTrip, trip, showToastMessage]);

    const handleDiscardTrip = useCallback(async () => {
        try {
            await offlineStorage.clearActiveTrip();
            setShowTripRecoveryModal(false);
            setPendingRestoreTrip(null);
            showToastMessage('Viaje descartado');
        } catch (err) {
            console.error('[MobileApp] Error descartando viaje:', err);
        }
    }, [showToastMessage]);

    const handleGoToTrip = useCallback(() => {
        setShowActiveTripOverlay(false);
        setPendingNavigation(null);
        setCurrentScreen('viaje');
    }, []);

    const handleStayHere = useCallback(() => {
        if (pendingNavigation) {
            setCurrentScreen(pendingNavigation);
        }
        setShowActiveTripOverlay(false);
        setPendingNavigation(null);
    }, [pendingNavigation]);

    // Handlers para modales de operaciones
    function openModalForManifiesto(
        tipo: 'recepcion' | 'rechazo' | 'tratamiento' | 'reversion',
        revType?: 'entrega' | 'recepcion' | 'certificado'
    ): void {
        if (!selectedManifiesto) return;

        const original = selectedManifiesto._original || selectedManifiesto;
        const modalData = {
            id: original.id,
            numero: selectedManifiesto.numero,
            estado: selectedManifiesto.estado,
            generador: { razonSocial: selectedManifiesto.generador },
            transportista: { razonSocial: selectedManifiesto.transportista },
            tipoResiduo: selectedManifiesto.residuo,
            pesoKg: original.residuos?.[0]?.cantidad || 0
        };

        setManifiestoParaModal(modalData);

        switch (tipo) {
            case 'recepcion':
                setShowRecepcionModal(true);
                break;
            case 'rechazo':
                setShowRechazoModal(true);
                break;
            case 'tratamiento':
                setShowTratamientoModal(true);
                break;
            case 'reversion':
                setReversionType(revType || 'entrega');
                setShowReversionModal(true);
                break;
        }
    }

    async function handleFirmarManifiesto(): Promise<void> {
        if (!selectedManifiesto) return;
        const original = selectedManifiesto._original || selectedManifiesto;
        try {
            await manifiestoService.firmarManifiesto(original.id);
            showToastMessage(`Manifiesto #${selectedManifiesto.numero} firmado correctamente`);
            loadManifiestosFromBackend();
            setSelectedManifiesto(null);
            setCurrentScreen('home');
        } catch (err: any) {
            showToastMessage(`Error: ${err.response?.data?.message || 'Error al firmar'}`);
        }
    }

    async function handleCerrarManifiesto(): Promise<void> {
        if (!selectedManifiesto) return;
        const original = selectedManifiesto._original || selectedManifiesto;
        try {
            await manifiestoService.cerrarManifiesto(original.id, {
                observaciones: 'Tratamiento completado desde app movil'
            });
            showToastMessage(`Certificado emitido - Manifiesto #${selectedManifiesto.numero} cerrado`);
            loadManifiestosFromBackend();
            setSelectedManifiesto(null);
            setCurrentScreen('home');
        } catch (err: any) {
            showToastMessage(`Error: ${err.response?.data?.message || 'Error al cerrar manifiesto'}`);
        }
    }

    // ========== MENU CONFIGURATION ==========
    function getMenuItems(): MenuItem[] {
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
    }

    const getRoleName = (): string => role ? ROLE_NAMES[role] : 'Usuario';

    const menuItems = getMenuItems();
    const backScreens = ['detalle', 'viaje', 'actores'];
    const isBackScreen = backScreens.includes(currentScreen);

    function getHeaderTitle(): string {
        if (currentScreen === 'viaje') return 'Viaje Activo';
        if (currentScreen === 'actores') return 'Actores';
        // Títulos de Home sincronizados con WEB Dashboard
        if (currentScreen === 'home') {
            switch (role) {
                case 'ADMIN': return 'Centro de Control';
                case 'GENERADOR': return 'Mis Manifiestos';
                case 'TRANSPORTISTA': return 'Mis Viajes';
                case 'OPERADOR': return 'Recepciones';
                default: return 'Inicio';
            }
        }
        return menuItems.find(m => m.id === currentScreen)?.label || 'Detalle';
    }

    function calcularDistanciaViaje(): number {
        return calcularDistanciaRuta(trip.viajeRuta);
    }

    function getGpsStatus(): 'active' | 'weak' | 'lost' {
        if (!trip.gpsPosition) return 'lost';
        return trip.gpsAvailable ? 'active' : 'weak';
    }

    // ========== RENDER HELPERS ==========

    function renderHeaderButton(): React.ReactElement {
        return (
            <button
                className="header-btn"
                onClick={() => isBackScreen ? setCurrentScreen('home') : setMenuOpen(!menuOpen)}
            >
                {isBackScreen ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>
        );
    }

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
    function renderContent(): React.ReactElement | null {
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
                if (role === 'ADMIN') {
                    return (
                        <AdminDashboard
                            manifiestos={displayManifiestos.map(formatManifiestoForDisplay)}
                            onSelectManifiesto={handleSelectManifiesto}
                            onNavigate={setCurrentScreen}
                            backendStats={dashboardStats || undefined}
                        />
                    );
                }

                return (
                    <HomeScreen
                        role={role!}
                        manifiestos={backendManifiestos}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onSelectManifiesto={handleSelectManifiesto}
                        onNavigate={handleNavigationWithActiveTrip}
                        isOnline={isOnline}
                        syncPending={syncPending}
                        viajeActivo={trip.viajeActivo}
                        onIniciarViajeAutomatico={handleIniciarViajeAutomatico}
                        backendStats={dashboardStats || undefined}
                    />
                );

            case 'manifiestos':
                return (
                    <ManifiestosScreen
                        manifiestos={displayManifiestos.map(formatManifiestoForDisplay)}
                        onSelectManifiesto={handleSelectManifiesto}
                    />
                );

            case 'alertas':
                return (
                    <AlertasScreen
                        notificaciones={notificaciones}
                        noLeidas={noLeidas}
                        onMarcarLeida={(id) => handleMarcarLeida(id).then(ok => ok && showToastMessage('Marcada como leida'))}
                        onEliminar={(id) => handleEliminarNotificacion(id).then(ok => ok && showToastMessage('Notificacion eliminada'))}
                        onMarcarTodasLeidas={() => handleMarcarTodasLeidas().then(ok => ok && showToastMessage('Todas marcadas como leidas'))}
                    />
                );

            case 'usuarios':
                return <AdminUsuariosScreen />;

            case 'control':
                return <CentroControlScreen onNavigate={(screen) => setCurrentScreen(screen as Screen)} />;

            case 'perfil':
                return <PerfilScreen roleName={getRoleName()} onChangeRole={handleChangeRole} />;

            case 'detalle':
                if (!selectedManifiesto) return null;
                const hayViajeActivoEnDetalle = displayManifiestos.some(m => m.estado === 'EN_TRANSITO') || trip.viajeActivo;

                return (
                    <ManifiestoDetail
                        manifiesto={selectedManifiesto}
                        role={role!}
                        hayViajeActivo={hayViajeActivoEnDetalle}
                        onIniciarViaje={handleIniciarViajeConManifiesto}
                        onVerViajeActivo={() => {
                            setActiveManifiestoId((selectedManifiesto._original || selectedManifiesto).id);
                            setCurrentScreen('viaje');
                        }}
                        onFirmar={handleFirmarManifiesto}
                        onRecibir={() => openModalForManifiesto('recepcion')}
                        onRechazar={() => openModalForManifiesto('rechazo')}
                        onTratamiento={() => openModalForManifiesto('tratamiento')}
                        onCerrar={handleCerrarManifiesto}
                        onRevertir={(tipo) => openModalForManifiesto('reversion', tipo)}
                    />
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
                                <span className="tracking-value">{trip.gpsPosition ? 'Activo' : 'Sin senal'}</span>
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
                            </div>
                        )}
                        <div className="list">
                            <h4 style={{ margin: '16px 0 8px', color: 'var(--ind-yellow)' }}>Viajes Activos</h4>
                            {displayManifiestos.filter(m => m.estado === 'EN_TRANSITO').length > 0 ? (
                                displayManifiestos.filter(m => m.estado === 'EN_TRANSITO').map(formatManifiestoForDisplay).map(m => (
                                    <div key={m.id} className="list-item" onClick={() => handleSelectManifiesto(m)}>
                                        <div className="list-icon"><Navigation size={18} /></div>
                                        <div className="list-body">
                                            <div className="list-title">#{m.numero}</div>
                                            <div className="list-sub">{m.generador} → {m.operador}</div>
                                        </div>
                                        <div className="list-badge">{getEstadoBadge(m.estado)}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <MapPin size={32} />
                                    <p>No hay viajes en transito</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'nuevo':
                return (
                    <NuevoManifiestoScreen
                        onBack={() => setCurrentScreen('home')}
                        onSuccess={() => {
                            loadManifiestosFromBackend();
                            setCurrentScreen('manifiestos');
                        }}
                        onToast={showToastMessage}
                    />
                );

            case 'actores':
                return (
                    <ActoresScreen
                        onSelectActor={(actor) => {
                            showToastMessage(`Seleccionado: ${actor.razonSocial}`);
                        }}
                    />
                );

            case 'historial':
                return (
                    <div className="section">
                        <h3>Historial de Viajes</h3>
                        <div className="filter-bar">
                            <select className="form-select compact">
                                <option value="7">Ultimos 7 dias</option>
                                <option value="30">Ultimos 30 dias</option>
                                <option value="90">Ultimos 90 dias</option>
                            </select>
                        </div>
                        <div className="list">
                            {displayManifiestos.filter(m => m.estado === 'TRATADO' || m.estado === 'RECIBIDO').length > 0 ? (
                                displayManifiestos.filter(m => m.estado === 'TRATADO' || m.estado === 'RECIBIDO').map(formatManifiestoForDisplay).map(m => (
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

            case 'historial-viajes':
                return null;

            default:
                return (
                    <div className="screen-not-found">
                        <div className="screen-not-found-icon">?</div>
                        <h2>Pantalla no disponible</h2>
                        <p>La funcion solicitada esta en desarrollo</p>
                        <button className="btn btn-primary" onClick={() => setCurrentScreen('home')}>Volver al inicio</button>
                    </div>
                );
        }
    }

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

            {/* Modal de Recepcion */}
            {showRecepcionModal && manifiestoParaModal && (
                <RecepcionModal
                    isOpen={showRecepcionModal}
                    onClose={() => { setShowRecepcionModal(false); setManifiestoParaModal(null); }}
                    onConfirm={async (data) => {
                        await manifiestoService.confirmarRecepcion(manifiestoParaModal.id, {
                            pesoRecibido: data.pesoReal,
                            observaciones: data.observaciones,
                            firmaRecepcion: data.firma
                        });
                        showToastMessage(`Recepcion confirmada - ${manifiestoParaModal.numero}`);
                        loadManifiestosFromBackend();
                        setCurrentScreen('home');
                    }}
                    manifiesto={manifiestoParaModal}
                />
            )}

            {/* Modal de Rechazo */}
            {showRechazoModal && manifiestoParaModal && (
                <RechazoModal
                    isOpen={showRechazoModal}
                    onClose={() => { setShowRechazoModal(false); setManifiestoParaModal(null); }}
                    onConfirm={async (data) => {
                        await manifiestoService.rechazarCarga(manifiestoParaModal.id, {
                            motivo: data.motivo,
                            descripcion: data.descripcion,
                            cantidadRechazada: data.cantidadRechazada
                        });
                        showToastMessage(`Carga rechazada - ${manifiestoParaModal.numero}`);
                        loadManifiestosFromBackend();
                        setCurrentScreen('home');
                    }}
                    manifiesto={manifiestoParaModal}
                />
            )}

            {/* Modal de Tratamiento */}
            {showTratamientoModal && manifiestoParaModal && (
                <TratamientoModal
                    isOpen={showTratamientoModal}
                    onClose={() => { setShowTratamientoModal(false); setManifiestoParaModal(null); }}
                    onConfirm={async (data) => {
                        await manifiestoService.registrarTratamiento(manifiestoParaModal.id, {
                            metodoTratamiento: data.metodoTratamiento,
                            fechaTratamiento: data.fechaTratamiento,
                            observaciones: data.observaciones
                        });
                        showToastMessage(`Tratamiento registrado - ${manifiestoParaModal.numero}`);
                        loadManifiestosFromBackend();
                        setCurrentScreen('home');
                    }}
                    manifiesto={manifiestoParaModal}
                />
            )}

            {/* Modal de Reversion */}
            {showReversionModal && manifiestoParaModal && (
                <ReversionModal
                    isOpen={showReversionModal}
                    onClose={() => { setShowReversionModal(false); setManifiestoParaModal(null); }}
                    onSuccess={() => {
                        showToastMessage(`Estado revertido correctamente`);
                        loadManifiestosFromBackend();
                        setCurrentScreen('home');
                    }}
                    manifiestoId={manifiestoParaModal.id}
                    manifiestoNumero={manifiestoParaModal.numero}
                    estadoActual={manifiestoParaModal.estado}
                    tipoReversion={reversionType}
                />
            )}

            {/* Modal de Transportista */}
            {showTransportistaModal && manifiestoParaModal && (
                <TransportistaModal
                    isOpen={showTransportistaModal}
                    onClose={() => { setShowTransportistaModal(false); setManifiestoParaModal(null); }}
                    onConfirm={async (data) => {
                        if (data.action === 'retiro') {
                            await manifiestoService.confirmarRetiro(manifiestoParaModal.id, {
                                latitud: data.ubicacion?.lat,
                                longitud: data.ubicacion?.lng,
                                observaciones: data.observaciones,
                                firmaRetiro: data.firma
                            });
                            showToastMessage(`Retiro confirmado - ${manifiestoParaModal.numero}`);
                        } else {
                            await manifiestoService.confirmarEntrega(manifiestoParaModal.id, {
                                latitud: data.ubicacion?.lat,
                                longitud: data.ubicacion?.lng,
                                observaciones: data.observaciones,
                                firmaEntrega: data.firma
                            });
                            showToastMessage(`Entrega confirmada - ${manifiestoParaModal.numero}`);
                        }
                        loadManifiestosFromBackend();
                    }}
                    manifiesto={manifiestoParaModal}
                    action={transportistaModalAction}
                    ubicacionActual={trip.gpsPosition ? { lat: trip.gpsPosition.lat, lng: trip.gpsPosition.lng } : undefined}
                />
            )}

            {/* QR Confirmation Modal */}
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
                            {scannedManifiesto.estado === 'APROBADO' && role === 'TRANSPORTISTA' &&
                             !trip.viajeActivo && !displayManifiestos.some(m => m.estado === 'EN_TRANSITO') && (
                                <button className="btn btn-primary qr-btn-iniciar" onClick={handleIniciarViajeDesdeQR}>
                                    <Navigation size={18} />
                                    INICIAR VIAJE AHORA
                                </button>
                            )}

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

            {/* Loading overlay for QR */}
            {loadingQRManifiesto && (
                <div className="modal-overlay">
                    <div className="loading-spinner">
                        <RefreshCw size={32} className="spin" />
                        <span>Cargando manifiesto...</span>
                    </div>
                </div>
            )}

            {/* Modal de detalle de viaje */}
            {showViajeModal && selectedViaje && (
                <ViajeDetalleModal
                    viaje={selectedViaje}
                    onClose={() => { setShowViajeModal(false); setSelectedViaje(null); }}
                />
            )}

            {/* HistorialViajes - Renderizado a nivel superior */}
            {currentScreen === 'historial-viajes' && (
                <HistorialViajes
                    viajes={trip.savedTrips}
                    onSelectViaje={(viaje) => { setSelectedViaje(viaje); setShowViajeModal(true); }}
                    onBack={() => setCurrentScreen('home')}
                />
            )}

            {/* Header */}
            <header className="app-header">
                {renderHeaderButton()}
                <span className="header-title">{getHeaderTitle()}</span>
                <div className="header-right">
                    <SyncIndicator
                        isOnline={isReallyOnline}
                        isSyncing={syncPending}
                        onManualSync={manualSync}
                        compact={true}
                    />
                    <div className={`conn-indicator ${isOnline ? 'online' : 'offline'}`}>
                        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    </div>
                    <button className="header-btn" onClick={handleChangeRole} title="Cambiar Rol">
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* TripBanner colapsable */}
            {debeBloquearNavegacion && currentScreen !== 'viaje' && (
                <TripBanner
                    isActive={debeBloquearNavegacion}
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
                                    onClick={() => { setMenuOpen(false); handleNavigationWithActiveTrip(item.id); }}
                                >
                                    {item.icon}<span>{item.label}</span>
                                </button>
                            ))}
                            {role === 'ADMIN' && (
                                <>
                                    <button className="menu-link" onClick={() => { setMenuOpen(false); handleNavigationWithActiveTrip('actores'); }}>
                                        <Users size={20} /><span>Actores</span>
                                    </button>
                                    <button className="menu-link" onClick={() => { setMenuOpen(false); handleNavigationWithActiveTrip('historial-viajes'); }}>
                                        <Clock size={20} /><span>Historial Viajes ({trip.savedTrips.length})</span>
                                    </button>
                                </>
                            )}
                            {role === 'TRANSPORTISTA' && (
                                <button className="menu-link" onClick={() => { setMenuOpen(false); handleNavigationWithActiveTrip('historial-viajes'); }}>
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
                            if (handleNavigationWithActiveTrip(item.id)) {
                                analyticsService.trackNavigation(item.id, previousScreen, role || undefined);
                                analyticsService.trackPageView(item.id, role || undefined);
                            }
                        }}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Modal de recuperacion de viaje */}
            {showTripRecoveryModal && pendingRestoreTrip && (
                <TripRecoveryModal
                    savedTrip={pendingRestoreTrip}
                    onResume={handleResumeTrip}
                    onDiscard={handleDiscardTrip}
                />
            )}

            {/* Overlay de viaje activo */}
            {showActiveTripOverlay && debeBloquearNavegacion && (
                <ActiveTripOverlay
                    duration={trip.tiempoViaje}
                    distance={calcularDistanciaViaje()}
                    manifiestoNumero={selectedManifiesto?.numero}
                    isPaused={trip.viajePausado}
                    onGoToTrip={handleGoToTrip}
                    onStayHere={handleStayHere}
                />
            )}

            {/* Push notification prompt */}
            {currentScreen === 'home' && (
                <PushNotificationPrompt
                    autoShowDelay={5000}
                    onAccept={() => console.log('Push notifications activadas')}
                />
            )}
        </div>
    );
};

export default MobileApp;
