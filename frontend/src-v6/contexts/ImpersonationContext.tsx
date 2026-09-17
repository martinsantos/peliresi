/**
 * SITREP v6 - Impersonation Context
 * ==================================
 * Extracted from AuthContext to prevent impersonation state changes
 * from triggering re-renders in all auth consumers.
 *
 * Provides: impersonateUser, exitImpersonation, impersonationData
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getAccessToken, getRefreshToken, setTokens, api } from '../services/api';
import { useAuth } from './AuthContext';
import type { User } from './AuthContext';
import {
  currentAppLocation,
  getImpersonationRedirectPath,
  IMPERSONATION_STORAGE_KEY,
  safeImpersonationReturnPath,
} from '../utils/impersonationNavigation';

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
        if (
          typeof parsed?.adminToken !== 'string' ||
          typeof parsed?.adminRefreshToken !== 'string' ||
          !parsed?.adminUser
        ) {
          throw new Error('Invalid impersonation state');
        }
        setImpersonationData({
          adminToken: parsed.adminToken,
          adminRefreshToken: parsed.adminRefreshToken,
          adminUser: parsed.adminUser,
          impersonatedUser: currentUser, // fresh data from current JWT
          adminReturnPath: safeImpersonationReturnPath(parsed.adminReturnPath, window.location.pathname),
        });
      } catch {
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      }
    }
  }, [currentUser]);

  // Impersonar usuario (solo ADMIN) — full page reload clears React Query cache
  const impersonateUser = useCallback(async (userId: string) => {
    if (!currentUser || currentUser.rol !== 'ADMIN') {
      throw new Error('Solo ADMIN puede impersonar usuarios');
    }

    const adminToken = getAccessToken();
    const adminRefreshToken = getRefreshToken();
    if (!adminToken || !adminRefreshToken) {
      throw new Error('La sesión ADMIN no tiene tokens completos');
    }
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
    setTokens(tokens.accessToken, tokens.refreshToken);

    // Full page reload: clears React Query cache + initAuth runs with new JWT.
    // Preserve the surface from which the impersonation was started (web/PWA).
    window.location.href = getImpersonationRedirectPath(window.location.pathname, '/dashboard');
  }, [currentUser]);

  // Salir de impersonacion — full page reload to restore admin state cleanly
  const exitImpersonation = useCallback(() => {
    if (!impersonationData) return;

    // Restore admin tokens
    setTokens(impersonationData.adminToken, impersonationData.adminRefreshToken);

    // Clear impersonation from localStorage
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY);

    // Full page reload to the exact admin location that initiated the switch.
    window.location.href = safeImpersonationReturnPath(
      impersonationData.adminReturnPath,
      window.location.pathname,
    );
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
