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
    Clock,
    Building2,
    MapPin,
    Award,
    ChevronLeft,
    ChevronRight,
    List,
    Eye,
    Map as MapIcon,
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
    const [reporteTratados, setReporteTratados] = useState<any>(datosDemo.tratados);
    const [reporteTransporte, setReporteTransporte] = useState<any>(datosDemo.transporte);
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

    // Vista de mapa o tabla
    const [vistaActual, setVistaActual] = useState<'tabla' | 'mapa'>('tabla');

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
            if (!reporteGeneradores) {
                cargarReporteGeneradores();
            }
            cargarConteoTiposResiduo();
        }
    }, [activeTab]);

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

    const cargarReporte = async () => {
        if (activeTab === 'generadores') {
            await cargarReporteGeneradores();
            return;
        }

        setLoading(true);
        setUsandoDemo(false);
        try {
            const params = { fechaInicio, fechaFin };

            if (activeTab === 'manifiestos') {
                const data = await reporteService.getReporteManifiestos(params);
                setReporte(data);
            } else if (activeTab === 'tratados') {
                const data = await reporteService.getReporteTratados(params);
                setReporteTratados(data);
            } else if (activeTab === 'transporte') {
                const data = await reporteService.getReporteTransporte(params);
                setReporteTransporte(data);
            }
        } catch (error) {
            console.error('Error al cargar reporte:', error);
            // Si hay error, usar datos demo
            setUsandoDemo(true);
            if (activeTab === 'manifiestos') setReporte(datosDemo.manifiestos);
            if (activeTab === 'tratados') setReporteTratados(datosDemo.tratados);
            if (activeTab === 'transporte') setReporteTransporte(datosDemo.transporte);
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
                ) : activeTab === 'tratados' && reporteTratados ? (
                    <>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon green">
                                    <CheckCircle size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{reporteTratados.resumen.totalManifiestosTratados}</h3>
                                    <span>Manifiestos Tratados</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon blue">
                                    <Package size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{reporteTratados.resumen.totalResiduosTratados.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</h3>
                                    <span>Kg Tratados</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon purple">
                                    <Factory size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{Object.keys(reporteTratados.porGenerador).length}</h3>
                                    <span>Generadores Atendidos</span>
                                </div>
                            </div>
                        </div>

                        <div className="reporte-section">
                            <h3><Factory size={20} /> Manifiestos por Generador</h3>
                            <div className="estado-bars">
                                {Object.entries(reporteTratados.porGenerador).map(([generador, cantidad], index) => {
                                    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'];
                                    const color = colors[index % colors.length];
                                    const total = Object.values(reporteTratados.porGenerador).reduce((a: number, b: unknown) => a + (b as number), 0);
                                    return (
                                        <div key={generador} className="estado-bar-item">
                                            <div className="estado-label" style={{ minWidth: '200px' }}>
                                                <span className="estado-dot" style={{ background: color }} />
                                                {generador}
                                            </div>
                                            <div className="bar-container">
                                                <div
                                                    className="bar-fill"
                                                    style={{
                                                        width: `${((cantidad as number) / total) * 100}%`,
                                                        background: `linear-gradient(90deg, ${color}, ${color}dd)`
                                                    }}
                                                />
                                            </div>
                                            <span className="bar-value">{cantidad as number}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                ) : activeTab === 'transporte' && reporteTransporte ? (
                    <>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon orange">
                                    <Truck size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{reporteTransporte.resumen.totalTransportistas}</h3>
                                    <span>Transportistas Activos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon blue">
                                    <FileText size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{reporteTransporte.resumen.totalViajes}</h3>
                                    <span>Total Viajes</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon purple">
                                    <Clock size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{reporteTransporte.resumen.viajesActivos}</h3>
                                    <span>En Tránsito</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon green">
                                    <CheckCircle size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{Math.round((reporteTransporte.resumen.viajesCompletados / reporteTransporte.resumen.totalViajes) * 100)}%</h3>
                                    <span>Tasa Éxito</span>
                                </div>
                            </div>
                        </div>

                        <div className="reporte-section">
                            <h3><Truck size={20} /> Rendimiento por Transportista</h3>

                            {/* Mobile Cards */}
                            <div className="reporte-mobile-cards">
                                {reporteTransporte.transportistas.map((t: any) => (
                                    <div key={t.cuit} className="transportista-mobile-card">
                                        <div className="transportista-card-header">
                                            <div className="transportista-info">
                                                <span className="transportista-name">{t.transportista}</span>
                                                <span className="transportista-cuit">{t.cuit}</span>
                                            </div>
                                            <span className="transportista-badge">{t.tasaCompletitud}</span>
                                        </div>
                                        <div className="transportista-card-body">
                                            <div className="transportista-stats-grid">
                                                <div className="transportista-stat">
                                                    <span className="stat-value">{t.totalViajes}</span>
                                                    <span className="stat-label">Total</span>
                                                </div>
                                                <div className="transportista-stat success">
                                                    <span className="stat-value">{t.completados}</span>
                                                    <span className="stat-label">Completados</span>
                                                </div>
                                                <div className="transportista-stat warning">
                                                    <span className="stat-value">{t.enTransito}</span>
                                                    <span className="stat-label">En Tránsito</span>
                                                </div>
                                            </div>
                                            <div className="transportista-flota">
                                                <span>{t.vehiculos} vehículos</span>
                                                <span className="separator">·</span>
                                                <span>{t.choferes} choferes</span>
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
                                            <th>Transportista</th>
                                            <th>Total</th>
                                            <th>Completados</th>
                                            <th>En Tránsito</th>
                                            <th>Flota</th>
                                            <th>Completitud</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reporteTransporte.transportistas.map((t: any) => (
                                            <tr key={t.cuit}>
                                                <td>
                                                    <strong>{t.transportista}</strong>
                                                    <br />
                                                    <small>{t.cuit}</small>
                                                </td>
                                                <td>{t.totalViajes}</td>
                                                <td className="text-success">{t.completados}</td>
                                                <td className="text-warning">{t.enTransito}</td>
                                                <td>
                                                    <small>{t.vehiculos} vehículos · {t.choferes} choferes</small>
                                                </td>
                                                <td>
                                                    <span className="badge badge-success">{t.tasaCompletitud}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : activeTab === 'generadores' ? (
                    reporteGeneradores ? (
                        <>
                            {/* Filtros específicos para Generadores */}
                            {filtrosDisponibles && (
                                <div className="generadores-filtros-section" style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    marginBottom: '1.5rem',
                                    padding: '1rem',
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)'
                                }}>
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
                                        {(filtroDepto || filtroRubro || filtroTipoResiduo) && (
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
                            )}

                            {/* Stats Cards */}
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-icon purple">
                                        <Building2 size={28} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{reporteGeneradores.totales.totalGeneradores}</h3>
                                        <span>Total Generadores</span>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon green">
                                        <CheckCircle size={28} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{reporteGeneradores.totales.totalActivos}</h3>
                                        <span>Activos</span>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon blue">
                                        <MapPin size={28} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{reporteGeneradores.departamentos.length}</h3>
                                        <span>Departamentos</span>
                                    </div>
                                </div>
                                <div className="stat-card">
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

                            {/* Lista Completa de Generadores Filtrados */}
                            {listaGeneradores && listaGeneradores.generadores.length > 0 && (
                                <div className="reporte-section" style={{ marginTop: '2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <h3 style={{ margin: 0 }}>
                                            <List size={20} /> Lista de Generadores
                                            {(filtroDepto || filtroRubro || filtroTipoResiduo) && (
                                                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#94a3b8', marginLeft: '0.5rem' }}>
                                                    (Filtrado: {[
                                                        filtroDepto,
                                                        filtroRubro,
                                                        filtroTipoResiduo && filtrosDisponibles?.tiposResiduo?.find(t => t.id === filtroTipoResiduo)?.codigo
                                                    ].filter(Boolean).join(' / ')})
                                                </span>
                                            )}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div className="vista-toggle" style={{ display: 'flex', gap: '0.25rem', background: 'rgba(100,116,139,0.1)', padding: '4px', borderRadius: '8px' }}>
                                                <button
                                                    className={`btn btn-icon btn-sm ${vistaActual === 'tabla' ? 'btn-primary' : 'btn-ghost'}`}
                                                    onClick={() => setVistaActual('tabla')}
                                                    title="Vista de tabla"
                                                >
                                                    <List size={16} />
                                                </button>
                                                <button
                                                    className={`btn btn-icon btn-sm ${vistaActual === 'mapa' ? 'btn-primary' : 'btn-ghost'}`}
                                                    onClick={() => setVistaActual('mapa')}
                                                    title="Vista de mapa"
                                                >
                                                    <MapIcon size={16} />
                                                </button>
                                            </div>
                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                                {listaGeneradores.pagination.total} resultados
                                            </span>
                                        </div>
                                    </div>

                                    {loadingLista && (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                            <Loader2 size={24} className="spin" />
                                        </div>
                                    )}

                                    {!loadingLista && (
                                        <>
                                            {/* Vista de Mapa */}
                                            {vistaActual === 'mapa' && (
                                                <div className="mapa-generadores" style={{
                                                    height: '500px',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    border: '1px solid rgba(148, 163, 184, 0.2)'
                                                }}>
                                                    <MapContainer
                                                        center={[-32.89, -68.83]}
                                                        zoom={9}
                                                        style={{ height: '100%', width: '100%' }}
                                                    >
                                                        <TileLayer
                                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                        />
                                                        {listaGeneradores.generadores
                                                            .filter(g => g.latitud && g.longitud)
                                                            .map(g => (
                                                                <Marker
                                                                    key={g.id}
                                                                    position={[g.latitud!, g.longitud!]}
                                                                >
                                                                    <Popup>
                                                                        <div style={{ minWidth: '200px' }}>
                                                                            <strong style={{ fontSize: '1rem' }}>{g.razonSocial}</strong>
                                                                            <br />
                                                                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{g.cuit}</span>
                                                                            <hr style={{ margin: '8px 0', borderColor: 'rgba(148,163,184,0.2)' }} />
                                                                            <div style={{ fontSize: '0.85rem' }}>
                                                                                <p style={{ margin: '4px 0' }}><strong>Rubro:</strong> {g.rubro || 'Sin rubro'}</p>
                                                                                <p style={{ margin: '4px 0' }}><strong>Departamento:</strong> {g.departamento || '—'}</p>
                                                                                <p style={{ margin: '4px 0' }}><strong>Volumen:</strong> {g.volumenKg.toLocaleString('es-AR')} kg</p>
                                                                                <p style={{ margin: '4px 0' }}><strong>Manifiestos:</strong> {g.manifiestos}</p>
                                                                            </div>
                                                                            <button
                                                                                className="btn btn-primary btn-sm"
                                                                                style={{ marginTop: '8px', width: '100%' }}
                                                                                onClick={() => navigate(`/admin/generadores/${g.id}`)}
                                                                            >
                                                                                Ver detalle
                                                                            </button>
                                                                        </div>
                                                                    </Popup>
                                                                </Marker>
                                                            ))
                                                        }
                                                    </MapContainer>
                                                    {listaGeneradores.generadores.filter(g => g.latitud && g.longitud).length === 0 && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            background: 'rgba(0,0,0,0.7)',
                                                            color: 'white',
                                                            padding: '1rem 2rem',
                                                            borderRadius: '8px',
                                                            zIndex: 1000
                                                        }}>
                                                            No hay generadores con geolocalización
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Vista de Tabla/Cards */}
                                            {vistaActual === 'tabla' && (
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
                                        </>
                                    )}
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
