/**
 * SITREP v6 - Auth Context
 * ========================
 * Contexto de autenticacion con soporte real API + fallback demo
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authService } from '../services/auth.service';
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
export const DEMO_CREDENTIALS: Record<number, { email: string; password: string }> = {
  1:  { email: 'admin@dgfa.mendoza.gov.ar', password: 'admin123' },
  5:  { email: 'quimica.mendoza@industria.com', password: 'gen123' },
  13: { email: 'transportes.andes@logistica.com', password: 'trans123' },
  19: { email: 'tratamiento.residuos@planta.com', password: 'op123' },
};

// ========================================
// MOCK USERS - Fallback when API is unavailable
// ========================================
export const MOCK_USERS: User[] = [
  // Administradores
  {
    id: 1,
    nombre: 'Administrador DGFA',
    email: 'admin@dgfa.mendoza.gov.ar',
    rol: 'ADMIN',
    sector: 'DGFA',
    avatar: 'AD',
    telefono: '',
    ubicacion: 'Ciudad, Mendoza',
    permisos: ['*'],
  },
  {
    id: 2,
    nombre: 'Laura Torres',
    email: 'laura.torres@dgfa.gob.ar',
    rol: 'ADMIN',
    sector: 'DGFA',
    avatar: 'LT',
    telefono: '+54 261 467-8901',
    ubicacion: 'Godoy Cruz, Mendoza',
    permisos: ['*'],
  },

  // Generadores
  {
    id: 5,
    nombre: 'Roberto Gómez',
    email: 'quimica.mendoza@industria.com',
    rol: 'GENERADOR',
    sector: 'Química Mendoza S.A.',
    avatar: 'RG',
    telefono: '2614251234',
    ubicacion: 'Av. San Martín 1200, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.create', 'manifiestos.edit', 'reportes.read'],
  },
  {
    id: 6,
    nombre: 'María López',
    email: 'petroquimica.andes@industria.com',
    rol: 'GENERADOR',
    sector: 'Petroquímica Andes S.A.',
    avatar: 'ML',
    telefono: '2614859876',
    ubicacion: 'Ruta Nacional 7, Guaymallén',
    permisos: ['manifiestos.read', 'manifiestos.create', 'manifiestos.edit', 'reportes.read'],
  },

  // Transportistas
  {
    id: 13,
    nombre: 'Pedro Martínez',
    email: 'transportes.andes@logistica.com',
    rol: 'TRANSPORTISTA',
    sector: 'Transportes Andes S.R.L.',
    avatar: 'PM',
    telefono: '2614123456',
    ubicacion: 'Acceso Este 1500, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.transport', 'tracking.update', 'vehiculos.read'],
  },
  {
    id: 14,
    nombre: 'Ana González',
    email: 'logistica.cuyo@transporte.com',
    rol: 'TRANSPORTISTA',
    sector: 'Logística Cuyo S.A.',
    avatar: 'AG',
    telefono: '2614789123',
    ubicacion: 'Ruta Provincial 60, Maipú',
    permisos: ['manifiestos.read', 'manifiestos.transport', 'tracking.update', 'vehiculos.read'],
  },

  // Operadores
  {
    id: 19,
    nombre: 'Miguel Fernández',
    email: 'tratamiento.residuos@planta.com',
    rol: 'OPERADOR',
    sector: 'Tratamiento de Residuos Mendoza S.A.',
    avatar: 'MF',
    telefono: '2614321987',
    ubicacion: 'Parque Industrial Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.receive', 'manifiestos.treat', 'reportes.read', 'reportes.create'],
  },
  {
    id: 20,
    nombre: 'Laura Díaz',
    email: 'eco.ambiental@reciclado.com',
    rol: 'OPERADOR',
    sector: 'Eco Ambiental S.R.L.',
    avatar: 'LD',
    telefono: '2614765432',
    ubicacion: 'Luján de Cuyo, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.receive', 'manifiestos.treat', 'reportes.read', 'reportes.create'],
  },

  // Auditores
  {
    id: 25,
    nombre: 'Patricia Mendez',
    email: 'p.mendez@auditoriaambiental.com',
    rol: 'AUDITOR',
    sector: 'Auditoria Ambiental',
    avatar: 'PM',
    telefono: '+54 261 678-9012',
    ubicacion: 'Ciudad, Mendoza',
    permisos: ['manifiestos.read', 'reportes.read', 'auditoria.read'],
  },
];

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
  const [isDemo, setIsDemo] = useState(false);
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
          setIsDemo(false);
          setIsLoading(false);
          return;
        } catch {
          // Token invalid, clear it
          clearTokens();
        }
      }

      // No valid token - check for demo user in localStorage
      const savedDemo = localStorage.getItem('sitrep_demo_user');
      if (savedDemo) {
        try {
          const parsed = JSON.parse(savedDemo);
          const exists = MOCK_USERS.find(u => u.id === parsed.id);
          if (exists) {
            setCurrentUser(parsed);
            setIsDemo(true);
          }
        } catch {
          // ignore
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
      // Token is already stored by authService.login -> setTokens
      const user = apiUserToUser(response.user);
      setCurrentUser(user);
      setIsDemo(false);
      localStorage.removeItem('sitrep_demo_user');
    } catch (err: any) {
      // If API fails (network error OR 401/etc), fallback to demo mode
      // if the email matches a known demo user
      // CRITICAL: Clear any stale tokens to prevent wrong-user API access
      clearTokens();
      const demoUser = MOCK_USERS.find(u => u.email === email);
      if (demoUser) {
        setCurrentUser(demoUser);
        setIsDemo(true);
        localStorage.setItem('sitrep_demo_user', JSON.stringify(demoUser));
      } else {
        const message = err.response?.data?.message || 'Credenciales incorrectas o API no disponible.';
        setAuthError(message);
        throw err;
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      if (!isDemo) {
        await authService.logout();
      }
    } catch {
      // ignore logout errors
    } finally {
      clearTokens();
      localStorage.removeItem('sitrep_demo_user');
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
      setCurrentUser(null);
      setIsDemo(false);
    }
  }, [isDemo]);

  // Switch user (demo mode or real login for quick-switch)
  const switchUser = useCallback(async (userId: number) => {
    // CRITICAL: Clear old tokens BEFORE switching to prevent stale JWT from
    // previous user (e.g. ADMIN) leaking into API calls of the new user
    setIsLoading(true);
    setAuthError(null);
    clearTokens();

    const credentials = DEMO_CREDENTIALS[userId];
    if (credentials) {
      // Try real login first, fallback to demo
      try {
        const response = await authService.login(credentials);
        const user = apiUserToUser(response.user);
        setCurrentUser(user);
        setIsDemo(false);
        localStorage.removeItem('sitrep_demo_user');
      } catch {
        // Fallback to demo — tokens already cleared above
        const user = MOCK_USERS.find(u => u.id === userId);
        if (user) {
          setCurrentUser(user);
          setIsDemo(true);
          localStorage.setItem('sitrep_demo_user', JSON.stringify(user));
        }
      }
    } else {
      // No credentials for this user, use demo
      const user = MOCK_USERS.find(u => u.id === userId);
      if (user) {
        setCurrentUser(user);
        setIsDemo(true);
        localStorage.setItem('sitrep_demo_user', JSON.stringify(user));
      }
    }
    setIsLoading(false);
  }, []);

  const getUsersByRole = useCallback((role: UserRole) => {
    return MOCK_USERS.filter(u => u.rol === role);
  }, []);

  const canAccess = useCallback((permission: string) => {
    if (!currentUser) return false;
    if (currentUser.permisos.includes('*')) return true;
    return currentUser.permisos.includes(permission);
  }, [currentUser]);

  const value: AuthContextType = {
    currentUser,
    users: MOCK_USERS,
    switchUser,
    getUsersByRole,
    isAdmin: currentUser?.rol === 'ADMIN',
    isGenerador: currentUser?.rol === 'GENERADOR',
    isTransportista: currentUser?.rol === 'TRANSPORTISTA',
    isOperador: currentUser?.rol === 'OPERADOR',
    canAccess,
    login,
    logout,
    isDemo,
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
