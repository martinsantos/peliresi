/**
 * CentroControl.tsx - MEGA Dashboard para Monitor Grande
 * Dashboard premium con métricas en vivo, mapa animado y efectos visuales impactantes
 * Control Room 2077 Design System
 *
 * Refactored: Components extracted to src/components/centro-control/
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Activity, FileText, Truck, AlertTriangle,
    CheckCircle, Clock, MapPin, RefreshCw,
    ChevronRight, Package, Radio,
    Factory, Building2, BarChart3,
    Wifi, WifiOff, ArrowRightLeft, Navigation,
    Trophy, TrendingUp, Recycle, Phone, Gauge, User, Pause, Users, Bell
} from 'lucide-react';
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { usuarioService } from '../services/admin.service';
import type { Actividad } from '../services/admin.service';
import { alertaService } from '../services/alerta.service';
import { manifiestoService } from '../services/manifiesto.service';
import { viajesService } from '../services/viajes.service';
import { useWebSocket, WS_EVENTS } from '../hooks/useWebSocket';
import './CentroControl.css';

// Import extracted components
import {
    LiveClock,
    ViajeTimer,
    KPICards,
    MendozaMapSVG,
    truckIcon,
    truckPausedIcon,
    truckIncidentIcon,
    generadorIcon,
    operadorIcon,
    DEPT_COLORS,
    DEPT_CODES,
    generateActivityChartData,
    generatePipelineChartData,
    formatRelativeTime,
} from '../components/centro-control';
import type {
    ViajeActivo,
    ManifiestoEnTransito,
    SystemStats,
    DepartamentoStats,
    FiltroTiempo,
} from '../components/centro-control';

// Component to invalidate map size when container changes
const MapResizer: React.FC = () => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);
    return null;
};

const CentroControl: React.FC = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [enTransito, setEnTransito] = useState<ManifiestoEnTransito[]>([]);
    const [viajesActivos, setViajesActivos] = useState<ViajeActivo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const activityRef = useRef<HTMLDivElement>(null);

    // Estado para departamentos (datos reales de API)
    const [departamentos, setDepartamentos] = useState<DepartamentoStats[]>([]);

    // Estado para filtro de tiempo
    const [filtroTiempo, setFiltroTiempo] = useState<FiltroTiempo>('mes');

    // Estado para tendencia real (viene del API)
    const [tendencia, setTendencia] = useState<{ manifiestos: number; residuos: number }>({ manifiestos: 0, residuos: 0 });

    // WebSocket para actualizaciones en tiempo real
    const { on, subscribeToManifiesto } = useWebSocket();

    // Total de residuos tratados (calculado de datos reales) - MEMOIZADO
    const totalTratados = useMemo(() =>
        departamentos.reduce((sum, d) => sum + d.tratados, 0), [departamentos]);
    const maxTratados = useMemo(() =>
        Math.max(...departamentos.map(d => d.tratados), 1), [departamentos]);

    // Contadores de viajes por estado - MEMOIZADO para evitar recálculos en render
    const viajesEnRuta = useMemo(() =>
        viajesActivos.filter(v => !v.isPaused && v.estado !== 'INCIDENTE').length, [viajesActivos]);
    const viajesPausados = useMemo(() =>
        viajesActivos.filter(v => v.isPaused || v.estado === 'PAUSADO').length, [viajesActivos]);
    const viajesIncidentes = useMemo(() =>
        viajesActivos.filter(v => v.estado === 'INCIDENTE').length, [viajesActivos]);

    // Simular manifiestos en tránsito con ubicaciones de Mendoza
    const simulateEnTransito = useCallback(() => {
        const baseLocations = [
            { lat: -32.8908, lng: -68.8272, gen: 'Química Mendoza SA', op: 'Planta Tratamiento Norte' },
            { lat: -32.9500, lng: -68.8500, gen: 'Industrias Cuyo', op: 'Operador Residuos Sur' },
            { lat: -33.0000, lng: -68.7800, gen: 'Metalúrgica Andes', op: 'Centro Ambiental Este' },
            { lat: -32.8500, lng: -68.9000, gen: 'Petroquímica Oeste', op: 'Planta Reciclaje Central' },
            { lat: -32.9200, lng: -68.7500, gen: 'Laboratorios Bio', op: 'Destino Final Seguro' }
        ];

        return baseLocations.map((loc, i) => ({
            id: `transit-${i}`,
            numero: `MAN-2025-${1000 + i}`,
            lat: loc.lat + (Math.random() - 0.5) * 0.05,
            lng: loc.lng + (Math.random() - 0.5) * 0.05,
            generador: loc.gen,
            operador: loc.op,
            estado: 'EN_TRANSITO',
            tiempoEnRuta: `${Math.floor(Math.random() * 4) + 1}h ${Math.floor(Math.random() * 60)}m`
        }));
    }, []);

    // Cargar viajes activos desde el backend
    const loadViajesActivos = useCallback(async () => {
        try {
            // Obtener manifiestos EN_TRANSITO
            const response = await manifiestoService.getManifiestos({
                estado: 'EN_TRANSITO',
                limit: 20
            });
            const manifiestos = response.manifiestos || [];

            // Para cada manifiesto, obtener estado del viaje
            const viajesPromises = manifiestos.map(async (m: any) => {
                try {
                    const viaje = await viajesService.getViajeEnCurso(m.id);
                    if (viaje) {
                        return {
                            id: viaje.id,
                            manifiestoId: m.id,
                            manifiestoNumero: m.numero,
                            transportistaRazonSocial: m.transportista?.razonSocial || 'Transportista',
                            estado: viaje.estado as 'EN_CURSO' | 'PAUSADO' | 'INCIDENTE',
                            elapsedSeconds: viaje.elapsedSeconds,
                            ultimaUbicacion: viaje.ultimaUbicacion,
                            isPaused: viaje.isPaused
                        };
                    }
                } catch (err) {
                    console.warn(`Error cargando viaje para manifiesto ${m.id}:`, err);
                }
                return null;
            });

            const viajes = (await Promise.all(viajesPromises)).filter(Boolean) as ViajeActivo[];
            setViajesActivos(viajes);

            // También actualizar enTransito con ubicaciones reales + origen/destino + info completa
            const enTransitoConUbicaciones = manifiestos.map((m: any, i: number) => {
                const viaje = viajes.find(v => v.manifiestoId === m.id);
                return {
                    id: m.id,
                    numero: m.numero,
                    lat: viaje?.ultimaUbicacion?.lat || (-32.8908 + (Math.random() - 0.5) * 0.1),
                    lng: viaje?.ultimaUbicacion?.lng || (-68.8272 + (Math.random() - 0.5) * 0.1),
                    generador: m.generador?.razonSocial || 'Generador',
                    operador: m.operador?.razonSocial || 'Operador',
                    estado: viaje?.estado || 'EN_TRANSITO',
                    tiempoEnRuta: viaje ? `${Math.floor(viaje.elapsedSeconds / 3600)}h ${Math.floor((viaje.elapsedSeconds % 3600) / 60)}m` : `${i + 1}h`,
                    // Coordenadas de origen (Generador) y destino (Operador)
                    origenLat: m.generador?.latitud || undefined,
                    origenLng: m.generador?.longitud || undefined,
                    destinoLat: m.operador?.latitud || undefined,
                    destinoLng: m.operador?.longitud || undefined,
                    // Info adicional para popups expandidos
                    generadorDomicilio: m.generador?.domicilio || undefined,
                    generadorTelefono: m.generador?.telefono || undefined,
                    operadorDomicilio: m.operador?.domicilio || undefined,
                    operadorTelefono: m.operador?.telefono || undefined,
                    transportista: m.transportista?.razonSocial || undefined,
                    vehiculoPatente: m.vehiculo?.patente || undefined,
                    chofer: m.chofer ? `${m.chofer.nombre} ${m.chofer.apellido || ''}`.trim() : undefined,
                    velocidad: Math.floor(30 + Math.random() * 40),
                };
            });
            setEnTransito(enTransitoConUbicaciones);

            console.log('[CentroControl] Viajes activos cargados:', viajes.length);
        } catch (err) {
            console.error('Error cargando viajes activos:', err);
            // Fallback a simulación si hay error
            setEnTransito(simulateEnTransito());
        }
    }, [simulateEnTransito]);

    // Calcular fechas según filtro de tiempo
    const calcularFechasFiltro = useCallback(() => {
        const hasta = new Date();
        const desde = new Date();

        switch (filtroTiempo) {
            case 'hoy':
                desde.setHours(0, 0, 0, 0);
                break;
            case 'semana':
                desde.setDate(desde.getDate() - 7);
                break;
            case 'mes':
                desde.setMonth(desde.getMonth() - 1);
                break;
            case 'trimestre':
                desde.setMonth(desde.getMonth() - 3);
                break;
        }

        return {
            desde: desde.toISOString().split('T')[0],
            hasta: hasta.toISOString().split('T')[0]
        };
    }, [filtroTiempo]);

    const loadData = useCallback(async () => {
        try {
            const fechas = calcularFechasFiltro();

            const [statsData, actividadData, advertenciasData, tiemposData, vencimientosData, deptData, histData] = await Promise.all([
                usuarioService.getEstadisticas(),
                usuarioService.getActividad({ limit: 30 }),
                alertaService.getAdvertenciasActivas(),
                alertaService.evaluarTiemposExcesivos(),
                alertaService.evaluarVencimientos(),
                usuarioService.getEstadisticasDepartamento(),
                usuarioService.getEstadisticasHistoricas({
                    desde: fechas.desde,
                    hasta: fechas.hasta,
                    agrupacion: filtroTiempo === 'hoy' ? 'dia' : filtroTiempo === 'semana' ? 'dia' : 'semana'
                })
            ]);

            const todasLasAlertas = [...advertenciasData, ...tiemposData, ...vencimientosData];

            const combinedStats: SystemStats = {
                manifiestos: {
                    total: statsData.manifiestos.total,
                    borradores: statsData.manifiestos.porEstado['BORRADOR'] || 0,
                    aprobados: statsData.manifiestos.porEstado['APROBADO'] || 0,
                    enTransito: statsData.manifiestos.porEstado['EN_TRANSITO'] || 0,
                    entregados: statsData.manifiestos.porEstado['ENTREGADO'] || 0,
                    recibidos: statsData.manifiestos.porEstado['RECIBIDO'] || 0,
                    tratados: statsData.manifiestos.porEstado['TRATADO'] || 0
                },
                usuarios: statsData.usuarios,
                alertasActivas: todasLasAlertas.length,
                eventosHoy: actividadData.stats.eventosHoy
            };

            setStats(combinedStats);
            setActividades(actividadData.actividades);

            // Cargar departamentos con datos reales
            if (deptData.departamentos && deptData.departamentos.length > 0) {
                const deptStats: DepartamentoStats[] = deptData.departamentos
                    .map((d: any) => ({
                        nombre: d.nombre,
                        codigo: DEPT_CODES[d.nombre] || d.nombre.substring(0, 2).toUpperCase(),
                        tratados: Math.round(d.residuosTratados || 0),
                        enProceso: d.enProceso || 0,
                        color: DEPT_COLORS[d.nombre] || '#6366f1'
                    }))
                    .sort((a: DepartamentoStats, b: DepartamentoStats) => b.tratados - a.tratados);
                setDepartamentos(deptStats);
            }

            // Cargar tendencia real
            if (histData.tendencia) {
                setTendencia(histData.tendencia);
            }

            // Cargar viajes activos reales
            await loadViajesActivos();

            setLastUpdate(new Date());
        } catch (err) {
            console.error('Error loading control center data:', err);
        } finally {
            setLoading(false);
        }
    }, [loadViajesActivos, calcularFechasFiltro, filtroTiempo]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [loadData]);

    // WebSocket: Suscribirse a manifiestos en tránsito para actualizaciones en tiempo real
    useEffect(() => {
        if (enTransito.length === 0) return;

        // Suscribirse a cada manifiesto en tránsito
        enTransito.forEach(m => subscribeToManifiesto(m.id));

        // Escuchar eventos de pausa
        const unsubPausado = on(WS_EVENTS.VIAJE_PAUSADO, (data: any) => {
            console.log('[CentroControl] WebSocket: VIAJE_PAUSADO', data);
            setViajesActivos(prev => prev.map(v =>
                v.manifiestoId === data.manifiestoId
                    ? { ...v, isPaused: true, estado: 'PAUSADO' as const }
                    : v
            ));
            setEnTransito(prev => prev.map(m =>
                m.id === data.manifiestoId
                    ? { ...m, estado: 'PAUSADO' }
                    : m
            ));
        });

        // Escuchar eventos de reanudación
        const unsubReanudado = on(WS_EVENTS.VIAJE_REANUDADO, (data: any) => {
            console.log('[CentroControl] WebSocket: VIAJE_REANUDADO', data);
            setViajesActivos(prev => prev.map(v =>
                v.manifiestoId === data.manifiestoId
                    ? { ...v, isPaused: false, estado: 'EN_CURSO' as const }
                    : v
            ));
            setEnTransito(prev => prev.map(m =>
                m.id === data.manifiestoId
                    ? { ...m, estado: 'EN_TRANSITO' }
                    : m
            ));
        });

        // Escuchar eventos de incidente
        const unsubIncidente = on(WS_EVENTS.VIAJE_INCIDENTE, (data: any) => {
            console.log('[CentroControl] WebSocket: VIAJE_INCIDENTE', data);
            setViajesActivos(prev => prev.map(v =>
                v.manifiestoId === data.manifiestoId
                    ? { ...v, estado: 'INCIDENTE' as const }
                    : v
            ));
            setEnTransito(prev => prev.map(m =>
                m.id === data.manifiestoId
                    ? { ...m, estado: 'INCIDENTE' }
                    : m
            ));
        });

        // Escuchar actualizaciones GPS
        const unsubGps = on(WS_EVENTS.GPS_UPDATE, (data: any) => {
            if (data.lat && data.lng) {
                setEnTransito(prev => prev.map(m =>
                    m.id === data.manifiestoId
                        ? { ...m, lat: data.lat, lng: data.lng }
                        : m
                ));
            }
        });

        return () => {
            unsubPausado();
            unsubReanudado();
            unsubIncidente();
            unsubGps();
        };
    }, [enTransito.length, on, subscribeToManifiesto]);

    // Online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Auto-scroll actividad
    useEffect(() => {
        if (activityRef.current && actividades.length > 0) {
            activityRef.current.scrollTop = 0;
        }
    }, [actividades]);

    const getActionIcon = (accion: string) => {
        if (accion.includes('CREAR') || accion.includes('NUEVO')) return <FileText size={14} />;
        if (accion.includes('APROBAR')) return <CheckCircle size={14} />;
        if (accion.includes('RETIRO') || accion.includes('TRANSITO')) return <Truck size={14} />;
        if (accion.includes('ENTREGA')) return <MapPin size={14} />;
        if (accion.includes('RECEP')) return <Package size={14} />;
        if (accion.includes('TRAT')) return <CheckCircle size={14} />;
        return <Activity size={14} />;
    };

    if (loading) {
        return (
            <div className="mega-loading">
                <div className="mega-loader">
                    <div className="loader-ring"></div>
                    <div className="loader-ring"></div>
                    <div className="loader-ring"></div>
                </div>
                <p>Inicializando Centro de Control...</p>
            </div>
        );
    }

    return (
        <div className="mega-dashboard">
            {/* MEGA Header */}
            <header className="mega-header">
                <div className="mega-logo">
                    <div className="logo-pulse"></div>
                    <Radio className="logo-icon" size={28} />
                    <div className="logo-text">
                        <span className="logo-title">SITREP</span>
                        <span className="logo-subtitle">LIVE</span>
                    </div>
                </div>

                <LiveClock />

                <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
                    {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                    <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                    <div className="status-dot"></div>
                </div>
            </header>

            {/* KPIs - Professional Style */}
            {stats && <KPICards stats={stats} tendencia={tendencia} />}

            {/* Main Content Grid */}
            <div className="mega-grid">
                {/* MAPA EN TIEMPO REAL */}
                <div className="mega-panel map-panel">
                    <div className="panel-header">
                        <h3><Navigation size={18} /> Tracking en Tiempo Real</h3>
                        <span className="tracking-count">{enTransito.length} vehículos activos</span>
                    </div>
                    <div className="map-container">
                        <MapContainer
                            center={[-32.8908, -68.8272]}
                            zoom={11}
                            className="mega-map"
                            zoomControl={false}
                            style={{ height: '390px', width: '100%' }}
                        >
                            <MapResizer />
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                            {enTransito.map(m => (
                                <React.Fragment key={m.id}>
                                    {/* Línea punteada: Origen → Transporte (verde) */}
                                    {m.origenLat && m.origenLng && (
                                        <Polyline
                                            positions={[[m.origenLat, m.origenLng], [m.lat, m.lng]]}
                                            pathOptions={{
                                                color: '#059669',
                                                weight: 2,
                                                opacity: 0.6,
                                                dashArray: '8, 8'
                                            }}
                                        />
                                    )}
                                    {/* Línea punteada: Transporte → Destino (roja) */}
                                    {m.destinoLat && m.destinoLng && (
                                        <Polyline
                                            positions={[[m.lat, m.lng], [m.destinoLat, m.destinoLng]]}
                                            pathOptions={{
                                                color: '#dc2626',
                                                weight: 2,
                                                opacity: 0.6,
                                                dashArray: '8, 8'
                                            }}
                                        />
                                    )}
                                    {/* Marker de ORIGEN (Generador) */}
                                    {m.origenLat && m.origenLng && (
                                        <Marker
                                            position={[m.origenLat, m.origenLng]}
                                            icon={generadorIcon}
                                        >
                                            <Popup className="mega-popup expanded">
                                                <div className="popup-content origen">
                                                    <div className="popup-header">
                                                        <span className="popup-tipo origen-badge">ORIGEN</span>
                                                        <span className="popup-manifiesto">{m.numero}</span>
                                                    </div>
                                                    <div className="popup-title">
                                                        <Factory size={16} />
                                                        <strong>{m.generador}</strong>
                                                    </div>
                                                    <span className="popup-label">Generador de residuos</span>
                                                    {m.generadorDomicilio && (
                                                        <div className="popup-detail">
                                                            <MapPin size={12} />
                                                            <span>{m.generadorDomicilio}</span>
                                                        </div>
                                                    )}
                                                    {m.generadorTelefono && (
                                                        <div className="popup-detail">
                                                            <Phone size={12} />
                                                            <span>{m.generadorTelefono}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}
                                    {/* Marker de DESTINO (Operador) */}
                                    {m.destinoLat && m.destinoLng && (
                                        <Marker
                                            position={[m.destinoLat, m.destinoLng]}
                                            icon={operadorIcon}
                                        >
                                            <Popup className="mega-popup expanded">
                                                <div className="popup-content destino">
                                                    <div className="popup-header">
                                                        <span className="popup-tipo destino-badge">DESTINO</span>
                                                        <span className="popup-manifiesto">{m.numero}</span>
                                                    </div>
                                                    <div className="popup-title">
                                                        <Building2 size={16} />
                                                        <strong>{m.operador}</strong>
                                                    </div>
                                                    <span className="popup-label">Planta de tratamiento</span>
                                                    {m.operadorDomicilio && (
                                                        <div className="popup-detail">
                                                            <MapPin size={12} />
                                                            <span>{m.operadorDomicilio}</span>
                                                        </div>
                                                    )}
                                                    {m.operadorTelefono && (
                                                        <div className="popup-detail">
                                                            <Phone size={12} />
                                                            <span>{m.operadorTelefono}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}
                                    {/* Marker de TRANSPORTE (camión) */}
                                    <Marker
                                        position={[m.lat, m.lng]}
                                        icon={
                                            m.estado === 'PAUSADO' ? truckPausedIcon :
                                            m.estado === 'INCIDENTE' ? truckIncidentIcon :
                                            truckIcon
                                        }
                                    >
                                        <Popup className="mega-popup expanded viaje-popup">
                                            <div className="popup-content viaje">
                                                {/* Header con manifiesto y estado */}
                                                <div className="popup-viaje-header">
                                                    <span className="popup-viaje-numero">{m.numero}</span>
                                                    <span className={`popup-viaje-estado ${m.estado.toLowerCase()}`}>
                                                        {m.estado === 'PAUSADO' && <><Pause size={12} /> PAUSADO</>}
                                                        {m.estado === 'INCIDENTE' && <><AlertTriangle size={12} /> INCIDENTE</>}
                                                        {m.estado === 'EN_CURSO' && <><Truck size={12} /> EN RUTA</>}
                                                        {m.estado === 'EN_TRANSITO' && <><Truck size={12} /> EN RUTA</>}
                                                    </span>
                                                </div>

                                                {/* Sección ORIGEN */}
                                                <div className="popup-viaje-section origen">
                                                    <div className="section-header">
                                                        <Factory size={14} />
                                                        <span className="section-label">ORIGEN</span>
                                                    </div>
                                                    <strong>{m.generador}</strong>
                                                    {m.generadorDomicilio && (
                                                        <div className="section-detail">
                                                            <MapPin size={11} /> {m.generadorDomicilio}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Sección TRANSPORTE */}
                                                <div className="popup-viaje-section transporte">
                                                    <div className="section-header">
                                                        <Truck size={14} />
                                                        <span className="section-label">TRANSPORTE</span>
                                                    </div>
                                                    {m.transportista && <strong>{m.transportista}</strong>}
                                                    <div className="transporte-details">
                                                        {m.vehiculoPatente && (
                                                            <span className="detail-badge patente">{m.vehiculoPatente}</span>
                                                        )}
                                                        {m.chofer && (
                                                            <span className="detail-item">
                                                                <User size={11} /> {m.chofer}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="transporte-stats">
                                                        <span className="stat">
                                                            <Clock size={11} /> {m.tiempoEnRuta}
                                                        </span>
                                                        <span className="stat">
                                                            <Gauge size={11} /> {m.velocidad || 0} km/h
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Sección DESTINO */}
                                                <div className="popup-viaje-section destino">
                                                    <div className="section-header">
                                                        <Building2 size={14} />
                                                        <span className="section-label">DESTINO</span>
                                                    </div>
                                                    <strong>{m.operador}</strong>
                                                    {m.operadorDomicilio && (
                                                        <div className="section-detail">
                                                            <MapPin size={11} /> {m.operadorDomicilio}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                </React.Fragment>
                            ))}
                        </MapContainer>
                        <div className="map-overlay">
                            <div className="map-legend">
                                <span className="legend-item origen"><Factory size={14} /> Origen</span>
                                <span className="legend-item en-ruta"><Truck size={14} /> En ruta</span>
                                <span className="legend-item pausado"><Pause size={14} /> Pausado</span>
                                <span className="legend-item incidente"><AlertTriangle size={14} /> Incidente</span>
                                <span className="legend-item destino"><Building2 size={14} /> Destino</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FEED DE ACTIVIDAD - MEJORADO */}
                <div className="mega-panel activity-panel">
                    <div className="panel-header">
                        <h3><Activity size={18} /> Actividad en Vivo</h3>
                        <div className="activity-stats">
                            <span className="activity-count">{actividades.length} eventos</span>
                            <Link to="/admin/actividad" className="view-more">
                                Ver todo <ChevronRight size={14} />
                            </Link>
                        </div>
                    </div>
                    <motion.div
                        className="activity-feed"
                        ref={activityRef}
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: { opacity: 1, transition: { staggerChildren: 0.05 } }
                        }}
                    >
                        {actividades.length === 0 ? (
                            <div className="activity-empty">
                                <Activity size={32} />
                                <p>Sin actividad reciente</p>
                            </div>
                        ) : (
                            actividades.slice(0, 15).map((act, index) => (
                                <motion.div
                                    key={act.id}
                                    className={`activity-item ${index === 0 ? 'newest' : ''}`}
                                    variants={{
                                        hidden: { x: -20, opacity: 0 },
                                        show: { x: 0, opacity: 1, transition: { duration: 0.3 } }
                                    }}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                >
                                    <div className={`activity-icon ${act.accion.includes('ERROR') || act.accion.includes('RECHAZ') ? 'error' : ''}`}>
                                        {getActionIcon(act.accion)}
                                    </div>
                                    <div className="activity-content">
                                        <span className="activity-action">{act.accion.replace(/_/g, ' ')}</span>
                                        <span className="activity-desc">{act.descripcion?.slice(0, 60) || 'Sin descripción'}</span>
                                    </div>
                                    <div className="activity-meta">
                                        <span className="activity-time">{formatRelativeTime(act.fecha)}</span>
                                        {index === 0 && (
                                            <motion.span
                                                className="new-badge"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                            >
                                                NUEVO
                                            </motion.span>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </motion.div>
                </div>
            </div>

            {/* PANEL DE VIAJES ACTIVOS EN TIEMPO REAL */}
            {viajesActivos.length > 0 && (
                <motion.div
                    className="mega-panel viajes-activos-panel"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                >
                    <div className="panel-header">
                        <h3><Truck size={18} /> Viajes en Tiempo Real</h3>
                        <div className="viajes-count-badges">
                            <span className="viaje-badge en-curso">
                                {viajesEnRuta} en ruta
                            </span>
                            <span className="viaje-badge pausado">
                                {viajesPausados} pausados
                            </span>
                            {viajesIncidentes > 0 && (
                                <span className="viaje-badge incidente">
                                    {viajesIncidentes} incidentes
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="viajes-activos-grid">
                        {viajesActivos.map(viaje => (
                            <motion.div
                                key={viaje.id}
                                className={`viaje-activo-card ${viaje.isPaused ? 'pausado' : ''} ${viaje.estado === 'INCIDENTE' ? 'incidente' : ''}`}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02 }}
                            >
                                <div className="viaje-icon-wrapper">
                                    {viaje.isPaused ? (
                                        <Pause size={20} className="icon-pausado" />
                                    ) : viaje.estado === 'INCIDENTE' ? (
                                        <AlertTriangle size={20} className="icon-incidente" />
                                    ) : (
                                        <>
                                            <Truck size={20} className="icon-en-ruta" />
                                            <div className="pulse-indicator" />
                                        </>
                                    )}
                                </div>
                                <div className="viaje-info">
                                    <span className="viaje-numero">{viaje.manifiestoNumero}</span>
                                    <span className="viaje-transportista">{viaje.transportistaRazonSocial}</span>
                                </div>
                                <div className="viaje-timer-wrapper">
                                    <Clock size={14} />
                                    <ViajeTimer
                                        initialSeconds={viaje.elapsedSeconds}
                                        isPaused={viaje.isPaused}
                                    />
                                </div>
                                <span className={`viaje-estado-badge ${viaje.estado.toLowerCase()}`}>
                                    {viaje.isPaused ? 'PAUSADO' :
                                     viaje.estado === 'INCIDENTE' ? 'INCIDENTE' : 'EN RUTA'}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Charts Section - Activity & Distribution */}
            {stats && (
                <motion.div
                    className="mega-charts"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                        gap: '20px',
                        marginBottom: '24px'
                    }}
                >
                    {/* Area Chart - Actividad en Tiempo Real */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <h4>Actividad en Tiempo Real</h4>
                            <p>Eventos por hora (últimas 8 horas)</p>
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={generateActivityChartData(actividades)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorActivityCC" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid rgba(148, 163, 184, 0.2)',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#colorActivityCC)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Pie Chart - Distribución */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <h4>Distribución de Manifiestos</h4>
                            <p>Por estado actual</p>
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={generatePipelineChartData(stats)}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={65}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {generatePipelineChartData(stats).map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={['#64748b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#22c55e'][index % 6]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid rgba(148, 163, 184, 0.2)',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: '11px' }}
                                    formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            )}

            {/* PIPELINE DE ESTADOS */}
            {stats && (
                <div className="mega-pipeline">
                    <div className="pipeline-header">
                        <h3><ArrowRightLeft size={18} /> Flujo de Manifiestos</h3>
                        <span className="pipeline-total">{stats.manifiestos.total} total</span>
                    </div>
                    <div className="pipeline-flow">
                        <div className="pipeline-stage borrador" style={{ flex: stats.manifiestos.borradores || 1 }}>
                            <span className="stage-count">{stats.manifiestos.borradores}</span>
                            <span className="stage-label">Borrador</span>
                            <div className="stage-bar"></div>
                        </div>
                        <div className="pipeline-arrow">→</div>
                        <div className="pipeline-stage aprobado" style={{ flex: stats.manifiestos.aprobados || 1 }}>
                            <span className="stage-count">{stats.manifiestos.aprobados}</span>
                            <span className="stage-label">Aprobado</span>
                            <div className="stage-bar"></div>
                        </div>
                        <div className="pipeline-arrow">→</div>
                        <div className="pipeline-stage transito" style={{ flex: stats.manifiestos.enTransito || 1 }}>
                            <span className="stage-count">{stats.manifiestos.enTransito}</span>
                            <span className="stage-label">Tránsito</span>
                            <div className="stage-bar"></div>
                        </div>
                        <div className="pipeline-arrow">→</div>
                        <div className="pipeline-stage entregado" style={{ flex: stats.manifiestos.entregados || 1 }}>
                            <span className="stage-count">{stats.manifiestos.entregados}</span>
                            <span className="stage-label">Entregado</span>
                            <div className="stage-bar"></div>
                        </div>
                        <div className="pipeline-arrow">→</div>
                        <div className="pipeline-stage recibido" style={{ flex: stats.manifiestos.recibidos || 1 }}>
                            <span className="stage-count">{stats.manifiestos.recibidos}</span>
                            <span className="stage-label">Recibido</span>
                            <div className="stage-bar"></div>
                        </div>
                        <div className="pipeline-arrow">→</div>
                        <div className="pipeline-stage tratado" style={{ flex: stats.manifiestos.tratados || 1 }}>
                            <span className="stage-count">{stats.manifiestos.tratados}</span>
                            <span className="stage-label">Tratado</span>
                            <div className="stage-bar"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* RANKING POR DEPARTAMENTO */}
            <div className="mega-ranking">
                <div className="ranking-header">
                    <h3><Trophy size={20} /> Ranking Departamentos Mendoza</h3>
                    <div className="ranking-controls">
                        <select
                            className="filtro-tiempo-select"
                            value={filtroTiempo}
                            onChange={(e) => setFiltroTiempo(e.target.value as FiltroTiempo)}
                        >
                            <option value="hoy">Hoy</option>
                            <option value="semana">Esta semana</option>
                            <option value="mes">Este mes</option>
                            <option value="trimestre">Último trimestre</option>
                        </select>
                        <div className="ranking-total">
                            <Recycle size={16} />
                            <span>{totalTratados.toLocaleString()} kg tratados total</span>
                        </div>
                    </div>
                </div>
                <div className="ranking-content">
                    {/* Mapa de Mendoza */}
                    <div className="ranking-map">
                        <MendozaMapSVG
                            departamentos={departamentos}
                            selectedDept={selectedDept}
                            onSelect={(codigo) => setSelectedDept(selectedDept === codigo ? null : codigo)}
                        />
                        {selectedDept && (
                            <div className="dept-tooltip">
                                {(() => {
                                    const dept = departamentos.find(d => d.codigo === selectedDept);
                                    if (!dept) return null;
                                    return (
                                        <>
                                            <strong style={{ color: dept.color }}>{dept.nombre}</strong>
                                            <span>{dept.tratados.toLocaleString()} kg tratados</span>
                                            <span>{dept.enProceso} en proceso</span>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Lista de ranking */}
                    <div className="ranking-list">
                        {departamentos.length === 0 ? (
                            <div className="ranking-empty">
                                <Package size={24} />
                                <span>Sin datos para el período seleccionado</span>
                            </div>
                        ) : (
                            departamentos.slice(0, 10).map((dept, index) => (
                                <div
                                    key={dept.codigo}
                                    className={`ranking-item ${selectedDept === dept.codigo ? 'selected' : ''} ${index < 3 ? 'top-three' : ''}`}
                                    onClick={() => setSelectedDept(selectedDept === dept.codigo ? null : dept.codigo)}
                                >
                                    <div className="ranking-position">
                                        {index === 0 ? <Trophy size={16} className="gold" /> :
                                         index === 1 ? <Trophy size={16} className="silver" /> :
                                         index === 2 ? <Trophy size={16} className="bronze" /> :
                                         <span>{index + 1}</span>}
                                    </div>
                                    <div className="ranking-info">
                                        <span className="ranking-name">{dept.nombre}</span>
                                        <div className="ranking-bar-container">
                                            <div
                                                className="ranking-bar"
                                                style={{
                                                    width: `${(dept.tratados / maxTratados) * 100}%`,
                                                    backgroundColor: dept.color
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="ranking-stats">
                                        <span className="ranking-value">{dept.tratados.toLocaleString()}</span>
                                        <span className="ranking-unit">kg</span>
                                    </div>
                                    {dept.enProceso > 0 && (
                                        <div className="ranking-pending">
                                            <TrendingUp size={12} />
                                            <span>+{dept.enProceso}</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Mini lista de los restantes */}
                {departamentos.length > 10 && (
                    <div className="ranking-others">
                        <span className="others-label">Otros departamentos:</span>
                        <div className="others-list">
                            {departamentos.slice(10).map((dept) => (
                                <span
                                    key={dept.codigo}
                                    className="other-dept"
                                    style={{ borderColor: dept.color }}
                                    onClick={() => setSelectedDept(dept.codigo)}
                                >
                                    {dept.nombre}: {dept.tratados}kg
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions Footer */}
            <div className="mega-footer">
                <Link to="/manifiestos" className="quick-action-btn">
                    <FileText size={18} />
                    <span>Manifiestos</span>
                </Link>
                <Link to="/tracking" className="quick-action-btn">
                    <MapPin size={18} />
                    <span>Tracking</span>
                </Link>
                <Link to="/admin/usuarios-panel" className="quick-action-btn">
                    <Users size={18} />
                    <span>Usuarios</span>
                </Link>
                <Link to="/reportes" className="quick-action-btn">
                    <BarChart3 size={18} />
                    <span>Reportes</span>
                </Link>
                <Link to="/alertas" className="quick-action-btn">
                    <Bell size={18} />
                    <span>Alertas</span>
                </Link>
                <button className="quick-action-btn refresh" onClick={loadData}>
                    <RefreshCw size={18} />
                    <span>Actualizar</span>
                </button>
            </div>

            {/* Last Update Indicator */}
            <div className="update-indicator">
                <Clock size={12} />
                <span>Última actualización: {lastUpdate.toLocaleTimeString('es-AR')}</span>
            </div>
        </div>
    );
};

export default CentroControl;
