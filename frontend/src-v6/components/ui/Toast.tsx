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

const notifyListeners = () => {
  toastListeners.forEach((listener) => listener([...toasts]));
};

export const toast = {
  add: (t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasts = [...toasts, { ...t, id }];
    notifyListeners();

    // Auto remove
    const duration = t.duration || 5000;
    setTimeout(() => {
      toast.remove(id);
    }, duration);

    return id;
  },
  
  remove: (id: string) => {
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
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(id), 300);
  };

  return (
    <div
      className={cn(
        'w-full rounded-xl border p-3 shadow-3 sm:p-4',
        'animate-slide-in-right',
        toastStyles[type],
        isExiting && 'animate-fade-out'
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <div className="shrink-0">{toastIcons[type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 sm:text-base">{title}</p>
          {message && (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">{message}</p>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors"
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
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[9999] flex flex-col gap-2 sm:left-auto sm:right-4 sm:top-4 sm:w-96 sm:gap-3">
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
