/**
 * SITREP Design System v6 - Animation Tokens
 * =========================================
 * Sistema de animaciones consistente y accesible
 * 
 * Respetamos prefers-reduced-motion
 */

// ============================================
// DURATIONS
// ============================================
export const duration = {
  instant: '50ms',
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '400ms',
  slowest: '500ms',
} as const;

// ============================================
// EASING FUNCTIONS
// ============================================
export const easing = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
} as const;

// ============================================
// KEYFRAME ANIMATIONS
// ============================================
export const keyframes = {
  fadeIn: `
    from { opacity: 0; }
    to { opacity: 1; }
  `,
  fadeOut: `
    from { opacity: 1; }
    to { opacity: 0; }
  `,
  fadeInUp: `
    from { 
      opacity: 0; 
      transform: translateY(12px); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0); 
    }
  `,
  fadeInDown: `
    from { 
      opacity: 0; 
      transform: translateY(-12px); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0); 
    }
  `,
  fadeInLeft: `
    from { 
      opacity: 0; 
      transform: translateX(-12px); 
    }
    to { 
      opacity: 1; 
      transform: translateX(0); 
    }
  `,
  fadeInRight: `
    from { 
      opacity: 0; 
      transform: translateX(12px); 
    }
    to { 
      opacity: 1; 
      transform: translateX(0); 
    }
  `,
  scaleIn: `
    from { 
      opacity: 0; 
      transform: scale(0.96); 
    }
    to { 
      opacity: 1; 
      transform: scale(1); 
    }
  `,
  scaleOut: `
    from { 
      opacity: 1; 
      transform: scale(1); 
    }
    to { 
      opacity: 0; 
      transform: scale(0.96); 
    }
  `,
  slideInUp: `
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  `,
  slideInDown: `
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  `,
  slideInLeft: `
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  `,
  slideInRight: `
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  `,
  spin: `
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  `,
  pulse: `
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  `,
  bounce: `
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-25%); }
  `,
  shake: `
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80% { transform: translateX(4px); }
  `,
  shimmer: `
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  `,
  progress: `
    0% { width: 0; }
    100% { width: 100%; }
  `,
  ripple: `
    0% { 
      transform: scale(0);
      opacity: 0.5;
    }
    100% { 
      transform: scale(4);
      opacity: 0;
    }
  `,
} as const;

// ============================================
// PRESET ANIMATIONS
// ============================================
export const animations = {
  // Entrances
  'fade-in': `fadeIn ${duration.normal} ${easing.easeOut}`,
  'fade-in-up': `fadeInUp ${duration.normal} ${easing.easeOut}`,
  'fade-in-down': `fadeInDown ${duration.normal} ${easing.easeOut}`,
  'fade-in-left': `fadeInLeft ${duration.normal} ${easing.easeOut}`,
  'fade-in-right': `fadeInRight ${duration.normal} ${easing.easeOut}`,
  'scale-in': `scaleIn ${duration.normal} ${easing.spring}`,
  
  // Exits
  'fade-out': `fadeOut ${duration.fast} ${easing.easeIn}`,
  'scale-out': `scaleOut ${duration.fast} ${easing.easeIn}`,
  
  // Slides
  'slide-in-up': `slideInUp ${duration.slow} ${easing.spring}`,
  'slide-in-down': `slideInDown ${duration.slow} ${easing.spring}`,
  'slide-in-left': `slideInLeft ${duration.slow} ${easing.spring}`,
  'slide-in-right': `slideInRight ${duration.slow} ${easing.spring}`,
  
  // Continuous
  'spin': `spin 1s linear infinite`,
  'spin-slow': `spin 3s linear infinite`,
  'pulse': `pulse 2s ease-in-out infinite`,
  'pulse-fast': `pulse 1s ease-in-out infinite`,
  'bounce': `bounce 1s ease-in-out infinite`,
  'shimmer': `shimmer 2s linear infinite`,
  
  // Feedback
  'shake': `shake ${duration.slow} ${easing.easeInOut}`,
  'ripple': `ripple 0.6s linear`,
} as const;

// ============================================
// STAGGER DELAYS
// ============================================
export const stagger = {
  1: '0ms',
  2: '50ms',
  3: '100ms',
  4: '150ms',
  5: '200ms',
  6: '250ms',
  7: '300ms',
  8: '350ms',
  9: '400ms',
  10: '450ms',
} as const;

// ============================================
// TRANSITION PRESETS
// ============================================
export const transitions = {
  colors: `color ${duration.fast} ${easing.easeOut}, background-color ${duration.fast} ${easing.easeOut}, border-color ${duration.fast} ${easing.easeOut}`,
  transform: `transform ${duration.normal} ${easing.spring}`,
  opacity: `opacity ${duration.fast} ${easing.easeOut}`,
  shadow: `box-shadow ${duration.normal} ${easing.easeOut}`,
  all: `all ${duration.normal} ${easing.easeOut}`,
} as const;

// ============================================
// EXPORT COMPLETO
// ============================================
export const animation = {
  duration,
  easing,
  keyframes,
  animations,
  stagger,
  transitions,
} as const;

export default animation;
