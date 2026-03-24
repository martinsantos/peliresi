/**
 * SITREP v6 - Card Component v2.0
 * ================================
 * Alto contraste, definición extrema
 */

import React, { forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';
type CardPadding = 'none' | 'sm' | 'base' | 'lg';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  // Default - matches .pen design: border #E0E0DC, subtle shadow
  default: [
    'bg-white',
    'border border-[#E0E0DC]',
    'shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
    'hover:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.06),0_2px_4px_-2px_rgba(0,0,0,0.04)]',
    'hover:border-[#D4D4D0]',
  ].join(' '),

  // Elevación pronunciada
  elevated: [
    'bg-white',
    'border border-[#E0E0DC]',
    'shadow-[0_4px_8px_-2px_rgba(0,0,0,0.06),0_2px_4px_-2px_rgba(0,0,0,0.04)]',
  ].join(' '),

  // Solo borde, bien definido
  outlined: [
    'bg-white',
    'border-2 border-[#D4D4D0]',
    'shadow-none',
  ].join(' '),

  // Interactivo con estados claros
  interactive: [
    'bg-white',
    'border border-[#E0E0DC]',
    'shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
    'cursor-pointer',
    'hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.08),0_4px_8px_-4px_rgba(0,0,0,0.03)]',
    'hover:border-[rgba(27,94,60,0.2)]',
    'hover:-translate-y-0.5',
    'active:translate-y-0 active:shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
  ].join(' '),
};

const paddingStyles: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-4',
  base: 'p-5',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'base', children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-[12px]',
          'transition-all duration-200',
          variantStyles[variant],
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

// Card Header con definición
interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, React.PropsWithChildren<CardHeaderProps>>(
  ({ title, subtitle, action, icon, className, children, ...props }, ref) => {
    const useChildren = !title && !icon && children;
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-4',
          'pb-4 mb-4',
          'border-b border-neutral-200',
          className
        )}
        {...props}
      >
        {useChildren ? (
          <>{children}</>
        ) : (
          <>
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {icon && (
                <div className="p-2.5 rounded-lg bg-primary-50 text-primary-600 shrink-0">
                  {icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="font-semibold text-lg text-neutral-900 tracking-tight">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-sm text-neutral-600 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </>
        )}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

// Card Content simple
export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('', className)} {...props} />;
  }
);
CardContent.displayName = 'CardContent';

export default Card;
