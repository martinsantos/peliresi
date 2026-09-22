/**
 * Tests for src-v6/contexts/AuthContext.tsx
 * AuthProvider + useAuth hook
 *
 * Strategy: Mock all external dependencies (authService, api, offline-sync, etc.)
 * and test the context's state transitions via a consumer component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
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
import { authService } from '../../services/auth.service';
import { clearTokens, getAccessToken } from '../../services/api';
import { OFFLINE_SESSION_KEY, MAX_OFFLINE_SESSION_MS } from '../../services/offlineSession';
import type { Usuario } from '../../types/models';

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
      <span data-testid="inspector">{String(auth.currentUser?.esInspector ?? false)}</span>
      <span data-testid="isAdmin">{String(auth.isAdmin)}</span>
      <span data-testid="isGenerador">{String(auth.isGenerador)}</span>
      <span data-testid="isTransportista">{String(auth.isTransportista)}</span>
      <span data-testid="isOperador">{String(auth.isOperador)}</span>
      <span data-testid="isAnyAdmin">{String(auth.isAnyAdmin)}</span>
      <span data-testid="isLoading">{String(auth.isLoading)}</span>
      <span data-testid="authError">{auth.authError ?? 'none'}</span>
      <button data-testid="login-btn" onClick={() => auth.login('admin@test.com', 'pass123')}>Login</button>
      <button data-testid="logout-btn" onClick={() => auth.logout()}>Logout</button>
      <button data-testid="switch-btn" onClick={() => auth.switchUser(-1)}>Switch</button>
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
  const inspector = { id: 'inspector-1', email: 'inspector@test.invalid', nombre: 'Inspectora', apellido: 'Uno', rol: 'AUDITOR', activo: true, esInspector: true } as Usuario;
  const networkError = { isAxiosError: true, code: 'ERR_NETWORK' };
  const tokenFor = (id = inspector.id, expiresAt = Date.now() + 24 * 60 * 60 * 1000) =>
    `header.${btoa(JSON.stringify({ id, exp: expiresAt / 1000 }))}.signature`;

  async function cacheVerifiedSession(expiresAt?: number) {
    localStorage.setItem('sitrep_access_token', tokenFor(inspector.id, expiresAt));
    vi.mocked(authService.getMe).mockResolvedValueOnce(inspector);
    const view = renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Inspectora Uno'));
    view.unmount();
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getAccessToken).mockImplementation(() => localStorage.getItem('sitrep_access_token'));
    vi.mocked(clearTokens).mockImplementation(() => {
      localStorage.removeItem('sitrep_access_token');
      localStorage.removeItem('sitrep_refresh_token');
    });
    vi.mocked(authService.getMe).mockRejectedValue(new Error('No token'));
  });

  afterEach(() => vi.useRealTimers());

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

  it('reopens offline with the same API-confirmed user and no broader role', async () => {
    await cacheVerifiedSession();
    vi.mocked(authService.getMe).mockRejectedValue(networkError);
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('isLoading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('Inspectora Uno');
    expect(screen.getByTestId('rol')).toHaveTextContent('AUDITOR');
    expect(screen.getByTestId('inspector')).toHaveTextContent('true');
    expect(screen.getByTestId('isAnyAdmin')).toHaveTextContent('false');
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])('rejects HTTP %s instead of restoring the cached user', async (status) => {
    await cacheVerifiedSession();
    vi.mocked(authService.getMe).mockRejectedValue({ response: { status } });
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('isLoading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('does not authenticate offline without a previously verified profile', async () => {
    localStorage.setItem('sitrep_access_token', tokenFor());
    vi.mocked(authService.getMe).mockRejectedValue(networkError);
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('isLoading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('does not reuse the previous account cache with a different token', async () => {
    await cacheVerifiedSession();
    localStorage.setItem('sitrep_access_token', tokenFor('another-user'));
    vi.mocked(authService.getMe).mockRejectedValue(networkError);
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('isLoading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });

  it('revalidates on reconnect and applies the current server permissions', async () => {
    await cacheVerifiedSession();
    vi.mocked(authService.getMe).mockRejectedValueOnce(networkError);
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Inspectora Uno'));
    vi.mocked(authService.getMe).mockResolvedValueOnce({ ...inspector, esInspector: false });
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(screen.getByTestId('inspector')).toHaveTextContent('false'));
    expect(authService.getMe).toHaveBeenCalledTimes(3);
  });

  it('revokes an offline session when reconnect returns 401', async () => {
    await cacheVerifiedSession();
    vi.mocked(authService.getMe).mockRejectedValueOnce(networkError);
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Inspectora Uno'));
    vi.mocked(authService.getMe).mockRejectedValueOnce({ response: { status: 401 } });
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });

  it.each(['logout-btn', 'switch-btn'])('removes the cached profile on %s', async (button) => {
    await cacheVerifiedSession();
    vi.mocked(authService.getMe).mockRejectedValueOnce(networkError);
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Inspectora Uno'));
    await userEvent.setup().click(screen.getByTestId(button));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });

  it('cannot keep an open offline session beyond JWT expiration', async () => {
    await cacheVerifiedSession(Date.now() + 60_000);
    vi.mocked(authService.getMe).mockRejectedValueOnce(networkError);
    vi.useFakeTimers();
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId('user')).toHaveTextContent('Inspectora Uno');
    await act(async () => { vi.advanceTimersByTime(60_001); });
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });

  it('requires online authentication after the offline window expires', async () => {
    await cacheVerifiedSession();
    vi.mocked(authService.getMe).mockRejectedValueOnce(networkError);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + MAX_OFFLINE_SESSION_MS + 1);
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('clears the active profile after a logout in another tab', async () => {
    await cacheVerifiedSession();
    vi.mocked(authService.getMe).mockRejectedValueOnce(networkError);
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Inspectora Uno'));
    const token = getAccessToken();
    localStorage.removeItem('sitrep_access_token');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'sitrep_access_token', oldValue: token, newValue: null })));
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });

  it('ignores a validation response that arrives after logout', async () => {
    localStorage.setItem('sitrep_access_token', tokenFor());
    let resolveProfile!: (profile: Usuario) => void;
    vi.mocked(authService.getMe).mockReturnValueOnce(new Promise(resolve => { resolveProfile = resolve; }));
    renderWithProviders();
    await userEvent.setup().click(screen.getByTestId('logout-btn'));
    await act(async () => resolveProfile(inspector));
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });
});
