/**
 * SITREP v6 - Button Component v2.0
 * ==================================
 * Alto contraste, definición extrema, accesibilidad WCAG
 */

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'base' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  // Primary - Institutional green
  primary: [
    'bg-[#1B5E3C] text-white',
    'border-2 border-[#1B5E3C]',
    'shadow-md shadow-[#1B5E3C]/20',
    'hover:bg-[#164D32] hover:border-[#164D32]',
    'hover:shadow-lg hover:shadow-[#1B5E3C]/30',
    'active:bg-[#0F3D27] active:border-[#0F3D27]',
    'focus:ring-4 focus:ring-[#1B5E3C]/25',
  ].join(' '),
  
  // Secondary - Naranja intenso
  secondary: [
    'bg-secondary-600 text-white',
    'border-2 border-secondary-600',
    'shadow-md shadow-secondary-600/20',
    'hover:bg-secondary-700 hover:border-secondary-700',
    'hover:shadow-lg hover:shadow-secondary-600/30',
    'active:bg-secondary-800 active:border-secondary-800',
    'focus:ring-4 focus:ring-secondary-600/30',
  ].join(' '),
  
  // Outline - Definido
  outline: [
    'bg-white text-neutral-700',
    'border-2 border-neutral-300',
    'shadow-sm',
    'hover:border-primary-500 hover:text-primary-600',
    'hover:bg-primary-50/50',
    'active:border-primary-600 active:bg-primary-100',
    'focus:ring-4 focus:ring-primary-500/20',
  ].join(' '),
  
  // Ghost - Para acciones secundarias
  ghost: [
    'bg-transparent text-neutral-700',
    'border-2 border-transparent',
    'hover:bg-neutral-100 hover:text-neutral-900',
    'active:bg-neutral-200',
    'focus:ring-4 focus:ring-neutral-500/20',
  ].join(' '),
  
  // Danger - Rojo intenso
  danger: [
    'bg-error-600 text-white',
    'border-2 border-error-600',
    'shadow-md shadow-error-600/20',
    'hover:bg-error-700 hover:border-error-700',
    'hover:shadow-lg hover:shadow-error-600/30',
    'active:bg-error-800 active:border-error-800',
    'focus:ring-4 focus:ring-error-600/30',
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-2 rounded-lg',
  base: 'h-11 px-5 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-[10px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'base',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = isLoading || disabled;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base
          'inline-flex items-center justify-center',
          'font-semibold',
          'transition-all duration-200',
          'focus:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
          'active:scale-[0.98]',
          
          // Estilos
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          isLoading && 'cursor-wait',
          
          className
        )}
        {...props}
      >
        {isLoading && (
          <Loader2 
            className="animate-spin shrink-0" 
            size={size === 'sm' ? 14 : size === 'base' ? 16 : 18} 
          />
        )}
        
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
