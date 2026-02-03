/**
 * SITREP v6 - SearchInput Component
 * ==================================
 * Input de búsqueda con icono, clear y loading
 */

import React, { useState, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search, X, Loader2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// TYPES
// ========================================
interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  debounce?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'bordered';
  showClear?: boolean;
  className?: string;
  inputClassName?: string;
}

// ========================================
// COMPONENT
// ========================================
export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = 'Buscar...',
  loading = false,
  debounce = 0,
  size = 'md',
  variant = 'default',
  showClear = true,
  className,
  inputClassName,
  disabled,
  ...props
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (debounce > 0) {
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounce);
    } else {
      onChange(newValue);
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    onSearch?.('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch?.(localValue);
    }
  };

  const sizeStyles = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-4 text-sm',
    lg: 'h-12 px-4 text-base',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  const variantStyles = {
    default: 'bg-white border-neutral-200 focus:border-primary-500 focus:ring-primary-500/20',
    filled: 'bg-neutral-100 border-transparent focus:bg-white focus:border-primary-500 focus:ring-primary-500/20',
    bordered: 'bg-white border-2 border-neutral-200 focus:border-primary-500 focus:ring-0',
  };

  return (
    <div className={cn('relative group', className)}>
      <div className={cn(
        'absolute left-0 top-0 bottom-0 flex items-center justify-center text-neutral-400 transition-colors',
        size === 'sm' && 'pl-3',
        size === 'md' && 'pl-3.5',
        size === 'lg' && 'pl-4',
        !disabled && 'group-focus-within:text-primary-500'
      )}>
        {loading ? (
          <Loader2 size={iconSizes[size]} className="animate-spin text-primary-500" />
        ) : (
          <Search size={iconSizes[size]} />
        )}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || loading}
        className={cn(
          'w-full rounded-xl border transition-all duration-200 outline-none',
          'placeholder:text-neutral-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeStyles[size],
          variantStyles[variant],
          'pl-10',
          showClear && localValue && 'pr-10',
          inputClassName
        )}
        {...props}
      />

      {showClear && localValue && !disabled && !loading && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            'absolute right-0 top-0 bottom-0 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors',
            size === 'sm' && 'pr-3',
            size === 'md' && 'pr-3.5',
            size === 'lg' && 'pr-4'
          )}
        >
          <X size={iconSizes[size]} />
        </button>
      )}
    </div>
  );
}

// ========================================
// SEARCH BAR (with filters button)
// ========================================
interface SearchBarProps extends Omit<SearchInputProps, 'className'> {
  onFilterClick?: () => void;
  filterCount?: number;
  className?: string;
}

export function SearchBar({
  onFilterClick,
  filterCount,
  className,
  size = 'md',
  ...searchProps
}: SearchBarProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <SearchInput {...searchProps} size={size} className="flex-1" />
      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className={cn(
            'shrink-0 flex items-center gap-2 px-4 rounded-xl border transition-all',
            'border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50',
            filterCount ? 'bg-primary-50 border-primary-200 text-primary-600' : '',
            size === 'sm' && 'h-9 text-sm',
            size === 'md' && 'h-11 text-sm',
            size === 'lg' && 'h-12 text-base'
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Filtros
          {filterCount ? (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-xs font-medium bg-primary-500 text-white rounded-full">
              {filterCount}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}

export default SearchInput;
