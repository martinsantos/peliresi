/**
 * SITREP v6 - Select Component
 * ============================
 * Dropdown select con búsqueda opcional.
 * Uses createPortal to render dropdown on document.body,
 * preventing clipping by overflow containers (MobileLayout).
 * Handles touch events for mobile, viewport edge detection,
 * and closes on parent scroll.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
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
  renderOption?: (option: SelectOption, isSelected: boolean) => React.ReactNode;
}

// ========================================
// SIZE STYLES
// ========================================
const sizeStyles: Record<SelectSize, string> = {
  sm: 'h-9 px-3 text-xs sm:text-sm',
  base: 'h-10 sm:h-11 px-3 sm:px-4 text-sm',
  lg: 'h-11 sm:h-14 px-4 sm:px-5 text-sm sm:text-base',
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
  renderOption,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Store position in ref to avoid flash at 0,0 on first render
  const positionRef = useRef<React.CSSProperties>({});
  const [positionVersion, setPositionVersion] = useState(0);

  const selectedOption = options.find((o) => o.value === value);
  const hasError = !!errorMessage;

  // Calculate dropdown position from trigger element
  const calcPosition = useCallback((): React.CSSProperties => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownMaxH = 320; // max-h-60 (240px) + search bar + count ≈ 320px

    // Open upward if not enough space below and more space above
    const openUpward = spaceBelow < dropdownMaxH && spaceAbove > spaceBelow;

    const viewportW = window.innerWidth;
    const isMobile = viewportW < 640;
    // On mobile, use nearly full viewport width for readability
    const dropdownW = isMobile ? Math.min(viewportW - 32, 400) : rect.width;
    const dropdownLeft = isMobile
      ? Math.max(16, (viewportW - dropdownW) / 2)
      : Math.min(rect.left, Math.max(0, viewportW - rect.width - 8));

    return {
      position: 'fixed' as const,
      left: dropdownLeft,
      width: dropdownW,
      zIndex: 9999,
      ...(openUpward
        ? { bottom: viewportH - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    };
  }, []);

  // Toggle open/close — calculate position BEFORE opening to prevent flash
  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!isOpen) {
      positionRef.current = calcPosition();
      setPositionVersion((v) => v + 1);
    }
    setIsOpen((prev) => !prev);
  }, [disabled, isOpen, calcPosition]);

  // Recalculate position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      positionRef.current = calcPosition();
      setPositionVersion((v) => v + 1);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, calcPosition]);

  // Close on click/touch outside (handles mobile touch events)
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: Event) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

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

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  // Render portal dropdown
  const dropdownContent = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      className="bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={positionRef.current}
    >
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
              className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Options */}
      <div className="max-h-72 sm:max-h-60 overflow-auto py-1 overscroll-contain">
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
                'w-full flex items-center justify-between px-4 py-3 sm:py-2.5 text-sm text-left',
                'hover:bg-neutral-50 active:bg-neutral-100 transition-colors',
                option.disabled && 'opacity-50 cursor-not-allowed',
                value === option.value && 'bg-primary-50 text-primary-600 font-medium'
              )}
            >
              {renderOption ? (
                <span className="flex-1 min-w-0">{renderOption(option, value === option.value)}</span>
              ) : (
                <span className="truncate">{option.label}</span>
              )}
              {value === option.value && !renderOption && (
                <Check size={16} className="text-primary-500 flex-shrink-0 ml-2" />
              )}
            </button>
          ))
        )}
      </div>

      {/* Count */}
      {searchable && (
        <div className="px-3 py-1.5 border-t border-neutral-100 text-xs text-neutral-400">
          {filteredOptions.length} de {options.length} opciones
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className={cn('relative', isFullWidth && 'w-full')} ref={containerRef}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Select trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
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
        <div className="flex items-center gap-1 flex-shrink-0">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-neutral-100 rounded-full"
            >
              <X size={14} className="text-neutral-400" />
            </span>
          )}
          <ChevronDown
            size={18}
            className={cn(
              'text-neutral-400 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Portal dropdown */}
      {dropdownContent}

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
