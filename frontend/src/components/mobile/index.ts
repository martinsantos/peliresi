/**
 * Mobile Components - Barrel export file
 * Centralizes exports for all mobile-related components
 */

// Components
export { default as RoleSelector } from './RoleSelector';
export { default as TripTracker } from './TripTracker';
export { default as QRScannerView } from './QRScannerView';
export { IncidentModal, ParadaModal } from './TripModals';

// Re-export hooks for convenience
export { useTripTracking } from '../../hooks/useTripTracking';
export { useQRScanner } from '../../hooks/useQRScanner';

// Re-export types
export * from '../../types/mobile.types';

// Re-export demo data
export * from '../../data/demoMobile';
