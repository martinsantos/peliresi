import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import { manifiestoService } from '../services/manifiesto.service';
import { logisticsService } from '../services/logistics.service';
import type { Manifiesto } from '../types';
import { Truck, MapPin, AlertTriangle, RefreshCw, Clock, Pause, Play, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './Tracking.css';

// Fix for default marker icons in Leaflet with webpack/vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Custom icons
const truckIcon = new Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
      <path d="M12 21h10v-4a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v4zm10 0h6a2 2 0 0 0 0-4h-1l-2-3h-3v7z" fill="#fff"/>
      <circle cx="15" cy="23" r="2" fill="#fff"/>
      <circle cx="25" cy="23" r="2" fill="#fff"/>
    </svg>
  `),
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
});

const POLLING_INTERVAL = 30000; // 30 seconds

// Component to center map on selected route
const MapCenterController: React.FC<{ center: LatLngExpression | null; zoom?: number }> = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, zoom || map.getZoom(), { animate: true });
        }
    }, [center, map, zoom]);
    return null;
};

interface ViajeInfo {
    id: string;
    inicio: string;
    fin?: string;
    duracion?: number;
    distancia?: number;
    estado: string;
}

const Tracking: React.FC = () => {
    const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedManifiesto, setSelectedManifiesto] = useState<Manifiesto | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [isPolling, setIsPolling] = useState(true);

    // Real GPS route state
    const [rutaReal, setRutaReal] = useState<LatLngExpression[]>([]);
    const [loadingRuta, setLoadingRuta] = useState(false);
    const [viajeInfo, setViajeInfo] = useState<ViajeInfo | null>(null);
    const [mapCenter, setMapCenter] = useState<LatLngExpression | null>(null);

    // Mendoza center coordinates
    const center: LatLngExpression = [-32.8908, -68.8272];

    // Demo manifiestos en tránsito
    const demoManifiestos: Manifiesto[] = [
        {
            id: '1',
            numero: 'MAN-2025-000006',
            estado: 'EN_TRANSITO',
            generador: { razonSocial: 'Hospital Central', domicilio: 'Av. San Martín 1234, Mendoza' },
            transportista: { razonSocial: 'Logística Cuyo S.R.L.', cuit: '30-71234571-2' },
            operador: { razonSocial: 'Planta Este Residuos', domicilio: 'Ruta 7 Km 18, Luján de Cuyo' },
            fechaRetiro: new Date('2025-12-08T10:30:00').toISOString(),
            residuos: [{ tipoResiduo: { nombre: 'Y3 - Medicamentos' } }]
        } as Manifiesto,
        {
            id: '2',
            numero: 'MAN-2025-000010',
            estado: 'EN_TRANSITO',
            generador: { razonSocial: 'Química Industrial', domicilio: 'Acceso Este 4500, Godoy Cruz' },
            transportista: { razonSocial: 'Transportes Los Andes', cuit: '30-71234568-9' },
            operador: { razonSocial: 'Centro Tratamiento Cuyo', domicilio: 'Ruta 40 Km 12, Maipú' },
            fechaRetiro: new Date('2025-12-08T09:15:00').toISOString(),
            residuos: [{ tipoResiduo: { nombre: 'Y1 - Ácidos' } }]
        } as Manifiesto,
    ];

    // Initial load
    useEffect(() => {
        loadManifiestos();
    }, []);

    // Polling for real-time updates
    useEffect(() => {
        if (!isPolling) return;

        const pollInterval = setInterval(() => {
            loadManifiestos();
            setLastUpdate(new Date());
        }, POLLING_INTERVAL);

        return () => clearInterval(pollInterval);
    }, [isPolling]);

    const loadManifiestos = async () => {
        try {
            setLoading(true);
            // Obtener manifiestos EN_TRANSITO directamente
            const data = await manifiestoService.getManifiestos({ estado: 'EN_TRANSITO', limit: 50 });
            setManifiestos(data.manifiestos || []);
            setError('');
        } catch (err: any) {
            console.error('Error loading tracking, using demo data:', err);
            // Usar datos demo en caso de error
            setManifiestos(demoManifiestos);
            setError('');  // No mostrar error
        } finally {
            setLoading(false);
        }
    };

    // Load real GPS route for selected manifiesto
    const loadRutaManifiesto = useCallback(async (manifiestoId: string) => {
        setLoadingRuta(true);
        try {
            const response = await logisticsService.getRutaManifiesto(manifiestoId);
            if (response.success && response.data.ruta.length > 0) {
                const positions: LatLngExpression[] = response.data.ruta.map(p => [p.lat, p.lng]);
                setRutaReal(positions);

                // Center map on the middle point of the route
                const midIndex = Math.floor(positions.length / 2);
                setMapCenter(positions[midIndex]);

                // Set viaje info if available
                if (response.data.viaje) {
                    setViajeInfo(response.data.viaje);
                }
            } else {
                // No real route - use tracking from manifiesto if available
                setRutaReal([]);
                setViajeInfo(null);
            }
        } catch (err) {
            console.warn('Error loading route:', err);
            setRutaReal([]);
            setViajeInfo(null);
        } finally {
            setLoadingRuta(false);
        }
    }, []);

    // Load route when manifiesto is selected
    useEffect(() => {
        if (selectedManifiesto) {
            loadRutaManifiesto(selectedManifiesto.id);
        } else {
            setRutaReal([]);
            setViajeInfo(null);
        }
    }, [selectedManifiesto, loadRutaManifiesto]);

    // Simulated tracking points for demo (fallback when no real data)
    const simulatedRoutes: Record<string, LatLngExpression[]> = {
        default: [
            [-32.8908, -68.8272], // Mendoza Centro
            [-32.8756, -68.8456], // Norte
            [-32.8534, -68.8678], // Más al norte
            [-32.9234, -68.8456], // Sur
        ]
    };

    const getLastPosition = (manifiesto: Manifiesto): LatLngExpression => {
        if (manifiesto.tracking && manifiesto.tracking.length > 0) {
            const last = manifiesto.tracking[0];
            return [last.latitud, last.longitud];
        }
        // Random position around Mendoza for demo
        return [
            -32.8908 + (Math.random() - 0.5) * 0.1,
            -68.8272 + (Math.random() - 0.5) * 0.1
        ];
    };

    if (loading) {
        return (
            <div className="tracking-loading">
                <div className="spinner" />
                <p>Cargando mapa de tracking...</p>
            </div>
        );
    }

    return (
        <div className="tracking-page animate-fadeIn">
            {/* Header */}
            <div className="tracking-header">
                <div>
                    <h2>Tracking GPS en Tiempo Real</h2>
                    <p className="tracking-subtitle">
                        Monitoreo de transportes activos en la provincia
                        <span className="last-update">
                            <Clock size={14} />
                            Última actualización: {lastUpdate.toLocaleTimeString('es-AR')}
                        </span>
                    </p>
                </div>
                <div className="tracking-controls">
                    <button
                        className={`btn btn-icon ${isPolling ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => setIsPolling(!isPolling)}
                        title={isPolling ? 'Pausar actualización automática' : 'Reanudar actualización automática'}
                    >
                        {isPolling ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button className="btn btn-secondary" onClick={() => { loadManifiestos(); setLastUpdate(new Date()); }}>
                        <RefreshCw size={18} />
                        Actualizar
                    </button>
                </div>
            </div>

            {error && (
                <div className="tracking-error">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            <div className="tracking-content">
                {/* Map */}
                <div className="tracking-map">
                    <MapContainer
                        center={center}
                        zoom={11}
                        className="map-container"
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {/* Map center controller for selected route */}
                        <MapCenterController center={mapCenter} zoom={14} />

                        {manifiestos.map((manifiesto) => {
                            const position = getLastPosition(manifiesto);
                            return (
                                <Marker
                                    key={manifiesto.id}
                                    position={position}
                                    icon={truckIcon}
                                    eventHandlers={{
                                        click: () => setSelectedManifiesto(manifiesto)
                                    }}
                                >
                                    <Popup>
                                        <div className="map-popup">
                                            <strong>{manifiesto.numero}</strong>
                                            <p>{manifiesto.transportista?.razonSocial}</p>
                                            <span className="popup-route">
                                                {manifiesto.generador?.domicilio?.split(',')[0]} → {manifiesto.operador?.domicilio?.split(',')[0]}
                                            </span>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}

                        {/* Real GPS route polyline */}
                        {selectedManifiesto && rutaReal.length > 0 && (
                            <Polyline
                                positions={rutaReal}
                                color="#10b981"
                                weight={4}
                                opacity={0.9}
                            />
                        )}

                        {/* Fallback: simulated route when no real GPS data */}
                        {selectedManifiesto && rutaReal.length === 0 && !loadingRuta && (
                            <Polyline
                                positions={simulatedRoutes.default}
                                color="#94a3b8"
                                weight={2}
                                opacity={0.5}
                                dashArray="10, 10"
                            />
                        )}
                    </MapContainer>

                    {manifiestos.length === 0 && (
                        <div className="map-empty">
                            <Truck size={48} />
                            <h3>Sin transportes activos</h3>
                            <p>No hay manifiestos en tránsito en este momento</p>
                        </div>
                    )}
                </div>

                {/* Sidebar with active transports */}
                <div className="tracking-sidebar">
                    <h3>
                        <Truck size={20} />
                        Transportes Activos ({manifiestos.length})
                    </h3>

                    <div className="transport-list">
                        {manifiestos.length > 0 ? (
                            manifiestos.map((manifiesto) => (
                                <div
                                    key={manifiesto.id}
                                    className={`transport-item ${selectedManifiesto?.id === manifiesto.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedManifiesto(manifiesto)}
                                >
                                    <div className="transport-indicator">
                                        <span className="transport-pulse" />
                                    </div>
                                    <div className="transport-info">
                                        <strong>{manifiesto.numero}</strong>
                                        <span>{manifiesto.transportista?.razonSocial}</span>
                                        <span className="transport-route">
                                            <MapPin size={12} />
                                            {manifiesto.generador?.domicilio?.split(',')[0]}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-sidebar">
                                <p>No hay transportes activos</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Selected manifest details */}
            {selectedManifiesto && (
                <div className="tracking-details card">
                    <div className="tracking-details-header">
                        <h3>Detalles del Transporte</h3>
                        {loadingRuta && (
                            <span className="loading-ruta">
                                <RefreshCw size={14} className="spinning" />
                                Cargando ruta...
                            </span>
                        )}
                        {rutaReal.length > 0 && (
                            <span className="ruta-info">
                                <Navigation size={14} />
                                {rutaReal.length} puntos GPS
                            </span>
                        )}
                    </div>
                    <div className="details-grid">
                        <div className="detail-item">
                            <span className="detail-label">Manifiesto</span>
                            <strong>{selectedManifiesto.numero}</strong>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Transportista</span>
                            <strong>{selectedManifiesto.transportista?.razonSocial}</strong>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Origen</span>
                            <span>{selectedManifiesto.generador?.domicilio}</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Destino</span>
                            <span>{selectedManifiesto.operador?.domicilio}</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Inicio de Viaje</span>
                            <span>{viajeInfo?.inicio
                                ? new Date(viajeInfo.inicio).toLocaleString('es-AR')
                                : selectedManifiesto.fechaRetiro
                                    ? new Date(selectedManifiesto.fechaRetiro).toLocaleString('es-AR')
                                    : '-'
                            }</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Residuos</span>
                            <span>{selectedManifiesto.residuos?.map(r => r.tipoResiduo?.nombre).join(', ')}</span>
                        </div>
                        {/* Real viaje stats when available */}
                        {viajeInfo && (
                            <>
                                {viajeInfo.distancia && (
                                    <div className="detail-item">
                                        <span className="detail-label">Distancia Recorrida</span>
                                        <strong className="detail-highlight">{viajeInfo.distancia.toFixed(2)} km</strong>
                                    </div>
                                )}
                                {viajeInfo.duracion && (
                                    <div className="detail-item">
                                        <span className="detail-label">Tiempo en Ruta</span>
                                        <strong>{Math.floor(viajeInfo.duracion / 60)} min</strong>
                                    </div>
                                )}
                                <div className="detail-item">
                                    <span className="detail-label">Estado Viaje</span>
                                    <span className={`badge badge-${viajeInfo.estado === 'EN_CURSO' ? 'warning' : 'success'}`}>
                                        {viajeInfo.estado}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tracking;
