/**
 * SITREP v6 - Constants
 */

import { EstadoManifiesto, Rol, PrioridadNotificacion, SeveridadAnomalia, EstadoAlerta } from '../types/models';

export const ESTADO_LABELS: Record<EstadoManifiesto, string> = {
  [EstadoManifiesto.BORRADOR]: 'Borrador',
  [EstadoManifiesto.PENDIENTE_APROBACION]: 'Pendiente Aprobación',
  [EstadoManifiesto.APROBADO]: 'Aprobado',
  [EstadoManifiesto.EN_TRANSITO]: 'En Tránsito',
  [EstadoManifiesto.ENTREGADO]: 'Entregado',
  [EstadoManifiesto.RECIBIDO]: 'Recibido',
  [EstadoManifiesto.EN_TRATAMIENTO]: 'En Tratamiento',
  [EstadoManifiesto.TRATADO]: 'Tratado',
  [EstadoManifiesto.RECHAZADO]: 'Rechazado',
  [EstadoManifiesto.CANCELADO]: 'Cancelado',
};

export const ESTADO_COLORS: Record<EstadoManifiesto, { bg: string; text: string; border: string }> = {
  [EstadoManifiesto.BORRADOR]: { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-300' },
  [EstadoManifiesto.PENDIENTE_APROBACION]: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200' },
  [EstadoManifiesto.APROBADO]: { bg: 'bg-info-50', text: 'text-info-700', border: 'border-info-200' },
  [EstadoManifiesto.EN_TRANSITO]: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-200' },
  [EstadoManifiesto.ENTREGADO]: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200' },
  [EstadoManifiesto.RECIBIDO]: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200' },
  [EstadoManifiesto.EN_TRATAMIENTO]: { bg: 'bg-info-50', text: 'text-info-700', border: 'border-info-200' },
  [EstadoManifiesto.TRATADO]: { bg: 'bg-success-100', text: 'text-success-800', border: 'border-success-300' },
  [EstadoManifiesto.RECHAZADO]: { bg: 'bg-error-50', text: 'text-error-700', border: 'border-error-200' },
  [EstadoManifiesto.CANCELADO]: { bg: 'bg-neutral-100', text: 'text-neutral-500', border: 'border-neutral-300' },
};

export const ROL_LABELS: Record<Rol, string> = {
  [Rol.ADMIN]: 'Administrador',
  [Rol.GENERADOR]: 'Generador',
  [Rol.TRANSPORTISTA]: 'Transportista',
  [Rol.OPERADOR]: 'Operador',
};

export const ROL_COLORS: Record<Rol, { bg: string; text: string }> = {
  [Rol.ADMIN]: { bg: 'bg-purple-100', text: 'text-purple-700' },
  [Rol.GENERADOR]: { bg: 'bg-blue-100', text: 'text-blue-700' },
  [Rol.TRANSPORTISTA]: { bg: 'bg-amber-100', text: 'text-amber-700' },
  [Rol.OPERADOR]: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

export const PRIORIDAD_LABELS: Record<PrioridadNotificacion, string> = {
  [PrioridadNotificacion.BAJA]: 'Baja',
  [PrioridadNotificacion.NORMAL]: 'Normal',
  [PrioridadNotificacion.ALTA]: 'Alta',
  [PrioridadNotificacion.URGENTE]: 'Urgente',
};

export const SEVERIDAD_LABELS: Record<SeveridadAnomalia, string> = {
  [SeveridadAnomalia.BAJA]: 'Baja',
  [SeveridadAnomalia.MEDIA]: 'Media',
  [SeveridadAnomalia.ALTA]: 'Alta',
  [SeveridadAnomalia.CRITICA]: 'Crítica',
};

export const ESTADO_ALERTA_LABELS: Record<EstadoAlerta, string> = {
  [EstadoAlerta.PENDIENTE]: 'Pendiente',
  [EstadoAlerta.EN_REVISION]: 'En Revisión',
  [EstadoAlerta.RESUELTA]: 'Resuelta',
  [EstadoAlerta.DESCARTADA]: 'Descartada',
};

export const UNIDADES_RESIDUO = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'tn', label: 'Toneladas (tn)' },
  { value: 'm3', label: 'Metros cúbicos (m³)' },
  { value: 'unidades', label: 'Unidades' },
];

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
};

export const EMPTY_MESSAGES = {
  noResults: 'No se encontraron resultados',
  noData: (item: string) => `No hay ${item} disponibles`,
  noChartData: 'Sin datos para el período seleccionado',
};
