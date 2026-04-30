/**
 * SITREP v6 - AuthContext Unit Tests
 * Smoke-level: exports exist, provider renders, hook returns context.
 *
 * IMPORTANT: vi.mock() calls are hoisted by vitest above static imports.
 * So dependency mocks are in place before AuthProvider is loaded.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mocks (hoisted above static imports) ──

vi.mock('@src/services/auth.service', () => ({
  authService: {
    getMe: vi.fn().mockRejectedValue(new Error('No token')),
    login: vi.fn().mockResolvedValue({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      user: {
        id: 1, nombre: 'Admin', apellido: 'User',
        email: 'admin@test.com', rol: 'ADMIN', empresa: 'Test Corp',
        telefono: '', esInspector: false,
      },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@src/services/api', () => ({
  getAccessToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  default: { interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
}));

vi.mock('@src/services/offline-sync', () => ({
  clearUserOfflineData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@src/services/indexeddb', () => ({
  clearSyncQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@src/hooks/useSessionTimeout', () => ({
  useSessionTimeout: vi.fn(() => ({
    showWarning: false, secondsLeft: 60, dismissWarning: vi.fn(),
  })),
}));

vi.mock('@src/components/OnboardingWizard', () => ({
  default: vi.fn(() => null),
}));

vi.mock('@src/contexts/ImpersonationContext', () => ({
  ImpersonationProvider: vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  ),
  useImpersonation: vi.fn(() => ({
    impersonateUser: vi.fn(), exitImpersonation: vi.fn(), impersonationData: null,
  })),
}));

// ── Static imports (after mocks — vi.mock hoists above these) ──

import { AuthProvider, useAuth } from '@src/contexts/AuthContext';

// ── Helpers ──

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(AuthProvider, null, children)
    );
  };
}

// ── Tests ──

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('exports', () => {
    it('should export AuthProvider as a function', () => {
      expect(typeof AuthProvider).toBe('function');
    });

    it('should export useAuth as a function', () => {
      expect(typeof useAuth).toBe('function');
    });
  });

  describe('useAuth hook', () => {
    it('should throw when used outside AuthProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('should provide context when used within AuthProvider', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.currentUser).toBeNull();
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isGenerador).toBe(false);
      expect(result.current.isTransportista).toBe(false);
      expect(result.current.isOperador).toBe(false);
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.canAccess).toBe('function');
    });
  });

  describe('AuthProvider rendering', () => {
    it('should render children', () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(AuthProvider, null,
            React.createElement('div', { 'data-testid': 'child' }, 'Hello')
          )
        )
      );

      expect(screen.getByTestId('child')).toBeDefined();
      expect(screen.getByText('Hello')).toBeDefined();
    });
  });
});
