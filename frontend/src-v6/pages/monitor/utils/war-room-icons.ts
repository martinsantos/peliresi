import L from 'leaflet';

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

export const RESIDUO_PALETTE = [
  '#059669', '#7c3aed', '#dc2626', '#d97706',
  '#2563eb', '#0891b2', '#be185d', '#65a30d',
] as const;

export const ACTOR_COLORS = {
  generador: '#7C3AED',
  transportista: '#D97706',
  operador: '#2563EB',
  enTransito: '#EF4444',
  gpsPoint: '#6B7280',
} as const;

export const EVENT_COLORS: Record<string, string> = {
  CREACION: '#22c55e',
  FIRMA: '#eab308',
  RETIRO: '#f97316',
  ENTREGA: '#ef4444',
  RECEPCION: '#3b82f6',
  TRATAMIENTO: '#8b5cf6',
  CIERRE: '#fbbf24',
  INCIDENTE: '#dc2626',
} as const;

// ---------------------------------------------------------------------------
// SVG icon paths (Lucide stroke-based, viewBox 0 0 24 24)
// ---------------------------------------------------------------------------

const FACTORY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>`;

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

const FLASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16.5h10"/></svg>`;

// ---------------------------------------------------------------------------
// Marker HTML builder
// ---------------------------------------------------------------------------

function markerHtml(
  bg: string,
  svg: string,
  size: number,
  cssClass: string,
  selected = false,
): string {
  const border = selected ? '2px solid white' : 'none';
  const glow = selected ? `0 0 12px 4px ${bg}` : `0 2px 6px rgba(0,0,0,0.35)`;

  return `<div class="${cssClass}" style="
    width:${size}px;
    height:${size}px;
    background:${bg};
    border-radius:8px;
    display:flex;
    align-items:center;
    justify-content:center;
    box-shadow:${glow};
    border:${border};
    filter:drop-shadow(0 0 3px ${bg}40);
  ">${svg}</div>`;
}

// ---------------------------------------------------------------------------
// Exported icon factories
// ---------------------------------------------------------------------------

export function createGeneradorIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: markerHtml(ACTOR_COLORS.generador, FACTORY_SVG, 32, 'wr-marker-pulse'),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

export function createTransportistaIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: markerHtml(ACTOR_COLORS.transportista, TRUCK_SVG, 32, 'wr-marker-pulse'),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

export function createOperadorIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: markerHtml(ACTOR_COLORS.operador, FLASK_SVG, 32, 'wr-marker-pulse'),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

export function createEnTransitoIcon(selected = false): L.DivIcon {
  return L.divIcon({
    className: '',
    html: markerHtml(ACTOR_COLORS.enTransito, TRUCK_SVG, 36, 'wr-marker-transit', selected),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

export function createCreacionIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;background:#22c55e;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 12px rgba(34,197,94,0.6),0 2px 6px rgba(0,0,0,0.3);
      border:2px solid white;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="white" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export function createGpsPointIcon(color: string = ACTOR_COLORS.gpsPoint): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:10px;
      height:10px;
      background:${color};
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -7],
  });
}
