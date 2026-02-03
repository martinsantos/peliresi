/**
 * SITREP v6 - Badge Component v2.0
 * =================================
 * Alto contraste, definición clara
 */

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type BadgeVariant = 'default' | 'soft' | 'outline' | 'solid';
type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  color?: BadgeColor;
  dot?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
}

const colorStyles: Record<BadgeVariant, Record<BadgeColor, string>> = {
  // Default - fondo claro, texto oscuro
  default: {
    primary: 'bg-primary-100 text-primary-800 border border-primary-200',
    success: 'bg-success-100 text-success-800 border border-success-200',
    warning: 'bg-warning-100 text-warning-800 border border-warning-200',
    error: 'bg-error-100 text-error-800 border border-error-200',
    info: 'bg-info-100 text-info-800 border border-info-200',
    neutral: 'bg-neutral-100 text-neutral-800 border border-neutral-200',
  },
  
  // Soft - más sutil pero definido
  soft: {
    primary: 'bg-primary-50 text-primary-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    error: 'bg-error-50 text-error-700',
    info: 'bg-info-50 text-info-700',
    neutral: 'bg-neutral-50 text-neutral-700',
  },
  
  // Outline - solo borde
  outline: {
    primary: 'bg-white text-primary-700 border-2 border-primary-200',
    success: 'bg-white text-success-700 border-2 border-success-200',
    warning: 'bg-white text-warning-700 border-2 border-warning-200',
    error: 'bg-white text-error-700 border-2 border-error-200',
    info: 'bg-white text-info-700 border-2 border-info-200',
    neutral: 'bg-white text-neutral-700 border-2 border-neutral-200',
  },
  
  // Solid - alto contraste
  solid: {
    primary: 'bg-primary-600 text-white border border-primary-600',
    success: 'bg-success-600 text-white border border-success-600',
    warning: 'bg-warning-500 text-white border border-warning-500',
    error: 'bg-error-600 text-white border border-error-600',
    info: 'bg-info-600 text-white border border-info-600',
    neutral: 'bg-neutral-700 text-white border border-neutral-700',
  },
};

const dotColors: Record<BadgeColor, string> = {
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  info: 'bg-info-500',
  neutral: 'bg-neutral-500',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  color = 'neutral',
  dot = false,
  pulse = false,
  children,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-2.5 py-1',
        'text-xs font-semibold',
        'rounded-full',
        'transition-colors',
        colorStyles[variant][color],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            dotColors[color],
            pulse && 'animate-pulse'
          )}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
