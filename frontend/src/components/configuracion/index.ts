/**
 * Configuracion sub-components
 * Export all components and utilities for the Configuration page
 */

// Components
export { ConfigModal } from './ConfigModal';
export { ToastContainer } from './ToastContainer';

// Types
export type {
    TabType,
    ThemeType,
    Toast,
    DeleteConfirmation,
    ResiduoFormData,
    UsuarioFormData,
    ParametrosConfig,
} from './types';

// Constants
export {
    DEFAULT_RESIDUO_FORM,
    DEFAULT_USUARIO_FORM,
    DEFAULT_PARAMETROS,
    ROL_BADGE_CLASSES,
    PELIGROSIDAD_BADGE_CLASSES,
} from './constants';
