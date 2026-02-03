/**
 * SITREP Design System v6 - Border Radius Tokens
 * =============================================
 * Sistema de bordes redondeados consistente
 */

export const radius = {
  none: '0',
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '20px',
  '4xl': '24px',
  full: '9999px',
} as const;

// Alias semánticos
export const semanticRadius = {
  // Componentes
  button: radius.lg,
  input: radius.lg,
  card: radius['2xl'],
  modal: radius['2xl'],
  badge: radius.full,
  avatar: radius.full,
  chip: radius.full,
  tooltip: radius.md,
  popover: radius.lg,
  dropdown: radius.lg,
  toast: radius.lg,
  
  // Superficies
  surface: radius['2xl'],
  surfaceSm: radius.xl,
  surfaceLg: radius['3xl'],
} as const;

export default { ...radius, ...semanticRadius };
