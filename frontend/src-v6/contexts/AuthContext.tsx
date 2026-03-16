/**
 * SITREP v6 - Auth Context
 * ========================
 * Contexto de autenticacion contra API real
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authService } from '../services/auth.service';
import { clearUserOfflineData } from '../services/offline-sync';
import { clearSyncQueue } from '../services/indexeddb';
import { getAccessToken, clearTokens } from '../services/api';
import type { Usuario } from '../types/models';

// ========================================
// TYPES
// ========================================
export type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'AUDITOR';

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
  canAccess: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isDemo: boolean;
  isLoading: boolean;
  authError: string | null;
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
  };

  return {
    id: u.id,
    nombre: [u.nombre, u.apellido].filter(Boolean).join(' '),
    email: u.email,
    rol: u.rol as UserRole,
    sector: u.empresa || u.generador?.razonSocial || u.transportista?.razonSocial || u.operador?.razonSocial || '',
    avatar: initials,
    telefono: u.telefono || '',
    ubicacion: '',
    permisos: rolPermisos[u.rol] || [],
  };
}

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

  // On mount: check for existing token and validate it
  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const apiUser = await authService.getMe();
          setCurrentUser(apiUserToUser(apiUser));
          setIsLoading(false);
          return;
        } catch {
          // Token invalid, clear it
          clearTokens();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Real login via API
  const login = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const response = await authService.login({ email, password });
      const user = apiUserToUser(response.user);
      setCurrentUser(user);
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
      // Clean up trip-related localStorage to prevent data leaking to next user
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
    canAccess,
    login,
    logout,
    isDemo: false,
    isLoading,
    authError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
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
