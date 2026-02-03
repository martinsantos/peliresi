/**
 * SITREP v6 - Contextual Help
 * ============================
 * Small "?" icon button with tooltip for in-page guidance.
 */

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

// ========================================
// TYPES
// ========================================
interface ContextualHelpProps {
  text: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

// ========================================
// COMPONENT
// ========================================
export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  text,
  title,
  position = 'top',
}) => {
  const [open, setOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Position the tooltip relative to the trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const pad = 8;
    const style: React.CSSProperties = { position: 'fixed', zIndex: 9990 };

    switch (position) {
      case 'top':
        style.bottom = window.innerHeight - rect.top + pad;
        style.left = rect.left + rect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        style.top = rect.bottom + pad;
        style.left = rect.left + rect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'left':
        style.top = rect.top + rect.height / 2;
        style.right = window.innerWidth - rect.left + pad;
        style.transform = 'translateY(-50%)';
        break;
      case 'right':
        style.top = rect.top + rect.height / 2;
        style.left = rect.right + pad;
        style.transform = 'translateY(-50%)';
        break;
    }

    setTooltipStyle(style);
  }, [open, position]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        tooltipRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-neutral-400 hover:text-primary-500 hover:bg-primary-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200"
        aria-label="Ayuda"
      >
        <HelpCircle size={15} />
      </button>

      {open && (
        <div
          ref={tooltipRef}
          style={tooltipStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="w-64 bg-white rounded-xl shadow-lg border border-neutral-200 p-3 animate-fade-in"
        >
          {title && (
            <p className="text-sm font-semibold text-neutral-900 mb-1">{title}</p>
          )}
          <p className="text-xs text-neutral-600 leading-relaxed">{text}</p>
        </div>
      )}
    </>
  );
};

export default ContextualHelp;
