/**
 * IncidentModal & ParadaModal - Trip event modals
 * WITH INLINE STYLES to bypass PWA cache issues
 */

import React from 'react';
import { AlertTriangle, Pause, X } from 'lucide-react';

// Inline styles - guaranteed to apply regardless of cache
const modalStyles = {
    overlay: {
        position: 'fixed' as const,
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px 16px 16px',
    },
    content: {
        width: '100%',
        maxWidth: '400px',
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
    },
    headerIcon: {
        color: '#f59e0b',
    },
    headerIconIncident: {
        color: '#ef4444',
    },
    title: {
        flex: 1,
        fontSize: '18px',
        fontWeight: 700,
        color: '#f8fafc',
        margin: 0,
    },
    closeBtn: {
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        borderRadius: '10px',
        color: '#94a3b8',
        cursor: 'pointer',
    },
    body: {
        marginBottom: '24px',
    },
    textarea: {
        width: '100%',
        padding: '14px 16px',
        background: 'rgba(30, 41, 59, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#f8fafc',
        fontSize: '15px',
        resize: 'none' as const,
        outline: 'none',
        fontFamily: 'inherit',
    },
    actions: {
        display: 'flex',
        gap: '12px',
    },
    btnBase: {
        flex: 1,
        padding: '14px',
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    btnCancel: {
        background: 'rgba(255, 255, 255, 0.1)',
        color: '#94a3b8',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    btnConfirmIncident: {
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        color: 'white',
        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
    },
    btnConfirmParada: {
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        color: 'white',
        boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)',
    },
};

// ========== INCIDENT MODAL ==========
interface IncidentModalProps {
    isOpen: boolean;
    text: string;
    onTextChange: (text: string) => void;
    onConfirm: () => void;
    onClose: () => void;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({
    isOpen,
    text,
    onTextChange,
    onConfirm,
    onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={modalStyles.content} onClick={e => e.stopPropagation()}>
                <div style={modalStyles.header}>
                    <AlertTriangle size={24} style={modalStyles.headerIconIncident} />
                    <h3 style={modalStyles.title}>Registrar Incidente</h3>
                    <button style={modalStyles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div style={modalStyles.body}>
                    <textarea
                        style={{ ...modalStyles.textarea, minHeight: '100px' }}
                        placeholder="Describa el incidente..."
                        value={text}
                        onChange={e => onTextChange(e.target.value)}
                        rows={4}
                        autoFocus
                    />
                </div>
                <div style={modalStyles.actions}>
                    <button 
                        style={{ ...modalStyles.btnBase, ...modalStyles.btnCancel }} 
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button 
                        style={{ ...modalStyles.btnBase, ...modalStyles.btnConfirmIncident }} 
                        onClick={onConfirm}
                    >
                        <AlertTriangle size={16} />
                        Registrar Incidente
                    </button>
                </div>
            </div>
        </div>
    );
};

// ========== PARADA MODAL ==========
interface ParadaModalProps {
    isOpen: boolean;
    text: string;
    onTextChange: (text: string) => void;
    onConfirm: () => void;
    onClose: () => void;
}

export const ParadaModal: React.FC<ParadaModalProps> = ({
    isOpen,
    text,
    onTextChange,
    onConfirm,
    onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={modalStyles.content} onClick={e => e.stopPropagation()}>
                <div style={modalStyles.header}>
                    <Pause size={24} style={modalStyles.headerIcon} />
                    <h3 style={modalStyles.title}>Registrar Parada</h3>
                    <button style={modalStyles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div style={modalStyles.body}>
                    <textarea
                        style={{ ...modalStyles.textarea, minHeight: '80px' }}
                        placeholder="Motivo de la parada (opcional)..."
                        value={text}
                        onChange={e => onTextChange(e.target.value)}
                        rows={3}
                        autoFocus
                    />
                </div>
                <div style={modalStyles.actions}>
                    <button 
                        style={{ ...modalStyles.btnBase, ...modalStyles.btnCancel }} 
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button 
                        style={{ ...modalStyles.btnBase, ...modalStyles.btnConfirmParada }} 
                        onClick={onConfirm}
                    >
                        <Pause size={16} />
                        Confirmar Parada
                    </button>
                </div>
            </div>
        </div>
    );
};
