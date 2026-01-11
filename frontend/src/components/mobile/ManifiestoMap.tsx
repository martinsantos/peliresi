/**
 * ManifiestoMap - FASE 4 (P5, P6)
 * Mapa estatico para mostrar origen/destino de un manifiesto
 */

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import type { RoutePoint } from '../../types/mobile.types';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Coords {
    lat: number;
    lng: number;
}

interface ManifiestoMapProps {
    origen?: {
        nombre: string;
        direccion?: string;
        coords?: Coords;
    };
    destino?: {
        nombre: string;
        direccion?: string;
        coords?: Coords;
    };
    rutaActual?: RoutePoint[];
    altura?: string;
    showRoute?: boolean;
}

// Custom icon for origin (Generador)
const createOrigenIcon = () => {
    return L.divIcon({
        className: 'manifiesto-marker origen',
        html: `
            <div class="marker-container" style="
                width: 32px; height: 32px;
                background: #8b5cf6;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                    <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4"/>
                </svg>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
};

// Custom icon for destination (Operador)
const createDestinoIcon = () => {
    return L.divIcon({
        className: 'manifiesto-marker destino',
        html: `
            <div class="marker-container" style="
                width: 32px; height: 32px;
                background: #10b981;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M17 7V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2"/>
                </svg>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
};

const ManifiestoMap: React.FC<ManifiestoMapProps> = ({
    origen,
    destino,
    rutaActual,
    altura = '180px',
    showRoute = true
}) => {
    // Default center: Mendoza, Argentina
    const defaultCenter: [number, number] = [-32.8908, -68.8272];

    // Check if we have any valid coordinates
    const hasValidCoords = useMemo(() => {
        return (origen?.coords?.lat && origen?.coords?.lng) ||
               (destino?.coords?.lat && destino?.coords?.lng) ||
               (rutaActual && rutaActual.length > 0);
    }, [origen, destino, rutaActual]);

    // Calculate center
    const center = useMemo((): [number, number] => {
        if (origen?.coords?.lat && origen?.coords?.lng) {
            return [origen.coords.lat, origen.coords.lng];
        }
        if (destino?.coords?.lat && destino?.coords?.lng) {
            return [destino.coords.lat, destino.coords.lng];
        }
        if (rutaActual && rutaActual.length > 0) {
            const midIdx = Math.floor(rutaActual.length / 2);
            return [rutaActual[midIdx].lat, rutaActual[midIdx].lng];
        }
        return defaultCenter;
    }, [origen, destino, rutaActual]);

    // Calculate zoom level based on distance
    const zoom = useMemo(() => {
        if (origen?.coords && destino?.coords) {
            // Calculate distance between points
            const lat1 = origen.coords.lat;
            const lat2 = destino.coords.lat;
            const lng1 = origen.coords.lng;
            const lng2 = destino.coords.lng;
            const latDiff = Math.abs(lat2 - lat1);
            const lngDiff = Math.abs(lng2 - lng1);
            const maxDiff = Math.max(latDiff, lngDiff);

            if (maxDiff > 1) return 9;
            if (maxDiff > 0.5) return 10;
            if (maxDiff > 0.1) return 12;
            return 13;
        }
        return 13;
    }, [origen, destino]);

    // Icons
    const origenIcon = useMemo(() => createOrigenIcon(), []);
    const destinoIcon = useMemo(() => createDestinoIcon(), []);

    // If no valid coordinates, show placeholder
    if (!hasValidCoords) {
        return (
            <div
                className="map-placeholder"
                style={{
                    height: altura,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--ind-bg-lighter)',
                    borderRadius: '12px',
                    color: 'var(--ind-text-mid)',
                    gap: '8px'
                }}
            >
                <MapPin size={32} />
                <span style={{ fontSize: '0.85rem' }}>Ubicacion no disponible</span>
            </div>
        );
    }

    return (
        <div
            className="manifiesto-map-container"
            style={{
                height: altura,
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative'
            }}
        >
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={false}
                dragging={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                />

                {/* Origen marker */}
                {origen?.coords?.lat && origen?.coords?.lng && (
                    <Marker
                        position={[origen.coords.lat, origen.coords.lng]}
                        icon={origenIcon}
                    >
                        <Popup>
                            <div style={{ fontSize: '12px' }}>
                                <strong>Origen</strong><br />
                                {origen.nombre}
                                {origen.direccion && <><br /><small>{origen.direccion}</small></>}
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Destino marker */}
                {destino?.coords?.lat && destino?.coords?.lng && (
                    <Marker
                        position={[destino.coords.lat, destino.coords.lng]}
                        icon={destinoIcon}
                    >
                        <Popup>
                            <div style={{ fontSize: '12px' }}>
                                <strong>Destino</strong><br />
                                {destino.nombre}
                                {destino.direccion && <><br /><small>{destino.direccion}</small></>}
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Route polyline if available */}
                {showRoute && rutaActual && rutaActual.length > 1 && (
                    <Polyline
                        positions={rutaActual.map(p => [p.lat, p.lng] as [number, number])}
                        color="#10b981"
                        weight={3}
                        opacity={0.8}
                    />
                )}

                {/* Simple line between origen and destino if no route */}
                {showRoute && !rutaActual && origen?.coords && destino?.coords && (
                    <Polyline
                        positions={[
                            [origen.coords.lat, origen.coords.lng],
                            [destino.coords.lat, destino.coords.lng]
                        ]}
                        color="#64748b"
                        weight={2}
                        opacity={0.5}
                        dashArray="5, 10"
                    />
                )}
            </MapContainer>

            {/* Legend overlay */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    display: 'flex',
                    gap: '12px',
                    fontSize: '10px',
                    color: 'white',
                    zIndex: 1000
                }}
            >
                {origen?.coords && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }}></span>
                        Origen
                    </span>
                )}
                {destino?.coords && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                        Destino
                    </span>
                )}
            </div>
        </div>
    );
};

export default ManifiestoMap;
