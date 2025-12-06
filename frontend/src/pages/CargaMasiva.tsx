import React, { useState } from 'react';
import {
    Upload,
    Download,
    FileSpreadsheet,
    CheckCircle,
    AlertTriangle,
    X,
    Loader2,
    Factory,
    Truck,
    Building2,
    FileText
} from 'lucide-react';
import { cargaMasivaService } from '../services/notification.service';
import './CargaMasiva.css';

type TipoActorType = 'generadores' | 'transportistas' | 'operadores';

interface ResultadoCarga {
    total: number;
    exitosos: number;
    errores: { linea: number; error: string }[];
}

const CargaMasiva: React.FC = () => {
    const [tipoActor, setTipoActor] = useState<TipoActorType>('generadores');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
    const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

    const tiposActor = [
        { value: 'generadores' as TipoActorType, label: 'Generadores', icon: <Factory size={20} /> },
        { value: 'transportistas' as TipoActorType, label: 'Transportistas', icon: <Truck size={20} /> },
        { value: 'operadores' as TipoActorType, label: 'Operadores', icon: <Building2 size={20} /> },
    ];

    const descargarPlantilla = async () => {
        try {
            await cargaMasivaService.descargarPlantilla(tipoActor);
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error al descargar plantilla' });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.csv')) {
                setMensaje({ tipo: 'error', texto: 'Solo se aceptan archivos CSV' });
                return;
            }
            setArchivo(file);
            setResultado(null);
            setMensaje(null);
        }
    };

    const procesarArchivo = async () => {
        if (!archivo) {
            setMensaje({ tipo: 'error', texto: 'Seleccione un archivo CSV' });
            return;
        }

        setCargando(true);
        setResultado(null);
        setMensaje(null);

        try {
            const data = await cargaMasivaService.cargarArchivo(tipoActor, archivo);
            setResultado(data);

            if (data.errores.length === 0) {
                setMensaje({ tipo: 'success', texto: `Se procesaron ${data.exitosos} registros correctamente` });
            } else {
                setMensaje({ tipo: 'error', texto: `${data.exitosos} exitosos, ${data.errores.length} con errores` });
            }
        } catch (error: any) {
            setMensaje({ tipo: 'error', texto: error.message || 'Error al procesar archivo' });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="carga-masiva-page">
            <div className="page-header">
                <div>
                    <h1>Carga Masiva de Datos</h1>
                    <p>Importa actores desde archivos CSV</p>
                </div>
            </div>

            {mensaje && (
                <div className={`message ${mensaje.tipo}`}>
                    {mensaje.tipo === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {mensaje.texto}
                    <button className="message-close" onClick={() => setMensaje(null)}>
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="carga-container">
                {/* Paso 1: Seleccionar tipo */}
                <div className="step-card">
                    <div className="step-header">
                        <div className="step-number">1</div>
                        <h3>Seleccionar Tipo de Actor</h3>
                    </div>
                    <div className="tipo-selector">
                        {tiposActor.map(tipo => (
                            <button
                                key={tipo.value}
                                className={`tipo-btn ${tipoActor === tipo.value ? 'selected' : ''}`}
                                onClick={() => {
                                    setTipoActor(tipo.value);
                                    setArchivo(null);
                                    setResultado(null);
                                }}
                            >
                                {tipo.icon}
                                <span>{tipo.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Paso 2: Descargar plantilla */}
                <div className="step-card">
                    <div className="step-header">
                        <div className="step-number">2</div>
                        <h3>Descargar Plantilla</h3>
                    </div>
                    <p className="step-description">
                        Descarga la plantilla CSV con las columnas requeridas para {tipoActor}
                    </p>
                    <button className="btn btn-secondary" onClick={descargarPlantilla}>
                        <Download size={18} />
                        Descargar Plantilla CSV
                    </button>
                </div>

                {/* Paso 3: Subir archivo */}
                <div className="step-card">
                    <div className="step-header">
                        <div className="step-number">3</div>
                        <h3>Cargar Archivo</h3>
                    </div>

                    <div
                        className={`upload-area ${archivo ? 'has-file' : ''}`}
                        onClick={() => document.getElementById('file-input')?.click()}
                    >
                        <input
                            id="file-input"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            hidden
                        />
                        {archivo ? (
                            <>
                                <FileSpreadsheet size={40} />
                                <p className="file-name">{archivo.name}</p>
                                <span className="file-size">{(archivo.size / 1024).toFixed(1)} KB</span>
                            </>
                        ) : (
                            <>
                                <Upload size={40} />
                                <p>Arrastra un archivo aquí o haz clic para seleccionar</p>
                                <span>Solo archivos CSV</span>
                            </>
                        )}
                    </div>

                    {archivo && (
                        <button
                            className="btn btn-primary btn-large"
                            onClick={procesarArchivo}
                            disabled={cargando}
                        >
                            {cargando ? (
                                <>
                                    <Loader2 size={20} className="spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Upload size={20} />
                                    Procesar Archivo
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Resultados */}
                {resultado && (
                    <div className="step-card resultado-card">
                        <div className="step-header">
                            <div className="step-number">
                                {resultado.errores.length === 0 ? (
                                    <CheckCircle size={20} />
                                ) : (
                                    <AlertTriangle size={20} />
                                )}
                            </div>
                            <h3>Resultados de la Importación</h3>
                        </div>

                        <div className="resultado-stats">
                            <div className="stat success">
                                <span className="stat-value">{resultado.exitosos}</span>
                                <span className="stat-label">Exitosos</span>
                            </div>
                            <div className="stat error">
                                <span className="stat-value">{resultado.errores.length}</span>
                                <span className="stat-label">Errores</span>
                            </div>
                            <div className="stat total">
                                <span className="stat-value">{resultado.total}</span>
                                <span className="stat-label">Total</span>
                            </div>
                        </div>

                        {resultado.errores.length > 0 && (
                            <div className="errores-lista">
                                <h4>Detalle de Errores</h4>
                                <div className="errores-scroll">
                                    {resultado.errores.map((error, idx) => (
                                        <div key={idx} className="error-item">
                                            <span className="linea">Línea {error.linea}</span>
                                            <span className="error-msg">{error.error}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Instrucciones */}
            <div className="instrucciones-card">
                <h3><FileText size={20} /> Instrucciones</h3>
                <ul>
                    <li>Descarga la plantilla correspondiente al tipo de actor</li>
                    <li>Completa los datos en el archivo CSV respetando el formato</li>
                    <li>Los registros existentes (mismo CUIT) serán actualizados</li>
                    <li>Los nuevos registros crearán un usuario con contraseña temporal</li>
                    <li>Revisa los errores si los hay y corrige el archivo</li>
                </ul>
            </div>
        </div>
    );
};

export default CargaMasiva;
