/**
 * Tests for src-v6/contexts/AuthContext.tsx
 * AuthProvider + useAuth hook
 *
 * Strategy: Mock all external dependencies (authService, api, offline-sync, etc.)
 * and test the context's state transitions via a consumer component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ========================================
// Mocks — must be before component imports
// ========================================

vi.mock('../../services/auth.service', () => ({
  authService: {
    login: vi.fn().mockResolvedValue({
      accessToken: 'mock-access',
      refreshToken: 'mock-refresh',
      user: {
        id: '42',
        email: 'admin@test.com',
        nombre: 'Admin',
        apellido: 'User',
        rol: 'ADMIN',
        activo: true,
        empresa: 'DGFA',
        telefono: '261-555-0001',
        esInspector: false,
      },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    getMe: vi.fn().mockRejectedValue(new Error('No token')),
  },
}));

vi.mock('../../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { baseURL: '/api', headers: { 'Content-Type': 'application/json' }, timeout: 30000 },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { baseURL: '/api', headers: { 'Content-Type': 'application/json' }, timeout: 30000 },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  getAccessToken: vi.fn().mockReturnValue(null),
  getRefreshToken: vi.fn().mockReturnValue(null),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}));

vi.mock('../../services/offline-sync', () => ({
  clearUserOfflineData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/indexeddb', () => ({
  clearSyncQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../hooks/useSessionTimeout', () => ({
  useSessionTimeout: () => ({
    showWarning: false,
    secondsLeft: 0,
    dismissWarning: vi.fn(),
  }),
}));

vi.mock('../../components/OnboardingWizard', () => ({
  default: () => null,
}));

// Import AFTER mocks are declared
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { clearUserOfflineData } from '../../services/offline-sync';
import { clearSyncQueue } from '../../services/indexeddb';
import { authService } from '../../services/auth.service';
import { clearTokens, getAccessToken } from '../../services/api';

// ========================================
// Test helpers
// ========================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

/** Consumer component that exposes AuthContext values to the DOM for assertions */
function AuthConsumer() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="user">{auth.currentUser ? auth.currentUser.nombre : 'null'}</span>
      <span data-testid="rol">{auth.currentUser?.rol ?? 'none'}</span>
      <span data-testid="actorId">{auth.currentUser?.actorId ?? 'none'}</span>
      <span data-testid="isAdmin">{String(auth.isAdmin)}</span>
      <span data-testid="isGenerador">{String(auth.isGenerador)}</span>
      <span data-testid="isTransportista">{String(auth.isTransportista)}</span>
      <span data-testid="isOperador">{String(auth.isOperador)}</span>
      <span data-testid="isAnyAdmin">{String(auth.isAnyAdmin)}</span>
      <span data-testid="isLoading">{String(auth.isLoading)}</span>
      <span data-testid="authError">{auth.authError ?? 'none'}</span>
      <button data-testid="login-btn" onClick={() => auth.login('admin@test.com', 'pass123')}>Login</button>
      <button data-testid="logout-btn" onClick={() => auth.logout()}>Logout</button>
    </div>
  );
}

function renderWithProviders() {
  const qc = createTestQueryClient();

  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// ========================================
// Tests
// ========================================

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts with no user and isLoading transitions to false', async () => {
    renderWithProviders();

    // After mount + initAuth (no token -> finishes fast)
    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('all role booleans are false when no user is logged in', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    expect(screen.getByTestId('isGenerador').textContent).toBe('false');
    expect(screen.getByTestId('isTransportista').textContent).toBe('false');
    expect(screen.getByTestId('isOperador').textContent).toBe('false');
    expect(screen.getByTestId('isAnyAdmin').textContent).toBe('false');
  });

  it('login sets the current user and role booleans', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    await user.click(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Admin User');
    });
    expect(screen.getByTestId('rol').textContent).toBe('ADMIN');
    expect(screen.getByTestId('isAdmin').textContent).toBe('true');
    expect(screen.getByTestId('isAnyAdmin').textContent).toBe('true');
    expect(screen.getByTestId('isGenerador').textContent).toBe('false');
  });

  it('rehydrates a multi-role user with the actor matching the effective role', async () => {
    vi.mocked(getAccessToken).mockReturnValueOnce('persisted-access-token');
    vi.mocked(authService.getMe).mockResolvedValueOnce({
      id: 'multi-1', email: 'multi@sitrep.local', rol: 'OPERADOR', cuit: '30-00000000-0',
      nombre: 'Usuario', apellido: 'Multirol', empresa: null, telefono: null, activo: true,
      dosFaVerificado: false, createdAt: '', updatedAt: '',
      generador: { id: 'generator-1', razonSocial: 'Empresa G' },
      transportista: { id: 'transporter-1', razonSocial: 'Empresa T' },
      operador: { id: 'operator-1', razonSocial: 'Empresa O' },
    } as any);

    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('Usuario Multirol');
    expect(screen.getByTestId('rol').textContent).toBe('OPERADOR');
    expect(screen.getByTestId('actorId').textContent).toBe('operator-1');
  });

  it('clears an invalid persisted session and stale impersonation state', async () => {
    vi.mocked(getAccessToken).mockReturnValueOnce('expired-access-token');
    vi.mocked(authService.getMe).mockRejectedValueOnce(new Error('expired'));
    localStorage.setItem('sitrep_impersonation', '{"stale":true}');

    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('sitrep_impersonation')).toBeNull();
  });

  it('logout clears the current user', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    // Login first
    await user.click(screen.getByTestId('login-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Admin User');
    });

    // Now logout
    await user.click(screen.getByTestId('logout-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
    expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    expect(clearUserOfflineData).toHaveBeenCalledWith('42');
    expect(clearSyncQueue).toHaveBeenCalledTimes(1);
  });

  it('logout removes current-principal and legacy trip state without erasing another principal', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'));
    await user.click(screen.getByTestId('login-btn'));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Admin User'));

    localStorage.setItem('sitrep_user_42_recent_searches', '["current"]');
    localStorage.setItem('sitrep_user_other_recent_searches', '["other"]');
    localStorage.setItem('sitrep_active_trip_id', 'legacy-trip');
    localStorage.setItem('viaje_snapshot_legacy-trip', '{"estado":"EN_TRANSITO"}');
    localStorage.setItem('viaje_status_legacy-trip', 'ACTIVO');
    localStorage.setItem('gps_pending_legacy-trip', '[{"latitud":-32.8}]');

    await user.click(screen.getByTestId('logout-btn'));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('null'));

    expect(localStorage.getItem('sitrep_user_42_recent_searches')).toBeNull();
    expect(localStorage.getItem('sitrep_user_other_recent_searches')).toBe('["other"]');
    expect(localStorage.getItem('sitrep_active_trip_id')).toBeNull();
    expect(localStorage.getItem('viaje_snapshot_legacy-trip')).toBeNull();
    expect(localStorage.getItem('viaje_status_legacy-trip')).toBeNull();
    expect(localStorage.getItem('gps_pending_legacy-trip')).toBeNull();
  });

  it('useAuth throws when used outside AuthProvider', () => {
    function BareConsumer() {
      useAuth();
      return null;
    }

    expect(() => {
      render(<BareConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});
