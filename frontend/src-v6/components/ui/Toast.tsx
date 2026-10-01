/**
 * SITREP v6 - Toast Notification System
 * =====================================
 * Sistema de notificaciones tipo toast
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// TYPES
// ========================================
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastItemProps extends Toast {
  onRemove: (id: string) => void;
}

// ========================================
// TOAST STORE (Simple state management)
// ========================================
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

const notifyListeners = () => {
  toastListeners.forEach((listener) => listener([...toasts]));
};

export const toast = {
  add: (t: Omit<Toast, 'id'>) => {
    const existing = toasts.find(item => item.type === t.type && item.title === t.title && item.message === t.message);
    const id = existing?.id ?? Math.random().toString(36).slice(2, 11);
    if (existing) toasts = toasts.map(item => item.id === id ? { ...t, id } : item);
    else toasts = [...toasts, { ...t, id }];
    notifyListeners();
    clearTimeout(expiryTimers.get(id));
    expiryTimers.delete(id);
    // An explicit zero keeps an actionable notice until the user dismisses it.
    const duration = t.duration ?? 5000;
    if (duration > 0) expiryTimers.set(id, setTimeout(() => toast.remove(id), duration));

    return id;
  },
  
  remove: (id: string) => {
    clearTimeout(expiryTimers.get(id));
    expiryTimers.delete(id);
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  },
  
  success: (title: string, message?: string) => {
    return toast.add({ type: 'success', title, message });
  },
  
  error: (title: string, message?: string) => {
    return toast.add({ type: 'error', title, message });
  },
  
  warning: (title: string, message?: string) => {
    return toast.add({ type: 'warning', title, message });
  },
  
  info: (title: string, message?: string) => {
    return toast.add({ type: 'info', title, message });
  },
  
  subscribe: (listener: (toasts: Toast[]) => void) => {
    toastListeners.push(listener);
    listener([...toasts]);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  },
};

// ========================================
// TOAST ICONS
// ========================================
const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={20} className="text-success-500" />,
  error: <AlertCircle size={20} className="text-error-500" />,
  warning: <AlertTriangle size={20} className="text-warning-500" />,
  info: <Info size={20} className="text-info-500" />,
};

const toastStyles: Record<ToastType, string> = {
  success: 'bg-success-50 border-success-200',
  error: 'bg-error-50 border-error-200',
  warning: 'bg-warning-50 border-warning-200',
  info: 'bg-info-50 border-info-200',
};

// ========================================
// TOAST ITEM
// ========================================
const ToastItem: React.FC<ToastItemProps> = ({
  id,
  type,
  title,
  message,
  onRemove,
}) => {
  return (
    <div
      className={cn(
        'w-full rounded-xl border p-3 shadow-3',
        toastStyles[type]
      )}
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <div className="flex gap-3">
        <div className="shrink-0">{toastIcons[type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 sm:text-base">{title}</p>
          {message && (
            <p className="mt-1 break-words text-sm leading-relaxed text-neutral-700">{message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(id)}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center self-start rounded-lg text-neutral-600 hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
          aria-label="Cerrar notificación"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// ========================================
// TOAST CONTAINER
// ========================================
export const ToastContainer: React.FC = () => {
  const [activeToasts, setActiveToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return toast.subscribe((newToasts) => {
      setActiveToasts(newToasts);
    });
  }, []);

  const container = (
    <div aria-label="Avisos del sistema" role="region" className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-[9999] flex max-h-[60dvh] flex-col gap-2 overflow-y-auto sm:left-auto sm:right-4 sm:w-96">
      {activeToasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} onRemove={toast.remove} />
        </div>
      ))}
    </div>
  );

  return createPortal(container, document.body);
};

export default ToastContainer;
