/**
 * ManifiestosScreen - FASE 4
 * Pantalla de lista de manifiestos extraída de MobileApp.tsx
 */

import React from 'react';
import { FileText, Search } from 'lucide-react';
import { ESTADO_CONFIG } from '../types/mobile.types';

interface ProcessedManifiesto {
    id: string;
    numero: string;
    estado: string;
    generador: string;
    operador: string;
    residuo: string;
    cantidad: string;
    fecha: string;
}

interface ManifiestosScreenProps {
    manifiestos: ProcessedManifiesto[];
    onSelectManifiesto: (m: ProcessedManifiesto) => void;
}

const ManifiestosScreen: React.FC<ManifiestosScreenProps> = ({
    manifiestos,
    onSelectManifiesto
}) => {
    const getEstadoBadge = (estado: string) => {
        const s = ESTADO_CONFIG[estado] || { bg: '#334155', color: '#94a3b8', label: estado };
        return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
    };

    return (
        <div className="section">
            <div className="search-bar">
                <Search size={18} />
                <input type="text" placeholder="Buscar manifiestos..." />
            </div>
            <div className="list">
                {manifiestos.map(m => (
                    <div key={m.id} className="list-item" onClick={() => onSelectManifiesto(m)}>
                        <div className="list-icon"><FileText size={18} /></div>
                        <div className="list-body">
                            <div className="list-title">#{m.numero}</div>
                            <div className="list-sub">{m.generador} → {m.operador}</div>
                            <div className="list-meta" style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--ind-text-mid)' }}>
                                <span style={{ color: 'var(--ind-cyan)' }}>{m.residuo || 'Residuo'}</span>
                                <span style={{ color: 'var(--ind-orange)' }}>{m.cantidad || ''}</span>
                                {m.fecha && <span>{m.fecha}</span>}
                            </div>
                        </div>
                        <div className="list-badge">{getEstadoBadge(m.estado)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManifiestosScreen;
