/**
 * SITREP v6 - Auth Context
 * ========================
 * Contexto de autenticacion contra API real
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import OnboardingWizard from '../components/OnboardingWizard';
import { authService } from '../services/auth.service';
import { useQueryClient } from '@tanstack/react-query';
import { clearUserOfflineData } from '../services/offline-sync';
import { clearSyncQueue } from '../services/indexeddb';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { getAccessToken, clearTokens } from '../services/api';
import { ImpersonationProvider } from './ImpersonationContext';
import type { Usuario } from '../types/models';

// ========================================
// TYPES
// ========================================
export type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'AUDITOR' | 'ADMIN_TRANSPORTISTA' | 'ADMIN_GENERADOR' | 'ADMIN_OPERADOR';

export interface User {
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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

// ========================================
// HELPERS
// ========================================

/** Convert a real API Usuario to the local User shape used throughout the app */
function apiUserToUser(u: Usuario): User {
  const initials = u.nombre
    ? u.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : u.email.slice(0, 2).toUpperCase();

  const rolPermisos: Record<string, string[]> = {
    ADMIN: ['*'],
    GENERADOR: ['manifiestos.read', 'manifiestos.create', 'manifiestos.edit', 'reportes.read'],
    TRANSPORTISTA: ['manifiestos.read', 'manifiestos.transport', 'tracking.update', 'vehiculos.read'],
    OPERADOR: ['manifiestos.read', 'manifiestos.receive', 'manifiestos.treat', 'reportes.read', 'reportes.create'],
    ADMIN_TRANSPORTISTA: ['actores.transportistas', 'actores.vehiculos', 'manifiestos.read', 'reportes.read'],
    ADMIN_GENERADOR: ['actores.generadores', 'catalogo.residuos', 'manifiestos.read', 'reportes.read'],
    ADMIN_OPERADOR: ['actores.operadores', 'catalogo.tratamientos', 'manifiestos.read', 'reportes.read'],
  };

  return {
    id: u.id,
    nombre: [u.nombre, u.apellido].filter(Boolean).join(' '),
    email: u.email,
    rol: u.rol as UserRole,
    sector: u.empresa || u.generador?.razonSocial || u.transportista?.razonSocial || u.operador?.razonSocial || '',
    actorId: u.generador?.id || u.transportista?.id || u.operador?.id,
    avatar: initials,
    telefono: u.telefono || '',
    ubicacion: '',
    permisos: rolPermisos[u.rol] || [],
    esInspector: u.esInspector ?? false,
  };
}

// ========================================
// CONTEXT
// ========================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ========================================
// SESSION TIMEOUT GUARD
// ========================================
function SessionTimeoutGuard({ logout, isAuthenticated }: { logout: () => void; isAuthenticated: boolean }) {
  const { showWarning, secondsLeft, dismissWarning } = useSessionTimeout(logout, isAuthenticated);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 shadow-2xl max-w-sm mx-4 text-center">
        <div className="text-4xl mb-3">&#9200;</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sesion a punto de expirar</h3>
        <p className="text-gray-600 mb-4">
          Por inactividad, su sesion se cerrara en <span className="font-bold text-red-600">{secondsLeft}s</span>.
        </p>
        <button
          onClick={dismissWarning}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          Continuar trabajando
        </button>
      </div>
    </div>
  );
}

