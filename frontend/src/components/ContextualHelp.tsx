import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, HelpCircle, Sparkles, Info } from 'lucide-react';
import './ContextualHelp.css';

// ============================================
// CONTEXTUAL HELP SYSTEM
// Tooltip-based UI guidance on demand
// ============================================

interface HelpItem {
    id: string;
    selector: string;
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

interface ContextualHelpProps {
    isActive: boolean;
    onClose: () => void;
    items?: HelpItem[];
}

// Default help items for each page section
const defaultHelpItems: Record<string, HelpItem[]> = {
    dashboard: [
        {
            id: 'welcome', selector: '.dashboard-welcome', title: 'Panel de Bienvenida',
            description: 'Resumen de tu actividad con accesos rápidos a las funciones principales.', position: 'bottom'
        },
        {
            id: 'stats', selector: '.stats-grid', title: 'Estadísticas en Tiempo Real',
            description: 'Contadores actualizados: manifiestos por estado, alertas pendientes.', position: 'bottom'
        },
        {
            id: 'recent', selector: '.dashboard-section', title: 'Actividad Reciente',
            description: 'Últimos manifiestos con cambios de estado. Click para ver detalles.', position: 'top'
        },
        {
            id: 'mobile', selector: '.mobile-promo-card', title: 'App Móvil',
            description: 'Accede a la versión móvil optimizada para transportistas.', position: 'left'
        },
    ],
    manifiestos: [
        {
            id: 'header', selector: '.page-header', title: 'Gestión de Manifiestos',
            description: 'Crea, edita y consulta manifiestos electrónicos de residuos peligrosos.', position: 'bottom'
        },
        {
            id: 'table', selector: '.card', title: 'Lista de Manifiestos',
            description: 'Ordenable por columnas. Click en una fila para ver detalle completo.', position: 'top'
        },
        {
            id: 'actions', selector: '.btn-primary', title: 'Acciones',
            description: 'Botones para crear nuevo manifiesto o exportar datos.', position: 'left'
        },
    ],
    tracking: [
        {
            id: 'map', selector: '.map-container, .tracking-map, .card', title: 'Mapa de Seguimiento GPS',
            description: 'Ubicación en tiempo real de transportes activos. Actualiza cada 30 segundos.', position: 'right'
        },
        {
            id: 'list', selector: '.sidebar, .tracking-sidebar', title: 'Transportes Activos',
            description: 'Lista de manifiestos en tránsito. Click para centrar en el mapa.', position: 'left'
        },
    ],
    actores: [
        {
            id: 'tabs', selector: '.tabs, .nav-tabs', title: 'Tipos de Actores',
            description: 'Alterna entre Generadores, Transportistas y Operadores.', position: 'bottom'
        },
        {
            id: 'search', selector: 'input[type="text"], .search-input', title: 'Búsqueda',
            description: 'Busca por nombre, CUIT o número de inscripción.', position: 'bottom'
        },
        {
            id: 'card', selector: '.card', title: 'Tarjeta de Actor',
            description: 'Muestra datos principales. Click para editar, botones para acciones.', position: 'right'
        },
    ],
    alertas: [
        {
            id: 'header', selector: '.page-header, h1', title: 'Sistema de Alertas',
            description: 'Configura reglas para alertas automáticas.', position: 'bottom'
        },
        {
            id: 'rules', selector: '.card', title: 'Reglas de Alerta',
            description: 'Configura qué eventos disparan alertas automáticas.', position: 'bottom'
        },
        {
            id: 'toggle', selector: 'input[type="checkbox"], .toggle', title: 'Activar/Desactivar',
            description: 'Enciende o apaga cada regla sin eliminarla.', position: 'right'
        },
    ],
    configuracion: [
        {
            id: 'profile', selector: '.card, .profile-section', title: 'Mi Perfil',
            description: 'Datos personales y preferencias de notificaciones.', position: 'right'
        },
        {
            id: 'security', selector: 'form, .security-section', title: 'Seguridad',
            description: 'Cambio de contraseña y configuración de 2FA.', position: 'right'
        },
    ],
};

const ContextualHelp: React.FC<ContextualHelpProps> = ({ isActive, onClose, items }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [helpItems, setHelpItems] = useState<HelpItem[]>([]);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
    const [isVisible, setIsVisible] = useState(false);

    // Detect current page and load relevant help items
    useEffect(() => {
        if (isActive) {
            const path = window.location.pathname;
            let pageKey = 'dashboard';

            if (path.includes('manifiestos')) pageKey = 'manifiestos';
            else if (path.includes('tracking')) pageKey = 'tracking';
            else if (path.includes('actores')) pageKey = 'actores';
            else if (path.includes('alertas')) pageKey = 'alertas';
            else if (path.includes('configuracion')) pageKey = 'configuracion';

            const pageItems = items || defaultHelpItems[pageKey] || [];
            // Filter to only items that exist in DOM
            const existingItems = pageItems.filter(item => document.querySelector(item.selector));

            setHelpItems(existingItems.length > 0 ? existingItems : [
                {
                    id: 'general', selector: 'body', title: 'Ayuda Contextual',
                    description: 'Navega por las diferentes secciones para ver ayuda específica de cada elemento.', position: 'bottom'
                }
            ]);
            setCurrentIndex(0);
            setTimeout(() => setIsVisible(true), 100);
        } else {
            setIsVisible(false);
        }
    }, [isActive, items]);

    // Position spotlight and tooltip
    const updatePosition = useCallback(() => {
        if (!helpItems[currentIndex]) return;

        const item = helpItems[currentIndex];
        const element = document.querySelector(item.selector);

        if (element) {
            const rect = element.getBoundingClientRect();
            const padding = 8;

            // Spotlight position
            setSpotlightStyle({
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
            });

            // Tooltip position based on preference
            const tooltipWidth = 280;
            const tooltipHeight = 150;
            let top = 0, left = 0;

            switch (item.position) {
                case 'top':
                    top = rect.top - tooltipHeight - 20;
                    left = rect.left + rect.width / 2 - tooltipWidth / 2;
                    break;
                case 'bottom':
                    top = rect.bottom + 20;
                    left = rect.left + rect.width / 2 - tooltipWidth / 2;
                    break;
                case 'left':
                    top = rect.top + rect.height / 2 - tooltipHeight / 2;
                    left = rect.left - tooltipWidth - 20;
                    break;
                case 'right':
                default:
                    top = rect.top + rect.height / 2 - tooltipHeight / 2;
                    left = rect.right + 20;
            }

            // Keep tooltip in viewport
            top = Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 20));
            left = Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20));

