import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthLayout } from '../../layouts/AuthLayout';
import LoginPage from '../../pages/auth/LoginPage';
import ForgotPasswordPage from '../../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../../pages/auth/ResetPasswordPage';
import ReclamarCuentaPage from '../../pages/auth/ReclamarCuentaPage';
import RegistroPage from '../../pages/auth/RegistroPage';
import VerificarEmailPage from '../../pages/auth/VerificarEmailPage';
import EmpresaInvitacionPage from '../../pages/empresas/EmpresaInvitacionPage';

const service = vi.hoisted(() => ({ verifyEmail: vi.fn(), resendVerification: vi.fn() }));
vi.mock('../../services/auth.service', () => ({ authService: service }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock('../../services/api', () => ({ getAccessToken: () => null, default: { get: vi.fn() } }));

function open(path: string, page: React.ReactElement, layout = true, basename = '') {
  render(<MemoryRouter basename={basename} initialEntries={[basename + path]}><Routes>
    {layout ? <Route element={<AuthLayout />}><Route path="*" element={page} /></Route> : <Route path="*" element={page} />}
  </Routes></MemoryRouter>);
}
function expectTask(title: string) {
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

afterEach(cleanup);
beforeEach(() => { service.verifyEmail.mockReset().mockReturnValue(new Promise(() => {})); });
describe('Public access names the task independently of the institutional panel', () => {
  it.each(['', '/app'])('has one task heading throughout public access with base %s', async basename => {
    const cases = [
      ['/login', <LoginPage />, 'Iniciar sesión'],
      ['/recuperar', <ForgotPasswordPage />, 'Recuperar contraseña'],
      ['/reclamar', <ReclamarCuentaPage />, 'Recuperar acceso a tu cuenta'],
      ['/reset-password?token=only-unit', <ResetPasswordPage />, 'Nueva contraseña'],
      ['/registro', <RegistroPage />, 'Crear cuenta en SITREP'],
      ['/empresa-invitacion/only-unit', <EmpresaInvitacionPage />, 'Acceso a empresa'],
    ] as const;
    for (const [path, page, title] of cases) {
      open(path, page, true, basename);
      expectTask(title);
      expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
      cleanup();
    }
    expect(service.verifyEmail).not.toHaveBeenCalled();
  });
  it.each([
    ['/login', <LoginPage />, 'Iniciar sesión'],
    ['/reclamar', <ReclamarCuentaPage />, 'Recuperar acceso a tu cuenta'],
  ])('keeps the task heading in standalone app route %s', (path, page, title) => {
    open(path as string, page as React.ReactElement, false, '/app');
    expectTask(title as string);
  });
  it.each(['', '/app'])('returns from recovery to the same surface %s', basename => {
    open('/recuperar', <ForgotPasswordPage />, true, basename);
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', basename + '/login');
    cleanup();
    open('/reset-password?token=only-unit', <ResetPasswordPage />, true, basename);
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', basename + '/login');
  });
  it('does not skip a heading level for the alternative registration path', () => {
    open('/login', <LoginPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'Inscripción Provincial de Actores' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    expect(screen.getByRole('link', { name: 'Recuperá el acceso por correo' })).toHaveClass('inline-flex', 'min-h-11', 'items-center');
  });
  it('keeps a heading and announces email verification while waiting', () => {
    open('/verificar-email?token=only-unit', <VerificarEmailPage />);
    expectTask('Verificar email');
    expect(screen.getByRole('status')).toHaveTextContent('Verificando tu email');
  });
  it('replaces the heading on successful verification without adding another one', async () => {
    service.verifyEmail.mockResolvedValue({ message: 'Verificado' });
    open('/verificar-email?token=only-unit', <VerificarEmailPage />);
    await waitFor(() => expectTask('Email verificado'));
  });
  it('identifies a missing verification link without issuing a request', async () => {
    open('/verificar-email', <VerificarEmailPage />);
    await waitFor(() => expectTask('Verificar mi correo'));
    expect(screen.getByRole('textbox', { name: 'Correo de la inscripción' })).toBeVisible();
    expect(service.resendVerification).not.toHaveBeenCalled();
    expect(service.verifyEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Ingresar a mi cuenta' })).toHaveAttribute('href', '/login');
  });
});
