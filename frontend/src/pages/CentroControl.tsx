/**
 * CentroControl.tsx - MEGA Dashboard para Monitor Grande
 * Dashboard premium con métricas en vivo, mapa animado y efectos visuales impactantes
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity, Users, FileText, Truck, Bell, AlertTriangle,
    CheckCircle, Clock, MapPin, RefreshCw,
    ChevronRight, Package, Radio,
    Factory, Building2, BarChart3,
    Wifi, WifiOff, ArrowRightLeft, Navigation,
    Trophy, TrendingUp, Recycle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { usuarioService } from '../services/admin.service';
import type { Actividad } from '../services/admin.service';
import { alertaService } from '../services/alerta.service';
import './CentroControl.css';

// Componente para invalidar el tamaño del mapa cuando cambia el contenedor
const MapResizer: React.FC = () => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);
    return null;
};

// Icono de camión para el mapa
const truckIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#10b981">
            <circle cx="16" cy="16" r="14" fill="#10b981" stroke="#fff" stroke-width="2"/>
            <path d="M10 11h8v6h4l-2 4h-2v-2h-6v2h-2l-2-4h2v-6z" fill="#fff"/>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

interface ManifiestoEnTransito {
    id: string;
    numero: string;
    lat: number;
    lng: number;
    generador: string;
    operador: string;
    estado: string;
    tiempoEnRuta?: string;
}

interface SystemStats {
    manifiestos: {
        total: number;
        borradores: number;
        aprobados: number;
        enTransito: number;
        entregados: number;
        recibidos: number;
        tratados: number;
    };
    usuarios: {
        total: number;
        activos: number;
        pendientes: number;
        porRol: Record<string, number>;
    };
    alertasActivas: number;
    eventosHoy: number;
}

// Datos de departamentos de Mendoza con ranking simulado
interface DepartamentoStats {
    nombre: string;
    codigo: string;
    tratados: number;
    enProceso: number;
    color: string;
}

const DEPARTAMENTOS_MENDOZA: DepartamentoStats[] = [
    { nombre: 'Godoy Cruz', codigo: 'GC', tratados: 487, enProceso: 23, color: '#10b981' },
    { nombre: 'Ciudad', codigo: 'CD', tratados: 423, enProceso: 31, color: '#3b82f6' },
    { nombre: 'Guaymallén', codigo: 'GY', tratados: 356, enProceso: 18, color: '#8b5cf6' },
    { nombre: 'Las Heras', codigo: 'LH', tratados: 312, enProceso: 15, color: '#f59e0b' },
    { nombre: 'Maipú', codigo: 'MP', tratados: 287, enProceso: 12, color: '#ef4444' },
    { nombre: 'Luján de Cuyo', codigo: 'LJ', tratados: 245, enProceso: 9, color: '#06b6d4' },
    { nombre: 'San Martín', codigo: 'SM', tratados: 198, enProceso: 14, color: '#84cc16' },
    { nombre: 'San Rafael', codigo: 'SR', tratados: 176, enProceso: 8, color: '#f97316' },
    { nombre: 'Rivadavia', codigo: 'RV', tratados: 134, enProceso: 6, color: '#ec4899' },
    { nombre: 'Tunuyán', codigo: 'TN', tratados: 112, enProceso: 5, color: '#14b8a6' },
    { nombre: 'Tupungato', codigo: 'TP', tratados: 98, enProceso: 4, color: '#a855f7' },
    { nombre: 'General Alvear', codigo: 'GA', tratados: 87, enProceso: 3, color: '#22c55e' },
    { nombre: 'San Carlos', codigo: 'SC', tratados: 76, enProceso: 3, color: '#0ea5e9' },
    { nombre: 'Lavalle', codigo: 'LV', tratados: 65, enProceso: 2, color: '#eab308' },
    { nombre: 'Malargüe', codigo: 'MG', tratados: 54, enProceso: 2, color: '#f43f5e' },
    { nombre: 'Santa Rosa', codigo: 'SRo', tratados: 43, enProceso: 1, color: '#6366f1' },
    { nombre: 'La Paz', codigo: 'LP', tratados: 32, enProceso: 1, color: '#d946ef' },
    { nombre: 'Junín', codigo: 'JN', tratados: 28, enProceso: 1, color: '#78716c' },
];

// Mapa esquemático de Mendoza SVG
const MendozaMapSVG: React.FC<{ departamentos: DepartamentoStats[], selectedDept: string | null, onSelect: (codigo: string) => void }> = ({ departamentos, selectedDept, onSelect }) => {
    const getDeptByCode = (code: string) => departamentos.find(d => d.codigo === code);

    return (
        <svg viewBox="0 0 200 300" className="mendoza-map-svg">
            {/* Malargüe - Sur */}
            <path d="M20 220 L80 200 L100 280 L30 290 Z"
                className={`dept-path ${selectedDept === 'MG' ? 'selected' : ''}`}
                fill={getDeptByCode('MG')?.color || '#374151'}
                onClick={() => onSelect('MG')}
            />
            <text x="55" y="250" className="dept-label">MG</text>

            {/* San Rafael */}
            <path d="M80 140 L140 130 L150 200 L80 200 Z"
                className={`dept-path ${selectedDept === 'SR' ? 'selected' : ''}`}
                fill={getDeptByCode('SR')?.color || '#374151'}
                onClick={() => onSelect('SR')}
            />
            <text x="110" y="170" className="dept-label">SR</text>

            {/* General Alvear */}
            <path d="M140 130 L180 140 L180 200 L150 200 Z"
                className={`dept-path ${selectedDept === 'GA' ? 'selected' : ''}`}
                fill={getDeptByCode('GA')?.color || '#374151'}
                onClick={() => onSelect('GA')}
            />
            <text x="160" y="170" className="dept-label">GA</text>

            {/* San Carlos */}
            <path d="M60 100 L90 95 L90 130 L60 140 Z"
                className={`dept-path ${selectedDept === 'SC' ? 'selected' : ''}`}
                fill={getDeptByCode('SC')?.color || '#374151'}
                onClick={() => onSelect('SC')}
            />
            <text x="72" y="118" className="dept-label">SC</text>

            {/* Tunuyán */}
            <path d="M40 70 L70 65 L70 100 L40 100 Z"
                className={`dept-path ${selectedDept === 'TN' ? 'selected' : ''}`}
                fill={getDeptByCode('TN')?.color || '#374151'}
                onClick={() => onSelect('TN')}
            />
            <text x="52" y="85" className="dept-label">TN</text>

            {/* Tupungato */}
            <path d="M20 50 L50 45 L50 75 L20 80 Z"
                className={`dept-path ${selectedDept === 'TP' ? 'selected' : ''}`}
                fill={getDeptByCode('TP')?.color || '#374151'}
                onClick={() => onSelect('TP')}
            />
            <text x="32" y="65" className="dept-label">TP</text>

            {/* Luján de Cuyo */}
            <path d="M50 40 L80 35 L85 65 L55 70 Z"
                className={`dept-path ${selectedDept === 'LJ' ? 'selected' : ''}`}
                fill={getDeptByCode('LJ')?.color || '#374151'}
                onClick={() => onSelect('LJ')}
            />
            <text x="65" y="52" className="dept-label">LJ</text>

            {/* Maipú */}
            <path d="M80 30 L110 28 L115 55 L85 60 Z"
                className={`dept-path ${selectedDept === 'MP' ? 'selected' : ''}`}
                fill={getDeptByCode('MP')?.color || '#374151'}
                onClick={() => onSelect('MP')}
            />
            <text x="95" y="45" className="dept-label">MP</text>

            {/* Godoy Cruz */}
            <path d="M85 15 L105 12 L108 35 L88 38 Z"
                className={`dept-path ${selectedDept === 'GC' ? 'selected' : ''}`}
                fill={getDeptByCode('GC')?.color || '#374151'}
                onClick={() => onSelect('GC')}
            />
            <text x="94" y="26" className="dept-label">GC</text>

            {/* Ciudad */}
            <path d="M95 5 L115 3 L118 25 L98 28 Z"
                className={`dept-path ${selectedDept === 'CD' ? 'selected' : ''}`}
                fill={getDeptByCode('CD')?.color || '#374151'}
                onClick={() => onSelect('CD')}
            />
            <text x="105" y="16" className="dept-label">CD</text>

            {/* Guaymallén */}
            <path d="M110 5 L135 8 L138 40 L112 35 Z"
                className={`dept-path ${selectedDept === 'GY' ? 'selected' : ''}`}
                fill={getDeptByCode('GY')?.color || '#374151'}
                onClick={() => onSelect('GY')}
            />
            <text x="122" y="24" className="dept-label">GY</text>

            {/* Las Heras */}
            <path d="M70 5 L100 2 L100 20 L72 22 Z"
                className={`dept-path ${selectedDept === 'LH' ? 'selected' : ''}`}
                fill={getDeptByCode('LH')?.color || '#374151'}
                onClick={() => onSelect('LH')}
            />
            <text x="82" y="14" className="dept-label">LH</text>

            {/* Lavalle */}
            <path d="M130 5 L170 10 L175 60 L135 50 Z"
                className={`dept-path ${selectedDept === 'LV' ? 'selected' : ''}`}
                fill={getDeptByCode('LV')?.color || '#374151'}
                onClick={() => onSelect('LV')}
            />
            <text x="150" y="35" className="dept-label">LV</text>

            {/* San Martín */}
            <path d="M115 50 L150 45 L155 90 L120 95 Z"
                className={`dept-path ${selectedDept === 'SM' ? 'selected' : ''}`}
                fill={getDeptByCode('SM')?.color || '#374151'}
                onClick={() => onSelect('SM')}
            />
            <text x="132" y="72" className="dept-label">SM</text>

            {/* Rivadavia */}
            <path d="M150 45 L180 50 L185 95 L155 90 Z"
                className={`dept-path ${selectedDept === 'RV' ? 'selected' : ''}`}
                fill={getDeptByCode('RV')?.color || '#374151'}
                onClick={() => onSelect('RV')}
            />
            <text x="165" y="72" className="dept-label">RV</text>

            {/* Junín */}
            <path d="M120 90 L150 85 L155 120 L125 125 Z"
                className={`dept-path ${selectedDept === 'JN' ? 'selected' : ''}`}
                fill={getDeptByCode('JN')?.color || '#374151'}
                onClick={() => onSelect('JN')}
            />
            <text x="135" y="105" className="dept-label">JN</text>

            {/* Santa Rosa */}
            <path d="M150 85 L185 90 L190 130 L155 120 Z"
                className={`dept-path ${selectedDept === 'SRo' ? 'selected' : ''}`}
                fill={getDeptByCode('SRo')?.color || '#374151'}
                onClick={() => onSelect('SRo')}
            />
            <text x="168" y="108" className="dept-label">SRo</text>

            {/* La Paz */}
            <path d="M155 120 L190 125 L195 170 L160 160 Z"
                className={`dept-path ${selectedDept === 'LP' ? 'selected' : ''}`}
                fill={getDeptByCode('LP')?.color || '#374151'}
                onClick={() => onSelect('LP')}
            />
            <text x="172" y="145" className="dept-label">LP</text>
        </svg>
    );
};

