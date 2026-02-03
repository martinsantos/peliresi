/**
 * SITREP v6 - Select Component
 * ============================
 * Dropdown select con búsqueda opcional
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// TYPES
// ========================================
type SelectSize = 'sm' | 'base' | 'lg';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  errorMessage?: string;
  size?: SelectSize;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  isFullWidth?: boolean;
}

// ========================================
// SIZE STYLES
// ========================================
const sizeStyles: Record<SelectSize, string> = {
  sm: 'h-9 px-3 text-sm',
  base: 'h-11 px-4 text-sm',
  lg: 'h-14 px-5 text-base',
};

// ========================================
// COMPONENT
// ========================================
export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  label,
  helperText,
  errorMessage,
  size = 'base',
  disabled = false,
  searchable = false,
  clearable = false,
  isFullWidth = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const hasError = !!errorMessage;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options if searchable
  const filteredOptions = searchable
    ? options.filter((o) =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={cn(isFullWidth && 'w-full')} ref={containerRef}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Select trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between rounded-xl border-2 bg-white',
          'transition-all duration-200',
          'focus:outline-none focus:ring-4 focus:ring-primary-500/10',
          sizeStyles[size],
          hasError
            ? 'border-error-500 bg-error-50/30'
            : 'border-neutral-200 hover:border-neutral-300 focus:border-primary-500',
          disabled && 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed',
          isOpen && 'border-primary-500 ring-4 ring-primary-500/10'
        )}
      >
        <span
          className={cn(
            'truncate',
            !selectedOption && 'text-neutral-400'
          )}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={18}
          className={cn(
            'text-neutral-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full min-w-[200px] max-w-sm mt-1 bg-white border border-neutral-200 rounded-xl shadow-3 animate-fade-in-down">
          {/* Search */}
          {searchable && (
            <div className="p-2 border-b border-neutral-100">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 rounded-lg border-none focus:ring-2 focus:ring-primary-500/20"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Options */}
          <div className="max-h-60 overflow-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-neutral-500 text-center">
                No se encontraron opciones
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left',
                    'hover:bg-neutral-50 transition-colors',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                    value === option.value && 'bg-primary-50 text-primary-600'
                  )}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <Check size={16} className="text-primary-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Helper/Error text */}
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
};

export default Select;
