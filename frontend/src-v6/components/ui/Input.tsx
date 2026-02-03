/**
 * SITREP v6 - Input Component
 * ===========================
 * Campo de entrada altamente configurable
 * 
 * Estados: default, error, success, disabled
 * Variantes: default, filled, flushed
 */

import React, { forwardRef } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ========================================
// UTILIDAD
// ========================================
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// TYPES
// ========================================
type InputSize = 'sm' | 'base' | 'lg';
type InputState = 'default' | 'error' | 'success';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  state?: InputState;
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isFullWidth?: boolean;
  containerClassName?: string;
}

// ========================================
// STYLES - Tamaños
// ========================================
const sizeStyles: Record<InputSize, { input: string; icon: number }> = {
  sm: { input: 'h-9 px-3 text-sm', icon: 14 },
  base: { input: 'h-11 px-4 text-sm', icon: 16 },
  lg: { input: 'h-14 px-5 text-base', icon: 18 },
};

// ========================================
// COMPONENTE
// ========================================
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'base',
      state = 'default',
      label,
      helperText,
      errorMessage,
      leftIcon,
      rightIcon,
      isFullWidth = true,
      disabled,
      className,
      containerClassName,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = state === 'error';
    const hasSuccess = state === 'success';

    // Iconos de estado
    const stateIcon = hasError ? (
      <AlertCircle size={sizeStyles[size].icon} className="text-error-500" />
    ) : hasSuccess ? (
      <Check size={sizeStyles[size].icon} className="text-success-500" />
    ) : null;

    return (
      <div className={cn(isFullWidth && 'w-full', containerClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium mb-1.5',
              disabled ? 'text-neutral-400' : 'text-neutral-700'
            )}
          >
            {label}
          </label>
        )}

        {/* Input container */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
              {leftIcon}
            </div>
          )}

          {/* Input element */}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              // Base styles
              'w-full rounded-xl border-2 bg-white',
              'transition-all duration-200 ease-out',
              'placeholder:text-neutral-400',
              'focus:outline-none',
              
              // Size
              sizeStyles[size].input,
              
              // Padding para iconos
              leftIcon && 'pl-11',
              (rightIcon || stateIcon) && 'pr-11',
              
              // States
              state === 'default' && [
                'border-neutral-200',
                'hover:border-neutral-300',
                'focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20',
              ],
              hasError && [
                'border-error-500 bg-error-50/30',
                'focus:border-error-500 focus:ring-4 focus:ring-error-500/20',
              ],
              hasSuccess && [
                'border-success-500 bg-success-50/30',
                'focus:border-success-500 focus:ring-4 focus:ring-success-500/20',
              ],
              disabled && [
                'bg-neutral-100 border-neutral-200',
                'text-neutral-400 cursor-not-allowed',
              ],
              
              // Custom classes
              className
            )}
            {...props}
          />

          {/* Right icon / State icon */}
          {(rightIcon || stateIcon) && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              {stateIcon || rightIcon}
            </div>
          )}
        </div>

        {/* Helper text / Error message */}
        {(helperText || errorMessage) && (
          <p
            className={cn(
              'mt-1.5 text-sm',
              hasError ? 'text-error-500' : 'text-neutral-500'
            )}
          >
            {errorMessage || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
