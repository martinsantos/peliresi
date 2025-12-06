import React, { useState, useEffect } from 'react';
import { manifiestoService } from '../../services/manifiesto.service';
import { db } from '../../services/indexeddb';
import api from '../../services/api';
import type { Manifiesto } from '../../types';
import {
    Truck,
    MapPin,
    Navigation,
    QrCode,
    Package,
    ChevronRight,
    AlertTriangle,
    Wifi,
    WifiOff,
    RefreshCw,
    Download
} from 'lucide-react';
import './TransportistaApp.css';

const TransportistaApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pendientes' | 'en-curso' | 'historial'>('pendientes');
    const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [syncing, setSyncing] = useState(false);

    // Mock data para demo visual inmediata
    const mockManifiestos = [
        {
            id: 'demo-1',
            numero: '2025-001234',
            estado: 'APROBADO',
            generador: { razonSocial: 'Química Industrial Mendoza', domicilio: 'Parque Industrial Las Heras, Lote 4' },
            residuos: [{ tipoResiduo: { codigo: 'Y1', nombre: 'Desechos clínicos' }, cantidad: 150, unidad: 'kg' }],
            fechaFirma: new Date().toISOString()
        },
        {
            id: 'demo-2',
            numero: '2025-001230',
            estado: 'EN_TRANSITO',
            generador: { razonSocial: 'Hospital Central', domicilio: 'Alem 123, Ciudad' },
            operador: { razonSocial: 'Tratamiento Cuyo', domicilio: 'Ruta 7 km 1050' },
            residuos: [{ tipoResiduo: { codigo: 'Y15', nombre: 'Residuos Hospitalarios' }, cantidad: 500, unidad: 'kg' }],
            fechaRetiro: new Date(Date.now() - 3600000).toISOString() // hace 1 hora
        }
    ];

    useEffect(() => {
        loadData();

        // Listener para cambios de conectividad
        const handleOnline = () => {
            setIsOnline(true);
            syncData(); // Auto-sync al reconectar
        };
        const handleOffline = () => {
            setIsOnline(false);
        };

        // Listener para mensajes del Service Worker
        const handleSWMessage = (event: any) => {
            if (event.detail?.type === 'SYNC_COMPLETE') {
                console.log('🔄 Sync completada desde SW');
                loadData();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('sw-sync-complete', handleSWMessage);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('sw-sync-complete', handleSWMessage);
        };
    }, []);

    const loadData = async () => {
        try {
            if (isOnline) {
                // Modo online: cargar desde API
                const data = await manifiestoService.getManifiestos({ limit: 10 });
                if (data.manifiestos && data.manifiestos.length > 0) {
                    setManifiestos(data.manifiestos);
                    // Guardar en IndexedDB para uso offline
                    data.manifiestos.forEach(m => db.saveManifiesto(m).catch(console.error));
                } else {
                    setManifiestos(mockManifiestos as any);
                }
            } else {
                // Modo offline: cargar desde IndexedDB
                const cachedManifiestos = await db.getAllManifiestos();
                if (cachedManifiestos.length > 0) {
                    setManifiestos(cachedManifiestos);
                    console.log('📦 Cargados', cachedManifiestos.length, 'manifiestos desde IndexedDB');
                } else {
                    setManifiestos(mockManifiestos as any);
                }
            }
        } catch (err) {
            console.error('Error cargando datos:', err);
            // Fallback a IndexedDB
            try {
                const cachedManifiestos = await db.getAllManifiestos();
                if (cachedManifiestos.length > 0) {
                    setManifiestos(cachedManifiestos);
                } else {
                    setManifiestos(mockManifiestos as any);
                }
            } catch {
                setManifiestos(mockManifiestos as any);
            }
        } finally {
            setLoading(false);
        }
    };

    // CU-T01: Sincronización Inicial con endpoint real
    const syncData = async () => {
        setSyncing(true);
        try {
            console.log('🔄 Iniciando sincronización...');

            // Llamar al endpoint de sync-inicial
            const response = await api.get('/manifiestos/sync-inicial');
            const { catalogoResiduos, operadores, manifiestos: syncedManifiestos } = response.data.data;

            // Guardar en IndexedDB
            if (catalogoResiduos) {
                await db.saveTiposResiduos(catalogoResiduos);
                console.log('✅ Catálogo de residuos sincronizado:', catalogoResiduos.length);
            }

            if (operadores) {
                await db.saveOperadores(operadores);
                console.log('✅ Operadores sincronizados:', operadores.length);
            }

            if (syncedManifiestos) {
                for (const m of syncedManifiestos) {
                    await db.saveManifiesto(m);
                }
                console.log('✅ Manifiestos sincronizados:', syncedManifiestos.length);
            }

            setLastSync(new Date());
            await loadData();

            console.log('✅ Sincronización completada');
        } catch (err) {
            console.error('❌ Error en sincronización:', err);
            // Si falla, simular para demo
            await new Promise(resolve => setTimeout(resolve, 1500));
            setLastSync(new Date());
            await loadData();
        } finally {
            setSyncing(false);
        }
    };

    const filteredManifiestos = manifiestos.filter(m => {
        if (activeTab === 'pendientes') return m.estado === 'APROBADO';
        if (activeTab === 'en-curso') return m.estado === 'EN_TRANSITO';
        return ['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(m.estado);
    });

    return (
        <div className="mobile-app animate-fadeIn">
            {/* App Header */}
            <div className="mobile-header">
                <div className="header-top">
                    <div className="user-welcome">
                        <span>Hola,</span>
                        <h3>Chofer Demo</h3>
                    </div>
                    <div className="header-avatar">
                        <Truck size={20} />
                    </div>
                </div>

                {/* CU-T09: Indicador de Modo Offline */}
                <div className="offline-indicator-bar">
                    <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
                        {isOnline ? (
                            <>
                                <Wifi size={14} />
                                <span>Conectado</span>
                            </>
                        ) : (
                            <>
                                <WifiOff size={14} />
                                <span>Modo Offline</span>
                            </>
                        )}
                    </div>

                    {lastSync && (
                        <div className="last-sync">
                            Última sync: {lastSync.toLocaleTimeString()}
                        </div>
                    )}

                    <button
                        className={`sync-btn ${syncing ? 'syncing' : ''}`}
                        onClick={syncData}
                        disabled={syncing}
                        title="Sincronizar datos (CU-T01)"
                    >
                        {syncing ? (
                            <RefreshCw size={14} className="spinning" />
                        ) : (
                            <Download size={14} />
                        )}
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="mobile-stats">
                    <div className="stat-card warning">
                        <span className="stat-value">{manifiestos.filter(m => m.estado === 'APROBADO').length}</span>
                        <span className="stat-label">Retiros</span>
                    </div>
                    <div className="stat-card primary">
                        <span className="stat-value">{manifiestos.filter(m => m.estado === 'EN_TRANSITO').length}</span>
                        <span className="stat-label">En Viaje</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mobile-tabs">
                <button
                    className={`tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendientes')}
                >
                    Pendientes
                </button>
                <button
                    className={`tab-btn ${activeTab === 'en-curso' ? 'active' : ''}`}
                    onClick={() => setActiveTab('en-curso')}
                >
                    En Curso
                </button>
                <button
                    className={`tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
                    onClick={() => setActiveTab('historial')}
                >
                    Historial
                </button>
            </div>

            {/* Content List */}
            <div className="mobile-content">
                {loading ? (
                    <div className="mobile-loading">Cargando...</div>
                ) : (
                    <div className="cards-list">
                        {filteredManifiestos.map((m) => (
                            <div key={m.id} className="mobile-card">
                                <div className="card-header">
                                    <span className="card-id">#{m.numero.split('-')[1]}</span>
                                    <span className={`status-badge ${m.estado.toLowerCase()}`}>
                                        {m.estado.replace('_', ' ')}
                                    </span>
                                </div>

                                <div className="card-body">
                                    <div className="info-row">
                                        <MapPin size={16} className="icon-muted" />
                                        <div className="info-text">
                                            <span className="label">Origen</span>
                                            <p>{m.generador?.domicilio}</p>
                                        </div>
                                    </div>

                                    {m.estado === 'EN_TRANSITO' && (
                                        <div className="info-row">
                                            <Navigation size={16} className="icon-muted" />
                                            <div className="info-text">
                                                <span className="label">Destino</span>
                                                <p>{m.operador?.domicilio}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="info-row">
                                        <Package size={16} className="icon-muted" />
                                        <div className="info-text">
                                            <span className="label">Carga</span>
                                            <p>{m.residuos?.[0]?.tipoResiduo?.nombre} ({m.residuos?.[0]?.cantidad} {m.residuos?.[0]?.unidad})</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="card-footer">
                                    {m.estado === 'APROBADO' && (
                                        <button className="btn-mobile primary">
                                            Iniciar Retiro
                                            <ChevronRight size={18} />
                                        </button>
                                    )}
                                    {m.estado === 'EN_TRANSITO' && (
                                        <div className="action-buttons-row">
                                            <button className="btn-mobile warning small">
                                                <AlertTriangle size={18} />
                                                Incidente
                                            </button>
                                            <button className="btn-mobile success small">
                                                <Navigation size={18} />
                                                Llegada
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredManifiestos.length === 0 && (
                            <div className="empty-state">
                                <p>No hay manifiestos en esta sección</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Floating Action Button (FAB) - CU-T08 */}
            <button className="fab-scan" title="Escanear QR (CU-T08)">
                <QrCode size={24} />
            </button>
        </div>
    );
};

export default TransportistaApp;
