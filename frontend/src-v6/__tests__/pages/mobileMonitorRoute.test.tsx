import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Outlet } from 'react-router-dom';
import AppMobile from '../../AppMobile';

const state = vi.hoisted(() => ({ currentUser: { rol: 'ADMIN' } as { rol: string } | null, isRestricted: false }));
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ ...state, isLoading: false }),
}));
// This unit covers routing/auth gates; the real mobile shell is exercised in E2E.
vi.mock('../../layouts/MobileLayout', () => ({ MobileLayout: () => <Outlet /> }));
vi.mock('../../routes/pages', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  WarRoomPage: () => <main>Monitor operativo</main>,
  LoginPage: () => <main>Ingreso requerido</main>,
  MiSolicitudPage: () => <main>Solicitud restringida</main>,
}));

describe('standalone app Monitor route retains authentication boundaries', () => {
  beforeEach(() => { state.currentUser = { rol: 'ADMIN' }; state.isRestricted = false; });
  const open = () => render(<MemoryRouter initialEntries={['/monitor']}><AppMobile /></MemoryRouter>);

  it('renders the shared Monitor without adding the mobile shell', () => {
    open();
    expect(screen.getByText('Monitor operativo')).toBeVisible();
    expect(screen.queryByText('Página no encontrada')).not.toBeInTheDocument();
  });
  it('does not render Monitor without an authenticated session', () => {
    state.currentUser = null;
    open();
    expect(screen.getByText('Ingreso requerido')).toBeVisible();
    expect(screen.queryByText('Monitor operativo')).not.toBeInTheDocument();
  });
  it('does not bypass the restricted account gate', () => {
    state.isRestricted = true;
    open();
    expect(screen.getByText('Solicitud restringida')).toBeVisible();
    expect(screen.queryByText('Monitor operativo')).not.toBeInTheDocument();
  });
});
