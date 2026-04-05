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

// ========================================
// TYPES
// ========================================
export interface ImpersonationData {
  adminToken: string;
  adminRefreshToken: string;
  adminUser: User;
  impersonatedUser: User;
}

export interface ImpersonationContextType {
  impersonateUser: (userId: string) => Promise<void>;
  exitImpersonation: () => void;
  impersonationData: ImpersonationData | null;
}

// ========================================
// STORAGE KEY
// ========================================
const IMPERSONATION_KEY = 'sitrep_impersonation';

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
    const saved = localStorage.getItem(IMPERSONATION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setImpersonationData({
          adminToken: parsed.adminToken,
          adminRefreshToken: parsed.adminRefreshToken,
          adminUser: parsed.adminUser,
          impersonatedUser: currentUser, // fresh data from current JWT
        });
      } catch {
        localStorage.removeItem(IMPERSONATION_KEY);
      }
    }
  }, [currentUser]);

  // Impersonar usuario (solo ADMIN) — full page reload clears React Query cache
  const impersonateUser = useCallback(async (userId: string) => {
    const adminToken = getAccessToken() || '';
    const adminRefreshToken = getRefreshToken() || '';
    const adminUser = currentUser!;

    const resp = await api.post(`/admin/impersonate/${userId}`);
    const { tokens } = resp.data.data;

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

  // Salir de impersonacion — full page reload to restore admin state cleanly
  const exitImpersonation = useCallback(() => {
    if (!impersonationData) return;

    // Restore admin tokens
    setTokens(impersonationData.adminToken, impersonationData.adminRefreshToken);

    // Clear impersonation from localStorage
    localStorage.removeItem(IMPERSONATION_KEY);

    // Full page reload to admin usuarios panel
    window.location.href = '/admin/usuarios';
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
