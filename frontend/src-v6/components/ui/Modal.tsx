/**
 * SITREP v6 - Modal Component
 * ===========================
 * Modal/dialog con animaciones y backdrop
 */

import React, { useEffect, useRef, useId, useContext, createContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './ButtonV2';

// Nested dialogs share a scroll lock; only the front dialog owns keyboard events.
const openDialogs: HTMLDivElement[] = [];
let originalBodyOverflow = '';
const ModalDepth = createContext(0);

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// TYPES
// ========================================
type ModalSize = 'sm' | 'base' | 'lg' | 'xl' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  isBusy?: boolean;
}

// ========================================
// SIZE STYLES
// ========================================
const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-md',
  base: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]',
};

// ========================================
// COMPONENT
// ========================================
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'base',
  children,
  footer,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  isBusy = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const depth = useContext(ModalDepth);
  const titleId = useId();
  const descriptionId = useId();
  const settings = useRef({ onClose, closeOnEscape, isBusy });
  useEffect(() => { settings.current = { onClose, closeOnEscape, isBusy }; }, [onClose, closeOnEscape, isBusy]);

  // Focus trap: Tab cycles within the modal
  useEffect(() => {
    const dialog = modalRef.current;
    if (!isOpen || !dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (openDialogs.length === 0) originalBodyOverflow = document.body.style.overflow;
    openDialogs.push(dialog);
    openDialogs.sort((a, b) => Number(a.dataset.modalDepth) - Number(b.dataset.modalDepth));
    document.body.style.overflow = 'hidden';
    const isTopDialog = () => openDialogs.at(-1) === dialog;
    const visibleFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
      && (!element.closest('details:not([open])') || element.tagName === 'SUMMARY'));
    const handleKey = (e: KeyboardEvent) => {
      if (!isTopDialog() || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        if (settings.current.closeOnEscape && !settings.current.isBusy) {
          e.preventDefault();
          settings.current.onClose();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = visibleFocusable();
      if (focusable.length === 0) { e.preventDefault(); dialog.focus({ preventScroll: true }); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    // Auto-focus first focusable element
    const frame = requestAnimationFrame(() => {
      if (isTopDialog()) (visibleFocusable()[0] || dialog).focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
      const wasTop = isTopDialog();
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      if (openDialogs.length === 0) document.body.style.overflow = originalBodyOverflow;
      if (wasTop && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen, depth]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4" style={{ zIndex: 120 + depth * 10 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in motion-reduce:animate-none"
        onClick={closeOnOverlayClick && !isBusy ? onClose : undefined}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        data-modal-depth={depth}
        className={cn(
          'relative w-full bg-white rounded-2xl shadow-4 z-10 max-h-[94dvh] flex flex-col',
          'animate-scale-in motion-reduce:animate-none',
          sizeStyles[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={isBusy || undefined}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex shrink-0 items-start justify-between p-4 sm:p-6 border-b border-neutral-100">
            <div className="flex-1 pr-4">
              {title && (
                <h3 id={titleId} className="text-xl font-semibold text-neutral-900">
                  {title}
                </h3>
              )}
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-neutral-600">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-600"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={cn('min-h-0 p-4 sm:p-6 overflow-y-auto flex-1', !title && !showCloseButton && 'pt-6')}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 p-4 sm:p-6 border-t border-neutral-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(<ModalDepth.Provider value={depth + 1}>{modalContent}</ModalDepth.Provider>, document.body);
};

// ========================================
// MODAL CONFIRM
// ========================================
interface ConfirmModalProps extends Omit<ModalProps, 'children' | 'footer'> {
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  variant = 'primary',
  isLoading = false,
  ...props
}) => {
  return (
    <Modal
      {...props}
      description={undefined}
      size="sm"
      isBusy={isLoading}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={props.onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            isLoading={isLoading}
            variant={variant}
          >
            {isLoading ? 'Procesando...' : confirmText}
          </Button>
        </>
      }
    >
      <p className="text-neutral-600">
        {props.description}
      </p>
    </Modal>
  );
};

export default Modal;
