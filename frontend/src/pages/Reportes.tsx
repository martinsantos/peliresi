import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reporteService } from '../services/admin.service';
import { datosDemoReportes as datosDemo } from '../data/demoReportes';
import {
    BarChart3,
    PieChart,
    Download,
    Calendar,
    Filter,
    FileText,
    Truck,
    Factory,
    TrendingUp,
    Loader2,
    Package,
    Activity,
    CheckCircle,
    Building2,
    MapPin,
    Award,
    ChevronLeft,
    ChevronRight,
    List,
    Eye,
    X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Reportes.css';
import '../components/admin/admin.css';

// Fix for default marker icons in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

interface ReporteManifiestos {
    resumen: {
        totalManifiestos: number;
        totalResiduos: number;
        periodo: { desde: string; hasta: string };
    };
    porEstado: Record<string, number>;
    porTipoResiduo: Record<string, { cantidad: number; unidad: string }>;
    manifiestos: any[];
}

interface DepartamentoData {
    departamento: string;
    totalGeneradores: number;
    activos: number;
    inactivos: number;
    volumenKg: number;
    totalManifiestos: number;
}

interface GeneradorVolumen {
    ranking: number;
    id: string;
    razonSocial: string;
    cuit: string;
    departamento: string;
    rubro: string;
    activo: boolean;
    volumenKg: number;
    manifiestos: number;
    tiposResiduoUnicos: number;
}

interface ReporteGeneradores {
    departamentos: DepartamentoData[];
    topGeneradores: GeneradorVolumen[];
    totales: {
        totalGeneradores: number;
        totalActivos: number;
        totalInactivos: number;
        totalVolumen: number;
        totalManifiestos: number;
    };
}

interface TipoResiduo {
    id: string;
    codigo: string;
    nombre: string;
    peligrosidad: string;
}

interface ConteoTipoResiduo {
    tipoResiduoId: string;
    codigo: string;
    nombre: string;
    peligrosidad: string;
    cantidadGeneradores: number;
}

interface FiltrosDisponibles {
    departamentos: {
        mendoza: string[];
        otros: string[];
        todos: string[];
    };
    rubros: string[];
    categorias: string[];
    tiposResiduo?: TipoResiduo[];
}

interface GeneradorFiltrado {
    id: string;
    razonSocial: string;
    cuit: string;
    departamento: string;
    rubro: string;
    categoria: string;
    activo: boolean;
    manifiestos: number;
    volumenKg: number;
    latitud?: number;
    longitud?: number;
}

interface ListaGeneradoresFiltrados {
    generadores: GeneradorFiltrado[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

// Datos de demostración - ahora importados de ../data/demoReportes

const Reportes: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'manifiestos' | 'tratados' | 'transporte' | 'generadores'>('manifiestos');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [reporte, setReporte] = useState<ReporteManifiestos | null>(datosDemo.manifiestos);
    const [reporteGeneradores, setReporteGeneradores] = useState<ReporteGeneradores | null>(null);
    const [exportando, setExportando] = useState(false);
    const [usandoDemo, setUsandoDemo] = useState(true);

    // Filtros para generadores
    const [filtrosDisponibles, setFiltrosDisponibles] = useState<FiltrosDisponibles | null>(null);
    const [filtroDepto, setFiltroDepto] = useState('');
    const [filtroRubro, setFiltroRubro] = useState('');
    const [filtroTipoResiduo, setFiltroTipoResiduo] = useState('');
    const [conteoTiposResiduo, setConteoTiposResiduo] = useState<ConteoTipoResiduo[]>([]);

    // Lista paginada de generadores filtrados
    const [listaGeneradores, setListaGeneradores] = useState<ListaGeneradoresFiltrados | null>(null);
    const [paginaActual, setPaginaActual] = useState(1);
    const [loadingLista, setLoadingLista] = useState(false);

    // Totales globales (no cambian con filtros)
    const [totalesGlobales, setTotalesGlobales] = useState<{
        totalGeneradores: number;
        totalDepartamentos: number;
        totalTiposResiduo: number;
    } | null>(null);

    // Indicador de filtros activos
    const hayFiltrosActivos = filtroDepto || filtroRubro || filtroTipoResiduo;

    // ═══════════════════════════════════════════════════════════════════════════
    // OPERADORES - Estado y filtros
    // ═══════════════════════════════════════════════════════════════════════════
    const [filtrosOperadores, setFiltrosOperadores] = useState<any>(null);
    const [filtroTipoResiduoOp, setFiltroTipoResiduoOp] = useState('');
    const [filtroActivoOp, setFiltroActivoOp] = useState('');
    const [listaOperadores, setListaOperadores] = useState<any>(null);
    const [conteoTiposOperadores, setConteoTiposOperadores] = useState<any[]>([]);
    const [totalesGlobalesOp, setTotalesGlobalesOp] = useState<any>(null);
    const [paginaActualOp, setPaginaActualOp] = useState(1);
    const [loadingListaOp, setLoadingListaOp] = useState(false);
    const hayFiltrosActivosOp = filtroTipoResiduoOp || filtroActivoOp;

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSPORTISTAS - Estado y filtros
    // ═══════════════════════════════════════════════════════════════════════════
    const [filtrosTransportistas, setFiltrosTransportistas] = useState<any>(null);
    const [filtroTipoResiduoTr, setFiltroTipoResiduoTr] = useState('');
    const [filtroActivoTr, setFiltroActivoTr] = useState('');
    const [listaTransportistas, setListaTransportistas] = useState<any>(null);
    const [topTransportistas, setTopTransportistas] = useState<any[]>([]);
    const [totalesGlobalesTr, setTotalesGlobalesTr] = useState<any>(null);
    const [paginaActualTr, setPaginaActualTr] = useState(1);
    const [loadingListaTr, setLoadingListaTr] = useState(false);
    const hayFiltrosActivosTr = filtroTipoResiduoTr || filtroActivoTr;

    const getHeaders = () => {
        const token = localStorage.getItem('accessToken');
        return {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
        };
    };

    useEffect(() => {
        // Establecer fechas por defecto (último mes)
        const hoy = new Date();
        const mesAnterior = new Date();
        mesAnterior.setMonth(mesAnterior.getMonth() - 1);

        setFechaFin(hoy.toISOString().split('T')[0]);
        setFechaInicio(mesAnterior.toISOString().split('T')[0]);
    }, []);

    // Auto-cargar datos cuando cambia el tab a "generadores"
    useEffect(() => {
        if (activeTab === 'generadores') {
            if (!filtrosDisponibles) {
                cargarFiltrosDisponibles();
            }
            if (!totalesGlobales) {
                cargarTotalesGlobales();
            }
            if (!reporteGeneradores) {
                cargarReporteGeneradores();
            }
            cargarConteoTiposResiduo();
        }
    }, [activeTab]);

    // Auto-cargar datos cuando cambia el tab a "tratados" (OPERADORES)
    useEffect(() => {
        if (activeTab === 'tratados') {
            if (!filtrosOperadores) {
                cargarFiltrosOperadores();
            }
            cargarReporteOperadores(1);
            cargarConteoTiposOperadores();
        }
    }, [activeTab]);

    // Auto-cargar datos cuando cambia el tab a "transporte" (TRANSPORTISTAS)
    useEffect(() => {
        if (activeTab === 'transporte') {
            if (!filtrosTransportistas) {
                cargarFiltrosTransportistas();
            }
            cargarReporteTransportistas(1);
            cargarTopTransportistas();
        }
    }, [activeTab]);

    // Cargar totales globales (solo una vez, no cambian con filtros)
    const cargarTotalesGlobales = async () => {
        try {
            const response = await axios.get(`${API_URL}/reportes/generadores-departamento`, { headers: getHeaders() });
            if (response.data.success) {
                setTotalesGlobales({
                    totalGeneradores: response.data.data.totales.totalGeneradores,
                    totalDepartamentos: response.data.data.departamentos.length,
                    totalTiposResiduo: filtrosDisponibles?.tiposResiduo?.length || 15
                });
            }
        } catch (error) {
            console.error('Error al cargar totales globales:', error);
        }
    };

    const cargarConteoTiposResiduo = async () => {
        try {
            const queryParams = new URLSearchParams();
            if (fechaInicio) queryParams.append('fechaInicio', fechaInicio);
            if (fechaFin) queryParams.append('fechaFin', fechaFin);
            if (filtroDepto) queryParams.append('departamento', filtroDepto);
            if (filtroRubro) queryParams.append('rubro', filtroRubro);

            const response = await axios.get(`${API_URL}/reportes/generadores-por-tipo-residuo?${queryParams}`, { headers: getHeaders() });
            if (response.data.success) {
                setConteoTiposResiduo(response.data.data.conteosPorTipo);
            }
        } catch (error) {
            console.error('Error al cargar conteo por tipo de residuo:', error);
        }
    };

    const cargarFiltrosDisponibles = async () => {
        try {
            const response = await axios.get(`${API_URL}/reportes/generadores-filtros`, { headers: getHeaders() });
            if (response.data.success) {
                setFiltrosDisponibles(response.data.data);
            }
        } catch (error) {
            console.error('Error al cargar filtros disponibles:', error);
        }
    };

    const cargarReporteGeneradores = async (page = 1) => {
        setLoading(true);
        setUsandoDemo(false);
        setPaginaActual(page);
        try {
            const queryParams = new URLSearchParams();
            if (fechaInicio) queryParams.append('fechaInicio', fechaInicio);
            if (fechaFin) queryParams.append('fechaFin', fechaFin);
            if (filtroDepto) queryParams.append('departamento', filtroDepto);
            if (filtroRubro) queryParams.append('rubro', filtroRubro);
            if (filtroTipoResiduo) queryParams.append('tipoResiduoId', filtroTipoResiduo);

            const [deptoRes, volumenRes, listaRes] = await Promise.all([
                axios.get(`${API_URL}/reportes/generadores-departamento?${queryParams}`, { headers: getHeaders() }),
                axios.get(`${API_URL}/reportes/generadores-volumen?${queryParams}&limit=10`, { headers: getHeaders() }),
                axios.get(`${API_URL}/reportes/generadores-filtrado?${queryParams}&page=${page}&limit=15`, { headers: getHeaders() })
            ]);

            // Backend ahora filtra correctamente - usar datos directamente
            setReporteGeneradores({
                departamentos: deptoRes.data.data.departamentos,
                topGeneradores: volumenRes.data.data.topGeneradores,
                totales: deptoRes.data.data.totales
            });

            // Lista paginada de generadores
            setListaGeneradores(listaRes.data.data);
        } catch (error) {
            console.error('Error al cargar reporte de generadores:', error);
            setReporteGeneradores(null);
            setListaGeneradores(null);
        } finally {
            setLoading(false);
        }
    };

    // Cambiar página de la lista
    const cambiarPagina = async (nuevaPagina: number) => {
        setLoadingLista(true);
        setPaginaActual(nuevaPagina);
        try {
            const queryParams = new URLSearchParams();
            // Incluir fechas en la paginación
            if (fechaInicio) queryParams.append('fechaInicio', fechaInicio);
            if (fechaFin) queryParams.append('fechaFin', fechaFin);
            if (filtroDepto) queryParams.append('departamento', filtroDepto);
            if (filtroRubro) queryParams.append('rubro', filtroRubro);
            if (filtroTipoResiduo) queryParams.append('tipoResiduoId', filtroTipoResiduo);

            const listaRes = await axios.get(
                `${API_URL}/reportes/generadores-filtrado?${queryParams}&page=${nuevaPagina}&limit=15`,
                { headers: getHeaders() }
            );
            setListaGeneradores(listaRes.data.data);
        } catch (error) {
            console.error('Error al cambiar página:', error);
        } finally {
            setLoadingLista(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // OPERADORES - Funciones de carga
    // ═══════════════════════════════════════════════════════════════════════════
    const cargarFiltrosOperadores = async () => {
        try {
            const response = await axios.get(`${API_URL}/reportes/operadores-filtros`, { headers: getHeaders() });
            if (response.data.success) {
                setFiltrosOperadores(response.data.data);
            }
        } catch (error) {
            console.error('Error al cargar filtros de operadores:', error);
        }
    };

    const cargarConteoTiposOperadores = async () => {
        try {
            const response = await axios.get(`${API_URL}/reportes/operadores-por-tipo-residuo`, { headers: getHeaders() });
            if (response.data.success) {
                setConteoTiposOperadores(response.data.data.conteosPorTipo || []);
            }
        } catch (error) {
            console.error('Error al cargar conteo operadores por tipo:', error);
        }
    };

    const cargarReporteOperadores = async (page = 1) => {
        setLoadingListaOp(true);
        setPaginaActualOp(page);
        try {
            const queryParams = new URLSearchParams({ page: String(page), limit: '15' });
            if (filtroTipoResiduoOp) queryParams.append('tipoResiduoId', filtroTipoResiduoOp);
            if (filtroActivoOp) queryParams.append('activo', filtroActivoOp);

            const response = await axios.get(`${API_URL}/reportes/operadores-filtrado?${queryParams}`, { headers: getHeaders() });
            if (response.data.success) {
                setListaOperadores(response.data.data);
                if (!totalesGlobalesOp) {
                    setTotalesGlobalesOp(response.data.data.totalesGlobales);
                }
            }
        } catch (error) {
            console.error('Error al cargar reporte de operadores:', error);
        } finally {
            setLoadingListaOp(false);
        }
    };

    const limpiarFiltrosOperadores = () => {
        setFiltroTipoResiduoOp('');
        setFiltroActivoOp('');
        cargarReporteOperadores(1);
        cargarConteoTiposOperadores();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSPORTISTAS - Funciones de carga
    // ═══════════════════════════════════════════════════════════════════════════
    const cargarFiltrosTransportistas = async () => {
        try {
            const response = await axios.get(`${API_URL}/reportes/transportistas-filtros`, { headers: getHeaders() });
            if (response.data.success) {
                setFiltrosTransportistas(response.data.data);
            }
        } catch (error) {
            console.error('Error al cargar filtros de transportistas:', error);
        }
    };

    const cargarTopTransportistas = async () => {
        try {
            const response = await axios.get(`${API_URL}/reportes/transportistas-por-viajes?limit=15`, { headers: getHeaders() });
            if (response.data.success) {
                setTopTransportistas(response.data.data.topTransportistas || []);
            }
        } catch (error) {
            console.error('Error al cargar top transportistas:', error);
        }
    };

    const cargarReporteTransportistas = async (page = 1) => {
        setLoadingListaTr(true);
        setPaginaActualTr(page);
        try {
            const queryParams = new URLSearchParams({ page: String(page), limit: '15' });
            if (filtroTipoResiduoTr) queryParams.append('tipoResiduoId', filtroTipoResiduoTr);
            if (filtroActivoTr) queryParams.append('activo', filtroActivoTr);

            const response = await axios.get(`${API_URL}/reportes/transportistas-filtrado?${queryParams}`, { headers: getHeaders() });
            if (response.data.success) {
                setListaTransportistas(response.data.data);
                if (!totalesGlobalesTr) {
                    setTotalesGlobalesTr(response.data.data.totalesGlobales);
                }
            }
        } catch (error) {
            console.error('Error al cargar reporte de transportistas:', error);
        } finally {
            setLoadingListaTr(false);
        }
    };

    const limpiarFiltrosTransportistas = () => {
        setFiltroTipoResiduoTr('');
        setFiltroActivoTr('');
        cargarReporteTransportistas(1);
        cargarTopTransportistas();
    };

    const cargarReporte = async () => {
        if (activeTab === 'generadores') {
            await cargarReporteGeneradores();
            return;
        }
        if (activeTab === 'tratados') {
            await cargarReporteOperadores();
            return;
        }
        if (activeTab === 'transporte') {
            await cargarReporteTransportistas();
            return;
        }

        // Solo para tab manifiestos - los demás se manejan arriba
        setLoading(true);
        setUsandoDemo(false);
        try {
            const params = { fechaInicio, fechaFin };
            const data = await reporteService.getReporteManifiestos(params);
            setReporte(data);
        } catch (error) {
            console.error('Error al cargar reporte:', error);
            setUsandoDemo(true);
            setReporte(datosDemo.manifiestos);
        } finally {
            setLoading(false);
        }
    };

    const exportarCSV = async (tipo: 'manifiestos' | 'generadores' | 'transportistas' | 'operadores') => {
        setExportando(true);
        try {
            await reporteService.exportarCSV(tipo, { fechaInicio, fechaFin });
        } catch (error) {
            console.error('Error al exportar:', error);
        } finally {
            setExportando(false);
        }
    };

    const getEstadoColor = (estado: string) => {
        const colores: Record<string, string> = {
            BORRADOR: '#6b7280',
            APROBADO: '#10b981',
            EN_TRANSITO: '#f59e0b',
            ENTREGADO: '#3b82f6',
            RECIBIDO: '#8b5cf6',
            TRATADO: '#059669',
            RECHAZADO: '#ef4444'
        };
        return colores[estado] || '#6b7280';
    };



    return (
        <div className="reportes-page animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Reportes y Estadísticas</h1>
                    <p>Análisis detallado del sistema de trazabilidad {usandoDemo && '(Datos de demostración)'}</p>
                </div>
            </div>

            {/* Filtros */}
            <div className="card filtros-card">
                <div className="filtros-grid">
                    <div className="filtro-grupo">
                        <label><Calendar size={16} /> Fecha Inicio</label>
                        <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                        />
                    </div>
                    <div className="filtro-grupo">
                        <label><Calendar size={16} /> Fecha Fin</label>
                        <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={cargarReporte} disabled={loading}>
                        {loading ? <Loader2 size={18} className="spin" /> : <Filter size={18} />}
                        Generar Reporte
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="reportes-tabs">
                <button
                    className={`tab-btn ${activeTab === 'manifiestos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manifiestos')}
                >
                    <FileText size={18} />
                    Manifiestos
                </button>
                <button
                    className={`tab-btn ${activeTab === 'tratados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tratados')}
                >
                    <Factory size={18} />
                    Residuos Tratados
                </button>
                <button
                    className={`tab-btn ${activeTab === 'transporte' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transporte')}
                >
                    <Truck size={18} />
                    Transporte
                </button>
                <button
                    className={`tab-btn ${activeTab === 'generadores' ? 'active' : ''}`}
                    onClick={() => setActiveTab('generadores')}
                >
                    <Building2 size={18} />
                    Generadores
                </button>
            </div>

            {/* Contenido del reporte */}
            <div className="reporte-contenido">
                {loading ? (
                    <div className="loading-container">
                        <Loader2 size={48} className="spin" />
                        <p>Generando reporte...</p>
                    </div>
                ) : activeTab === 'manifiestos' && reporte ? (
                    <>
                        {/* Resumen */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon blue">
                                    <FileText size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{reporte?.resumen?.totalManifiestos || 0}</h3>
                                    <span>Total Manifiestos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon green">
                                    <Package size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{(reporte?.resumen?.totalResiduos || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</h3>
                                    <span>Kg de Residuos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon purple">
                                    <Activity size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{Object.keys(reporte?.porTipoResiduo || {}).length}</h3>
                                    <span>Tipos de Residuo</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon orange">
                                    <TrendingUp size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{reporte?.resumen?.totalManifiestos ? Math.round((reporte?.porEstado?.TRATADO || 0) / reporte.resumen.totalManifiestos * 100) : 0}%</h3>
                                    <span>Tasa Completitud</span>
                                </div>
                            </div>
                        </div>

                        {/* Por Estado */}
                        <div className="reporte-section">
                            <h3><PieChart size={20} /> Distribución por Estado</h3>
                            <div className="estado-bars">
                                {Object.entries(reporte?.porEstado || {}).map(([estado, cantidad]) => (
                                    <div key={estado} className="estado-bar-item">
                                        <div className="estado-label">
                                            <span className="estado-dot" style={{ background: getEstadoColor(estado), color: getEstadoColor(estado) }} />
                                            {estado.replace('_', ' ')}
                                        </div>
                                        <div className="bar-container">
                                            <div
                                                className="bar-fill"
                                                style={{
                                                    width: `${reporte?.resumen?.totalManifiestos ? (cantidad / reporte.resumen.totalManifiestos) * 100 : 0}%`,
                                                    background: `linear-gradient(90deg, ${getEstadoColor(estado)}, ${getEstadoColor(estado)}dd)`
                                                }}
                                            />
                                        </div>
                                        <span className="bar-value">{cantidad}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Por Tipo de Residuo */}
                        <div className="reporte-section">
                            <h3><BarChart3 size={20} /> Volumen por Tipo de Residuo</h3>

                            {/* Mobile Cards */}
                            <div className="reporte-mobile-cards">
                                {Object.entries(reporte.porTipoResiduo).map(([tipo, data]) => {
                                    const porcentaje = (data.cantidad / reporte.resumen.totalResiduos) * 100;
                                    return (
                                        <div key={tipo} className="reporte-mobile-card">
                                            <div className="reporte-card-header">
                                                <span className="reporte-card-title">{tipo}</span>
                                                <span className="reporte-card-badge">{porcentaje.toFixed(1)}%</span>
                                            </div>
                                            <div className="reporte-card-body">
                                                <div className="reporte-card-stat">
                                                    <span className="stat-value">{data.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</span>
                                                    <span className="stat-unit">{data.unidad}</span>
                                                </div>
                                                <div className="reporte-card-bar">
                                                    <div
                                                        className="reporte-card-bar-fill"
                                                        style={{ width: `${porcentaje}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop Table */}
                            <div className="table-container reporte-desktop-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Tipo de Residuo</th>
                                            <th>Cantidad</th>
                                            <th>Unidad</th>
                                            <th>% del Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(reporte.porTipoResiduo).map(([tipo, data]) => (
                                            <tr key={tipo}>
                                                <td><strong>{tipo}</strong></td>
                                                <td>{data.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
                                                <td>{data.unidad}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{
                                                            width: '60px',
                                                            height: '8px',
                                                            background: 'rgba(255,255,255,0.1)',
                                                            borderRadius: '4px',
                                                            overflow: 'hidden'
                                                        }}>
                                                            <div style={{
                                                                width: `${(data.cantidad / reporte.resumen.totalResiduos) * 100}%`,
                                                                height: '100%',
                                                                background: 'linear-gradient(90deg, #10b981, #059669)',
                                                                borderRadius: '4px'
                                                            }} />
                                                        </div>
                                                        <span>{((data.cantidad / reporte.resumen.totalResiduos) * 100).toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : activeTab === 'tratados' ? (
                    <>
                        {/* ═══════════════════════════════════════════════════════════════
                            OPERADORES - SECCIÓN COMPLETA (siguiendo patrón de generadores)
                           ═══════════════════════════════════════════════════════════════ */}

                        {/* Header Global */}
                        <div className="resumen-global-header" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1.25rem',
                            marginBottom: '1rem',
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(168, 85, 247, 0.1))',
                            borderRadius: '12px',
                            border: '1px solid rgba(139, 92, 246, 0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Factory size={18} style={{ color: '#a855f7' }} />
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Resumen Global de Operadores</span>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Factory size={16} style={{ color: '#a855f7' }} />
                                    <span style={{ fontWeight: 700, color: '#a855f7', fontSize: '1.1rem' }}>
                                        {totalesGlobalesOp?.totalOperadores || 0}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Operadores</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle size={16} style={{ color: '#22c55e' }} />
                                    <span style={{ fontWeight: 700, color: '#22c55e', fontSize: '1.1rem' }}>
                                        {totalesGlobalesOp?.totalActivos || 0}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Activos</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={16} style={{ color: '#f59e0b' }} />
                                    <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.1rem' }}>
                                        {totalesGlobalesOp?.totalTiposTratados || 0}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tipos Tratados</span>
                                </div>
                            </div>
                        </div>

                        {/* Filtros */}
                        <div className="generadores-filtros-section" style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            alignItems: 'center',
                            padding: '1rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            marginBottom: '1.5rem'
                        }}>
                            <div className="filtro-group" style={{ flex: '1', minWidth: '200px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>
                                    Tipo de Residuo Autorizado
                                </label>
                                <select
                                    value={filtroTipoResiduoOp}
                                    onChange={(e) => setFiltroTipoResiduoOp(e.target.value)}
                                    className="form-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Todos los tipos</option>
                                    {filtrosOperadores?.tiposResiduo?.map((tr: any) => (
                                        <option key={tr.id} value={tr.id}>{tr.codigo} - {tr.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filtro-group" style={{ flex: '1', minWidth: '150px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>
                                    Estado
                                </label>
                                <select
                                    value={filtroActivoOp}
                                    onChange={(e) => setFiltroActivoOp(e.target.value)}
                                    className="form-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Todos</option>
                                    <option value="true">Activos</option>
                                    <option value="false">Inactivos</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', paddingTop: '1.25rem' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => { cargarReporteOperadores(1); cargarConteoTiposOperadores(); }}
                                    disabled={loadingListaOp}
                                >
                                    <Filter size={16} /> Filtrar
                                </button>
                                {hayFiltrosActivosOp && (
                                    <button
                                        className="btn btn-secondary"
                                        onClick={limpiarFiltrosOperadores}
                                    >
                                        <X size={16} /> Limpiar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Badges de filtros activos */}
                        {hayFiltrosActivosOp && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                {filtroTipoResiduoOp && (
                                    <span className="badge" style={{ background: '#8b5cf6', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                                        Tipo: {filtrosOperadores?.tiposResiduo?.find((t: any) => t.id === filtroTipoResiduoOp)?.codigo || filtroTipoResiduoOp}
                                    </span>
                                )}
                                {filtroActivoOp && (
                                    <span className="badge" style={{ background: filtroActivoOp === 'true' ? '#22c55e' : '#ef4444', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                                        {filtroActivoOp === 'true' ? 'Activos' : 'Inactivos'}
                                    </span>
                                )}
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                    Mostrando {listaOperadores?.pagination?.total || 0} de {totalesGlobalesOp?.totalOperadores || 0}
                                </span>
                            </div>
                        )}

                        {/* Stats Cards */}
                        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                            <div className="stat-card" style={{ borderLeft: hayFiltrosActivosOp ? '3px solid #f59e0b' : 'none' }}>
                                <div className="stat-icon purple">
                                    <Factory size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{listaOperadores?.pagination?.total || totalesGlobalesOp?.totalOperadores || 0}</h3>
                                    <span>{hayFiltrosActivosOp ? 'Operadores (Filtrado)' : 'Total Operadores'}</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon green">
                                    <CheckCircle size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{totalesGlobalesOp?.totalActivos || 0}</h3>
                                    <span>Activos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon blue">
                                    <Package size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{totalesGlobalesOp?.totalTiposTratados || 0}</h3>
                                    <span>Tipos Tratados</span>
                                </div>
                            </div>
                        </div>

                        {/* Gráfico de Operadores por Tipo de Residuo */}
                        {conteoTiposOperadores.length > 0 && (
                            <div className="reporte-section" style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Package size={20} /> Operadores por Tipo de Residuo Autorizado (Y-codes Basel)
                                </h3>
                                <div className="estado-bars">
                                    {conteoTiposOperadores.slice(0, 15).map((item: any) => {
                                        const maxCount = conteoTiposOperadores[0]?.cantidadOperadores || 1;
                                        const peligrosidadColor = item.peligrosidad === 'ALTA' ? '#ef4444' : item.peligrosidad === 'MEDIA' ? '#f59e0b' : '#22c55e';
                                        return (
                                            <div
                                                key={item.tipoResiduoId}
                                                className="estado-bar-item"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => {
                                                    setFiltroTipoResiduoOp(item.tipoResiduoId);
                                                    cargarReporteOperadores(1);
                                                }}
                                            >
                                                <div className="estado-label" style={{ minWidth: '120px' }}>
                                                    <span className="estado-dot" style={{ background: peligrosidadColor }} />
                                                    <span style={{ fontWeight: 600 }}>{item.codigo}</span>
                                                </div>
                                                <div className="bar-container" style={{ flex: 1 }}>
                                                    <div
                                                        className="bar-fill"
                                                        style={{
                                                            width: `${(item.cantidadOperadores / maxCount) * 100}%`,
                                                            background: `linear-gradient(90deg, ${peligrosidadColor}, ${peligrosidadColor}dd)`
                                                        }}
                                                    />
                                                </div>
                                                <span className="bar-value" style={{ minWidth: '50px', textAlign: 'right' }}>
                                                    {item.cantidadOperadores}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Lista de Operadores */}
                        {listaOperadores && listaOperadores.operadores?.length > 0 && (
                            <div className="reporte-section">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <List size={20} /> Lista de Operadores
                                    {loadingListaOp && <Loader2 size={16} className="spin" style={{ marginLeft: '0.5rem' }} />}
                                </h3>

                                {/* Mobile Cards */}
                                <div className="reporte-mobile-cards">
                                    {listaOperadores.operadores.map((op: any) => (
                                        <div key={op.id} className="transportista-mobile-card" onClick={() => navigate(`/admin/operadores/${op.id}`)}>
                                            <div className="transportista-card-header">
                                                <div className="transportista-info">
                                                    <span className="transportista-name">{op.razonSocial}</span>
                                                    <span className="transportista-cuit">{op.cuit}</span>
                                                </div>
                                                <span className={`badge ${op.activo ? 'badge-success' : 'badge-danger'}`}>
                                                    {op.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                            <div className="transportista-card-body">
                                                <div className="transportista-stats-grid">
                                                    <div className="transportista-stat">
                                                        <span className="stat-value">{op.manifiestos}</span>
                                                        <span className="stat-label">Manifiestos</span>
                                                    </div>
                                                    <div className="transportista-stat">
                                                        <span className="stat-value">{op.tratamientos?.length || 0}</span>
                                                        <span className="stat-label">Tratamientos</span>
                                                    </div>
                                                </div>
                                                {op.tratamientos?.length > 0 && (
                                                    <div className="transportista-flota" style={{ marginTop: '0.5rem' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            {op.tratamientos.slice(0, 3).map((t: any) => t.codigo).join(', ')}
                                                            {op.tratamientos.length > 3 && ` +${op.tratamientos.length - 3}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="table-container reporte-desktop-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Razón Social</th>
                                                <th>CUIT</th>
                                                <th>Categoría</th>
                                                <th>Tratamientos</th>
                                                <th>Manifiestos</th>
                                                <th>Estado</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {listaOperadores.operadores.map((op: any) => (
                                                <tr key={op.id} onClick={() => navigate(`/admin/operadores/${op.id}`)} style={{ cursor: 'pointer' }}>
                                                    <td><strong>{op.razonSocial}</strong></td>
                                                    <td>{op.cuit}</td>
                                                    <td>{op.categoria || '-'}</td>
                                                    <td>
                                                        <span style={{ fontSize: '0.8rem' }}>
                                                            {op.tratamientos?.slice(0, 2).map((t: any) => t.codigo).join(', ')}
                                                            {op.tratamientos?.length > 2 && ` +${op.tratamientos.length - 2}`}
                                                        </span>
                                                    </td>
                                                    <td>{op.manifiestos}</td>
                                                    <td>
                                                        <span className={`badge ${op.activo ? 'badge-success' : 'badge-danger'}`}>
                                                            {op.activo ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <Link to={`/admin/operadores/${op.id}`} className="btn btn-icon btn-ghost" title="Ver detalle">
                                                            <Eye size={16} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Paginación */}
                                {listaOperadores.pagination?.pages > 1 && (
                                    <div className="pagination" style={{ marginTop: '1rem' }}>
                                        <span className="pagination-info">
                                            Página {listaOperadores.pagination.page} de {listaOperadores.pagination.pages}
                                            {' '}({listaOperadores.pagination.total} total)
                                        </span>
                                        <div className="pagination-controls">
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                disabled={paginaActualOp === 1 || loadingListaOp}
                                                onClick={() => cargarReporteOperadores(paginaActualOp - 1)}
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="pagination-current">
                                                {paginaActualOp} / {listaOperadores.pagination.pages}
                                            </span>
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                disabled={paginaActualOp === listaOperadores.pagination.pages || loadingListaOp}
                                                onClick={() => cargarReporteOperadores(paginaActualOp + 1)}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty state */}
                        {(!listaOperadores || listaOperadores.operadores?.length === 0) && !loadingListaOp && (
                            <div className="empty-state" style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
                                <Factory size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <h3 style={{ margin: '0 0 8px', color: '#e2e8f0' }}>Sin datos de operadores</h3>
                                <p style={{ margin: 0 }}>No se encontraron operadores con los filtros seleccionados.</p>
                            </div>
                        )}

                        {loadingListaOp && (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <Loader2 size={32} className="spin" />
                                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando operadores...</p>
                            </div>
                        )}

                        {/* Mapa de Operadores */}
                        {listaOperadores && listaOperadores.operadores?.length > 0 && (
                            <div className="reporte-section" style={{
                                marginTop: '2rem',
                                padding: '1.5rem',
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                                <h4 style={{
                                    margin: '0 0 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: '#e2e8f0'
                                }}>
                                    <MapPin size={20} style={{ color: '#10b981' }} />
                                    Mapa de Ubicación de Operadores
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: '#94a3b8',
                                        fontWeight: 'normal',
                                        marginLeft: 'auto'
                                    }}>
                                        {listaOperadores.operadores.filter((op: any) => op.latitud && op.longitud).length} operadores con ubicación
                                    </span>
                                </h4>
                                <div style={{
                                    height: '400px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(148, 163, 184, 0.2)'
                                }}>
                                    <MapContainer
                                        center={[-32.89, -68.83]}
                                        zoom={8}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        {listaOperadores.operadores
                                            .filter((op: any) => op.latitud && op.longitud)
                                            .map((op: any) => (
                                                <Marker
                                                    key={op.id}
                                                    position={[op.latitud, op.longitud]}
                                                >
                                                    <Popup>
                                                        <strong>{op.razonSocial}</strong><br/>
                                                        {op.categoria || 'Sin categoría'}<br/>
                                                        <small>{op.manifiestos} manifiestos</small>
                                                    </Popup>
                                                </Marker>
                                            ))
                                        }
                                    </MapContainer>
                                </div>
                            </div>
                        )}
                    </>
                ) : activeTab === 'transporte' ? (
                    <>
                        {/* ═══════════════════════════════════════════════════════════════
                            TRANSPORTISTAS - SECCIÓN COMPLETA (siguiendo patrón de generadores)
                           ═══════════════════════════════════════════════════════════════ */}

                        {/* Header Global */}
                        <div className="resumen-global-header" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1.25rem',
                            marginBottom: '1rem',
                            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(234, 88, 12, 0.1))',
                            borderRadius: '12px',
                            border: '1px solid rgba(249, 115, 22, 0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Truck size={18} style={{ color: '#f97316' }} />
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Resumen Global de Transportistas</span>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Truck size={16} style={{ color: '#f97316' }} />
                                    <span style={{ fontWeight: 700, color: '#f97316', fontSize: '1.1rem' }}>
                                        {totalesGlobalesTr?.totalTransportistas || 0}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Transportistas</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={16} style={{ color: '#3b82f6' }} />
                                    <span style={{ fontWeight: 700, color: '#3b82f6', fontSize: '1.1rem' }}>
                                        {totalesGlobalesTr?.totalVehiculos || 0}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vehículos</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Award size={16} style={{ color: '#22c55e' }} />
                                    <span style={{ fontWeight: 700, color: '#22c55e', fontSize: '1.1rem' }}>
                                        {totalesGlobalesTr?.totalChoferes || 0}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Choferes</span>
                                </div>
                            </div>
                        </div>

                        {/* Filtros */}
                        <div className="generadores-filtros-section" style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            alignItems: 'center',
                            padding: '1rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            marginBottom: '1.5rem'
                        }}>
                            <div className="filtro-group" style={{ flex: '1', minWidth: '200px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>
                                    Tipo de Residuo Transportado
                                </label>
                                <select
                                    value={filtroTipoResiduoTr}
                                    onChange={(e) => setFiltroTipoResiduoTr(e.target.value)}
                                    className="form-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Todos los tipos</option>
                                    {filtrosTransportistas?.tiposResiduo?.map((tr: any) => (
                                        <option key={tr.id} value={tr.id}>{tr.codigo} - {tr.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filtro-group" style={{ flex: '1', minWidth: '150px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>
                                    Estado
                                </label>
                                <select
                                    value={filtroActivoTr}
                                    onChange={(e) => setFiltroActivoTr(e.target.value)}
                                    className="form-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Todos</option>
                                    <option value="true">Activos</option>
                                    <option value="false">Inactivos</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', paddingTop: '1.25rem' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => { cargarReporteTransportistas(1); cargarTopTransportistas(); }}
                                    disabled={loadingListaTr}
                                >
                                    <Filter size={16} /> Filtrar
                                </button>
                                {hayFiltrosActivosTr && (
                                    <button
                                        className="btn btn-secondary"
                                        onClick={limpiarFiltrosTransportistas}
                                    >
                                        <X size={16} /> Limpiar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Badges de filtros activos */}
                        {hayFiltrosActivosTr && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                {filtroTipoResiduoTr && (
                                    <span className="badge" style={{ background: '#f97316', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                                        Tipo: {filtrosTransportistas?.tiposResiduo?.find((t: any) => t.id === filtroTipoResiduoTr)?.codigo || filtroTipoResiduoTr}
                                    </span>
                                )}
                                {filtroActivoTr && (
                                    <span className="badge" style={{ background: filtroActivoTr === 'true' ? '#22c55e' : '#ef4444', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                                        {filtroActivoTr === 'true' ? 'Activos' : 'Inactivos'}
                                    </span>
                                )}
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                    Mostrando {listaTransportistas?.pagination?.total || 0} de {totalesGlobalesTr?.totalTransportistas || 0}
                                </span>
                            </div>
                        )}

                        {/* Stats Cards */}
                        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                            <div className="stat-card" style={{ borderLeft: hayFiltrosActivosTr ? '3px solid #f59e0b' : 'none' }}>
                                <div className="stat-icon orange">
                                    <Truck size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{listaTransportistas?.pagination?.total || totalesGlobalesTr?.totalTransportistas || 0}</h3>
                                    <span>{hayFiltrosActivosTr ? 'Transportistas (Filtrado)' : 'Total Transportistas'}</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon green">
                                    <CheckCircle size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{totalesGlobalesTr?.totalActivos || 0}</h3>
                                    <span>Activos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon blue">
                                    <Package size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{totalesGlobalesTr?.totalVehiculos || 0}</h3>
                                    <span>Vehículos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon purple">
                                    <Award size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{totalesGlobalesTr?.totalChoferes || 0}</h3>
                                    <span>Choferes</span>
                                </div>
                            </div>
                        </div>

                        {/* Gráfico Top Transportistas por Viajes */}
                        {topTransportistas.length > 0 && (
                            <div className="reporte-section" style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <TrendingUp size={20} /> Top Transportistas por Manifiestos
                                </h3>
                                <div className="estado-bars">
                                    {topTransportistas.slice(0, 10).map((item: any, index: number) => {
                                        const maxCount = topTransportistas[0]?.manifiestos || 1;
                                        const colors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'];
                                        const color = colors[Math.min(index, colors.length - 1)];
                                        return (
                                            <div
                                                key={item.id}
                                                className="estado-bar-item"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => navigate(`/admin/transportistas/${item.id}`)}
                                            >
                                                <div className="estado-label" style={{ minWidth: '200px' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: color,
                                                        color: index < 3 ? 'white' : '#333',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        marginRight: '0.5rem'
                                                    }}>
                                                        {item.ranking}
                                                    </span>
                                                    <span style={{ fontWeight: 500 }}>{item.razonSocial?.substring(0, 30)}{item.razonSocial?.length > 30 ? '...' : ''}</span>
                                                </div>
                                                <div className="bar-container" style={{ flex: 1 }}>
                                                    <div
                                                        className="bar-fill"
                                                        style={{
                                                            width: `${(item.manifiestos / maxCount) * 100}%`,
                                                            background: `linear-gradient(90deg, ${color}, ${color}dd)`
                                                        }}
                                                    />
                                                </div>
                                                <span className="bar-value" style={{ minWidth: '50px', textAlign: 'right' }}>
                                                    {item.manifiestos}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Lista de Transportistas */}
                        {listaTransportistas && listaTransportistas.transportistas?.length > 0 && (
                            <div className="reporte-section">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <List size={20} /> Lista de Transportistas
                                    {loadingListaTr && <Loader2 size={16} className="spin" style={{ marginLeft: '0.5rem' }} />}
                                </h3>

                                {/* Mobile Cards */}
                                <div className="reporte-mobile-cards">
                                    {listaTransportistas.transportistas.map((tr: any) => (
                                        <div key={tr.id} className="transportista-mobile-card" onClick={() => navigate(`/admin/transportistas/${tr.id}`)}>
                                            <div className="transportista-card-header">
                                                <div className="transportista-info">
                                                    <span className="transportista-name">{tr.razonSocial}</span>
                                                    <span className="transportista-cuit">{tr.cuit}</span>
                                                </div>
                                                <span className={`badge ${tr.activo ? 'badge-success' : 'badge-danger'}`}>
                                                    {tr.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                            <div className="transportista-card-body">
                                                <div className="transportista-stats-grid">
                                                    <div className="transportista-stat">
                                                        <span className="stat-value">{tr.manifiestos}</span>
                                                        <span className="stat-label">Manifiestos</span>
                                                    </div>
                                                    <div className="transportista-stat success">
                                                        <span className="stat-value">{tr.viajesCompletados}</span>
                                                        <span className="stat-label">Completados</span>
                                                    </div>
                                                    <div className="transportista-stat">
                                                        <span className="stat-value">{tr.tasaCompletitud}</span>
                                                        <span className="stat-label">Completitud</span>
                                                    </div>
                                                </div>
                                                <div className="transportista-flota">
                                                    <span>{tr.vehiculos} vehículos</span>
                                                    <span className="separator">·</span>
                                                    <span>{tr.choferes} choferes</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="table-container reporte-desktop-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Razón Social</th>
                                                <th>CUIT</th>
                                                <th>Vehículos</th>
                                                <th>Choferes</th>
                                                <th>Manifiestos</th>
                                                <th>Completitud</th>
                                                <th>Estado</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {listaTransportistas.transportistas.map((tr: any) => (
                                                <tr key={tr.id} onClick={() => navigate(`/admin/transportistas/${tr.id}`)} style={{ cursor: 'pointer' }}>
                                                    <td><strong>{tr.razonSocial}</strong></td>
                                                    <td>{tr.cuit}</td>
                                                    <td>{tr.vehiculos}</td>
                                                    <td>{tr.choferes}</td>
                                                    <td>{tr.manifiestos}</td>
                                                    <td>
                                                        <span className="badge badge-info">{tr.tasaCompletitud}</span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${tr.activo ? 'badge-success' : 'badge-danger'}`}>
                                                            {tr.activo ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <Link to={`/admin/transportistas/${tr.id}`} className="btn btn-icon btn-ghost" title="Ver detalle">
                                                            <Eye size={16} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Paginación */}
                                {listaTransportistas.pagination?.pages > 1 && (
                                    <div className="pagination" style={{ marginTop: '1rem' }}>
                                        <span className="pagination-info">
                                            Página {listaTransportistas.pagination.page} de {listaTransportistas.pagination.pages}
                                            {' '}({listaTransportistas.pagination.total} total)
                                        </span>
                                        <div className="pagination-controls">
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                disabled={paginaActualTr === 1 || loadingListaTr}
                                                onClick={() => cargarReporteTransportistas(paginaActualTr - 1)}
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="pagination-current">
                                                {paginaActualTr} / {listaTransportistas.pagination.pages}
                                            </span>
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                disabled={paginaActualTr === listaTransportistas.pagination.pages || loadingListaTr}
                                                onClick={() => cargarReporteTransportistas(paginaActualTr + 1)}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty state */}
                        {(!listaTransportistas || listaTransportistas.transportistas?.length === 0) && !loadingListaTr && (
                            <div className="empty-state" style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
                                <Truck size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <h3 style={{ margin: '0 0 8px', color: '#e2e8f0' }}>Sin datos de transportistas</h3>
                                <p style={{ margin: 0 }}>No se encontraron transportistas con los filtros seleccionados.</p>
                            </div>
                        )}

                        {loadingListaTr && (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <Loader2 size={32} className="spin" />
                                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando transportistas...</p>
                            </div>
                        )}

                        {/* Mapa de Transportistas */}
                        {listaTransportistas && listaTransportistas.transportistas?.length > 0 && (
                            <div className="reporte-section" style={{
                                marginTop: '2rem',
                                padding: '1.5rem',
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                                <h4 style={{
                                    margin: '0 0 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: '#e2e8f0'
                                }}>
                                    <MapPin size={20} style={{ color: '#f97316' }} />
                                    Mapa de Ubicación de Transportistas
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: '#94a3b8',
                                        fontWeight: 'normal',
                                        marginLeft: 'auto'
                                    }}>
                                        {listaTransportistas.transportistas.filter((tr: any) => tr.latitud && tr.longitud).length} transportistas con ubicación
                                    </span>
                                </h4>
                                <div style={{
                                    height: '400px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(148, 163, 184, 0.2)'
                                }}>
                                    <MapContainer
                                        center={[-32.89, -68.83]}
                                        zoom={8}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        {listaTransportistas.transportistas
                                            .filter((tr: any) => tr.latitud && tr.longitud)
                                            .map((tr: any) => (
                                                <Marker
                                                    key={tr.id}
                                                    position={[tr.latitud, tr.longitud]}
                                                >
                                                    <Popup>
                                                        <strong>{tr.razonSocial}</strong><br/>
                                                        {tr.vehiculos} vehículos · {tr.choferes} choferes<br/>
                                                        <small>{tr.manifiestos} manifiestos</small>
                                                    </Popup>
                                                </Marker>
                                            ))
                                        }
                                    </MapContainer>
                                </div>
                            </div>
                        )}
                    </>
                ) : activeTab === 'generadores' ? (
                    reporteGeneradores ? (
                        <>
                            {/* ═══════════════════════════════════════════════════════════════
                                SECCIÓN 1: RESUMEN GLOBAL (datos constantes, no cambian con filtros)
                               ═══════════════════════════════════════════════════════════════ */}
                            <div className="resumen-global-header" style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1.25rem',
                                marginBottom: '1rem',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
                                borderRadius: '12px',
                                border: '1px solid rgba(99, 102, 241, 0.2)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <BarChart3 size={18} style={{ color: '#8b5cf6' }} />
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Resumen Global del Sistema</span>
                                </div>
                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Building2 size={16} style={{ color: '#8b5cf6' }} />
                                        <span style={{ fontWeight: 700, color: '#8b5cf6', fontSize: '1.1rem' }}>
                                            {totalesGlobales?.totalGeneradores || reporteGeneradores.totales.totalGeneradores}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Generadores</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <MapPin size={16} style={{ color: '#06b6d4' }} />
                                        <span style={{ fontWeight: 700, color: '#06b6d4', fontSize: '1.1rem' }}>
                                            {totalesGlobales?.totalDepartamentos || reporteGeneradores.departamentos.length}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Departamentos</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Package size={16} style={{ color: '#10b981' }} />
                                        <span style={{ fontWeight: 700, color: '#10b981', fontSize: '1.1rem' }}>
                                            {filtrosDisponibles?.tiposResiduo?.length || 15}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Y-codes</span>
                                    </div>
                                </div>
                            </div>

                            {/* ═══════════════════════════════════════════════════════════════
                                SECCIÓN 2: FILTROS
                               ═══════════════════════════════════════════════════════════════ */}
                            {filtrosDisponibles && (
                                <div className="generadores-filtros-section" style={{
                                    marginBottom: '1.5rem',
                                    padding: '1.25rem',
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <Filter size={16} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Filtrar Generadores</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div className="filtro-grupo" style={{ flex: '1', minWidth: '200px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                <MapPin size={14} /> Departamento
                                            </label>
                                            <select
                                                value={filtroDepto}
                                                onChange={(e) => setFiltroDepto(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1rem',
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.95rem'
                                                }}
                                            >
                                                <option value="">Todos los departamentos</option>
                                                <optgroup label="Mendoza">
                                                    {filtrosDisponibles.departamentos.mendoza.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </optgroup>
                                                {filtrosDisponibles.departamentos.otros.length > 0 && (
                                                    <optgroup label="Otras provincias">
                                                        {filtrosDisponibles.departamentos.otros.map(d => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>
                                        <div className="filtro-grupo" style={{ flex: '1', minWidth: '200px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                <Building2 size={14} /> Rubro
                                            </label>
                                            <select
                                                value={filtroRubro}
                                                onChange={(e) => setFiltroRubro(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1rem',
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.95rem'
                                                }}
                                            >
                                                <option value="">Todos los rubros</option>
                                                {filtrosDisponibles.rubros.map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="filtro-grupo" style={{ flex: '1', minWidth: '200px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                <Package size={14} /> Tipo Residuo (Y-code)
                                            </label>
                                            <select
                                                value={filtroTipoResiduo}
                                                onChange={(e) => setFiltroTipoResiduo(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1rem',
                                                    background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.95rem'
                                            }}
                                        >
                                            <option value="">Todos los tipos</option>
                                            {filtrosDisponibles.tiposResiduo?.map(t => (
                                                <option key={t.id} value={t.id}>{t.codigo} - {t.nombre.length > 30 ? t.nombre.substring(0, 30) + '...' : t.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => cargarReporteGeneradores(1)}
                                                disabled={loading}
                                                style={{ padding: '0.75rem 1.5rem' }}
                                            >
                                                {loading ? <Loader2 size={16} className="spin" /> : <Filter size={16} />}
                                                Filtrar
                                            </button>
                                            {hayFiltrosActivos && (
                                                <button
                                                    className="btn btn-ghost"
                                                    onClick={() => {
                                                        setFiltroDepto('');
                                                        setFiltroRubro('');
                                                        setFiltroTipoResiduo('');
                                                        setTimeout(() => cargarReporteGeneradores(1), 0);
                                                    }}
                                                    style={{ padding: '0.75rem 1rem' }}
                                                    title="Limpiar filtros"
                                                >
                                                    <X size={16} />
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Badges de filtros activos */}
                                    {hayFiltrosActivos && (
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '0.5rem',
                                            marginTop: '1rem',
                                            paddingTop: '1rem',
                                            borderTop: '1px solid rgba(148, 163, 184, 0.1)'
                                        }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginRight: '0.5rem' }}>Filtros activos:</span>
                                            {filtroDepto && (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                                    padding: '0.25rem 0.75rem', background: 'rgba(6, 182, 212, 0.15)',
                                                    color: '#06b6d4', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500
                                                }}>
                                                    <MapPin size={12} /> {filtroDepto}
                                                </span>
                                            )}
                                            {filtroRubro && (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                                    padding: '0.25rem 0.75rem', background: 'rgba(139, 92, 246, 0.15)',
                                                    color: '#8b5cf6', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500
                                                }}>
                                                    <Building2 size={12} /> {filtroRubro.length > 25 ? filtroRubro.substring(0, 25) + '...' : filtroRubro}
                                                </span>
                                            )}
                                            {filtroTipoResiduo && (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                                    padding: '0.25rem 0.75rem', background: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#10b981', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500
                                                }}>
                                                    <Package size={12} /> {filtrosDisponibles?.tiposResiduo?.find(t => t.id === filtroTipoResiduo)?.codigo || ''}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══════════════════════════════════════════════════════════════
                                SECCIÓN 3: RESULTADOS DEL FILTRO (Stats Cards)
                               ═══════════════════════════════════════════════════════════════ */}
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '0.75rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <TrendingUp size={18} style={{ color: '#f59e0b' }} />
                                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                            {hayFiltrosActivos ? 'Resultados del Filtro' : 'Estadísticas Generales'}
                                        </span>
                                    </div>
                                    {hayFiltrosActivos && (
                                        <span style={{
                                            padding: '0.35rem 0.75rem',
                                            background: 'rgba(245, 158, 11, 0.15)',
                                            color: '#f59e0b',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: 500
                                        }}>
                                            Mostrando {reporteGeneradores.totales.totalGeneradores} de {totalesGlobales?.totalGeneradores || '—'} generadores
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="stats-grid">
                                <div className="stat-card" style={hayFiltrosActivos ? { borderLeft: '3px solid #f59e0b' } : {}}>
                                    <div className="stat-icon purple">
                                        <Building2 size={28} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{reporteGeneradores.totales.totalGeneradores}</h3>
                                        <span>{hayFiltrosActivos ? 'Encontrados' : 'Total Generadores'}</span>
                                    </div>
                                </div>
                                <div className="stat-card" style={hayFiltrosActivos ? { borderLeft: '3px solid #f59e0b' } : {}}>
                                    <div className="stat-icon green">
                                        <CheckCircle size={28} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{reporteGeneradores.totales.totalActivos}</h3>
                                        <span>Activos</span>
                                    </div>
                                </div>
                                <div className="stat-card" style={hayFiltrosActivos ? { borderLeft: '3px solid #f59e0b' } : {}}>
                                    <div className="stat-icon blue">
                                        <MapPin size={28} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{reporteGeneradores.departamentos.length}</h3>
                                        <span>Departamentos</span>
                                    </div>
                                </div>
                                <div className="stat-card" style={hayFiltrosActivos ? { borderLeft: '3px solid #f59e0b' } : {}}>
                                    <div className="stat-icon orange">
                                        <Package size={28} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{(reporteGeneradores.totales.totalVolumen / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} t</h3>
                                        <span>Volumen Total</span>
                                    </div>
                                </div>
                            </div>

                            {/* Generadores por Departamento */}
                            <div className="reporte-section">
                                <h3><MapPin size={20} /> Generadores por Departamento</h3>
                                <div className="estado-bars">
                                    {reporteGeneradores.departamentos.slice(0, 12).map((d, index) => {
                                        const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
                                        const color = colors[index % colors.length];
                                        const maxGen = Math.max(...reporteGeneradores.departamentos.map(x => x.totalGeneradores));
                                        return (
                                            <div key={d.departamento} className="estado-bar-item">
                                                <div className="estado-label" style={{ minWidth: '160px' }}>
                                                    <span className="estado-dot" style={{ background: color }} />
                                                    {d.departamento || 'Sin datos'}
                                                </div>
                                                <div className="bar-container">
                                                    <div
                                                        className="bar-fill"
                                                        style={{
                                                            width: `${(d.totalGeneradores / maxGen) * 100}%`,
                                                            background: `linear-gradient(90deg, ${color}, ${color}dd)`
                                                        }}
                                                    />
                                                </div>
                                                <span className="bar-value">{d.totalGeneradores}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Generadores por Tipo de Residuo (Y-codes) */}
                            {conteoTiposResiduo && conteoTiposResiduo.length > 0 && (
                                <div className="reporte-section">
                                    <h3><Package size={20} /> Generadores por Tipo de Residuo (Y-codes Basel)</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                        Cantidad de generadores que han declarado cada tipo de residuo en sus manifiestos
                                    </p>
                                    <div className="estado-bars">
                                        {conteoTiposResiduo.slice(0, 15).map((item) => {
                                            const getPeligrosidadColor = (p: string) => {
                                                switch (p?.toUpperCase()) {
                                                    case 'ALTA': return '#ef4444';
                                                    case 'MEDIA': return '#f59e0b';
                                                    case 'BAJA': return '#10b981';
                                                    default: return '#6366f1';
                                                }
                                            };
                                            const color = getPeligrosidadColor(item.peligrosidad);
                                            const maxGen = Math.max(...conteoTiposResiduo.map(x => x.cantidadGeneradores));
                                            return (
                                                <div
                                                    key={item.tipoResiduoId}
                                                    className="estado-bar-item"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => {
                                                        setFiltroTipoResiduo(item.tipoResiduoId);
                                                        cargarReporteGeneradores(1);
                                                    }}
                                                    title={`Clic para filtrar por ${item.codigo}`}
                                                >
                                                    <div className="estado-label" style={{ minWidth: '80px' }}>
                                                        <span className="estado-dot" style={{ background: color }} />
                                                        <strong>{item.codigo}</strong>
                                                    </div>
                                                    <div className="bar-container" style={{ flex: 1 }}>
                                                        <div
                                                            className="bar-fill"
                                                            style={{
                                                                width: `${(item.cantidadGeneradores / maxGen) * 100}%`,
                                                                background: `linear-gradient(90deg, ${color}, ${color}dd)`
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="bar-value" style={{ minWidth: '40px', textAlign: 'right' }}>{item.cantidadGeneradores}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {conteoTiposResiduo.length > 15 && (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
                                            Mostrando top 15 de {conteoTiposResiduo.length} tipos de residuo con generadores
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Top Generadores por Volumen */}
                            <div className="reporte-section">
                                <h3><Award size={20} /> Top Generadores por Volumen</h3>

                                {/* Mobile Cards */}
                                <div className="reporte-mobile-cards">
                                    {reporteGeneradores.topGeneradores.map((g) => (
                                        <div key={g.id} className="transportista-mobile-card">
                                            <div className="transportista-card-header">
                                                <div className="transportista-info">
                                                    <span className="transportista-name">#{g.ranking} {g.razonSocial}</span>
                                                    <span className="transportista-cuit">{g.cuit}</span>
                                                </div>
                                                <span className="transportista-badge" style={{ background: g.activo ? '#10b981' : '#ef4444' }}>
                                                    {g.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                            <div className="transportista-card-body">
                                                <div className="transportista-stats-grid">
                                                    <div className="transportista-stat">
                                                        <span className="stat-value">{(g.volumenKg / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}t</span>
                                                        <span className="stat-label">Volumen</span>
                                                    </div>
                                                    <div className="transportista-stat success">
                                                        <span className="stat-value">{g.manifiestos}</span>
                                                        <span className="stat-label">Manifiestos</span>
                                                    </div>
                                                    <div className="transportista-stat warning">
                                                        <span className="stat-value">{g.tiposResiduoUnicos}</span>
                                                        <span className="stat-label">Tipos</span>
                                                    </div>
                                                </div>
                                                <div className="transportista-flota">
                                                    <span><MapPin size={12} /> {g.departamento}</span>
                                                    <span className="separator">·</span>
                                                    <span>{g.rubro}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="table-container reporte-desktop-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Razón Social</th>
                                                <th>CUIT</th>
                                                <th>Departamento</th>
                                                <th>Volumen (kg)</th>
                                                <th>Manifiestos</th>
                                                <th>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reporteGeneradores.topGeneradores.map((g) => (
                                                <tr key={g.id}>
                                                    <td><strong>{g.ranking}</strong></td>
                                                    <td>
                                                        <strong>{g.razonSocial}</strong>
                                                        <br />
                                                        <small style={{ color: '#64748b' }}>{g.rubro}</small>
                                                    </td>
                                                    <td><code style={{ background: 'rgba(100,116,139,0.2)', padding: '2px 6px', borderRadius: '4px' }}>{g.cuit}</code></td>
                                                    <td>{g.departamento}</td>
                                                    <td>
                                                        <strong style={{ color: '#06b6d4' }}>
                                                            {g.volumenKg.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                                        </strong>
                                                    </td>
                                                    <td>{g.manifiestos}</td>
                                                    <td>
                                                        <span className={`badge ${g.activo ? 'badge-success' : 'badge-danger'}`}>
                                                            {g.activo ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* ═══════════════════════════════════════════════════════════════
                                SECCIÓN 5: LISTA DE GENERADORES (tabla paginada)
                               ═══════════════════════════════════════════════════════════════ */}
                            {listaGeneradores && listaGeneradores.generadores.length > 0 && (
                                <div className="reporte-section" style={{ marginTop: '2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <List size={20} /> Lista de Generadores
                                        </h3>
                                        <span style={{
                                            padding: '0.35rem 0.75rem',
                                            background: 'rgba(100, 116, 139, 0.1)',
                                            color: 'var(--text-muted)',
                                            borderRadius: '20px',
                                            fontSize: '0.85rem'
                                        }}>
                                            Página {listaGeneradores.pagination.page} de {listaGeneradores.pagination.pages} • {listaGeneradores.pagination.total} resultados
                                        </span>
                                    </div>

                                    {loadingLista && (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                            <Loader2 size={24} className="spin" />
                                        </div>
                                    )}

                                    {!loadingLista && (
                                        <>
                                            {/* Mobile Cards */}
                                            <div className="reporte-mobile-cards">
                                                {listaGeneradores.generadores.map((g) => (
                                                    <Link
                                                        to={`/admin/generadores/${g.id}`}
                                                        key={g.id}
                                                        className="transportista-mobile-card"
                                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                                    >
                                                        <div className="transportista-card-header">
                                                            <div className="transportista-info">
                                                                <span className="transportista-name">{g.razonSocial}</span>
                                                                <span className="transportista-cuit">{g.cuit}</span>
                                                            </div>
                                                            <span className="transportista-badge" style={{ background: g.activo ? '#10b981' : '#ef4444' }}>
                                                                {g.activo ? 'Activo' : 'Inactivo'}
                                                            </span>
                                                        </div>
                                                        <div className="transportista-card-body">
                                                            <div className="transportista-stats-grid">
                                                                <div className="transportista-stat">
                                                                    <span className="stat-value">{g.manifiestos}</span>
                                                                    <span className="stat-label">Manifiestos</span>
                                                                </div>
                                                                <div className="transportista-stat success">
                                                                    <span className="stat-value">{(g.volumenKg / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}t</span>
                                                                    <span className="stat-label">Volumen</span>
                                                                </div>
                                                            </div>
                                                            <div className="transportista-flota">
                                                                <span><MapPin size={12} /> {g.departamento || 'Sin depto'}</span>
                                                                <span className="separator">·</span>
                                                                <span>{g.rubro || 'Sin rubro'}</span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>

                                            {/* Desktop Table */}
                                            <div className="table-container reporte-desktop-table">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Razón Social</th>
                                                            <th>CUIT</th>
                                                            <th>Departamento</th>
                                                            <th>Rubro</th>
                                                            <th>Categoría</th>
                                                            <th>Manifiestos</th>
                                                            <th>Volumen (kg)</th>
                                                            <th>Estado</th>
                                                            <th>Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {listaGeneradores.generadores.map((g) => (
                                                            <tr
                                                                key={g.id}
                                                                className="admin-table-row--clickable"
                                                                onClick={() => navigate(`/admin/generadores/${g.id}`)}
                                                            >
                                                                <td>
                                                                    <strong>{g.razonSocial}</strong>
                                                                </td>
                                                                <td>
                                                                    <code style={{ background: 'rgba(100,116,139,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                                        {g.cuit}
                                                                    </code>
                                                                </td>
                                                                <td>{g.departamento || '—'}</td>
                                                                <td>
                                                                    <span style={{
                                                                        background: 'rgba(139, 92, 246, 0.15)',
                                                                        color: '#a78bfa',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 500
                                                                    }}>
                                                                        {g.rubro || 'Sin rubro'}
                                                                    </span>
                                                                </td>
                                                                <td>{g.categoria || '—'}</td>
                                                                <td style={{ textAlign: 'center' }}>{g.manifiestos}</td>
                                                                <td>
                                                                    <strong style={{ color: '#06b6d4' }}>
                                                                        {g.volumenKg.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                                                    </strong>
                                                                </td>
                                                                <td>
                                                                    <span className={`badge ${g.activo ? 'badge-success' : 'badge-danger'}`}>
                                                                        {g.activo ? 'Activo' : 'Inactivo'}
                                                                    </span>
                                                                </td>
                                                                <td onClick={(e) => e.stopPropagation()}>
                                                                    <Link
                                                                        to={`/admin/generadores/${g.id}`}
                                                                        className="btn btn-icon btn-ghost"
                                                                        title="Ver detalle"
                                                                    >
                                                                        <Eye size={16} />
                                                                    </Link>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Paginación */}
                                            {listaGeneradores.pagination.pages > 1 && (
                                                <div className="pagination" style={{ marginTop: '1rem' }}>
                                                    <span className="pagination-info">
                                                        Página {listaGeneradores.pagination.page} de {listaGeneradores.pagination.pages}
                                                        {' '}({listaGeneradores.pagination.total} total)
                                                    </span>
                                                    <div className="pagination-controls">
                                                        <button
                                                            className="btn btn-icon btn-ghost"
                                                            disabled={paginaActual === 1 || loadingLista}
                                                            onClick={() => cambiarPagina(paginaActual - 1)}
                                                        >
                                                            <ChevronLeft size={18} />
                                                        </button>
                                                        <span className="pagination-current">
                                                            {paginaActual} / {listaGeneradores.pagination.pages}
                                                        </span>
                                                        <button
                                                            className="btn btn-icon btn-ghost"
                                                            disabled={paginaActual === listaGeneradores.pagination.pages || loadingLista}
                                                            onClick={() => cambiarPagina(paginaActual + 1)}
                                                        >
                                                            <ChevronRight size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ═══════════════════════════════════════════════════════════════
                                SECCIÓN: MAPA DE GENERADORES (al final, antes de Exportar)
                               ═══════════════════════════════════════════════════════════════ */}
                            {listaGeneradores && listaGeneradores.generadores.length > 0 && (
                                <div className="mapa-section" style={{
                                    marginTop: '2rem',
                                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>
                                    <h4 style={{
                                        margin: '0 0 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: '#e2e8f0'
                                    }}>
                                        <MapPin size={20} style={{ color: '#3b82f6' }} />
                                        Mapa de Ubicación
                                        <span style={{
                                            fontSize: '0.8rem',
                                            color: '#94a3b8',
                                            fontWeight: 'normal',
                                            marginLeft: 'auto'
                                        }}>
                                            {listaGeneradores.generadores.filter(g => g.latitud && g.longitud).length} generadores con ubicación
                                        </span>
                                    </h4>
                                    <div style={{
                                        height: '400px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(148, 163, 184, 0.2)'
                                    }}>
                                        <MapContainer
                                            center={[-32.0, -65.0]}
                                            zoom={5}
                                            style={{ height: '100%', width: '100%' }}
                                        >
                                            <TileLayer
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            />
                                            {listaGeneradores.generadores
                                                .filter(g => g.latitud && g.longitud)
                                                .map(g => (
                                                    <Marker
                                                        key={g.id}
                                                        position={[g.latitud!, g.longitud!]}
                                                    >
                                                        <Popup>
                                                            <strong>{g.razonSocial}</strong><br/>
                                                            {typeof g.departamento === 'object' ? (g.departamento as any)?.nombre : g.departamento || 'Sin departamento'}<br/>
                                                            <small>{g.categoria || 'Sin categoría'}</small>
                                                        </Popup>
                                                    </Marker>
                                                ))
                                            }
                                        </MapContainer>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state" style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
                            <Building2 size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3 style={{ margin: '0 0 8px', color: '#e2e8f0' }}>Sin datos de generadores</h3>
                            <p style={{ margin: 0 }}>Haz clic en "Generar Reporte" para cargar los datos de generadores por departamento y volumen.</p>
                        </div>
                    )
                ) : null}
            </div>

            {/* Exportar */}
            {user?.rol === 'ADMIN' && (
                <div className="card exportar-card">
                    <h3><Download size={20} /> Exportar Datos</h3>
                    <p>Descarga los datos en formato CSV para su análisis</p>
                    <div className="exportar-buttons">
                        <button
                            className="btn btn-secondary"
                            onClick={() => exportarCSV('manifiestos')}
                            disabled={exportando}
                        >
                            {exportando ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                            Manifiestos
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => exportarCSV('generadores')}
                            disabled={exportando}
                        >
                            <Download size={16} />
                            Generadores
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => exportarCSV('transportistas')}
                            disabled={exportando}
                        >
                            <Download size={16} />
                            Transportistas
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => exportarCSV('operadores')}
                            disabled={exportando}
                        >
                            <Download size={16} />
                            Operadores
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reportes;
// build Thu Jan 22 16:07:30 -03 2026
