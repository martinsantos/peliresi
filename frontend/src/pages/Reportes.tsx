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
    Clock
} from 'lucide-react';
import './Reportes.css';

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

// Datos de demostración - ahora importados de ../data/demoReportes

const Reportes: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'manifiestos' | 'tratados' | 'transporte'>('manifiestos');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [reporte, setReporte] = useState<ReporteManifiestos | null>(datosDemo.manifiestos);
    const [reporteTratados, setReporteTratados] = useState<any>(datosDemo.tratados);
    const [reporteTransporte, setReporteTransporte] = useState<any>(datosDemo.transporte);
    const [exportando, setExportando] = useState(false);
    const [usandoDemo, setUsandoDemo] = useState(true);

    useEffect(() => {
        // Establecer fechas por defecto (último mes)
        const hoy = new Date();
        const mesAnterior = new Date();
        mesAnterior.setMonth(mesAnterior.getMonth() - 1);

        setFechaFin(hoy.toISOString().split('T')[0]);
        setFechaInicio(mesAnterior.toISOString().split('T')[0]);
    }, []);

    const cargarReporte = async () => {
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
                                    <h3>{reporte.resumen.totalManifiestos}</h3>
                                    <span>Total Manifiestos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon green">
                                    <Package size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{reporte.resumen.totalResiduos.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</h3>
                                    <span>Kg de Residuos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon purple">
                                    <Activity size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{Object.keys(reporte.porTipoResiduo).length}</h3>
                                    <span>Tipos de Residuo</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon orange">
                                    <TrendingUp size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>{Math.round((reporte.porEstado.TRATADO || 0) / reporte.resumen.totalManifiestos * 100)}%</h3>
                                    <span>Tasa Completitud</span>
                                </div>
                            </div>
                        </div>

                        {/* Por Estado */}
                        <div className="reporte-section">
                            <h3><PieChart size={20} /> Distribución por Estado</h3>
                            <div className="estado-bars">
                                {Object.entries(reporte.porEstado).map(([estado, cantidad]) => (
                                    <div key={estado} className="estado-bar-item">
                                        <div className="estado-label">
                                            <span className="estado-dot" style={{ background: getEstadoColor(estado), color: getEstadoColor(estado) }} />
                                            {estado.replace('_', ' ')}
                                        </div>
                                        <div className="bar-container">
                                            <div
                                                className="bar-fill"
                                                style={{
                                                    width: `${(cantidad / reporte.resumen.totalManifiestos) * 100}%`,
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
                            <div className="table-container">
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
                            <div className="table-container">
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
