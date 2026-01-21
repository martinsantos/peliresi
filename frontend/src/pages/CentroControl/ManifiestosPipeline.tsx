/**
 * Manifiestos Pipeline Component
 */

import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import type { SystemStats } from './types';

interface ManifiestosPipelineProps {
    stats: SystemStats;
}

export const ManifiestosPipeline: React.FC<ManifiestosPipelineProps> = ({ stats }) => {
    return (
        <div className="mega-pipeline">
            <div className="pipeline-header">
                <h3><ArrowRightLeft size={18} /> Flujo de Manifiestos</h3>
                <span className="pipeline-total">{stats.manifiestos.total} total</span>
            </div>
            <div className="pipeline-flow">
                <div className="pipeline-stage borrador" style={{ flex: stats.manifiestos.borradores || 1 }}>
                    <span className="stage-count">{stats.manifiestos.borradores}</span>
                    <span className="stage-label">Borrador</span>
                    <div className="stage-bar"></div>
                </div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-stage aprobado" style={{ flex: stats.manifiestos.aprobados || 1 }}>
                    <span className="stage-count">{stats.manifiestos.aprobados}</span>
                    <span className="stage-label">Aprobado</span>
                    <div className="stage-bar"></div>
                </div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-stage transito" style={{ flex: stats.manifiestos.enTransito || 1 }}>
                    <span className="stage-count">{stats.manifiestos.enTransito}</span>
                    <span className="stage-label">Tránsito</span>
                    <div className="stage-bar"></div>
                </div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-stage entregado" style={{ flex: stats.manifiestos.entregados || 1 }}>
                    <span className="stage-count">{stats.manifiestos.entregados}</span>
                    <span className="stage-label">Entregado</span>
                    <div className="stage-bar"></div>
                </div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-stage recibido" style={{ flex: stats.manifiestos.recibidos || 1 }}>
                    <span className="stage-count">{stats.manifiestos.recibidos}</span>
                    <span className="stage-label">Recibido</span>
                    <div className="stage-bar"></div>
                </div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-stage tratado" style={{ flex: stats.manifiestos.tratados || 1 }}>
                    <span className="stage-count">{stats.manifiestos.tratados}</span>
                    <span className="stage-label">Tratado</span>
                    <div className="stage-bar"></div>
                </div>
            </div>
        </div>
    );
};
