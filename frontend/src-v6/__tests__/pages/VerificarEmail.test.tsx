import React, { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), token: vi.fn() }));
vi.mock('../../services/auth.service', () => ({ authService: { verifyEmail: mocks.verify } }));
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
  await screen.findByRole('heading', { name: 'Error de verificación' });
  expect(screen.getByText(/Tu borrador no fue eliminado/)).toBeVisible();
  expect(localStorage.getItem('unrelated-draft')).toBe('keep');
});
it('missing proof never contacts verification', async () => {
  show('/verificar-email');
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Error de verificación' })).toBeVisible());
  expect(mocks.verify).not.toHaveBeenCalled();
});
