import type { Config } from 'tailwindcss';
import { tokens } from './src-v6/design-system/tokens/tokens';

/**
 * Tailwind CSS Configuration for SITREP v6
 * ========================================
 * Configuración que integra el Design System v6
 */

const config: Config = {
  content: [
    './src-v6/**/*.{js,ts,jsx,tsx}',
    './src-v6/index.html',
  ],
  
  theme: {
    extend: {
      // ========================================
      // COLORS - Del Design System
      // ========================================
      colors: {
        // Primarios
        primary: tokens.colors.primary,
        secondary: tokens.colors.secondary,
        
        // Semánticos
        success: tokens.colors.success,
        warning: tokens.colors.warning,
        error: tokens.colors.error,
        info: tokens.colors.info,
        
        // Neutrales
        neutral: tokens.colors.neutral,
        
        // Superficies
        surface: tokens.colors.surface,
        
        // Texto
        text: tokens.colors.text,
        
        // Bordes
        border: tokens.colors.border,
      },
      
      // ========================================
      // TYPOGRAPHY
      // ========================================
      fontFamily: {
        display: [tokens.typography.fontFamily.display],
        body: [tokens.typography.fontFamily.body],
        mono: [tokens.typography.fontFamily.mono],
      },
      
      fontSize: {
        '2xs': tokens.typography.fontSize['2xs'],
      },
      
      // ========================================
      // SPACING
      // ========================================
      spacing: {
        ...tokens.spacing.space,
      },
      
      // ========================================
      // BORDER RADIUS
      // ========================================
      borderRadius: {
        ...tokens.radius,
      },
      
      // ========================================
      // SHADOWS
      // ========================================
      boxShadow: {
        1: tokens.colors.shadows[1],
        2: tokens.colors.shadows[2],
        3: tokens.colors.shadows[3],
        4: tokens.colors.shadows[4],
        glow: tokens.colors.shadows.glow,
        'glow-error': tokens.colors.shadows['glow-error'],
        'glow-success': tokens.colors.shadows['glow-success'],
      },
      
      // ========================================
      // TRANSITIONS
      // ========================================
      transitionDuration: {
        ...tokens.animation.duration,
      },
      
      transitionTimingFunction: {
        spring: tokens.animation.easing.spring,
        smooth: tokens.animation.easing.smooth,
      },
      
      // ========================================
      // Z-INDEX
      // ========================================
      zIndex: {
        ...tokens.spacing.zIndex,
      },
      
      // ========================================
      // KEYFRAME ANIMATIONS
      // ========================================
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'fade-in-up': 'fadeInUp 200ms ease-out',
        'fade-in-down': 'fadeInDown 200ms ease-out',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-in-up': 'slideInUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-in-right': 'slideInRight 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse': 'pulse 2s ease-in-out infinite',
        'spin': 'spin 1s linear infinite',
      },
      
      // ========================================
      // LAYOUT
      // ========================================
      maxWidth: {
        'container-sm': '640px',
        'container-md': '768px',
        'container-lg': '1024px',
        'container-xl': '1280px',
        'container-2xl': '1400px',
        'container-max': '1600px',
      },
      
      height: {
        'header': '64px',
        'sidebar': 'calc(100vh - 64px)',
        'bottom-nav': '64px',
      },
      
      width: {
        'sidebar': '260px',
        'sidebar-collapsed': '72px',
      },
    },
  },
  
  plugins: [
    // Plugin para utilidades adicionales
    function({ addUtilities, theme }) {
      const newUtilities = {
        '.text-balance': {
          textWrap: 'balance',
        },
        '.tap-highlight-transparent': {
          '-webkit-tap-highlight-color': 'transparent',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.glass': {
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
        },
        '.glass-dark': {
          backgroundColor: 'rgba(18, 26, 38, 0.8)',
          backdropFilter: 'blur(12px)',
        },
      };
      addUtilities(newUtilities);
    },
  ],
  
  // Deshabilitar clases que no usamos para reducir bundle
  corePlugins: {
    // Mantener todo activo por ahora, optimizar después
  },
};

export default config;
