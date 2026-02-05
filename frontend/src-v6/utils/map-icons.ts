/**
 * SITREP v6 - Leaflet Map Icons (shared across all map views)
 * =============================================================
 * Uses the same Lucide icons as the UI system:
 *   Generador  → Factory (purple)
 *   Transportista → Truck (orange)
 *   Operador   → Building2 (blue)
 *   En Tránsito → pulsing red circle with arrow
 *   GPS start/end → green/red dots
 */

import L from 'leaflet';

// ── SVG paths from Lucide icons (24×24 viewBox, stroke-based) ──

// Factory icon (Lucide)
const SVG_FACTORY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>';

// Truck icon (Lucide)
const SVG_TRUCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';

// Building2 icon (Lucide)
const SVG_BUILDING = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>';

// ── Actor colors (system consistent) ──
export const ACTOR_COLORS = {
  generador: '#7c3aed',   // purple (matches system)
  transportista: '#ea580c', // orange
  operador: '#2563eb',     // blue
  enTransito: '#ef4444',   // red
  gpsStart: '#22c55e',     // green
  gpsEnd: '#ef4444',       // red
};

// ── Actor marker icons ──

export const ACTOR_ICONS = {
  // Generador: purple rounded-square with Factory icon
  generador: L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:6px;background:${ACTOR_COLORS.generador};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">${SVG_FACTORY}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  }),

  // Transportista: orange diamond with Truck icon
  transportista: L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;transform:rotate(45deg);border-radius:4px;background:${ACTOR_COLORS.transportista};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><div style="transform:rotate(-45deg)">${SVG_TRUCK}</div></div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  }),

  // Operador: blue hexagon with Building2 icon
  operador: L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))"><svg width="30" height="30" viewBox="0 0 30 30"><polygon points="15,1 27,8 27,22 15,29 3,22 3,8" fill="${ACTOR_COLORS.operador}" stroke="white" stroke-width="2"/></svg><div style="position:absolute">${SVG_BUILDING}</div></div>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  }),

  // En Tránsito: red pulsing circle with navigation arrow
  enTransito: L.divIcon({
    className: '',
    html: `<div style="position:relative;width:24px;height:24px"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,.3);animation:sitrep-pulse 2s ease-in-out infinite"></div><div style="position:absolute;inset:3px;border-radius:50%;background:${ACTOR_COLORS.enTransito};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="12,2 22,22 12,17 2,22"/></svg></div></div><style>@keyframes sitrep-pulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.6);opacity:0}}</style>`,
    iconSize: [24, 24], iconAnchor: [12, 12],
  }),

  // En Tránsito selected (larger)
  enTransitoSelected: L.divIcon({
    className: '',
    html: `<div style="position:relative;width:32px;height:32px"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,.3);animation:sitrep-pulse 1.5s ease-in-out infinite"></div><div style="position:absolute;inset:4px;border-radius:50%;background:#dc2626;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="12,2 22,22 12,17 2,22"/></svg></div></div>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
  }),

  // GPS start point: green dot
  gpsStart: L.divIcon({
    className: '',
    html: `<div style="background:${ACTOR_COLORS.gpsStart};width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  }),

  // GPS end point: red dot
  gpsEnd: L.divIcon({
    className: '',
    html: `<div style="background:${ACTOR_COLORS.gpsEnd};width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  }),
};

// ── Cluster icon (rounded square with count) ──
export function createClusterIcon(count: number, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;border-radius:8px;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// ── Legend HTML snippets (for inline SVG legends) ──
export const LEGEND_ITEMS = {
  generador: { shape: 'rounded-square', color: ACTOR_COLORS.generador, label: 'Generador' },
  transportista: { shape: 'diamond', color: ACTOR_COLORS.transportista, label: 'Transportista' },
  operador: { shape: 'hexagon', color: ACTOR_COLORS.operador, label: 'Operador' },
  enTransito: { shape: 'circle', color: ACTOR_COLORS.enTransito, label: 'En Tránsito' },
  gpsStart: { shape: 'circle', color: ACTOR_COLORS.gpsStart, label: 'Inicio GPS' },
  gpsEnd: { shape: 'circle', color: ACTOR_COLORS.gpsEnd, label: 'Fin GPS' },
};
