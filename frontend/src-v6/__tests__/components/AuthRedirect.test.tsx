import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginMock = vi.fn();
let authState = {
  currentUser: null as null | { rol: string },
  isLoading: false,
  isRestricted: false,
  login: loginMock,
  authError: null as string | null,
};

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => authState,
}));

import ProtectedRoute from '../../components/ProtectedRoute';
import LoginPage from '../../pages/auth/LoginPage';
import { AuthGate } from '../../AppMobile';

function LocationProbe() {
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  return (
    <>
      <span data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</span>
      <span data-testid="from">{typeof from === 'string' ? from : ''}</span>
    </>
  );
}

function renderLogin(from?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: { from } }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('tu@email.com o 20-12345678-9'), 'qa@example.com');
  await user.type(screen.getByPlaceholderText('********'), 'secret123');
  await user.click(screen.getByRole('button', { name: /ingresar/i }));
}

describe('authenticated redirect destination', () => {
  beforeEach(() => {
    loginMock.mockReset();
    loginMock.mockResolvedValue(undefined);
    authState = {
      currentUser: null,
      isLoading: false,
      isRestricted: false,
      login: loginMock,
      authError: null,
    };
  });

  it('ProtectedRoute preserves pathname, search and hash when redirecting to login', async () => {
    render(
      <MemoryRouter initialEntries={['/inspecciones/INS-QR-123?origen=qr&vista=trazabilidad#evento-9']}>
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/inspecciones/:id" element={<span>contenido protegido</span>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    expect(screen.getByTestId('from')).toHaveTextContent(
      '/inspecciones/INS-QR-123?origen=qr&vista=trazabilidad#evento-9',
    );
  });

  it('LoginPage returns to a local destination including query and hash', async () => {
    renderLogin('/inspecciones/INS-QR-123?origen=qr&vista=trazabilidad#evento-9');

    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/inspecciones/INS-QR-123?origen=qr&vista=trazabilidad#evento-9',
      );
    });
    expect(loginMock).toHaveBeenCalledWith('qa@example.com', 'secret123');
  });

  it.each([
    ['protocol-relative URL', '//evil.example/phishing'],
    ['absolute URL', 'https://evil.example/phishing'],
    ['non-string value', { pathname: '/manifiestos/M-123' }],
  ])('LoginPage rejects a non-local from value: %s', async (_label, from) => {
    renderLogin(from);

    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
    });
  });
});

describe('standalone PWA AuthGate redirect destination', () => {
  beforeEach(() => {
    authState = {
      currentUser: null,
      isLoading: false,
      isRestricted: false,
      login: loginMock,
      authError: null,
    };
  });

  it('preserves pathname, search and hash when a private deep link requires login', async () => {
    render(
      <MemoryRouter initialEntries={['/inspecciones/INS-PWA-1?origen=qr#trazabilidad']}>
        <AuthGate><LocationProbe /></AuthGate>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    expect(screen.getByTestId('from')).toHaveTextContent(
      '/inspecciones/INS-PWA-1?origen=qr#trazabilidad',
    );
  });

  it('returns an authenticated user from login to a safe local deep link', async () => {
    authState.currentUser = { rol: 'ADMIN' };
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/login',
        state: { from: '/inspecciones/INS-PWA-1?origen=qr#trazabilidad' },
      }]}>
        <AuthGate><LocationProbe /></AuthGate>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/inspecciones/INS-PWA-1?origen=qr#trazabilidad',
      );
    });
  });

  it('routes an authenticated inspected party to its authorized traceability view', async () => {
    authState.currentUser = { rol: 'GENERADOR' };
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/login',
        state: { from: '/inspecciones/INS-PWA-1?origen=qr#trazabilidad' },
      }]}>
        <AuthGate><LocationProbe /></AuthGate>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/mis-inspecciones/INS-PWA-1?origen=qr#trazabilidad',
      );
    });
  });

  it('falls back to dashboard when an authenticated login receives a non-local from', async () => {
    authState.currentUser = { rol: 'ADMIN' };
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/login',
        state: { from: '//evil.example/phishing' },
      }]}>
        <AuthGate><LocationProbe /></AuthGate>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
  });
});
