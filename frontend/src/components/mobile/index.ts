/**
 * Mobile Components - Barrel export file
 * Centralizes exports for all mobile-related components
 */

// Components
export { default as RoleSelector } from './RoleSelector';
export { default as TripTracker } from './TripTracker';
export { default as QRScannerView } from './QRScannerView';
export { IncidentModal, ParadaModal } from './TripModals';
export { default as ManifiestoCard } from './ManifiestoCard';
export type { ManifiestoCardData, EstadoManifiesto } from './ManifiestoCard';
export { default as ActoresScreen } from './ActoresScreen';
export { default as RecepcionModal } from './RecepcionModal';
export { default as TransportistaModal } from './TransportistaModal';

// Re-export hooks for convenience
export { useTripTracking } from '../../hooks/useTripTracking';
export { useQRScanner } from '../../hooks/useQRScanner';

// Re-export types
export * from '../../types/mobile.types';

// Re-export demo data
export * from '../../data/demoMobile';
