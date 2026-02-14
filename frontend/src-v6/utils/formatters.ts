/**
 * SITREP v6 - Formatters
 */

import { EstadoManifiesto, Rol } from '../types/models';
import { ESTADO_LABELS, ROL_LABELS } from './constants';

// ========================================
// DATES
// ========================================

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return formatDate(dateStr);
}

// ========================================
// NUMBERS
// ========================================

export function formatNumber(value: number, decimals = 0): string {
  if (value == null || isNaN(value)) return '0';
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

export function formatWeight(kg: number): string {
  if (kg == null || isNaN(kg)) return '0 kg';
  if (kg >= 1000) return `${formatNumber(kg / 1000, 1)} tn`;
  return `${formatNumber(kg)} kg`;
}

// ========================================
// DOMAIN
// ========================================

export function formatEstado(estado: EstadoManifiesto): string {
  return ESTADO_LABELS[estado] || estado;
}

export function formatRol(rol: Rol): string {
  return ROL_LABELS[rol] || rol;
}

export function formatCuit(cuit: string): string {
  if (!cuit || cuit.length !== 11) return cuit || '-';
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
}

export function formatPatente(patente: string): string {
  if (!patente) return '-';
  const clean = patente.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length === 7) return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
  if (clean.length === 6) return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  return patente;
}

export function formatManifiestoNumero(numero: string): string {
  return numero.startsWith('M-') ? numero : `M-${numero}`;
}

// ========================================
// TEXT
// ========================================

export function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function initials(nombre: string, apellido?: string | null): string {
  const n = nombre?.charAt(0)?.toUpperCase() || '';
  const a = apellido?.charAt(0)?.toUpperCase() || '';
  return n + a;
}
