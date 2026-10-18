import L from 'leaflet';
import { ACTOR_ICONS, ACTOR_COLORS as SHARED_ACTOR_COLORS } from '../../../utils/map-icons';

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

export const RESIDUO_PALETTE = [
  '#059669', '#7c3aed', '#dc2626', '#d97706',
  '#2563eb', '#0891b2', '#be185d', '#65a30d',
] as const;

export const ACTOR_COLORS = {
  generador: SHARED_ACTOR_COLORS.generador,
  transportista: SHARED_ACTOR_COLORS.transportista,
  operador: SHARED_ACTOR_COLORS.operador,
  enTransito: SHARED_ACTOR_COLORS.enTransito,
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

// Use the same glyphs, shapes and colors as Control and Reports.
function actorIcon(icon: L.DivIcon): L.DivIcon {
  return L.divIcon({ ...icon.options, popupAnchor: [0, -18] });
}
export function createGeneradorIcon(): L.DivIcon {
  return actorIcon(ACTOR_ICONS.generador);
}
export function createTransportistaIcon(): L.DivIcon {
  return actorIcon(ACTOR_ICONS.transportista);
}
export function createOperadorIcon(): L.DivIcon {
  return actorIcon(ACTOR_ICONS.operador);
}
export function createEnTransitoIcon(selected = false): L.DivIcon {
  return actorIcon(selected ? ACTOR_ICONS.enTransitoSelected : ACTOR_ICONS.enTransito);
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
