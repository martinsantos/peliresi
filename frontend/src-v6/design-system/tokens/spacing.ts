/**
 * SITREP Design System v6 - Spacing Tokens
 * =======================================
 * Sistema de espaciado basado en 4px grid
 * 
 * Base: 4px (0.25rem)
 * Escala: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128
 */

// ============================================
// SPACING SCALE
// ============================================
export const space = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
  36: '9rem',        // 144px
  40: '10rem',       // 160px
  44: '11rem',       // 176px
  48: '12rem',       // 192px
  52: '13rem',       // 208px
  56: '14rem',       // 224px
  60: '15rem',       // 240px
  64: '16rem',       // 256px
  72: '18rem',       // 288px
  80: '20rem',       // 320px
  96: '24rem',       // 384px
} as const;

// ============================================
// SIZES - Para width, height, etc.
// ============================================
export const size = {
  ...space,
  auto: 'auto',
  full: '100%',
  screen: '100vh',
  min: 'min-content',
  max: 'max-content',
  fit: 'fit-content',
} as const;

// ============================================
// LAYOUT SIZES
// ============================================
export const layout = {
  // Container widths
  'container-sm': '640px',
  'container-md': '768px',
  'container-lg': '1024px',
  'container-xl': '1280px',
  'container-2xl': '1400px',
  'container-max': '1600px',
  
  // Component sizes
  'header-height': '64px',
  'sidebar-width': '260px',
  'sidebar-collapsed': '72px',
  'bottom-nav-height': '64px',
  
  // Form sizes
  'input-height-sm': '36px',
  'input-height-base': '44px',
  'input-height-lg': '52px',
  
  // Button sizes
  'button-height-sm': '32px',
  'button-height-base': '40px',
  'button-height-lg': '48px',
  
  // Icon sizes
  'icon-xs': '12px',
  'icon-sm': '16px',
  'icon-base': '20px',
  'icon-lg': '24px',
  'icon-xl': '32px',
  'icon-2xl': '40px',
} as const;

// ============================================
// Z-INDEX SCALE
// ============================================
export const zIndex = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
  max: 9999,
} as const;

// ============================================
// EXPORT COMPLETO
// ============================================
export const spacing = {
  space,
  size,
  layout,
  zIndex,
} as const;

export default spacing;
