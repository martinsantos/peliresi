import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
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
type Screen = 'home' | 'manifiestos' | 'tracking' | 'alertas' | 'perfil' | 'detalle' | 'nuevo' | 'escanear' | 'actores' | 'viaje' | 'historial';

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
    // Cargar rol guardado de localStorage
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
    const [viajeActivo, setViajeActivo] = useState(false);
    const [viajePausado, setViajePausado] = useState(false);
    const [tiempoViaje, setTiempoViaje] = useState(0);
    const [viajeInicio, setViajeInicio] = useState<Date | null>(null);
    const [viajeEventos, setViajeEventos] = useState<Array<{
        tipo: 'INCIDENTE' | 'PARADA' | 'INICIO' | 'FIN' | 'REANUDACION';
        descripcion: string;
        timestamp: string;
        gps: {lat: number, lng: number} | null;
    }>>([]);
    // Route tracking - records GPS position every 5 seconds during trip
    const [viajeRuta, setViajeRuta] = useState<Array<{
        lat: number;
        lng: number;
        timestamp: string;
    }>>([]);
    // Ref for route storage - avoids React closure issues in setInterval
    const viajeRutaRef = useRef<Array<{lat: number; lng: number; timestamp: string}>>([]);
    
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const intervalRef = useRef<number | null>(null);
    
    // Camera and GPS state
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [gpsPosition, setGpsPosition] = useState<{lat: number, lng: number} | null>(null);
    const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
    const [gpsAvailable, setGpsAvailable] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scannedQR, setScannedQR] = useState<string | null>(null);
    const scanningRef = useRef<boolean>(false);
    
    // Incident and Stop modals
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [showParadaModal, setShowParadaModal] = useState(false);
    const [incidentText, setIncidentText] = useState('');
    const [paradaText, setParadaText] = useState('');
    
    // Saved trips history - includes route for map visualization
    const [savedTrips, setSavedTrips] = useState<Array<{
        id: string;
        inicio: string;
        fin: string;
        duracion: number;
        eventos: Array<{tipo: string; descripcion: string; timestamp: string; gps: any}>;
        ruta?: Array<{lat: number; lng: number; timestamp: string}>;
        role: string;
    }>>([]);

    const { isOnline, syncPending } = useConnectivity();
    const { promptInstall, canInstall, isIOS } = usePWAInstall();

    // Guardar rol en localStorage cuando cambia
    useEffect(() => {
        if (role) {
            localStorage.setItem('sitrep_mobile_role', role);
        }
    }, [role]);

    // Auto-detect GPS on component mount
    useEffect(() => {
        if ('geolocation' in navigator) {
            setGpsAvailable(true);
            // Get initial position
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGpsPosition({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    console.log('📍 GPS detectado automáticamente');
                },
                (error) => {
                    console.warn('GPS no accesible:', error.message);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
        
        // Load saved trips from localStorage
        const loadSavedTrips = () => {
            const trips = JSON.parse(localStorage.getItem('sitrep_trips') || '[]');
            setSavedTrips(trips);
            console.log(`📋 ${trips.length} viajes cargados del historial`);
        };
        loadSavedTrips();
    }, []);

    // Timer for active trip (pauses when viajePausado)
    useEffect(() => {
        if (viajeActivo && !viajePausado) {
            intervalRef.current = window.setInterval(() => {
                setTiempoViaje(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [viajeActivo, viajePausado]);


    // GPS Route Tracking - use setInterval for reliable periodic tracking
    const gpsRouteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastRoutePointTime = useRef<number>(0);
    
    useEffect(() => {
        // DEBUG: Log when useEffect fires
        console.log('🔄 GPS useEffect fired - viajeActivo:', viajeActivo, 'viajePausado:', viajePausado);
        
        // Start GPS tracking when trip is active and not paused
        if (viajeActivo && !viajePausado && 'geolocation' in navigator) {
            console.log('🛰️ Iniciando tracking GPS para ruta...');
            
            // Get initial position immediately
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const point = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        timestamp: new Date().toISOString()
                    };
                    setGpsPosition({ lat: point.lat, lng: point.lng });
                    // Store initial point in ref AND state
                    viajeRutaRef.current = [point];
                    setViajeRuta([point]);
                    lastRoutePointTime.current = Date.now();
                    console.log('📍 Punto inicial ruta guardado:', point, 'Ref length:', viajeRutaRef.current.length);
                },
                (err) => console.warn('GPS inicial error:', err.message),
                { enableHighAccuracy: true, timeout: 10000 }
            );
            
            // Use setInterval for reliable periodic tracking every 5 seconds
            gpsRouteIntervalRef.current = setInterval(() => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const point = {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            timestamp: new Date().toISOString()
                        };
                        setGpsPosition({ lat: point.lat, lng: point.lng });
                        
                        // Store point in ref (reliable) AND update state for UI
                        viajeRutaRef.current = [...viajeRutaRef.current, point];
                        setViajeRuta([...viajeRutaRef.current]); // Sync state with ref
                        lastRoutePointTime.current = Date.now();
                        console.log('📍 Ruta actualizada:', point, 'Total puntos:', viajeRutaRef.current.length);
                    },
                    (err) => console.warn('GPS tracking error:', err.message),
                    { enableHighAccuracy: true, timeout: 4000, maximumAge: 2000 }
                );
            }, 30000); // Every 30 seconds
        }
        
        // Cleanup: stop tracking when trip ends or pauses
        return () => {
            if (gpsRouteIntervalRef.current !== null) {
                console.log('🛑 Deteniendo tracking GPS');
                clearInterval(gpsRouteIntervalRef.current);
                gpsRouteIntervalRef.current = null;
            }
        };
    }, [viajeActivo, viajePausado]);




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
        localStorage.removeItem('sitrep_mobile_role');
        // Stop camera and GPS when changing role
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setCameraActive(false);
        if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(gpsWatchId);
            setGpsWatchId(null);
        }
        setGpsPosition(null);
        setRole(null);
        setCurrentScreen('home');
        setMenuOpen(false);
        setViajeActivo(false);
        setTiempoViaje(0);
    };

    // ===== CAMERA FUNCTIONS =====
    const scanQRFromVideo = () => {
        if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });
                
                if (code && code.data) {
                    console.log('✅ QR Code detected:', code.data);
                    scanningRef.current = false;
                    setScannedQR(code.data);
                    stopCamera();
                    
                    // Open the QR URL (should be public verification URL)
                    if (code.data.startsWith('http')) {
                        window.open(code.data, '_blank');
                        showToastMessage('✅ QR escaneado - Abriendo verificación');
                    } else {
                        showToastMessage(`✅ QR: ${code.data}`);
                    }
                    return;
                }
            } catch (err) {
                console.error('Error scanning QR:', err);
            }
        }
        
        if (scanningRef.current) {
            requestAnimationFrame(scanQRFromVideo);
        }
    };

    const startCamera = async () => {
        console.log('🎥 startCamera called');
        setScannedQR(null);
        try {
            console.log('🎥 Requesting camera...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: 640, height: 480 }
            });
            console.log('🎥 Camera stream obtained:', stream);
            setCameraStream(stream);
            setCameraActive(true);
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    scanningRef.current = true;
                    requestAnimationFrame(scanQRFromVideo);
                };
                console.log('🎥 Video element connected, QR scanning started');
            }
            showToastMessage('📷 Cámara activada - Escaneando QR...');
        } catch (err: any) {
            console.error('❌ Camera error:', err);
            showToastMessage('❌ No se pudo acceder a la cámara: ' + (err.message || 'Permiso denegado'));
        }
    };

    const stopCamera = () => {
        scanningRef.current = false;
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setCameraActive(false);
    };

    // ===== GPS FUNCTIONS =====
    // GPS tracking is now handled by useEffect with watchPosition when trip is active


    const stopGPS = () => {
        if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(gpsWatchId);
            setGpsWatchId(null);
        }
        setGpsPosition(null);
    };

    const handleIniciarViaje = () => {
        const inicio = new Date();
        
        // Start trip state immediately (optimistic UI)
        setViajeActivo(true);
        setViajePausado(false);
        setViajeInicio(inicio);
        viajeRutaRef.current = []; // Reset ref for new trip
        setViajeRuta([]); // Reset route for new trip
        setTiempoViaje(0);
        setCurrentScreen('viaje');
        
        // Get fresh GPS for INICIO event
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setGpsPosition(gps);
                
                const inicioEvento = {
                    tipo: 'INICIO' as const,
                    descripcion: 'Viaje iniciado',
                    timestamp: inicio.toISOString(),
                    gps: gps
                };
                setViajeEventos([inicioEvento]);
                console.log('🚀 Viaje iniciado con GPS:', gps);
                showToastMessage('🚛 Viaje iniciado - GPS activo');
            },
            (error) => {
                // If GPS fails, still record the event without location
                console.warn('GPS al iniciar:', error.message);
                const inicioEvento = {
                    tipo: 'INICIO' as const,
                    descripcion: 'Viaje iniciado (sin GPS)',
                    timestamp: inicio.toISOString(),
                    gps: null
                };
                setViajeEventos([inicioEvento]);
                showToastMessage('🚛 Viaje iniciado - GPS no disponible');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
        
        analyticsService.trackAction('iniciar_viaje', 'viaje', role || undefined);
    };

    const handleFinalizarViaje = () => {
        const finEvento = {
            tipo: 'FIN' as const,
            descripcion: 'Viaje finalizado',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        
        const eventosFinales = [...viajeEventos, finEvento];
        
        // Save trip to localStorage with route for map visualization
        // Use ref.current for ruta as it's more reliable than state in async contexts
        const rutaFinal = viajeRutaRef.current.length > 0 ? viajeRutaRef.current : viajeRuta;
        const tripData = {
            id: Date.now().toString(),
            inicio: viajeInicio?.toISOString(),
            fin: finEvento.timestamp,
            duracion: tiempoViaje,
            eventos: eventosFinales,
            ruta: rutaFinal, // Include GPS route for map (from ref)
            role: role
        };
        
        const existingTrips = JSON.parse(localStorage.getItem('sitrep_trips') || '[]');
        existingTrips.push(tripData);
        localStorage.setItem('sitrep_trips', JSON.stringify(existingTrips));
        console.log('💾 Viaje guardado con ruta:', tripData);
        
        // Update state to reflect new saved trip
        setSavedTrips(existingTrips);
        
        setViajeActivo(false);
        setViajePausado(false);
        setTiempoViaje(0);
        setViajeEventos([]);
        viajeRutaRef.current = []; // Clear ref
        setViajeRuta([]);
        setViajeInicio(null);
        stopGPS();
        setCurrentScreen('home');
        
        showToastMessage(`✅ Viaje guardado - ${eventosFinales.length} eventos, ${viajeRuta.length} puntos GPS`);
        analyticsService.trackAction('finalizar_viaje', 'viaje', role || undefined, tripData);
    };

    // ===== INCIDENT & PARADA HANDLERS =====
    const handleOpenIncidentModal = () => {
        setIncidentText('');
        setShowIncidentModal(true);
    };

    const handleConfirmIncident = () => {
        if (!incidentText.trim()) {
            showToastMessage('⚠️ Describa el incidente');
            return;
        }
        
        const incidentEvento = {
            tipo: 'INCIDENTE' as const,
            descripcion: incidentText,
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        
        setViajeEventos(prev => [...prev, incidentEvento]);
        
        console.log('📝 Incidente registrado:', incidentEvento);
        showToastMessage('⚠️ INCIDENTE REGISTRADO - ' + incidentText.substring(0, 30));
        analyticsService.trackAction('registrar_incidente', 'viaje', role || undefined, incidentEvento);
        setShowIncidentModal(false);
        setIncidentText('');
    };

    const handleOpenParadaModal = () => {
        setParadaText('');
        setShowParadaModal(true);
    };

    const handleConfirmParada = () => {
        const paradaEvento = {
            tipo: 'PARADA' as const,
            descripcion: paradaText || 'Parada programada',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        
        setViajeEventos(prev => [...prev, paradaEvento]);
        setViajePausado(true);
        
        console.log('📝 Parada registrada:', paradaEvento);
        showToastMessage('⏸️ VIAJE EN PAUSA - ' + (paradaText || 'Parada registrada'));
        analyticsService.trackAction('registrar_parada', 'viaje', role || undefined, paradaEvento);
        setShowParadaModal(false);
        setParadaText('');
    };

    const handleReanudarViaje = () => {
        const reanudacionEvento = {
            tipo: 'REANUDACION' as const,
            descripcion: 'Viaje reanudado',
            timestamp: new Date().toISOString(),
            gps: gpsPosition
        };
        
        setViajeEventos(prev => [...prev, reanudacionEvento]);
        setViajePausado(false);
        
        showToastMessage('▶️ VIAJE REANUDADO');
        analyticsService.trackAction('reanudar_viaje', 'viaje', role || undefined, reanudacionEvento);
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
                                        <button 
                                            className="action-card"
                                            onClick={() => {
                                                const trips = JSON.parse(localStorage.getItem('sitrep_trips') || '[]');
                                                setSavedTrips(trips);
                                                setCurrentScreen('historial');
                                            }}
                                        >
                                            <FileText size={24} />
                                            <span>Historial</span>
                                            {savedTrips.length > 0 && (
                                                <span style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    background: '#ef4444',
                                                    color: 'white',
                                                    borderRadius: '50%',
                                                    width: '20px',
                                                    height: '20px',
                                                    fontSize: '11px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>{savedTrips.length}</span>
                                            )}
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
                                {/* Pause indicator */}
                                {viajePausado && (
                                    <div style={{
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            ⏸️ VIAJE EN PAUSA
                                        </span>
                                        <button 
                                            className="btn-primary" 
                                            onClick={handleReanudarViaje}
                                            style={{ padding: '8px 16px', fontSize: '14px' }}
                                        >
                                            <Play size={16} />
                                            Reanudar
                                        </button>
                                    </div>
                                )}

                                {/* GPS Status */}
                                <div className="viaje-map-placeholder">
                                    <MapPinned size={40} />
                                    <span>
                                        {gpsPosition ? '📍 GPS Activo' : 
                                         gpsAvailable ? '⏳ Obteniendo GPS...' : '❌ GPS No Disponible'}
                                    </span>
                                    <small>
                                        {gpsPosition 
                                            ? `Lat: ${gpsPosition.lat.toFixed(6)}, Lng: ${gpsPosition.lng.toFixed(6)}`
                                            : 'Esperando señal GPS...'}
                                    </small>
                                </div>

                                {/* Events counter */}
                                {viajeEventos.length > 1 && (
                                    <div style={{
                                        background: 'rgba(59, 130, 246, 0.2)',
                                        border: '1px solid rgba(59, 130, 246, 0.4)',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        marginTop: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span style={{ color: '#93c5fd', fontSize: '14px' }}>
                                            📋 Eventos registrados: {viajeEventos.length}
                                        </span>
                                        <span style={{ 
                                            fontSize: '12px', 
                                            color: '#64748b',
                                            display: 'flex',
                                            gap: '8px'
                                        }}>
                                            {viajeEventos.filter(e => e.tipo === 'INCIDENTE').length > 0 && (
                                                <span style={{ color: '#f87171' }}>
                                                    ⚠️ {viajeEventos.filter(e => e.tipo === 'INCIDENTE').length}
                                                </span>
                                            )}
                                            {viajeEventos.filter(e => e.tipo === 'PARADA').length > 0 && (
                                                <span style={{ color: '#fbbf24' }}>
                                                    ⏸️ {viajeEventos.filter(e => e.tipo === 'PARADA').length}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                )}

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
                                    <button className="btn-warning full" onClick={handleOpenIncidentModal}>
                                        <AlertTriangle size={18} />
                                        Registrar Incidente
                                    </button>
                                    {!viajePausado ? (
                                        <button className="btn-secondary full" onClick={handleOpenParadaModal}>
                                            <Clock size={18} />
                                            Registrar Parada
                                        </button>
                                    ) : (
                                        <button className="btn-primary full" onClick={handleReanudarViaje}>
                                            <Play size={18} />
                                            Reanudar Viaje
                                        </button>
                                    )}
                                    <button className="btn-primary full" onClick={handleFinalizarViaje}>
                                        <CheckCircle size={18} />
                                        Confirmar Entrega
                                    </button>
                                </div>
                            </>
                        )}

                        {!viajeActivo && (
                            <>
                                <button className="btn-primary full" onClick={handleIniciarViaje}>
                                    <Play size={18} />
                                    Iniciar Nuevo Viaje
                                </button>
                                <button 
                                    className="btn-secondary full" 
                                    style={{ marginTop: '12px' }}
                                    onClick={() => {
                                        // Refresh saved trips before showing
                                        const trips = JSON.parse(localStorage.getItem('sitrep_trips') || '[]');
                                        setSavedTrips(trips);
                                        setCurrentScreen('historial');
                                    }}
                                >
                                    <FileText size={18} />
                                    Ver Historial ({savedTrips.length} viajes)
                                </button>
                            </>
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

            case 'historial':
                return (
                    <div className="scroll-content">
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '18px' }}>Historial de Viajes</h2>
                            <span style={{ 
                                background: 'rgba(59, 130, 246, 0.2)', 
                                padding: '6px 12px', 
                                borderRadius: '20px',
                                fontSize: '12px',
                                color: '#93c5fd'
                            }}>
                                {savedTrips.length} viajes
                            </span>
                        </div>

                        {savedTrips.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px 20px',
                                color: '#94a3b8'
                            }}>
                                <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <p>No hay viajes registrados</p>
                                <small>Los viajes completados aparecerán aquí</small>
                            </div>
                        ) : (
                            <div className="list">
                                {savedTrips.slice().reverse().map((trip, index) => (
                                    <div key={trip.id} className="list-item" style={{ 
                                        padding: '16px',
                                        marginBottom: '12px'
                                    }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between',
                                            marginBottom: '12px'
                                        }}>
                                            <div>
                                                <span style={{ 
                                                    fontSize: '12px', 
                                                    color: '#94a3b8',
                                                    display: 'block'
                                                }}>
                                                    {new Date(trip.inicio).toLocaleDateString('es-AR', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                                <span style={{ fontWeight: 600 }}>
                                                    Viaje #{savedTrips.length - index}
                                                </span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ 
                                                    fontSize: '18px', 
                                                    fontWeight: 600,
                                                    color: '#10b981'
                                                }}>
                                                    {Math.floor(trip.duracion / 60)}:{(trip.duracion % 60).toString().padStart(2, '0')}
                                                </span>
                                                <span style={{ 
                                                    fontSize: '12px', 
                                                    color: '#94a3b8',
                                                    display: 'block'
                                                }}>
                                                    min
                                                </span>
                                            </div>
                                        </div>

                                        {/* Events summary */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '8px',
                                            flexWrap: 'wrap',
                                            marginBottom: '12px'
                                        }}>
                                            {trip.eventos.filter(e => e.tipo === 'INCIDENTE').length > 0 && (
                                                <span style={{
                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                    color: '#f87171',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    ⚠️ {trip.eventos.filter(e => e.tipo === 'INCIDENTE').length} Incidentes
                                                </span>
                                            )}
                                            {trip.eventos.filter(e => e.tipo === 'PARADA').length > 0 && (
                                                <span style={{
                                                    background: 'rgba(245, 158, 11, 0.2)',
                                                    color: '#fbbf24',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    ⏸️ {trip.eventos.filter(e => e.tipo === 'PARADA').length} Paradas
                                                </span>
                                            )}
                                            <span style={{
                                                background: 'rgba(16, 185, 129, 0.2)',
                                                color: '#34d399',
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                ✅ Completado
                                            </span>
                                        </div>

                                        {/* Events detail */}
                                        <details style={{ marginTop: '8px' }}>
                                            <summary style={{ 
                                                cursor: 'pointer', 
                                                color: '#64748b',
                                                fontSize: '12px'
                                            }}>
                                                Ver {trip.eventos.length} eventos
                                            </summary>
                                            <div style={{ 
                                                marginTop: '12px',
                                                borderLeft: '2px solid #334155',
                                                paddingLeft: '12px'
                                            }}>
                                                {trip.eventos.map((evento, eIdx) => (
                                                    <div key={eIdx} style={{
                                                        padding: '8px 0',
                                                        borderBottom: eIdx < trip.eventos.length - 1 ? '1px solid #1e293b' : 'none'
                                                    }}>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <span style={{
                                                                fontSize: '14px'
                                                            }}>
                                                                {evento.tipo === 'INICIO' ? '🚀' :
                                                                 evento.tipo === 'FIN' ? '🏁' :
                                                                 evento.tipo === 'INCIDENTE' ? '⚠️' :
                                                                 evento.tipo === 'PARADA' ? '⏸️' :
                                                                 evento.tipo === 'REANUDACION' ? '▶️' : '📍'}
                                                            </span>
                                                            <span style={{ fontSize: '13px' }}>
                                                                {evento.descripcion}
                                                            </span>
                                                        </div>
                                                        <div style={{ 
                                                            fontSize: '11px', 
                                                            color: '#64748b',
                                                            marginTop: '4px',
                                                            marginLeft: '22px'
                                                        }}>
                                                            {new Date(evento.timestamp).toLocaleTimeString('es-AR')}
                                                            {evento.gps && ` | 📍 ${evento.gps.lat.toFixed(4)}, ${evento.gps.lng.toFixed(4)}`}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>

                                        {/* Route Map Visualization */}
                                        {trip.ruta && trip.ruta.length > 0 && (
                                            <details style={{ marginTop: '12px' }}>
                                                <summary style={{ 
                                                    cursor: 'pointer', 
                                                    color: '#3b82f6',
                                                    fontSize: '12px',
                                                    fontWeight: 500
                                                }}>
                                                    🗺️ Ver mapa del recorrido ({trip.ruta.length} puntos GPS)
                                                </summary>
                                                <div style={{ 
                                                    marginTop: '12px',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    border: '1px solid #334155'
                                                }}>
                                                    {/* Static map showing route */}
                                                    <div style={{
                                                        height: '200px',
                                                        background: '#1e293b',
                                                        position: 'relative'
                                                    }}>
                                                        <iframe
                                                            title={`Mapa Viaje ${savedTrips.length - index}`}
                                                            style={{ width: '100%', height: '100%', border: 0 }}
                                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                                                                Math.min(...trip.ruta.map(p => p.lng)) - 0.01
                                                            }%2C${
                                                                Math.min(...trip.ruta.map(p => p.lat)) - 0.01
                                                            }%2C${
                                                                Math.max(...trip.ruta.map(p => p.lng)) + 0.01
                                                            }%2C${
                                                                Math.max(...trip.ruta.map(p => p.lat)) + 0.01
                                                            }&layer=mapnik&marker=${
                                                                trip.ruta[0].lat
                                                            }%2C${
                                                                trip.ruta[0].lng
                                                            }`}
                                                        />
                                                    </div>
                                                    {/* Route points legend */}
                                                    <div style={{
                                                        padding: '10px',
                                                        background: 'rgba(30, 41, 59, 0.9)',
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        gap: '12px',
                                                        fontSize: '11px'
                                                    }}>
                                                        <span style={{ color: '#22c55e' }}>
                                                            🟢 Inicio: {trip.ruta[0].lat.toFixed(4)}, {trip.ruta[0].lng.toFixed(4)}
                                                        </span>
                                                        <span style={{ color: '#ef4444' }}>
                                                            🔴 Fin: {trip.ruta[trip.ruta.length - 1].lat.toFixed(4)}, {trip.ruta[trip.ruta.length - 1].lng.toFixed(4)}
                                                        </span>
                                                        {trip.eventos.filter(e => e.tipo === 'INCIDENTE' && e.gps).map((e, i) => (
                                                            <span key={i} style={{ color: '#fbbf24' }}>
                                                                ⚠️ Incidente: {e.gps.lat.toFixed(4)}, {e.gps.lng.toFixed(4)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
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
                                {cameraActive ? (
                                    <>
                                        <video 
                                            ref={videoRef} 
                                            autoPlay 
                                            playsInline 
                                            muted
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                borderRadius: '12px'
                                            }}
                                        />
                                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    </>
                                ) : scannedQR ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <CheckCircle size={48} color="#22c55e" />
                                        <p style={{ marginTop: '10px', fontWeight: 'bold' }}>QR Escaneado</p>
                                        <p style={{ fontSize: '12px', wordBreak: 'break-all' }}>{scannedQR}</p>
                                    </div>
                                ) : (
                                    <QrCode size={70} strokeWidth={1.5} color="#64748b" />
                                )}
                            </div>
                            {!cameraActive && !scannedQR && <div className="qr-laser"></div>}
                        </div>
                        <p className="hint-text">
                            {cameraActive ? 'Apunta al código QR del manifiesto' : 'Escanea el código QR del manifiesto'}
                        </p>
                        <button className="btn-primary" onClick={cameraActive ? stopCamera : startCamera}>
                            <Camera size={18} />
                            {cameraActive ? 'Detener Cámara' : 'Activar Cámara'}
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

            {/* Incident Modal */}
            {showIncidentModal && (
                <div className="menu-overlay" onClick={() => setShowIncidentModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'linear-gradient(180deg, #1e293b, #0f172a)',
                        padding: '24px',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '400px',
                        zIndex: 10001,
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ color: '#f87171', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={24} />
                            Registrar Incidente
                        </h3>
                        <textarea
                            value={incidentText}
                            onChange={(e) => setIncidentText(e.target.value)}
                            placeholder="Describa el incidente..."
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(0,0,0,0.3)',
                                color: '#fff',
                                fontSize: '14px',
                                resize: 'vertical'
                            }}
                        />
                        {gpsPosition && (
                            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>
                                📍 {gpsPosition.lat.toFixed(6)}, {gpsPosition.lng.toFixed(6)}
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowIncidentModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn-warning" style={{ flex: 1 }} onClick={handleConfirmIncident}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Parada Modal */}
            {showParadaModal && (
                <div className="menu-overlay" onClick={() => setShowParadaModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'linear-gradient(180deg, #1e293b, #0f172a)',
                        padding: '24px',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '400px',
                        zIndex: 10001,
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ color: '#94a3b8', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={24} />
                            Registrar Parada
                        </h3>
                        <textarea
                            value={paradaText}
                            onChange={(e) => setParadaText(e.target.value)}
                            placeholder="Motivo de la parada (opcional)..."
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(0,0,0,0.3)',
                                color: '#fff',
                                fontSize: '14px',
                                resize: 'vertical'
                            }}
                        />
                        {gpsPosition && (
                            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>
                                📍 {gpsPosition.lat.toFixed(6)}, {gpsPosition.lng.toFixed(6)}
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowParadaModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={handleConfirmParada}>
                                Confirmar
                            </button>
                        </div>
                    </div>
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
