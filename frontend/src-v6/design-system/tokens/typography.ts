/**
 * SITREP Design System v6 - Typography Tokens
 * ===========================================
 * Sistema tipográfico escalable y accesible
 * 
 * Fuente principal: Plus Jakarta Sans (display) + Inter (body)
 * Escala: 1.250 (Major Third)
 */

// ============================================
// FONT FAMILIES
// ============================================
export const fontFamily = {
  display: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
} as const;

// ============================================
// FONT SIZES - Escala 1.250
// ============================================
export const fontSize = {
  '2xs': '0.625rem',   // 10px
  'xs': '0.75rem',     // 12px
  'sm': '0.875rem',    // 14px
  'base': '1rem',      // 16px
  'lg': '1.125rem',    // 18px
  'xl': '1.25rem',     // 20px
  '2xl': '1.5rem',     // 24px
  '3xl': '1.875rem',   // 30px
  '4xl': '2.25rem',    // 36px
  '5xl': '3rem',       // 48px
  '6xl': '3.75rem',    // 60px
  '7xl': '4.5rem',     // 72px
} as const;

// ============================================
// FONT WEIGHTS
// ============================================
export const fontWeight = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

// ============================================
// LINE HEIGHTS
// ============================================
export const lineHeight = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
} as const;

// ============================================
// LETTER SPACING
// ============================================
export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

// ============================================
// TYPE STYLES - Pre-configured combinations
// ============================================
export const typeStyles = {
  // Display
  'display-xl': {
    fontSize: fontSize['6xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  'display-lg': {
    fontSize: fontSize['5xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  'display-md': {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  'display-sm': {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.tight,
  },
  
  // Headings
  'heading-1': {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  'heading-2': {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  'heading-3': {
    fontSize: fontSize['xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  'heading-4': {
    fontSize: fontSize['lg'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  'heading-5': {
    fontSize: fontSize['base'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  'heading-6': {
    fontSize: fontSize['sm'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wide,
  },
  
  // Body
  'body-lg': {
    fontSize: fontSize['lg'],
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  'body-base': {
    fontSize: fontSize['base'],
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  'body-sm': {
    fontSize: fontSize['sm'],
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  'body-xs': {
    fontSize: fontSize['xs'],
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  
  // Labels
  'label-lg': {
    fontSize: fontSize['sm'],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
  'label-base': {
    fontSize: fontSize['xs'],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
  'label-sm': {
    fontSize: fontSize['2xs'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase' as const,
  },
  
  // Monospace (para datos técnicos)
  'mono-lg': {
    fontSize: fontSize['lg'],
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamily.mono,
  },
  'mono-base': {
    fontSize: fontSize['base'],
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamily.mono,
  },
  'mono-sm': {
    fontSize: fontSize['sm'],
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamily.mono,
  },
} as const;

// ============================================
// EXPORT COMPLETO
// ============================================
export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  typeStyles,
} as const;

export default typography;
