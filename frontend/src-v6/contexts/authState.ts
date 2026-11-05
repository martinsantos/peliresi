import { createContext, useContext } from 'react';
export type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'AUDITOR' | 'ADMIN_TRANSPORTISTA' | 'ADMIN_GENERADOR' | 'ADMIN_OPERADOR';

export interface User {
  preferenciaEnlaces?: import('../utils/linkPreference').LinkPreference;
  empresaContexto?:import('../services/companyContext').CompanyContext;
  contextosEmpresa?:import('../services/companyContext').CompanyChoice[];
  empresaContextoError?:string;
  actividadContextoError?:string;
  actividades?: UserRole[];
  training?: boolean;
  id: number | string;
  nombre: string;
  email: string;
  rol: UserRole;
  sector: string;
  avatar: string;
  telefono: string;
  ubicacion: string;
  permisos: string[];
  actorId?: string;
  esInspector?: boolean;
  esJefeInspecciones?: boolean;
}

export interface AuthContextType {
  currentUser: User | null;
  users: User[];
  switchUser: (userId: number) => Promise<void>;
  getUsersByRole: (role: UserRole) => User[];
  isAdmin: boolean;
  isGenerador: boolean;
  isTransportista: boolean;
  isOperador: boolean;
  isAdminTransportista: boolean;
  isAdminGenerador: boolean;
  isAdminOperador: boolean;
  isAnyAdmin: boolean;
  canAccess: (permission: string) => boolean;
  login: (email: string, password: string, options?: { deferWelcome?: boolean }) => Promise<User>;
  logout: (options?: { reason: 'expired' }) => Promise<void>;
  signOutRedirectPending: boolean;
  finishSignOutRedirect: () => void;
  isRestricted: boolean;
  solicitudId: string | null;
  isDemo: boolean;
  isLoading: boolean;
  authError: string | null;
  showOnboarding: boolean;
  dismissOnboarding: () => void;
}

// ========================================
// DEMO CREDENTIALS - for quick-switch buttons
// Must match actual seeded users in backend/prisma/seed.ts
// ========================================
export const DEMO_CREDENTIALS: Record<number, { email: string; password: string; nombre: string; rol: UserRole; sector: string }> =
  import.meta.env.VITE_DEMO_MODE === 'true'
    ? {
        1:  { email: 'admin@dgfa.mendoza.gov.ar',          password: 'admin123', nombre: 'Administrador DGFA',          rol: 'ADMIN',         sector: 'DGFA' },
        5:  { email: 'quimica.mendoza@industria.com',       password: 'gen123',   nombre: 'Roberto Gómez',               rol: 'GENERADOR',     sector: 'Química Mendoza S.A.' },
        13: { email: 'transportes.andes@logistica.com',     password: 'trans123', nombre: 'Pedro Martínez',              rol: 'TRANSPORTISTA', sector: 'Transportes Andes S.R.L.' },
        19: { email: 'tratamiento.residuos@planta.com',     password: 'op123',    nombre: 'Miguel Fernández',            rol: 'OPERADOR',      sector: 'Tratamiento de Residuos Mendoza S.A.' },
      }
    : {};


export const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
