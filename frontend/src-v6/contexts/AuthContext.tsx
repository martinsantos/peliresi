/**
 * SITREP v6 - Auth Context
 * ========================
 * Contexto de autenticación con User Switcher para demo
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// ========================================
// TYPES
// ========================================
export type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'AUDITOR';

export interface User {
  id: number;
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
  currentUser: User;
  users: User[];
  switchUser: (userId: number) => void;
  getUsersByRole: (role: UserRole) => User[];
  isAdmin: boolean;
  isGenerador: boolean;
  isTransportista: boolean;
  isOperador: boolean;
  canAccess: (permission: string) => boolean;
}

// ========================================
// MOCK USERS - Todos los perfiles disponibles
// ========================================
export const MOCK_USERS: User[] = [
  // Administradores
  {
    id: 1,
    nombre: 'Juan Pérez',
    email: 'juan.perez@dgfa.gob.ar',
    rol: 'ADMIN',
    sector: 'DGFA',
    avatar: 'JP',
    telefono: '+54 261 412-3456',
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
  
  // Generadores - Hospital
  {
    id: 5,
    nombre: 'María González',
    email: 'm.gonzalez@hospitalcentral.gob.ar',
    rol: 'GENERADOR',
    sector: 'Hospital Central',
    avatar: 'MG',
    telefono: '+54 261 423-4567',
    ubicacion: 'Ciudad, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.create', 'manifiestos.edit', 'reportes.read'],
  },
  {
    id: 6,
    nombre: 'Pedro Sánchez',
    email: 'p.sanchez@hospitalpediatrico.gob.ar',
    rol: 'GENERADOR',
    sector: 'Hospital Pediátrico',
    avatar: 'PS',
    telefono: '+54 261 456-7890',
    ubicacion: 'Ciudad, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.create', 'manifiestos.edit', 'reportes.read'],
  },
  
  // Transportistas
  {
    id: 13,
    nombre: 'Carlos Rodríguez',
    email: 'c.rodriguez@transportesandes.com',
    rol: 'TRANSPORTISTA',
    sector: 'Transportes Andes S.A.',
    avatar: 'CR',
    telefono: '+54 261 434-5678',
    ubicacion: 'Guaymallén, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.transport', 'tracking.update', 'vehiculos.read'],
  },
  {
    id: 14,
    nombre: 'Elena Vargas',
    email: 'e.vargas@ecotransportear.com',
    rol: 'TRANSPORTISTA',
    sector: 'EcoTransporte AR',
    avatar: 'EV',
    telefono: '+54 261 578-9012',
    ubicacion: 'Ciudad, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.transport', 'tracking.update', 'vehiculos.read'],
  },
  
  // Operadores
  {
    id: 19,
    nombre: 'Ana Martínez',
    email: 'ana.martinez@plantalasheras.com',
    rol: 'OPERADOR',
    sector: 'Planta Las Heras',
    avatar: 'AM',
    telefono: '+54 261 445-6789',
    ubicacion: 'Las Heras, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.receive', 'manifiestos.treat', 'reportes.read', 'reportes.create'],
  },
  {
    id: 20,
    nombre: 'Bruno Acosta',
    email: 'b.acosta@incineradoraeco.com',
    rol: 'OPERADOR',
    sector: 'Incineradora Eco',
    avatar: 'BA',
    telefono: '+54 261 623-4567',
    ubicacion: 'Godoy Cruz, Mendoza',
    permisos: ['manifiestos.read', 'manifiestos.receive', 'manifiestos.treat', 'reportes.read', 'reportes.create'],
  },
  
  // Auditores
  {
    id: 25,
    nombre: 'Patricia Méndez',
    email: 'p.mendez@auditoriaambiental.com',
    rol: 'AUDITOR',
    sector: 'Auditoría Ambiental',
    avatar: 'PM',
    telefono: '+54 261 678-9012',
    ubicacion: 'Ciudad, Mendoza',
    permisos: ['manifiestos.read', 'reportes.read', 'auditoria.read'],
  },
];

// ========================================
// CONTEXT
// ========================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ========================================
// PROVIDER
// ========================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cargar usuario desde localStorage o usar el primero por defecto
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('sitrep_demo_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Verificar que el usuario guardado existe en MOCK_USERS
        const exists = MOCK_USERS.find(u => u.id === parsed.id);
        if (exists) return parsed;
      } catch {
        // Si hay error, usar el default
      }
    }
    return MOCK_USERS[0]; // Admin por defecto
  });

  const switchUser = useCallback((userId: number) => {
    const user = MOCK_USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('sitrep_demo_user', JSON.stringify(user));
    }
  }, []);

  const getUsersByRole = useCallback((role: UserRole) => {
    return MOCK_USERS.filter(u => u.rol === role);
  }, []);

  const canAccess = useCallback((permission: string) => {
    if (currentUser.permisos.includes('*')) return true;
    return currentUser.permisos.includes(permission);
  }, [currentUser]);

  const value: AuthContextType = {
    currentUser,
    users: MOCK_USERS,
    switchUser,
    getUsersByRole,
    isAdmin: currentUser.rol === 'ADMIN',
    isGenerador: currentUser.rol === 'GENERADOR',
    isTransportista: currentUser.rol === 'TRANSPORTISTA',
    isOperador: currentUser.rol === 'OPERADOR',
    canAccess,
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
