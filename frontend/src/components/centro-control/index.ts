/**
 * CentroControl sub-components
 * Export all components and utilities for the Control Center
 */

// Components
export { LiveClock } from './LiveClock';
export { ViajeTimer } from './ViajeTimer';
export { KPICards } from './KPICards';
export { MendozaMapSVG } from './MendozaMapSVG';

// Types
export type {
    ViajeActivo,
    ManifiestoEnTransito,
    SystemStats,
    DepartamentoStats,
    FiltroTiempo,
} from './types';

// Icons
export {
    truckIcon,
    truckPausedIcon,
    truckIncidentIcon,
    generadorIcon,
    operadorIcon,
} from './icons';

// Constants
export {
    DEPT_COLORS,
    DEPT_CODES,
    MENDOZA_CENTER,
    DEFAULT_ZOOM,
} from './constants';

// Utilities
export {
    generateActivityChartData,
    generatePipelineChartData,
    formatRelativeTime,
    formatElapsedTime,
} from './utils';
