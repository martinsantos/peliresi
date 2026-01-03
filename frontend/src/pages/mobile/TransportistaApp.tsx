import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5QrcodeScanner } from 'html5-qrcode';
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
    Download,
    X,
    CheckCircle2
} from 'lucide-react';
import './TransportistaApp.css';

const TransportistaApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pendientes' | 'en-curso' | 'historial'>('pendientes');
    const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [scannerActive, setScannerActive] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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

    // Limpieza del scanner al desmontar
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
        };
    }, []);

    const startScanner = () => {
        setScannerActive(true);
        setTimeout(() => {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                /* verbose= */ false
            );
            
            scanner.render(onScanSuccess, onScanFailure);
            scannerRef.current = scanner;
        }, 100);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.clear().then(() => {
                setScannerActive(false);
                scannerRef.current = null;
            }).catch(console.error);
        } else {
            setScannerActive(false);
        }
    };

    const onScanSuccess = async (decodedText: string) => {
        console.log(`Code matched = ${decodedText}`);
        stopScanner();
        
        try {
            const data = JSON.parse(decodedText);
            if (data.id) {
                handleAction(data.id, 'RETIRAR');
            }
        } catch (e) {
            showActionMessage('error', 'Código QR no reconocido como manifiesto válido');
        }
    };

    const onScanFailure = () => {
        // Ignorar fallos de lectura continuos
    };

    const showActionMessage = (type: 'success' | 'error', text: string) => {
        setActionMessage({ type, text });
        setTimeout(() => setActionMessage(null), 4000);
    };

    const handleAction = async (id: string, action: 'RETIRAR' | 'ENTREGAR') => {
        try {
            setLoading(true);
            const data = {}; // Podríamos agregar ubicación real aquí
            if (action === 'RETIRAR') {
                await manifiestoService.confirmarRetiro(id, data);
                showActionMessage('success', 'Retiro iniciado correctamente');
            } else {
                await manifiestoService.confirmarEntrega(id, data);
                showActionMessage('success', 'Entrega confirmada correctamente');
            }
            await loadData();
        } catch (err) {
            console.error('Error en acción:', err);
            showActionMessage('error', 'Error al procesar la solicitud');
        } finally {
            setLoading(false);
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
            <header className="mobile-header">
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
                            {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    <motion.div 
                        className="stat-card warning"
                        whileTap={{ scale: 0.95 }}
                    >
                        <span className="stat-value">{manifiestos.filter(m => m.estado === 'APROBADO').length}</span>
                        <span className="stat-label">Retiros</span>
                    </motion.div>
                    <motion.div 
                        className="stat-card primary"
                        whileTap={{ scale: 0.95 }}
                    >
                        <span className="stat-value">{manifiestos.filter(m => m.estado === 'EN_TRANSITO').length}</span>
                        <span className="stat-label">En Viaje</span>
                    </motion.div>
                </div>
            </header>

            {/* Success/Error Message Overlay */}
            <AnimatePresence>
                {actionMessage && (
                    <motion.div 
                        className={`action-message ${actionMessage.type}`}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                    >
                        {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        <span>{actionMessage.text}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* QR Scanner Overlay */}
            <AnimatePresence>
                {scannerActive && (
                    <motion.div 
                        className="scanner-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="scanner-container">
                            <div className="scanner-header">
                                <h3>Escaneando Manifiesto</h3>
                                <button onClick={stopScanner} className="close-scanner">
                                    <X size={24} />
                                </button>
                            </div>
                            <div id="reader"></div>
                            <p className="scanner-hint">Apunta con la cámara al código QR del manifiesto</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tabs */}
            <div className="mobile-tabs">
                {(['pendientes', 'en-curso', 'historial'] as const).map((tab) => (
                    <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
                        {activeTab === tab && (
                            <motion.div 
                                className="tab-indicator" 
                                layoutId="tab-indicator"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Content List */}
            <main className="mobile-content">
                {loading && manifiestos.length === 0 ? (
                    <div className="mobile-loading">
                        <RefreshCw className="spinning" size={32} />
                        <p>Cargando datos...</p>
                    </div>
                ) : (
                    <div className="cards-list">
                        <AnimatePresence mode="popLayout">
                            {filteredManifiestos.map((m) => (
                                <motion.div 
                                    key={m.id} 
                                    className={`mobile-card ${m.estado.toLowerCase()}`}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    layout
                                >
                                    <div className="card-header">
                                        <span className="card-id">#{m.numero.split('-')?.[1] || m.numero}</span>
                                        <span className={`status-badge ${m.estado.toLowerCase()}`}>
                                            {m.estado.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <div className="card-body">
                                        <div className="info-row">
                                            <MapPin size={16} className="icon-muted" />
                                            <div className="info-text">
                                                <span className="label">Origen</span>
                                                <p>{m.generador?.razonSocial}</p>
                                                <span className="address">{m.generador?.domicilio}</span>
                                            </div>
                                        </div>

                                        {m.estado === 'EN_TRANSITO' && (
                                            <div className="info-row">
                                                <Navigation size={16} className="icon-muted" />
                                                <div className="info-text">
                                                    <span className="label">Destino</span>
                                                    <p>{m.operador?.razonSocial}</p>
                                                    <span className="address">{m.operador?.domicilio}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="info-row">
                                            <Package size={16} className="icon-muted" />
                                            <div className="info-text">
                                                <span className="label">Residuos</span>
                                                <p>{m.residuos?.[0]?.tipoResiduo?.nombre || 'Ver detalle'}</p>
                                                <span className="quantity">{m.residuos?.[0]?.cantidad} {m.residuos?.[0]?.unidad}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card-footer">
                                        {m.estado === 'APROBADO' && (
                                            <motion.button 
                                                className="btn-mobile primary"
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handleAction(m.id, 'RETIRAR')}
                                            >
                                                Iniciar Retiro
                                                <ChevronRight size={18} />
                                            </motion.button>
                                        )}
                                        {m.estado === 'EN_TRANSITO' && (
                                            <div className="action-buttons-row">
                                                <motion.button 
                                                    className="btn-mobile warning small"
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <AlertTriangle size={18} />
                                                    Incidente
                                                </motion.button>
                                                <motion.button 
                                                    className="btn-mobile success small"
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleAction(m.id, 'ENTREGAR')}
                                                >
                                                    <CheckCircle2 size={18} />
                                                    Entregar
                                                </motion.button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {filteredManifiestos.length === 0 && (
                            <motion.div 
                                className="empty-state"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <Package size={48} className="icon-muted" />
                                <p>No hay manifiestos en esta sección</p>
                            </motion.div>
                        )}
                    </div>
                )}
            </main>

            {/* Floating Action Button (FAB) - CU-T08 */}
            <motion.button 
                className="fab-scan" 
                title="Escanear QR (CU-T08)"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={startScanner}
            >
                <QrCode size={24} />
            </motion.button>
        </div>
    );
};

export default TransportistaApp;