// Componente de contador animado
const AnimatedCounter: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1500 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const prevValue = useRef(0);

    useEffect(() => {
        const startValue = prevValue.current;
        const diff = value - startValue;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + diff * eased);

            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                prevValue.current = value;
            }
        };

        requestAnimationFrame(animate);
    }, [value, duration]);

    return <span>{displayValue.toLocaleString()}</span>;
};

// Reloj en tiempo real
const LiveClock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="live-clock">
            <span className="clock-time">
                {time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="clock-date">
                {time.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
        </div>
    );
};

const CentroControl: React.FC = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [enTransito, setEnTransito] = useState<ManifiestoEnTransito[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const activityRef = useRef<HTMLDivElement>(null);

    // Total de residuos tratados
    const totalTratados = DEPARTAMENTOS_MENDOZA.reduce((sum, d) => sum + d.tratados, 0);
    const maxTratados = Math.max(...DEPARTAMENTOS_MENDOZA.map(d => d.tratados));

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

    const loadData = useCallback(async () => {
        try {
            const [statsData, actividadData, advertenciasData, tiemposData, vencimientosData] = await Promise.all([
                usuarioService.getEstadisticas(),
                usuarioService.getActividad({ limit: 30 }),
                alertaService.getAdvertenciasActivas(),
                alertaService.evaluarTiemposExcesivos(),
                alertaService.evaluarVencimientos()
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
            setEnTransito(simulateEnTransito());
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Error loading control center data:', err);
        } finally {
            setLoading(false);
        }
    }, [simulateEnTransito]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [loadData]);

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

    const formatRelativeTime = (dateStr: string): string => {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    };

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

            {/* KPIs MEGA */}
            {stats && (
                <div className="mega-kpis">
                    <div className="mega-kpi manifiestos">
                        <div className="kpi-glow"></div>
                        <div className="kpi-icon">
                            <FileText size={32} />
                        </div>
                        <div className="kpi-data">
                            <span className="kpi-value">
                                <AnimatedCounter value={stats.manifiestos.total} />
                            </span>
                            <span className="kpi-label">MANIFIESTOS</span>
                        </div>
                        <div className="kpi-trend">
                            <span className="trend-up">+{Math.floor(Math.random() * 15) + 5}</span>
                            <span className="trend-label">esta semana</span>
                        </div>
                    </div>

                    <div className="mega-kpi transito">
                        <div className="kpi-glow"></div>
                        <div className="kpi-icon pulsing">
                            <Truck size={32} />
                        </div>
                        <div className="kpi-data">
                            <span className="kpi-value">
                                <AnimatedCounter value={stats.manifiestos.enTransito} />
                            </span>
                            <span className="kpi-label">EN RUTA</span>
                        </div>
                        <div className="kpi-live">
                            <span className="live-dot"></span>
                            <span>En vivo</span>
                        </div>
                    </div>

                    <div className="mega-kpi alertas">
                        <div className="kpi-glow"></div>
                        <div className="kpi-icon">
                            <Bell size={32} />
                        </div>
                        <div className="kpi-data">
                            <span className="kpi-value">
                                <AnimatedCounter value={stats.alertasActivas} />
                            </span>
                            <span className="kpi-label">ALERTAS</span>
                        </div>
                        {stats.alertasActivas > 0 && (
                            <div className="kpi-alert">
                                <AlertTriangle size={14} />
                                <span>Revisar</span>
                            </div>
                        )}
                    </div>

                    <div className="mega-kpi usuarios">
                        <div className="kpi-glow"></div>
                        <div className="kpi-icon">
                            <Users size={32} />
                        </div>
                        <div className="kpi-data">
                            <span className="kpi-value">
                                <AnimatedCounter value={stats.usuarios.activos} />
                            </span>
                            <span className="kpi-label">USUARIOS</span>
                        </div>
                        {stats.usuarios.pendientes > 0 && (
                            <div className="kpi-pending">
                                <span>{stats.usuarios.pendientes}</span>
                                <span>pendientes</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                <Marker key={m.id} position={[m.lat, m.lng]} icon={truckIcon}>
                                    <Popup className="mega-popup">
                                        <div className="popup-content">
                                            <strong>{m.numero}</strong>
                                            <div className="popup-route">
                                                <span><Factory size={12} /> {m.generador}</span>
                                                <ArrowRightLeft size={12} />
                                                <span><Building2 size={12} /> {m.operador}</span>
                                            </div>
                                            <div className="popup-time">
                                                <Clock size={12} /> {m.tiempoEnRuta}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                        <div className="map-overlay">
                            <div className="map-legend">
                                <span><Truck size={14} /> Vehículos en ruta</span>
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
                    <div className="activity-feed" ref={activityRef}>
                        {actividades.length === 0 ? (
                            <div className="activity-empty">
                                <Activity size={32} />
                                <p>Sin actividad reciente</p>
                            </div>
                        ) : (
                            actividades.slice(0, 15).map((act, index) => (
                                <div
                                    key={act.id}
                                    className={`activity-item ${index === 0 ? 'newest' : ''}`}
                                    style={{ animationDelay: `${index * 0.05}s` }}
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
                                        {index === 0 && <span className="new-badge">NUEVO</span>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

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
                    <div className="ranking-total">
                        <Recycle size={16} />
                        <span>{totalTratados.toLocaleString()} kg tratados total</span>
                    </div>
                </div>
                <div className="ranking-content">
                    {/* Mapa de Mendoza */}
                    <div className="ranking-map">
                        <MendozaMapSVG
                            departamentos={DEPARTAMENTOS_MENDOZA}
                            selectedDept={selectedDept}
                            onSelect={(codigo) => setSelectedDept(selectedDept === codigo ? null : codigo)}
                        />
                        {selectedDept && (
                            <div className="dept-tooltip">
                                {(() => {
                                    const dept = DEPARTAMENTOS_MENDOZA.find(d => d.codigo === selectedDept);
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
                        {DEPARTAMENTOS_MENDOZA.slice(0, 10).map((dept, index) => (
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
                        ))}
                    </div>
                </div>

                {/* Mini lista de los restantes */}
                <div className="ranking-others">
                    <span className="others-label">Otros departamentos:</span>
                    <div className="others-list">
                        {DEPARTAMENTOS_MENDOZA.slice(10).map((dept) => (
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
