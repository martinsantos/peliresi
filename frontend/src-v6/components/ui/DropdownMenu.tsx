/**
 * SITREP v6 - DropdownMenu Component
 * ===================================
 * Menú desplegable accesible
 */

import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Check, ChevronRight } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// CONTEXT
// ========================================
interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined);

function useDropdown() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within a DropdownMenu');
  }
  return context;
}

// ========================================
// DROPDOWN MENU
// ========================================
interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
}

export function DropdownMenu({ children, className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div className={cn('relative inline-block', className)}>{children}</div>
    </DropdownContext.Provider>
  );
}

// ========================================
// TRIGGER
// ========================================
interface DropdownTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

export function DropdownTrigger({ children, asChild, className }: DropdownTriggerProps) {
  const { isOpen, setIsOpen, triggerRef } = useDropdown();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      ref: triggerRef,
      onClick: () => setIsOpen(!isOpen),
      'aria-expanded': isOpen,
      'aria-haspopup': true,
    });
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      aria-expanded={isOpen}
      aria-haspopup="true"
      className={className}
    >
      {children}
    </button>
  );
}

// ========================================
// CONTENT
// ========================================
interface DropdownContentProps {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function DropdownContent({ children, align = 'end', className }: DropdownContentProps) {
  const { isOpen, setIsOpen } = useDropdown();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, setIsOpen]);

  const alignStyles = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      className={cn(
        'absolute top-full mt-1 min-w-[200px] z-50',
        'bg-white rounded-xl shadow-4 border border-neutral-200',
        'py-1 animate-in fade-in zoom-in-95 duration-100',
        alignStyles[align],
        className
      )}
    >
      {children}
    </div>
  );
}

// ========================================
// ITEM
// ========================================
interface DropdownItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: React.ReactNode;
  shortcut?: string;
  className?: string;
}

export function DropdownItem({
  children,
  onClick,
  disabled,
  destructive,
  icon,
  shortcut,
  className,
}: DropdownItemProps) {
  const { setIsOpen } = useDropdown();

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    setIsOpen(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
        'hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none',
        disabled && 'opacity-50 cursor-not-allowed',
        destructive && 'text-error-600 hover:bg-error-50',
        !destructive && 'text-neutral-700',
        className
      )}
    >
      {icon && <span className="shrink-0 text-neutral-500">{icon}</span>}
      <span className="flex-1 text-left">{children}</span>
      {shortcut && (
        <span className="shrink-0 text-xs text-neutral-400 font-medium">{shortcut}</span>
      )}
    </button>
  );
}

// ========================================
// CHECKBOX ITEM
// ========================================
interface DropdownCheckboxItemProps {
  children: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function DropdownCheckboxItem({
  children,
  checked,
  onCheckedChange,
  disabled,
  className,
}: DropdownCheckboxItemProps) {
  const { setIsOpen } = useDropdown();

  const handleClick = () => {
    if (disabled) return;
    onCheckedChange(!checked);
    // Don't close on checkbox toggle
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
        'hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span className={cn(
        'w-4 h-4 rounded border flex items-center justify-center transition-colors',
        checked
          ? 'bg-primary-500 border-primary-500'
          : 'border-neutral-300 bg-white'
      )}>
        {checked && <Check size={12} className="text-white" />}
      </span>
      <span className="flex-1 text-left text-neutral-700">{children}</span>
    </button>
  );
}

// ========================================
// SEPARATOR
// ========================================
export function DropdownSeparator({ className }: { className?: string }) {
  return <div className={cn('h-px bg-neutral-200 my-1', className)} />;
}

// ========================================
// LABEL
// ========================================
export function DropdownLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-3 py-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider', className)}>
      {children}
    </div>
  );
}

// ========================================
// SUBMENU
// ========================================
interface DropdownSubmenuProps {
  children: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
}

export function DropdownSubmenu({ children, label, icon }: DropdownSubmenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
      >
        {icon && <span className="shrink-0 text-neutral-500">{icon}</span>}
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight size={14} className="shrink-0 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute left-full top-0 ml-0.5 min-w-[160px] bg-white rounded-xl shadow-4 border border-neutral-200 py-1">
          {children}
        </div>
      )}
    </div>
  );
}

export default DropdownMenu;