            setTooltipStyle({ top, left, width: tooltipWidth });
        }
    }, [helpItems, currentIndex]);

    useEffect(() => {
        if (isActive && helpItems.length > 0) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition);
            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition);
            };
        }
    }, [isActive, helpItems, currentIndex, updatePosition]);

    const handleNext = () => {
        if (currentIndex < helpItems.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isActive) return;
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'Escape') onClose();
    }, [isActive, currentIndex, helpItems.length]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    if (!isActive) return null;

    const currentItem = helpItems[currentIndex];
    if (!currentItem) return null;

    return (
        <div className={`contextual-help-overlay ${isVisible ? 'visible' : ''}`}>
            {/* Dark overlay with spotlight cutout */}
            <div className="help-backdrop" onClick={onClose} />

            {/* Spotlight around current element */}
            <div className="help-spotlight" style={spotlightStyle} />

            {/* Tooltip */}
            <div className="help-tooltip" style={tooltipStyle}>
                <div className="tooltip-header">
                    <div className="tooltip-icon">
                        <Info size={18} />
                    </div>
                    <h4>{currentItem.title}</h4>
                    <button className="tooltip-close" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <p className="tooltip-description">{currentItem.description}</p>

                <div className="tooltip-footer">
                    <span className="tooltip-progress">{currentIndex + 1} / {helpItems.length}</span>

                    <div className="tooltip-nav">
                        <button
                            className="tooltip-btn"
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button className="tooltip-btn primary" onClick={handleNext}>
                            {currentIndex === helpItems.length - 1 ? (
                                <>Terminar <Sparkles size={14} /></>
                            ) : (
                                <>Siguiente <ChevronRight size={16} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Help indicator */}
            <div className="help-indicator">
                <HelpCircle size={16} />
                <span>Modo Ayuda Activo</span>
                <kbd>ESC</kbd> para salir
            </div>
        </div>
    );
};

export default ContextualHelp;