// ========================================
// PROVIDER
// ========================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const qc = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);

  // On mount: check for existing token and validate it
  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const apiUser = await authService.getMe();
          const mapped = apiUserToUser(apiUser);
          setCurrentUser(mapped);
          setIsLoading(false);
          return;
        } catch {
          // Token invalid, clear it
          clearTokens();
          localStorage.removeItem('sitrep_impersonation');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Real login via API — accepts email or CUIT
  const login = useCallback(async (identifier: string, password: string) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const trimmed = identifier.trim();
      const isCuit = /^\d{2}-\d{8}-\d$/.test(trimmed) || /^\d{11}$/.test(trimmed);
      const credentials = isCuit
        ? { cuit: identifier.trim(), password }
        : { email: identifier.trim(), password };
      const response = await authService.login(credentials);
      if (response.restricted) {
        setIsRestricted(true);
        setSolicitudId(response.solicitudId || null);
      }
      const user = apiUserToUser(response.user);
      setCurrentUser(user);
      const isFirstSession = !localStorage.getItem(`sitrep_onboarding_${user.id}`);
      const isPostReset = localStorage.getItem('sitrep_post_reset') === '1';
      if (isFirstSession || isPostReset) setShowOnboarding(true);
    } catch (err: any) {
      clearTokens();
      const message = err.response?.data?.message || 'Credenciales incorrectas o API no disponible.';
      setAuthError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // ignore logout errors
    } finally {
      clearTokens();
      setIsRestricted(false);
      setSolicitudId(null);
      // Clean up impersonation and trip-related localStorage
      localStorage.removeItem('sitrep_impersonation');
      localStorage.removeItem('sitrep_active_trip_id');
      const keysToClean: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('viaje_snapshot_') || key.startsWith('viaje_status_') || key.startsWith('gps_pending_'))) {
          keysToClean.push(key);
        }
      }
      keysToClean.forEach(k => localStorage.removeItem(k));
      // Clear IndexedDB offline data and sync queue for this user
      if (currentUser) {
        clearUserOfflineData(currentUser.id).catch(() => {});
      }
      clearSyncQueue().catch(() => {});
      qc.clear();
      setCurrentUser(null);
    }
  }, [currentUser, qc]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  // Switch user — real API login with known credentials
  const switchUser = useCallback(async (userId: number) => {
    setIsLoading(true);
    setAuthError(null);
    clearTokens();

    const credentials = DEMO_CREDENTIALS[userId];
    if (credentials) {
      await login(credentials.email, credentials.password);
    }
    setIsLoading(false);
  }, [login]);

  const getUsersByRole = useCallback((role: UserRole) => {
    return Object.values(DEMO_CREDENTIALS)
      .filter(c => c.rol === role)
      .map((c, i) => ({
        id: Object.keys(DEMO_CREDENTIALS).map(Number).find(k => DEMO_CREDENTIALS[k] === c) ?? i,
        nombre: c.nombre,
        email: c.email,
        rol: c.rol,
        sector: c.sector,
        avatar: c.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        telefono: '',
        ubicacion: '',
        permisos: [] as string[],
      }));
  }, []);

  const canAccess = useCallback((permission: string) => {
    if (!currentUser) return false;
    if (currentUser.permisos.includes('*')) return true;
    return currentUser.permisos.includes(permission);
  }, [currentUser]);

  // Build users list from DEMO_CREDENTIALS for UserSwitcher (stable reference)
  const users = useMemo<User[]>(() => Object.entries(DEMO_CREDENTIALS).map(([id, c]) => ({
    id: Number(id),
    nombre: c.nombre,
    email: c.email,
    rol: c.rol,
    sector: c.sector,
    avatar: c.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    telefono: '',
    ubicacion: '',
    permisos: [],
  })), []);

  const value = useMemo<AuthContextType>(() => ({
    currentUser,
    users,
    switchUser,
    getUsersByRole,
    isAdmin: currentUser?.rol === 'ADMIN',
    isGenerador: currentUser?.rol === 'GENERADOR',
    isTransportista: currentUser?.rol === 'TRANSPORTISTA',
    isOperador: currentUser?.rol === 'OPERADOR',
    isAdminTransportista: currentUser?.rol === 'ADMIN_TRANSPORTISTA',
    isAdminGenerador: currentUser?.rol === 'ADMIN_GENERADOR',
    isAdminOperador: currentUser?.rol === 'ADMIN_OPERADOR',
    isAnyAdmin: ['ADMIN', 'ADMIN_TRANSPORTISTA', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'].includes(currentUser?.rol ?? ''),
    canAccess,
    login,
    logout,
    isRestricted,
    solicitudId,
    isDemo: false,
    isLoading,
    authError,
    showOnboarding,
    dismissOnboarding,
  }), [currentUser, users, switchUser, getUsersByRole, canAccess, login, logout, isRestricted, solicitudId, isLoading, authError, showOnboarding, dismissOnboarding]);

  return (
    <AuthContext.Provider value={value}>
      <ImpersonationProvider>
        {children}
      </ImpersonationProvider>
      {showOnboarding && currentUser && (
        <OnboardingWizard
          rol={currentUser.rol}
          userId={currentUser.id}
          onDismiss={dismissOnboarding}
        />
      )}
      <SessionTimeoutGuard logout={logout} isAuthenticated={!!currentUser} />
    </AuthContext.Provider>
  );
};

// ========================================
// HOOK
// ========================================
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
