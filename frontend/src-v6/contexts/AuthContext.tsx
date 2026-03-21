/**
 * SITREP v6 - Auth Context
 * ========================
 * Contexto de autenticacion contra API real
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import OnboardingWizard from '../components/OnboardingWizard';
import { authService } from '../services/auth.service';
import { clearUserOfflineData } from '../services/offline-sync';
import { clearSyncQueue } from '../services/indexeddb';
import { getAccessToken, getRefreshToken, setTokens, clearTokens, api } from '../services/api';
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
}

export interface ImpersonationData {
  adminToken: string;
  adminRefreshToken: string;
  adminUser: User;
  impersonatedUser: User;
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
  impersonateUser: (userId: string) => Promise<void>;
  exitImpersonation: () => void;
  impersonationData: ImpersonationData | null;
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
export const DEMO_CREDENTIALS: Record<number, { email: string; password: string; nombre: string; rol: UserRole; sector: string }> = {
  1:  { email: 'admin@dgfa.mendoza.gov.ar',          password: 'admin123', nombre: 'Administrador DGFA',          rol: 'ADMIN',         sector: 'DGFA' },
  5:  { email: 'quimica.mendoza@industria.com',       password: 'gen123',   nombre: 'Roberto Gómez',               rol: 'GENERADOR',     sector: 'Química Mendoza S.A.' },
  13: { email: 'transportes.andes@logistica.com',     password: 'trans123', nombre: 'Pedro Martínez',              rol: 'TRANSPORTISTA', sector: 'Transportes Andes S.R.L.' },
  19: { email: 'tratamiento.residuos@planta.com',     password: 'op123',    nombre: 'Miguel Fernández',            rol: 'OPERADOR',      sector: 'Tratamiento de Residuos Mendoza S.A.' },
};

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
  };
}

// ========================================
// IMPERSONATION STORAGE KEY
// ========================================
const IMPERSONATION_KEY = 'sitrep_impersonation';

// ========================================
// CONTEXT
// ========================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ========================================
// PROVIDER
// ========================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);

  // On mount: check for existing token and validate it; restore impersonation state
  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const apiUser = await authService.getMe();
          const mapped = apiUserToUser(apiUser);
          setCurrentUser(mapped);

          // Restore impersonation if active (survives page reload)
          const saved = localStorage.getItem(IMPERSONATION_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setImpersonationData({
                adminToken: parsed.adminToken,
                adminRefreshToken: parsed.adminRefreshToken,
                adminUser: parsed.adminUser,
                impersonatedUser: mapped, // fresh data from current JWT
              });
            } catch {
              localStorage.removeItem(IMPERSONATION_KEY);
            }
          }

          setIsLoading(false);
          return;
        } catch {
          // Token invalid, clear it
          clearTokens();
          localStorage.removeItem(IMPERSONATION_KEY);
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
      // Clean up impersonation and trip-related localStorage
      localStorage.removeItem(IMPERSONATION_KEY);
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
      setCurrentUser(null);
    }
  }, [currentUser]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  // Impersonar usuario (solo ADMIN) — full page reload clears React Query cache
  const impersonateUser = useCallback(async (userId: string) => {
    const adminToken = getAccessToken() || '';
    const adminRefreshToken = getRefreshToken() || '';
    const adminUser = currentUser!;

    const resp = await api.post(`/admin/impersonate/${userId}`);
    const { user: targetUser, tokens } = resp.data.data;

    // Persist admin tokens in localStorage BEFORE reload (survives page unload)
    localStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
      adminToken,
      adminRefreshToken,
      adminUser,
    }));

    // Set the impersonated user's tokens
    setTokens(tokens.accessToken, tokens.refreshToken);

    // Full page reload: clears React Query cache + initAuth runs with new JWT
    window.location.href = '/dashboard';
  }, [currentUser]);

  // Salir de impersonación — full page reload to restore admin state cleanly
  const exitImpersonation = useCallback(() => {
    if (!impersonationData) return;

    // Restore admin tokens
    setTokens(impersonationData.adminToken, impersonationData.adminRefreshToken);

    // Clear impersonation from localStorage
    localStorage.removeItem(IMPERSONATION_KEY);

    // Full page reload to admin usuarios panel
    window.location.href = '/admin/usuarios';
  }, [impersonationData]);

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

  // Build users list from DEMO_CREDENTIALS for UserSwitcher
  const users: User[] = Object.entries(DEMO_CREDENTIALS).map(([id, c]) => ({
    id: Number(id),
    nombre: c.nombre,
    email: c.email,
    rol: c.rol,
    sector: c.sector,
    avatar: c.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    telefono: '',
    ubicacion: '',
    permisos: [],
  }));

  const value: AuthContextType = {
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
    impersonateUser,
    exitImpersonation,
    impersonationData,
    isDemo: false,
    isLoading,
    authError,
    showOnboarding,
    dismissOnboarding,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showOnboarding && currentUser && (
        <OnboardingWizard
          rol={currentUser.rol}
          userId={currentUser.id}
          onDismiss={dismissOnboarding}
        />
      )}
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
