import React, { useState } from 'react';
import {
    Package,
    Scale,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Camera,
    FileText,
    ChevronRight
} from 'lucide-react';
import './OperadorApp.css';

const OperadorApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'entrantes' | 'recibidos' | 'tratados'>('entrantes');

    // Mock data para demo
    const manifiestos = {
        entrantes: [
            {
                id: '1',
                numero: '2025-001234',
                generador: 'Química Industrial Mendoza',
                transportista: 'Transportes Andes',
                residuo: 'Y1 - Ácido Clorhídrico',
                cantidadDeclarada: 150,
                unidad: 'kg',
                eta: '14:30'
            }
        ],
        recibidos: [
            {
                id: '2',
                numero: '2025-001230',
                generador: 'Hospital Central',
                residuo: 'Y15 - Residuos Hospitalarios',
                cantidadDeclarada: 500,
                cantidadReal: 485,
                unidad: 'kg',
                diferencia: -15,
                fechaRecepcion: new Date().toISOString()
            }
        ],
        tratados: []
    };

    const currentList = manifiestos[activeTab];

    return (
        <div className="mobile-app operador-app animate-fadeIn">
            {/* App Header */}
            <div className="mobile-header operador-header">
                <div className="header-top">
                    <div className="user-welcome">
                        <span>Planta de Tratamiento</span>
                        <h3>Operador Demo</h3>
                    </div>
                    <div className="header-avatar operador">
                        <Package size={20} />
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="mobile-stats">
                    <div className="stat-card info">
                        <span className="stat-value">{manifiestos.entrantes.length}</span>
                        <span className="stat-label">En Camino</span>
                    </div>
                    <div className="stat-card success">
                        <span className="stat-value">{manifiestos.recibidos.length}</span>
                        <span className="stat-label">Recibidos</span>
                    </div>
                    <div className="stat-card primary">
                        <span className="stat-value">{manifiestos.tratados.length}</span>
                        <span className="stat-label">Tratados</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mobile-tabs">
                <button
                    className={`tab-btn ${activeTab === 'entrantes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('entrantes')}
                >
                    En Camino
                </button>
                <button
                    className={`tab-btn ${activeTab === 'recibidos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recibidos')}
                >
                    Recibidos
                </button>
                <button
                    className={`tab-btn ${activeTab === 'tratados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tratados')}
                >
                    Tratados
                </button>
            </div>

            {/* Content List */}
            <div className="mobile-content">
                <div className="cards-list">
                    {activeTab === 'entrantes' && currentList.map((m: any) => (
                        <div key={m.id} className="mobile-card operador-card">
                            <div className="card-header">
                                <span className="card-id">#{m.numero.split('-')[1]}</span>
                                <span className="eta-badge">
                                    ETA: {m.eta}
                                </span>
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <Package size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Residuo</span>
                                        <p>{m.residuo}</p>
                                    </div>
                                </div>

                                <div className="info-row">
                                    <Scale size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Cantidad Declarada</span>
                                        <p>{m.cantidadDeclarada} {m.unidad}</p>
                                    </div>
                                </div>

                                <div className="info-row">
                                    <FileText size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Generador</span>
                                        <p>{m.generador}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer">
                                <button className="btn-mobile info">
                                    Ver Detalles
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'recibidos' && currentList.map((m: any) => (
                        <div key={m.id} className="mobile-card operador-card">
                            <div className="card-header">
                                <span className="card-id">#{m.numero.split('-')[1]}</span>
                                <span className={`status-badge ${m.diferencia === 0 ? 'success' : 'warning'}`}>
                                    {m.diferencia === 0 ? 'Conforme' : 'Con Diferencia'}
                                </span>
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <Package size={16} className="icon-muted" />
                                    <div className="info-text">
                                        <span className="label">Residuo</span>
                                        <p>{m.residuo}</p>
                                    </div>
                                </div>

                                <div className="weight-comparison">
                                    <div className="weight-item">
                                        <span className="weight-label">Declarado</span>
                                        <span className="weight-value">{m.cantidadDeclarada} {m.unidad}</span>
                                    </div>
                                    <div className="weight-arrow">→</div>
                                    <div className="weight-item">
                                        <span className="weight-label">Real</span>
                                        <span className="weight-value highlight">{m.cantidadReal} {m.unidad}</span>
                                    </div>
                                </div>

                                {m.diferencia !== 0 && (
                                    <div className="difference-alert">
                                        <AlertTriangle size={14} />
                                        <span>Diferencia: {m.diferencia} {m.unidad}</span>
                                    </div>
                                )}
                            </div>

                            <div className="card-footer">
                                <div className="action-buttons-row">
                                    <button className="btn-mobile danger small">
                                        <XCircle size={18} />
                                        Rechazar
                                    </button>
                                    <button className="btn-mobile success small">
                                        <CheckCircle size={18} />
                                        Aprobar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {currentList.length === 0 && (
                        <div className="empty-state">
                            <p>No hay manifiestos en esta sección</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Action Button (FAB) */}
            <button className="fab-scan">
                <Camera size={24} />
            </button>
        </div>
    );
};

export default OperadorApp;
