/**
 * Leaflet icons for CentroControl map
 */

import L from 'leaflet';

// Truck icon - EN CURSO (green)
export const truckIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#10b981">
            <circle cx="16" cy="16" r="14" fill="#10b981" stroke="#fff" stroke-width="2"/>
            <path d="M10 11h8v6h4l-2 4h-2v-2h-6v2h-2l-2-4h2v-6z" fill="#fff"/>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Truck icon - PAUSED (yellow)
export const truckPausedIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
            <rect x="11" y="10" width="4" height="12" fill="#fff"/>
            <rect x="17" y="10" width="4" height="12" fill="#fff"/>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Truck icon - INCIDENT (red)
export const truckIncidentIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#ef4444" stroke="#fff" stroke-width="2"/>
            <text x="16" y="22" text-anchor="middle" fill="#fff" font-size="18" font-weight="bold">!</text>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Generador icon (origin) - Green factory
export const generadorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
            <rect x="2" y="8" width="24" height="18" rx="2" fill="#059669" stroke="#fff" stroke-width="1.5"/>
            <rect x="5" y="2" width="6" height="10" fill="#059669" stroke="#fff" stroke-width="1"/>
            <rect x="17" y="4" width="4" height="8" fill="#059669" stroke="#fff" stroke-width="1"/>
            <rect x="6" y="14" width="4" height="4" fill="#fff"/>
            <rect x="12" y="14" width="4" height="4" fill="#fff"/>
            <rect x="18" y="14" width="4" height="4" fill="#fff"/>
            <rect x="10" y="20" width="8" height="6" fill="#fff"/>
        </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});

// Operador icon (destination) - Red building
export const operadorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
            <rect x="4" y="4" width="20" height="22" rx="2" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
            <rect x="7" y="7" width="4" height="4" fill="#fff"/>
            <rect x="12" y="7" width="4" height="4" fill="#fff"/>
            <rect x="17" y="7" width="4" height="4" fill="#fff"/>
            <rect x="7" y="13" width="4" height="4" fill="#fff"/>
            <rect x="12" y="13" width="4" height="4" fill="#fff"/>
            <rect x="17" y="13" width="4" height="4" fill="#fff"/>
            <rect x="11" y="19" width="6" height="7" fill="#fff"/>
        </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});
