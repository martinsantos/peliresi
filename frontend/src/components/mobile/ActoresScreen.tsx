/**
 * ActoresScreen - Pantalla de gestión de actores para móvil
 * Muestra Generadores, Transportistas y Operadores con búsqueda y filtros
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Building2, Truck, Factory, ChevronRight, Phone, Mail, MapPin, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { actorService } from '../../services/admin.service';
import './ActoresScreen.css';

type ActorTab = 'generadores' | 'transportistas' | 'operadores';

interface Actor {
    id: string;
    razonSocial: string;
    cuit: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    provincia?: string;
    activo?: boolean;
    inscripcionRNRP?: string;
    habilitacion?: string;
    categoria?: string;
    _count?: {
        manifiestos?: number;
        vehiculos?: number;
        choferes?: number;
    };
}

interface ActoresScreenProps {
    onSelectActor?: (actor: Actor, tipo: ActorTab) => void;
}

const ActoresScreen: React.FC<ActoresScreenProps> = ({ onSelectActor }) => {
    const [activeTab, setActiveTab] = useState<ActorTab>('generadores');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data state
    const [generadores, setGeneradores] = useState<Actor[]>([]);
    const [transportistas, setTransportistas] = useState<Actor[]>([]);
    const [operadores, setOperadores] = useState<Actor[]>([]);

    // Load actors from backend
    const loadActores = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [genResult, transResult, opResult] = await Promise.all([
                actorService.getGeneradores({ limit: 50 }),
                actorService.getTransportistas({ limit: 50 }),
                actorService.getOperadores({ limit: 50 })
            ]);

            setGeneradores(genResult?.generadores || []);
            setTransportistas(transResult?.transportistas || []);
            setOperadores(opResult?.operadores || []);
        } catch (err: any) {
            console.error('[ActoresScreen] Error loading actores:', err);
            setError('Error al cargar actores');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load on mount
    useEffect(() => {
        loadActores();
    }, [loadActores]);

    // Get current list based on tab
    const getCurrentList = (): Actor[] => {
        switch (activeTab) {
            case 'generadores':
                return generadores;
            case 'transportistas':
                return transportistas;
            case 'operadores':
                return operadores;
            default:
                return [];
        }
    };

    // Filter by search term
    const filteredActores = getCurrentList().filter(actor =>
        actor.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        actor.cuit?.includes(searchTerm) ||
        actor.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get icon for tab
    const getTabIcon = (tab: ActorTab) => {
        switch (tab) {
            case 'generadores':
                return <Building2 size={18} />;
            case 'transportistas':
                return <Truck size={18} />;
            case 'operadores':
                return <Factory size={18} />;
        }
    };

    // Get count for tab
    const getTabCount = (tab: ActorTab): number => {
        switch (tab) {
            case 'generadores':
                return generadores.length;
            case 'transportistas':
                return transportistas.length;
            case 'operadores':
                return operadores.length;
        }
    };

    // Render actor card
    const renderActorCard = (actor: Actor) => (
        <div
            key={actor.id}
            className="actor-card"
            onClick={() => onSelectActor?.(actor, activeTab)}
        >
            <div className="actor-card-header">
                <div className="actor-icon">
                    {getTabIcon(activeTab)}
                </div>
                <div className="actor-info">
                    <h4>{actor.razonSocial}</h4>
                    <span className="actor-cuit">CUIT: {actor.cuit}</span>
                </div>
                <div className={`actor-status ${actor.activo !== false ? 'active' : 'inactive'}`}>
                    {actor.activo !== false ? <CheckCircle size={16} /> : <XCircle size={16} />}
                </div>
            </div>

            <div className="actor-card-body">
                {actor.email && (
                    <div className="actor-detail">
                        <Mail size={14} />
                        <span>{actor.email}</span>
                    </div>
                )}
                {actor.telefono && (
                    <div className="actor-detail">
                        <Phone size={14} />
                        <span>{actor.telefono}</span>
                    </div>
                )}
                {(actor.direccion || actor.provincia) && (
                    <div className="actor-detail">
                        <MapPin size={14} />
                        <span>{[actor.direccion, actor.provincia].filter(Boolean).join(', ')}</span>
                    </div>
                )}
            </div>

            {(actor.inscripcionRNRP || actor.habilitacion || actor.categoria) && (
                <div className="actor-card-footer">
                    {actor.inscripcionRNRP && (
                        <span className="actor-badge">RNRP: {actor.inscripcionRNRP}</span>
                    )}
                    {actor.habilitacion && (
                        <span className="actor-badge">Hab: {actor.habilitacion}</span>
                    )}
                    {actor.categoria && (
                        <span className="actor-badge">{actor.categoria}</span>
                    )}
                </div>
            )}

            {actor._count && (
                <div className="actor-stats">
                    {actor._count.manifiestos !== undefined && (
                        <span>{actor._count.manifiestos} manifiestos</span>
                    )}
                    {actor._count.vehiculos !== undefined && (
                        <span>{actor._count.vehiculos} vehículos</span>
                    )}
                    {actor._count.choferes !== undefined && (
                        <span>{actor._count.choferes} choferes</span>
                    )}
                </div>
            )}

            <ChevronRight size={20} className="actor-chevron" />
        </div>
    );

    return (
        <div className="actores-screen">
            {/* Search Bar */}
            <div className="actores-search">
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, CUIT o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className="refresh-btn" onClick={loadActores} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                </button>
            </div>

            {/* Tabs */}
            <div className="actores-tabs">
                {(['generadores', 'transportistas', 'operadores'] as ActorTab[]).map(tab => (
                    <button
                        key={tab}
                        className={`actores-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {getTabIcon(tab)}
                        <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                        <span className="tab-count">{getTabCount(tab)}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="actores-content">
                {loading ? (
                    <div className="actores-loading">
                        <RefreshCw size={32} className="spinning" />
                        <span>Cargando actores...</span>
                    </div>
                ) : error ? (
                    <div className="actores-error">
                        <p>{error}</p>
                        <button onClick={loadActores}>Reintentar</button>
                    </div>
                ) : filteredActores.length === 0 ? (
                    <div className="actores-empty">
                        {getTabIcon(activeTab)}
                        <p>
                            {searchTerm
                                ? `No se encontraron ${activeTab} con "${searchTerm}"`
                                : `No hay ${activeTab} registrados`}
                        </p>
                    </div>
                ) : (
                    <div className="actores-list">
                        {filteredActores.map(renderActorCard)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActoresScreen;
