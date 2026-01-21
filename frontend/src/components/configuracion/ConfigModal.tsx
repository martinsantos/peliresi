/**
 * ConfigModal - Reusable modal component for configuration pages
 */

import React from 'react';
import { X } from 'lucide-react';

interface ConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

export function ConfigModal({ isOpen, onClose, title, children, size = 'md' }: ConfigModalProps): React.ReactElement | null {
    if (!isOpen) return null;

    return (
        <div className="config-modal-overlay" onClick={onClose}>
            <div className={`config-modal config-modal-${size}`} onClick={e => e.stopPropagation()}>
                <div className="config-modal-header">
                    <h3>{title}</h3>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="config-modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default ConfigModal;
