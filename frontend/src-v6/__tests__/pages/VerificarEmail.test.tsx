import React, { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), resend: vi.fn(), token: vi.fn() }));
vi.mock('../../services/auth.service', () => ({ authService: { verifyEmail: mocks.verify, resendVerification: mocks.resend } }));
vi.mock('../../services/api', () => ({ getAccessToken: mocks.token }));
import Page from '../../pages/auth/VerificarEmailPage';
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); localStorage.setItem('unrelated-draft', 'keep'); });
const token = (id: string) => `a.${btoa(JSON.stringify({ id }))}.s`;
function show(url = '/verificar-email?token=one-use') { return render(<StrictMode><MemoryRouter initialEntries={[url]}><Page /></MemoryRouter></StrictMode>); }
it('verifies once in StrictMode and preserves the anonymous draft and login destination', async () => {
  mocks.verify.mockResolvedValue({ message: 'Verificado', verifiedUserId: 'owner', nextPath: '/inscripcion/transportista' });
  show();
  await screen.findByRole('heading', { name: 'Email verificado' });
  expect(mocks.verify).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Continuar en SITREP' })).toHaveAttribute('href', '/login');
  expect(localStorage.getItem('unrelated-draft')).toBe('keep');
});
it('same-account session can continue without replacing credentials', async () => {
  mocks.token.mockReturnValue(token('owner'));
  mocks.verify.mockResolvedValue({ message: 'Verificado', verifiedUserId: 'owner', nextPath: '/inscripcion/generador' });
  show();
  expect(await screen.findByRole('link', { name: 'Continuar en SITREP' })).toHaveAttribute('href', '/inscripcion/generador');
  expect(localStorage.getItem('unrelated-draft')).toBe('keep');
});
it('a different active account is not silently replaced or taken into the verified draft', async () => {
  mocks.token.mockReturnValue(token('other'));
  mocks.verify.mockResolvedValue({ message: 'Verificado', verifiedUserId: 'owner', nextPath: '/inscripcion/generador' });
  show();
  expect(await screen.findByRole('link', { name: 'Volver a mi sesión' })).toHaveAttribute('href', '/dashboard');
  expect(screen.getByRole('status')).toHaveTextContent('otra cuenta');
  expect(localStorage.getItem('unrelated-draft')).toBe('keep');
});
it('expired or failed verification preserves drafts', async () => {
  mocks.verify.mockRejectedValue({ response: { data: { message: 'Enlace expirado' } } }); show();
  await screen.findByRole('heading', { name: 'Enlace de verificación' });
  expect(screen.getByText(/Tu borrador se conserva/)).toBeVisible();
  expect(localStorage.getItem('unrelated-draft')).toBe('keep');
});
it('missing proof never contacts verification', async () => {
  show('/verificar-email');
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Verificar mi correo' })).toBeVisible());
  expect(mocks.verify).not.toHaveBeenCalled();
});

it('requires an explicit confirmation before consuming a replacement mailbox proof', async () => {
  mocks.verify.mockResolvedValue({ message: 'Nuevo correo confirmado.', nextPath: '/login' });
  show('/verificar-email?token=m.fixture.proof');
  expect(mocks.verify).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar correo' }));
  await screen.findByRole('heading', { name: 'Email verificado' });
  expect(mocks.verify).toHaveBeenCalledTimes(1);
});
it('can request a fresh registration link without clearing the draft', async () => {
  mocks.resend.mockResolvedValue('Solicitud recibida');
  show('/verificar-email');
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'prueba@example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar otro enlace de inscripción' }));
  await screen.findByText('Solicitud recibida');
  expect(mocks.resend).toHaveBeenCalledWith('prueba@example.invalid');
  expect(localStorage.getItem('unrelated-draft')).toBe('keep');
});
