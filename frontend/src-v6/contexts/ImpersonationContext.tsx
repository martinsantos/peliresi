/**
 * SITREP v6 - Impersonation Context
 * ==================================
 * Extracted from AuthContext to prevent impersonation state changes
 * from triggering re-renders in all auth consumers.
 *
 * Provides: impersonateUser, exitImpersonation, impersonationData
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getAccessToken, getRefreshToken, setTokensDurably, api } from '../services/api';
import { toast } from '../components/ui/Toast';
import { useAuth } from './AuthContext';
import type { User } from './AuthContext';
import { currentAppLocation, impersonationDestination, IMPERSONATION_STORAGE_KEY, safeAdminReturnPath } from '../utils/impersonationNavigation';

// ========================================
// TYPES
// ========================================
export interface ImpersonationData {
  adminToken: string;
  adminRefreshToken: string;
  adminUser: User;
  impersonatedUser: User;
  adminReturnPath: string;
}

export interface ImpersonationContextType {
  impersonateUser: (userId: string) => Promise<void>;
  exitImpersonation: () => void;
  impersonationData: ImpersonationData | null;
}

// ========================================
// STORAGE KEY
// ========================================
// ========================================
// CONTEXT
// ========================================
const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

// ========================================
// PROVIDER
// ========================================
export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);

  // On mount: restore impersonation state from localStorage (survives page reload)
  useEffect(() => {
    if (!currentUser) {
      setImpersonationData(null);
      return;
    }
    const saved = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.adminToken !== 'string' || typeof parsed?.adminRefreshToken !== 'string' || !parsed?.adminUser) {
          throw new Error('Invalid impersonation session');
        }
        setImpersonationData({
          adminToken: parsed.adminToken,
          adminRefreshToken: parsed.adminRefreshToken,
          adminUser: parsed.adminUser,
          impersonatedUser: currentUser, // fresh data from current JWT
          adminReturnPath: safeAdminReturnPath(parsed.adminReturnPath, window.location.pathname),
        });
      } catch {
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      }
    }
  }, [currentUser]);

  // Impersonar usuario (solo ADMIN) — full page reload clears React Query cache
  const impersonateUser = useCallback(async (userId: string) => {
    if (!currentUser || currentUser.rol !== 'ADMIN') throw new Error('Solo una cuenta administradora puede cambiar de usuario.');
    const adminToken = getAccessToken();
    const adminRefreshToken = getRefreshToken();
    if (!adminToken || !adminRefreshToken) throw new Error('La sesión administradora debe renovarse antes de cambiar de usuario.');
    const adminUser = currentUser;
    const adminReturnPath = currentAppLocation(window.location);

    const resp = await api.post(`/admin/impersonate/${userId}`);
    const { tokens } = resp.data.data;

    // Persist admin tokens in localStorage BEFORE reload (survives page unload)
    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify({
      adminToken,
      adminRefreshToken,
      adminUser,
      adminReturnPath,
    }));

    // Set the impersonated user's tokens
    await setTokensDurably(tokens.accessToken, tokens.refreshToken);

    // Full page reload: clears React Query cache + initAuth runs with new JWT
    window.location.href = impersonationDestination(window.location.pathname, '/dashboard');
  }, [currentUser]);

  // Salir de impersonacion — full page reload to restore admin state cleanly
  const exitImpersonation = useCallback(() => {
    if (!impersonationData) return;

    // Restore admin tokens
    void setTokensDurably(impersonationData.adminToken, impersonationData.adminRefreshToken).then(() => {
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      window.location.href = safeAdminReturnPath(impersonationData.adminReturnPath, window.location.pathname);
    }).catch(() => {
      toast.warning('No se confirmó el cambio de cuenta', 'Reintentá antes de continuar.');
    });
  }, [impersonationData]);

  const value: ImpersonationContextType = {
    impersonateUser,
    exitImpersonation,
    impersonationData,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
};

// ========================================
// HOOK
// ========================================
export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
};

export default ImpersonationContext;
