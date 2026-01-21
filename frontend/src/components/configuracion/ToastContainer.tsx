/**
 * ToastContainer - Toast notifications for configuration pages
 */

import React from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import type { Toast } from './types';

interface ToastContainerProps {
    toasts: Toast[];
}

function getToastIcon(type: Toast['type']): React.ReactElement {
    switch (type) {
        case 'success': return <Check size={18} />;
        case 'error': return <X size={18} />;
        case 'info': return <AlertTriangle size={18} />;
    }
}

export function ToastContainer({ toasts }: ToastContainerProps): React.ReactElement {
    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast toast-${toast.type}`}>
                    {getToastIcon(toast.type)}
                    <span>{toast.message}</span>
                </div>
            ))}
        </div>
    );
}

export default ToastContainer;
