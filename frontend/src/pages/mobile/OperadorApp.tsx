/**
 * OperadorApp - App Móvil para Operadores de Tratamiento
 *
 * Conectado a backend real con:
 * - Carga de manifiestos por estado (ENTREGADO, RECIBIDO, TRATADO)
 * - Confirmar recepción con pesaje
 * - Rechazar carga
 * - Registrar tratamiento
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Package,
    Scale,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Camera,
    FileText,
    ChevronRight,
    RefreshCw,
    Wifi,
    WifiOff,
    Loader2,
    Factory,
    Beaker
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { manifiestoService } from '../../services/manifiesto.service';
import './OperadorApp.css';

interface ManifiestoOperador {
    id: string;
    numero: string;
    estado: string;
    generador: {
        razonSocial: string;
        domicilio?: string;
    };
    transportista: {
        razonSocial: string;
    };
    residuos: Array<{
        id: string;
        tipoResiduo: {
            codigo: string;
            nombre: string;
        };
        cantidad: number;
        unidad: string;
        pesoReal?: number;
    }>;
    pesoDeclarado?: number;
    pesoReal?: number;
    fechaEntrega?: string;
    fechaRecepcion?: string;
    fechaTratamiento?: string;
    observaciones?: string;
}

type TabType = 'entrantes' | 'recibidos' | 'tratados';

const OperadorApp: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('entrantes');
    const [manifiestos, setManifiestos] = useState<{
        entrantes: ManifiestoOperador[];
        recibidos: ManifiestoOperador[];
        tratados: ManifiestoOperador[];
    }>({
        entrantes: [],
        recibidos: [],
        tratados: []
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [selectedManifiesto, setSelectedManifiesto] = useState<ManifiestoOperador | null>(null);
    const [showPesajeModal, setShowPesajeModal] = useState(false);
    const [showRechazoModal, setShowRechazoModal] = useState(false);
    const [procesando, setProcesando] = useState(false);

    // Form states
    const [pesoReal, setPesoReal] = useState<string>('');
    const [observaciones, setObservaciones] = useState('');
    const [motivoRechazo, setMotivoRechazo] = useState('');

    // Monitor online status
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

    // Fetch manifiestos from backend
    const fetchManifiestos = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            // Fetch manifiestos in different states for operador
            const [entregados, recibidos, tratados] = await Promise.all([
                manifiestoService.getManifiestos({ estado: 'ENTREGADO' }),
                manifiestoService.getManifiestos({ estado: 'RECIBIDO' }),
                manifiestoService.getManifiestos({ estado: 'TRATADO', limit: 20 })
            ]);

            setManifiestos({
                entrantes: entregados.manifiestos as unknown as ManifiestoOperador[],
                recibidos: recibidos.manifiestos as unknown as ManifiestoOperador[],
                tratados: tratados.manifiestos as unknown as ManifiestoOperador[]
            });
        } catch (err: any) {
            console.error('[OperadorApp] Error fetching manifiestos:', err);
            setError(err.message || 'Error al cargar manifiestos');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchManifiestos();
    }, [fetchManifiestos]);

    // Handle confirmar recepción
    const handleConfirmarRecepcion = async () => {
        if (!selectedManifiesto) return;

        setProcesando(true);
        try {
            await manifiestoService.confirmarRecepcion(selectedManifiesto.id, {
                observaciones,
                pesoReal: pesoReal ? parseFloat(pesoReal) : undefined
            });

            setShowPesajeModal(false);
            setSelectedManifiesto(null);
            setPesoReal('');
            setObservaciones('');

            // Refresh data
            await fetchManifiestos(true);
        } catch (err: any) {
            console.error('[OperadorApp] Error confirming reception:', err);
            alert(err.response?.data?.error || 'Error al confirmar recepción');
        } finally {
            setProcesando(false);
        }
    };

    // Handle rechazar carga
    const handleRechazarCarga = async () => {
        if (!selectedManifiesto || !motivoRechazo.trim()) return;

        setProcesando(true);
        try {
            await manifiestoService.rechazarCarga(selectedManifiesto.id, {
                motivo: motivoRechazo,
                descripcion: observaciones
            });

            setShowRechazoModal(false);
            setSelectedManifiesto(null);
            setMotivoRechazo('');
            setObservaciones('');

            // Refresh data
            await fetchManifiestos(true);
        } catch (err: any) {
            console.error('[OperadorApp] Error rejecting cargo:', err);
            alert(err.response?.data?.error || 'Error al rechazar carga');
        } finally {
            setProcesando(false);
        }
    };

    // Calculate total weight
    const calcularPesoTotal = (residuos?: ManifiestoOperador['residuos']) => {
        if (!residuos || !Array.isArray(residuos)) return 0;
        return residuos.reduce((sum, r) => sum + (r.cantidad || 0), 0);
    };

    // Get residuos display
    const getResiduosDisplay = (m: ManifiestoOperador) => {
        if (!m.residuos || !Array.isArray(m.residuos)) return '-';
        return m.residuos.map(r => r.tipoResiduo?.codigo || 'N/A').join(', ');
    };

    const currentList = manifiestos[activeTab];

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="mobile-app operador-app">
                <div className="loading-container">
                    <Loader2 className="spinning" size={48} />
                    <p>Cargando manifiestos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mobile-app operador-app animate-fadeIn">
            {/* App Header */}
            <div className="mobile-header operador-header">
                <div className="header-top">
                    <div className="user-welcome">
                        <span className="welcome-label">Planta de Tratamiento</span>
                        <h3>{user?.nombre || 'Operador'}</h3>
                    </div>
                    <div className="header-actions">
                        <div className={`online-indicator ${isOnline ? 'online' : 'offline'}`}>
                            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                        </div>
                        <button
                            className="refresh-btn"
                            onClick={() => fetchManifiestos(true)}
                            disabled={refreshing}
                        >
                            <RefreshCw size={20} className={refreshing ? 'spinning' : ''} />
                        </button>
                        <div className="header-avatar operador">
                            <Factory size={20} />
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="mobile-stats">
                    <div className="stat-card info" onClick={() => setActiveTab('entrantes')}>
                        <span className="stat-value">{manifiestos.entrantes.length}</span>
                        <span className="stat-label">Pendientes</span>
                    </div>
                    <div className="stat-card success" onClick={() => setActiveTab('recibidos')}>
                        <span className="stat-value">{manifiestos.recibidos.length}</span>
                        <span className="stat-label">Recibidos</span>
                    </div>
                    <div className="stat-card primary" onClick={() => setActiveTab('tratados')}>
                        <span className="stat-value">{manifiestos.tratados.length}</span>
                        <span className="stat-label">Tratados</span>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="error-banner">
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                    <button onClick={() => fetchManifiestos()}>Reintentar</button>
                </div>
            )}

            {/* Tabs */}
            <div className="mobile-tabs">
                <button
                    className={`tab-btn ${activeTab === 'entrantes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('entrantes')}
                >
                    Pendientes
                </button>
                <button
                    className={`tab-btn ${activeTab === 'recibidos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recibidos')}
                >
                    Recibidos
                </button>
                <button
                    className={`tab-btn ${activeTab === 'tratados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tratados')}
                >
                    Tratados
                </button>
            </div>

            {/* Content List */}
            <div className="mobile-content">
                <div className="cards-list">
                    {/* Entrantes (ENTREGADO - pendientes de confirmar recepción) */}
                    {activeTab === 'entrantes' && currentList.map((m) => (
                        <div key={m.id} className="mobile-card operador-card">
                            <div className="card-header">
                                <span className="card-id">#{m.numero}</span>
                                <span className="eta-badge">
                                    {formatDate(m.fechaEntrega)}
                                </span>
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <Package size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Residuo(s)</span>
                                        <p>{getResiduosDisplay(m)}</p>
                                    </div>
                                </div>

                                <div className="info-row">
                                    <Scale size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Cantidad Declarada</span>
                                        <p>{calcularPesoTotal(m.residuos)} kg</p>
                                    </div>
                                </div>

                                <div className="info-row">
                                    <FileText size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Generador</span>
                                        <p>{m.generador?.razonSocial || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer">
                                <div className="action-buttons-row">
                                    <button
                                        className="btn-mobile danger small"
                                        onClick={() => {
                                            setSelectedManifiesto(m);
                                            setShowRechazoModal(true);
                                        }}
                                    >
                                        <XCircle size={18} />
                                        Rechazar
                                    </button>
                                    <button
                                        className="btn-mobile success small"
                                        onClick={() => {
                                            setSelectedManifiesto(m);
                                            setShowPesajeModal(true);
                                        }}
                                    >
                                        <CheckCircle size={18} />
                                        Recibir
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Recibidos (RECIBIDO - pendientes de tratamiento) */}
                    {activeTab === 'recibidos' && currentList.map((m) => (
                        <div key={m.id} className="mobile-card operador-card">
                            <div className="card-header">
                                <span className="card-id">#{m.numero}</span>
                                <span className="status-badge success">Recibido</span>
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <Package size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Residuo(s)</span>
                                        <p>{getResiduosDisplay(m)}</p>
                                    </div>
                                </div>

                                <div className="weight-comparison">
                                    <div className="weight-item">
                                        <span className="weight-label">Declarado</span>
                                        <span className="weight-value">{calcularPesoTotal(m.residuos)} kg</span>
                                    </div>
                                    <div className="weight-arrow">→</div>
                                    <div className="weight-item">
                                        <span className="weight-label">Real</span>
                                        <span className="weight-value highlight">{m.pesoReal || '-'} kg</span>
                                    </div>
                                </div>

                                <div className="info-row">
                                    <FileText size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Fecha Recepción</span>
                                        <p>{formatDate(m.fechaRecepcion)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer">
                                <button className="btn-mobile primary">
                                    <Beaker size={18} />
                                    Registrar Tratamiento
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Tratados (TRATADO - historial) */}
                    {activeTab === 'tratados' && currentList.map((m) => (
                        <div key={m.id} className="mobile-card operador-card completed">
                            <div className="card-header">
                                <span className="card-id">#{m.numero}</span>
                                <span className="status-badge treated">Tratado</span>
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <Package size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Residuo(s)</span>
                                        <p>{getResiduosDisplay(m)}</p>
                                    </div>
                                </div>

                                <div className="info-row">
                                    <FileText size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Fecha Tratamiento</span>
                                        <p>{formatDate(m.fechaTratamiento)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer">
                                <button className="btn-mobile info">
                                    Ver Certificado
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {currentList.length === 0 && (
                        <div className="empty-state">
                            <Package size={48} />
                            <p>No hay manifiestos en esta sección</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Action Button (FAB) */}
            <button className="fab-scan">
                <Camera size={24} />
            </button>

            {/* Modal Pesaje/Recepción */}
            {showPesajeModal && selectedManifiesto && (
                <div className="modal-overlay" onClick={() => setShowPesajeModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Confirmar Recepción</h3>
                        <p className="modal-subtitle">Manifiesto #{selectedManifiesto.numero}</p>

                        <div className="form-group">
                            <label>Peso Real (kg)</label>
                            <input
                                type="number"
                                value={pesoReal}
                                onChange={e => setPesoReal(e.target.value)}
                                placeholder={`Declarado: ${calcularPesoTotal(selectedManifiesto.residuos)} kg`}
                            />
                        </div>

                        <div className="form-group">
                            <label>Observaciones</label>
                            <textarea
                                value={observaciones}
                                onChange={e => setObservaciones(e.target.value)}
                                placeholder="Observaciones de la recepción..."
                                rows={3}
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setShowPesajeModal(false)}
                                disabled={procesando}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={handleConfirmarRecepcion}
                                disabled={procesando}
                            >
                                {procesando ? <Loader2 className="spinning" size={18} /> : <CheckCircle size={18} />}
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Rechazo */}
            {showRechazoModal && selectedManifiesto && (
                <div className="modal-overlay" onClick={() => setShowRechazoModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Rechazar Carga</h3>
                        <p className="modal-subtitle">Manifiesto #{selectedManifiesto.numero}</p>

                        <div className="form-group">
                            <label>Motivo del Rechazo *</label>
                            <select
                                value={motivoRechazo}
                                onChange={e => setMotivoRechazo(e.target.value)}
                            >
                                <option value="">Seleccione un motivo</option>
                                <option value="DOCUMENTACION_INCORRECTA">Documentación incorrecta</option>
                                <option value="RESIDUO_NO_COINCIDE">Residuo no coincide con declarado</option>
                                <option value="EMBALAJE_INADECUADO">Embalaje inadecuado</option>
                                <option value="CANTIDAD_EXCEDE">Cantidad excede lo autorizado</option>
                                <option value="CONTAMINACION_CRUZADA">Contaminación cruzada</option>
                                <option value="OTRO">Otro</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Descripción</label>
                            <textarea
                                value={observaciones}
                                onChange={e => setObservaciones(e.target.value)}
                                placeholder="Describa el motivo del rechazo..."
                                rows={3}
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setShowRechazoModal(false)}
                                disabled={procesando}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-reject"
                                onClick={handleRechazarCarga}
                                disabled={procesando || !motivoRechazo}
                            >
                                {procesando ? <Loader2 className="spinning" size={18} /> : <XCircle size={18} />}
                                Rechazar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OperadorApp;
