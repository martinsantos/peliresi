/**
 * SITREP v6 - Leaflet Map Icons (shared between CentroControl & Reportes)
 */

import L from 'leaflet';

export function createColorIcon(color: string, size = 10): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function createClusterIcon(count: number, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:700;font-size:11px;
    ">${count}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export const ACTOR_ICONS = {
  generador: createColorIcon('#22c55e', 12),
  transportista: createColorIcon('#f97316', 14),
  operador: createColorIcon('#3b82f6', 16),
};

export const ACTOR_COLORS = {
  generador: '#22c55e',
  transportista: '#f97316',
  operador: '#3b82f6',
};
