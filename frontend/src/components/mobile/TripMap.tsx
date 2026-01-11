/**
 * TripMap - Real-time map visualization for active trips
 * Uses Leaflet for map rendering with GPS route tracking
 */

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GPSPosition, RoutePoint } from '../../types/mobile.types';
import './TripMap.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface TripMapProps {
    ruta: RoutePoint[];
    posicionActual: GPSPosition | null;
    altura?: string;
    showStartMarker?: boolean;
    autoCenter?: boolean;
}

// Component to handle auto-centering the map on position changes
const MapController: React.FC<{ position: [number, number] | null; autoCenter: boolean }> = ({
    position,
    autoCenter
}) => {
    const map = useMap();

    useEffect(() => {
        if (position && autoCenter) {
            map.setView(position, map.getZoom(), { animate: true });
        }
    }, [position, map, autoCenter]);

    return null;
};

// Custom icon for current position (pulsing dot)
const createCurrentPositionIcon = () => {
    return L.divIcon({
        className: 'current-position-marker',
        html: `
            <div class="pulse-marker">
                <div class="pulse-core"></div>
                <div class="pulse-ring"></div>
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

// Custom icon for start position
const createStartIcon = () => {
    return L.divIcon({
        className: 'start-position-marker',
        html: `
            <div class="start-marker">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="#22c55e" stroke="white" stroke-width="2"/>
                    <polygon points="10,8 16,12 10,16" fill="white"/>
                </svg>
            </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
};

const TripMap: React.FC<TripMapProps> = ({
    ruta,
    posicionActual,
    altura = '300px',
    showStartMarker = true,
    autoCenter = true
}) => {
    // Convert route points to Leaflet positions
    const positions = useMemo(() =>
        ruta.map(p => [p.lat, p.lng] as [number, number]),
        [ruta]
    );

    // Calculate center position
    const center = useMemo(() => {
        if (posicionActual) {
            return [posicionActual.lat, posicionActual.lng] as [number, number];
        }
        if (positions.length > 0) {
            return positions[positions.length - 1];
        }
        // Default: Mendoza, Argentina
        return [-32.8908, -68.8272] as [number, number];
    }, [posicionActual, positions]);

    // Start position
    const startPosition = useMemo(() =>
        positions.length > 0 ? positions[0] : null,
        [positions]
    );

    // Current position icon
    const currentIcon = useMemo(() => createCurrentPositionIcon(), []);
    const startIcon = useMemo(() => createStartIcon(), []);

    return (
        <div className="trip-map-container" style={{ height: altura }}>
            <MapContainer
                center={center}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                <MapController
                    position={posicionActual ? [posicionActual.lat, posicionActual.lng] : null}
                    autoCenter={autoCenter}
                />

                {/* Route polyline - gradient effect with multiple lines */}
                {positions.length > 1 && (
                    <>
                        {/* Shadow line */}
                        <Polyline
                            positions={positions}
                            color="#000"
                            weight={6}
                            opacity={0.2}
                        />
                        {/* Main route line */}
                        <Polyline
                            positions={positions}
                            color="#10b981"
                            weight={4}
                            opacity={0.9}
                            lineCap="round"
                            lineJoin="round"
                        />
                    </>
                )}

                {/* Start marker */}
                {showStartMarker && startPosition && (
                    <Marker
                        position={startPosition}
                        icon={startIcon}
                    />
                )}

                {/* Intermediate points as small circles */}
                {positions.slice(1, -1).map((pos, idx) => (
                    <CircleMarker
                        key={idx}
                        center={pos}
                        radius={3}
                        fillColor="#10b981"
                        fillOpacity={0.6}
                        stroke={false}
                    />
                ))}

                {/* Current position marker */}
                {posicionActual && (
                    <Marker
                        position={[posicionActual.lat, posicionActual.lng]}
                        icon={currentIcon}
                    />
                )}
            </MapContainer>

            {/* Map overlay info */}
            <div className="map-overlay-info">
                <div className="map-stats">
                    <span className="stat-item">
                        <span className="stat-dot active"></span>
                        {ruta.length} puntos
                    </span>
                    {posicionActual && (
                        <span className="stat-item coords">
                            {posicionActual.lat.toFixed(5)}, {posicionActual.lng.toFixed(5)}
                        </span>
                    )}
                </div>
            </div>

            {/* Zoom controls - using CSS only (leaflet handles zoom via touch/scroll) */}
            <div className="map-zoom-controls" style={{ display: 'none' }}>
                <button className="zoom-btn">+</button>
                <button className="zoom-btn">−</button>
            </div>
        </div>
    );
};

export default TripMap;
