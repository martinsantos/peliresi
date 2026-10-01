/**
 * SITREP v6 - Select Component
 * ============================
 * Dropdown select con búsqueda opcional.
 * Uses createPortal to render dropdown on document.body,
 * preventing clipping by overflow containers (MobileLayout).
 * Handles touch events for mobile, viewport edge detection,
 * and closes on parent scroll.
 */

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
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
  sm: 'min-h-11 sm:min-h-9 px-3 text-base sm:text-sm',
  base: 'min-h-11 px-3 sm:px-4 text-base sm:text-sm',
  lg: 'min-h-12 px-4 sm:px-5 text-base',
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
  const selectId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Calculate before opening so the first painted frame is already positioned.
  const [position, setPosition] = useState<React.CSSProperties>({});

  const selectedOption = options.find((o) => o.value === value);
  const hasError = !!errorMessage;

  // Calculate dropdown position from trigger element
  const calcPosition = useCallback((): React.CSSProperties => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportH = viewport?.height || window.innerHeight;
    const viewportW = viewport?.width || window.innerWidth;
    const spaceBelow = viewportTop + viewportH - rect.bottom;
    const spaceAbove = rect.top - viewportTop;
    const dropdownMaxH = 320; // max-h-60 (240px) + search bar + count ≈ 320px

    // Open upward if not enough space below and more space above
    const openUpward = spaceBelow < dropdownMaxH && spaceAbove > spaceBelow;

    const isMobile = viewportW < 640;
    // On mobile, use nearly full viewport width for readability
    const dropdownW = Math.min(isMobile ? 400 : rect.width, viewportW - 32);
    const dropdownLeft = isMobile
      ? viewportLeft + (viewportW - dropdownW) / 2
      : Math.max(viewportLeft + 8, Math.min(rect.left, viewportLeft + viewportW - dropdownW - 8));

    return {
      position: 'fixed' as const,
      left: dropdownLeft,
      width: dropdownW,
      zIndex: 9999,
      maxHeight: Math.max(0, Math.min(dropdownMaxH, (openUpward ? spaceAbove : spaceBelow) - 12)),
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    };
  }, []);

  // Toggle open/close — calculate position BEFORE opening to prevent flash
  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!isOpen) {
      setPosition(calcPosition());
    }
    setIsOpen((prev) => !prev);
  }, [disabled, isOpen, calcPosition]);

  useEffect(() => {
    if (!isOpen) return;
    if (searchable) searchRef.current?.focus({ preventScroll: true });
    else (dropdownRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)') || dropdownRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)'))?.focus({ preventScroll: true });
  }, [isOpen, searchable]);

  // Recalculate position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      setPosition(calcPosition());
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
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

  const dismiss = () => {
    setIsOpen(false);
    setSearchTerm('');
    triggerRef.current?.focus({ preventScroll: true });
  };

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
    triggerRef.current?.focus({ preventScroll: true });
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    triggerRef.current?.focus({ preventScroll: true });
  };

  // Render portal dropdown
  const dropdownContent = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      className="flex flex-col bg-white text-neutral-900 border border-neutral-300 rounded-lg shadow-lg overflow-hidden"
      style={position}
      onKeyDown={(event) => {
        // Consume this before the parent dialog sees it. One Escape, one layer.
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); return; }
        if (event.key === 'Tab') { setIsOpen(false); triggerRef.current?.focus({ preventScroll: true }); return; }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        if (event.target === searchRef.current && (event.key === 'Home' || event.key === 'End')) return;
        event.preventDefault();
        const entries = Array.from(dropdownRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') || []);
        const index = entries.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length;
        entries[next]?.focus({ preventScroll: true });
        entries[next]?.scrollIntoView?.({ block: 'nearest' });
      }}
    >
      {/* Search */}
      {searchable && (
        <div className="shrink-0 p-2 border-b border-neutral-100">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              ref={searchRef}
              aria-label={'Buscar ' + (label || 'opción')}
              aria-controls={`${selectId}-options`}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="min-h-11 w-full pl-9 pr-3 py-2 text-base sm:text-sm bg-neutral-50 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-700/30"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Options */}
      <div id={`${selectId}-options`} role="listbox" aria-label={label || placeholder} className="min-h-0 max-h-72 sm:max-h-60 overflow-auto py-1 overscroll-contain">
        {filteredOptions.length === 0 ? (
          <div className="px-4 py-3 text-sm text-neutral-500 text-center">
            No se encontraron opciones
          </div>
        ) : (
          filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              tabIndex={-1}
              onClick={() => handleSelect(option.value)}
              disabled={option.disabled}
              className={cn(
                'min-h-11 w-full flex items-center justify-between px-4 py-3 sm:py-2.5 text-sm text-left focus-visible:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-700',
                'hover:bg-neutral-50 active:bg-neutral-100 transition-colors',
                option.disabled && 'opacity-50 cursor-not-allowed',
                value === option.value && 'bg-primary-50 text-primary-600 font-medium'
              )}
            >
              {renderOption ? (
                <span className="flex-1 min-w-0">{renderOption(option, value === option.value)}</span>
              ) : (
                <span className="min-w-0 whitespace-normal">{option.label}</span>
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
        <div className="shrink-0 px-3 py-1.5 border-t border-neutral-100 text-xs text-neutral-600">
          {filteredOptions.length} de {options.length} opciones
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className={cn('relative min-w-0', isFullWidth && 'w-full')} ref={containerRef}>
      {/* Label */}
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Select trigger */}
      <div className="relative">
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        aria-label={label ? undefined : placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${selectId}-options` : undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={`${selectId}-value${helperText || errorMessage ? ` ${selectId}-help` : ''}`}
        onClick={handleToggle}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); dismiss(); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!isOpen) handleToggle(); }
        }}
        disabled={disabled}
        className={cn(
          'w-full min-w-0 flex items-center justify-between gap-2 rounded-lg border bg-white text-neutral-900',
          'transition-colors duration-150',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700',
          sizeStyles[size],
          hasError
            ? 'border-error-500 bg-error-50/30'
            : 'border-neutral-400 hover:border-neutral-500 focus:border-primary-600',
          disabled && 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed',
          isOpen && 'border-primary-600',
          clearable && value !== '' && selectedOption && !disabled && 'pr-14'
        )}
      >
        <span
          id={`${selectId}-value`}
          className={cn(
            'truncate',
            !selectedOption && 'text-neutral-600'
          )}
        >
          {selectedOption?.label || placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <ChevronDown
            size={18}
            className={cn(
              'text-neutral-400 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>
      {clearable && value !== '' && selectedOption && !disabled && <button type="button" aria-label={'Limpiar ' + (label || 'selección')} onClick={handleClear} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"><X size={16} /></button>}
      </div>

      {/* Portal dropdown */}
      {dropdownContent}

      {/* Helper/Error text */}
      {(helperText || errorMessage) && (
        <p
          id={`${selectId}-help`}
          className={cn(
            'mt-1.5 text-sm',
            hasError ? 'text-error-700' : 'text-neutral-600'
          )}
        >
          {errorMessage || helperText}
        </p>
      )}
    </div>
  );
};

export default Select;
