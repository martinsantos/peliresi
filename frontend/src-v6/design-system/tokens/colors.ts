/**
 * SITREP Design System v6 - Color Tokens
 * ======================================
 * Sistema de colores semántico y escalable
 * 
 * Principios:
 * - Uso semántico sobre valores literales
 * - Consistencia en todos los estados
 * - Accesibilidad WCAG 2.1 AAA
 */

// ============================================
// CORE COLORS - Primarios
// ============================================
export const primary = {
  50: '#E6F7EF',
  100: '#C0EBD8',
  200: '#96DEBF',
  300: '#6CD1A6',
  400: '#4DC794',
  500: '#0D8A4F',  // Primary brand
  600: '#0B7844',
  700: '#096639',
  800: '#07542E',
  900: '#054223',
  950: '#032D18',
} as const;

export const secondary = {
  50: '#E6F0FF',
  100: '#CCE0FF',
  200: '#99C2FF',
  300: '#66A3FF',
  400: '#3385FF',
  500: '#0066CC',  // Secondary brand
  600: '#0052A3',
  700: '#003D7A',
  800: '#002952',
  900: '#001429',
  950: '#000A14',
} as const;

// ============================================
// SEMANTIC COLORS - Estados
// ============================================
export const success = {
  50: '#ECFDF5',
  100: '#D1FAE5',
  200: '#A7F3D0',
  300: '#6EE7B7',
  400: '#34D399',
  500: '#10B981',
  600: '#059669',
  700: '#047857',
  800: '#065F46',
  900: '#064E3B',
  950: '#022C22',
} as const;

export const warning = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
  950: '#451A03',
} as const;

export const error = {
  50: '#FEF2F2',
  100: '#FEE2E2',
  200: '#FECACA',
  300: '#FCA5A5',
  400: '#F87171',
  500: '#EF4444',
  600: '#DC2626',
  700: '#B91C1C',
  800: '#991B1B',
  900: '#7F1D1D',
  950: '#450A0A',
} as const;

export const info = {
  50: '#EFF6FF',
  100: '#DBEAFE',
  200: '#BFDBFE',
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#3B82F6',
  600: '#2563EB',
  700: '#1D4ED8',
  800: '#1E40AF',
  900: '#1E3A8A',
  950: '#172554',
} as const;

// ============================================
// NEUTRAL COLORS - Grises
// ============================================
export const neutral = {
  0: '#FFFFFF',
  50: '#FAFBFC',
  100: '#F4F5F7',
  200: '#EBEDF0',
  300: '#DFE1E6',
  400: '#B3BAC5',
  500: '#8A95A5',
  600: '#5E6A7E',
  700: '#3D4A5F',
  800: '#243142',
  900: '#121A26',
  950: '#080C12',
} as const;

// ============================================
// ROLE COLORS - Por tipo de actor
// ============================================
export const roles = {
  admin: {
    DEFAULT: '#2563EB',
    light: '#3B82F6',
    dark: '#1D4ED8',
    surface: 'rgba(37, 99, 235, 0.08)',
  },
  generador: {
    DEFAULT: '#7C3AED',
    light: '#8B5CF6',
    dark: '#6D28D9',
    surface: 'rgba(124, 58, 237, 0.08)',
  },
  transportista: {
    DEFAULT: '#D97706',
    light: '#F59E0B',
    dark: '#B45309',
    surface: 'rgba(217, 119, 6, 0.08)',
  },
  operador: {
    DEFAULT: '#059669',
    light: '#10B981',
    dark: '#047857',
    surface: 'rgba(5, 150, 105, 0.08)',
  },
} as const;

// ============================================
// ESTADO MANIFIESTO - Workflow
// ============================================
export const estados = {
  borrador: {
    bg: '#F4F5F7',
    text: '#5E6A7E',
    border: '#DFE1E6',
    icon: '#8A95A5',
  },
  pendiente: {
    bg: '#FFFBEB',
    text: '#B45309',
    border: '#FCD34D',
    icon: '#F59E0B',
  },
  aprobado: {
    bg: '#ECFDF5',
    text: '#047857',
    border: '#6EE7B7',
    icon: '#10B981',
  },
  en_transito: {
    bg: '#EFF6FF',
    text: '#1D4ED8',
    border: '#93C5FD',
    icon: '#3B82F6',
  },
  entregado: {
    bg: '#DBEAFE',
    text: '#1E40AF',
    border: '#60A5FA',
    icon: '#2563EB',
  },
  recibido: {
    bg: '#F3E8FF',
    text: '#6D28D9',
    border: '#C4B5FD',
    icon: '#8B5CF6',
  },
  tratado: {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#34D399',
    icon: primary[500],
  },
  rechazado: {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#FCA5A5',
    icon: '#EF4444',
  },
  cancelado: {
    bg: '#F4F5F7',
    text: '#3D4A5F',
    border: '#B3BAC5',
    icon: '#5E6A7E',
  },
} as const;

// ============================================
// SURFACE COLORS - Fondos
// ============================================
export const surface = {
  0: '#FFFFFF',
  1: '#FAFBFC',
  2: '#F4F5F7',
  3: '#EBEDF0',
  inverse: '#121A26',
} as const;

// ============================================
// TEXT COLORS
// ============================================
export const text = {
  primary: '#121A26',
  secondary: '#3D4A5F',
  tertiary: '#5E6A7E',
  disabled: '#8A95A5',
  inverse: '#FFFFFF',
  link: primary[500],
  linkHover: primary[600],
} as const;

// ============================================
// BORDER COLORS
// ============================================
export const border = {
  subtle: '#F4F5F7',
  light: '#EBEDF0',
  DEFAULT: '#DFE1E6',
  strong: '#B3BAC5',
  focus: primary[500],
  error: error[500],
} as const;

// ============================================
// SHADOWS
// ============================================
export const shadows = {
  1: '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
  2: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
  3: '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.02)',
  4: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
  glow: `0 0 20px ${primary[500]}26`,
  'glow-error': `0 0 20px ${error[500]}26`,
  'glow-success': `0 0 20px ${success[500]}26`,
} as const;

// ============================================
// EXPORT COMPLETO
// ============================================
export const colors = {
  primary,
  secondary,
  success,
  warning,
  error,
  info,
  neutral,
  roles,
  estados,
  surface,
  text,
  border,
  shadows,
} as const;

export default colors;
