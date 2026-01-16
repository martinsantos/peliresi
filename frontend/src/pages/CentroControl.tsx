/**
 * CentroControl.tsx - MEGA Dashboard para Monitor Grande
 * Dashboard premium con métricas en vivo, mapa animado y efectos visuales impactantes
 * Control Room 2077 Design System
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Activity, Users, FileText, Truck, Bell, AlertTriangle,
    CheckCircle, Clock, MapPin, RefreshCw,
    ChevronRight, Package, Radio,
    Factory, Building2, BarChart3,
    Wifi, WifiOff, ArrowRightLeft, Navigation,
    Trophy, TrendingUp, Recycle, Phone, Gauge, User, Pause
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
import type { ChartDataPoint } from '../components/ui';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { usuarioService } from '../services/admin.service';
import type { Actividad } from '../services/admin.service';
import { alertaService } from '../services/alerta.service';
import { manifiestoService } from '../services/manifiesto.service';
import { viajesService } from '../services/viajes.service';
import { useWebSocket, WS_EVENTS } from '../hooks/useWebSocket';
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

// Icono de camión para el mapa - EN CURSO (verde)
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

// Icono de camión PAUSADO (amarillo)
const truckPausedIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
            <rect x="11" y="10" width="4" height="12" fill="#fff"/>
            <rect x="17" y="10" width="4" height="12" fill="#fff"/>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Icono de camión INCIDENTE (rojo)
const truckIncidentIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#ef4444" stroke="#fff" stroke-width="2"/>
            <text x="16" y="22" text-anchor="middle" fill="#fff" font-size="18" font-weight="bold">!</text>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Icono de GENERADOR (origen) - Fábrica verde
const generadorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
            <rect x="2" y="8" width="24" height="18" rx="2" fill="#059669" stroke="#fff" stroke-width="1.5"/>
            <rect x="5" y="2" width="6" height="10" fill="#059669" stroke="#fff" stroke-width="1"/>
            <rect x="17" y="4" width="4" height="8" fill="#059669" stroke="#fff" stroke-width="1"/>
            <rect x="6" y="14" width="4" height="4" fill="#fff"/>
            <rect x="12" y="14" width="4" height="4" fill="#fff"/>
            <rect x="18" y="14" width="4" height="4" fill="#fff"/>
            <rect x="10" y="20" width="8" height="6" fill="#fff"/>
        </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});

// Icono de OPERADOR (destino) - Edificio rojo
const operadorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
            <rect x="4" y="4" width="20" height="22" rx="2" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
            <rect x="7" y="7" width="4" height="4" fill="#fff"/>
            <rect x="12" y="7" width="4" height="4" fill="#fff"/>
            <rect x="17" y="7" width="4" height="4" fill="#fff"/>
            <rect x="7" y="13" width="4" height="4" fill="#fff"/>
            <rect x="12" y="13" width="4" height="4" fill="#fff"/>
            <rect x="17" y="13" width="4" height="4" fill="#fff"/>
            <rect x="11" y="19" width="6" height="7" fill="#fff"/>
        </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});

// Interfaz para viajes activos en tiempo real
interface ViajeActivo {
    id: string;
    manifiestoId: string;
    manifiestoNumero: string;
    transportistaRazonSocial: string;
    estado: 'EN_CURSO' | 'PAUSADO' | 'INCIDENTE';
    elapsedSeconds: number;
    ultimaUbicacion: { lat: number; lng: number } | null;
    isPaused: boolean;
}

interface ManifiestoEnTransito {
    id: string;
    numero: string;
    lat: number;
    lng: number;
    generador: string;
    operador: string;
    estado: string;
    tiempoEnRuta?: string;
    // Coordenadas de origen (Generador) y destino (Operador)
    origenLat?: number;
    origenLng?: number;
    destinoLat?: number;
    destinoLng?: number;
    // Info adicional para popups expandidos
    generadorDomicilio?: string;
    generadorTelefono?: string;
    operadorDomicilio?: string;
    operadorTelefono?: string;
    transportista?: string;
    vehiculoPatente?: string;
    chofer?: string;
    velocidad?: number;
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

// Interfaz para departamentos de Mendoza con estadísticas reales
interface DepartamentoStats {
    nombre: string;
    codigo: string;
    tratados: number;
    enProceso: number;
    color: string;
}

// Colores para departamentos
const DEPT_COLORS: Record<string, string> = {
    'Capital': '#3b82f6',
    'Ciudad': '#3b82f6',
    'Godoy Cruz': '#10b981',
    'Guaymallén': '#8b5cf6',
    'Las Heras': '#f59e0b',
    'Maipú': '#ef4444',
    'Luján de Cuyo': '#06b6d4',
    'San Martín': '#84cc16',
    'San Rafael': '#f97316',
    'Rivadavia': '#ec4899',
    'Tunuyán': '#14b8a6',
    'Tupungato': '#a855f7',
    'General Alvear': '#22c55e',
    'San Carlos': '#0ea5e9',
    'Lavalle': '#eab308',
    'Malargüe': '#f43f5e',
    'Santa Rosa': '#6366f1',
    'La Paz': '#d946ef',
    'Junín': '#78716c',
};

// Códigos abreviados para departamentos
const DEPT_CODES: Record<string, string> = {
    'Capital': 'CD',
    'Ciudad': 'CD',
    'Godoy Cruz': 'GC',
    'Guaymallén': 'GY',
    'Las Heras': 'LH',
    'Maipú': 'MP',
    'Luján de Cuyo': 'LJ',
    'San Martín': 'SM',
    'San Rafael': 'SR',
    'Rivadavia': 'RV',
    'Tunuyán': 'TN',
    'Tupungato': 'TP',
    'General Alvear': 'GA',
    'San Carlos': 'SC',
    'Lavalle': 'LV',
    'Malargüe': 'MG',
    'Santa Rosa': 'SRo',
    'La Paz': 'LP',
    'Junín': 'JN',
};

// Tipo de filtro de tiempo
type FiltroTiempo = 'hoy' | 'semana' | 'mes' | 'trimestre';

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

// Generate chart data for activity visualization
const generateActivityChartData = (actividades: Actividad[]): ChartDataPoint[] => {
    const hours: Record<string, number> = {};
    const now = new Date();

    // Initialize last 8 hours
    for (let i = 7; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 3600000);
        const key = hour.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        hours[key] = 0;
    }

    // Count activities per hour
    actividades.forEach(act => {
        const actDate = new Date(act.fecha);
        const diffHours = (now.getTime() - actDate.getTime()) / 3600000;
        if (diffHours <= 8) {
            const key = actDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            if (hours[key] !== undefined) {
                hours[key]++;
            }
        }
    });

    return Object.entries(hours).map(([name, value]) => ({ name, value }));
};

const generatePipelineChartData = (stats: SystemStats): ChartDataPoint[] => {
    return [
        { name: 'Borradores', value: stats.manifiestos.borradores },
        { name: 'Aprobados', value: stats.manifiestos.aprobados },
        { name: 'En Tránsito', value: stats.manifiestos.enTransito },
        { name: 'Entregados', value: stats.manifiestos.entregados },
        { name: 'Recibidos', value: stats.manifiestos.recibidos },
        { name: 'Tratados', value: stats.manifiestos.tratados },
    ].filter(item => item.value > 0);
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

// Timer para viajes activos
const ViajeTimer: React.FC<{ initialSeconds: number; isPaused: boolean }> = ({ initialSeconds, isPaused }) => {
    const [seconds, setSeconds] = useState(initialSeconds);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [isPaused]);

    // Sync con servidor cuando cambia initialSeconds
    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return <span className="viaje-timer-value">{formatTime(seconds)}</span>;
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

    // Total de residuos tratados (calculado de datos reales)
    const totalTratados = departamentos.reduce((sum, d) => sum + d.tratados, 0);
    const maxTratados = Math.max(...departamentos.map(d => d.tratados), 1);

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

            {/* KPIs - Professional Style */}
            {stats && (
                <motion.div
                    className="mega-kpis"
                    initial="hidden"
                    animate="show"
                    variants={{
                        hidden: { opacity: 0 },
                        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
                    }}
                >
                    <motion.div
                        className="kpi-card"
                        style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                        variants={{ hidden: { y: 15, opacity: 0 }, show: { y: 0, opacity: 1 } }}
                    >
                        <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                            <FileText size={24} />
                        </div>
                        <div className="kpi-content">
                            <div className="kpi-value" style={{ color: '#f8fafc' }}>
                                {stats.manifiestos.total.toLocaleString('es-AR')}
                            </div>
                            <span className="kpi-label">MANIFIESTOS</span>
                            <div className="kpi-trend" style={{ color: (tendencia?.manifiestos ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                                <TrendingUp size={14} style={{ transform: (tendencia?.manifiestos ?? 0) < 0 ? 'rotate(180deg)' : 'none' }} />
                                <span>{(tendencia?.manifiestos ?? 0) >= 0 ? '+' : ''}{(tendencia?.manifiestos ?? 0).toFixed(1)}% vs período anterior</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        className="kpi-card"
                        style={{ background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                        variants={{ hidden: { y: 15, opacity: 0 }, show: { y: 0, opacity: 1 } }}
                    >
                        <div className="kpi-icon" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4' }}>
                            <Truck size={24} />
                        </div>
                        <div className="kpi-content">
                            <div className="kpi-value" style={{ color: '#f8fafc' }}>
                                {stats.manifiestos.enTransito.toLocaleString('es-AR')}
                            </div>
                            <span className="kpi-label">EN RUTA</span>
                            <div className="kpi-live">
                                <span className="live-dot"></span>
                                <span>En vivo</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        className="kpi-card"
                        style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                        variants={{ hidden: { y: 15, opacity: 0 }, show: { y: 0, opacity: 1 } }}
                    >
                        <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                            <Bell size={24} />
                        </div>
                        <div className="kpi-content">
                            <div className="kpi-value" style={{ color: '#f8fafc' }}>
                                {stats.alertasActivas.toLocaleString('es-AR')}
                            </div>
                            <span className="kpi-label">ALERTAS</span>
                            {stats.alertasActivas > 0 && (
                                <div className="kpi-alert">
                                    <AlertTriangle size={14} />
                                    <span>Revisar</span>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    <motion.div
                        className="kpi-card"
                        style={{ background: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' }}
                        variants={{ hidden: { y: 15, opacity: 0 }, show: { y: 0, opacity: 1 } }}
                    >
                        <div className="kpi-icon" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}>
                            <Users size={24} />
                        </div>
                        <div className="kpi-content">
                            <div className="kpi-value" style={{ color: '#f8fafc' }}>
                                {stats.usuarios.activos.toLocaleString('es-AR')}
                            </div>
                            <span className="kpi-label">USUARIOS</span>
                            {stats.usuarios.pendientes > 0 && (
                                <div className="kpi-pending">
                                    <Clock size={14} />
                                    <span>{stats.usuarios.pendientes} pendientes</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
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
                                {viajesActivos.filter(v => !v.isPaused && v.estado !== 'INCIDENTE').length} en ruta
                            </span>
                            <span className="viaje-badge pausado">
                                {viajesActivos.filter(v => v.isPaused || v.estado === 'PAUSADO').length} pausados
                            </span>
                            {viajesActivos.filter(v => v.estado === 'INCIDENTE').length > 0 && (
                                <span className="viaje-badge incidente">
                                    {viajesActivos.filter(v => v.estado === 'INCIDENTE').length} incidentes
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
