import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from '../../pages/auth/ResetPasswordPage';

const service = vi.hoisted(() => ({ resetPassword: vi.fn() }));
vi.mock('../../services/auth.service', () => ({ authService: service }));
function open(path = '/reset-password') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/recuperar" element={<h2>Recuperar acceso</h2>} />
  </Routes></MemoryRouter>);
}
describe('Password recovery has no blank dead end', () => {
  beforeEach(() => service.resetPassword.mockReset().mockResolvedValue(undefined));
  it('reaches recovery when opened without a token, without making a request', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Recuperar acceso' })).toBeVisible();
    expect(service.resetPassword).not.toHaveBeenCalled();
  });
  it('labels both fields and the touch-sized visibility toggle without changing the token', async () => {
    open('/reset-password?token=only-unit-synthetic');
    const password = screen.getByLabelText('Nueva contraseña', { exact: true });
    const confirm = screen.getByLabelText('Confirmar contraseña', { exact: true });
    fireEvent.change(password, { target: { value: 'OnlyUnit-2026!' } });
    fireEvent.change(confirm, { target: { value: 'OnlyUnit-2026!' } });
    const show = screen.getByRole('button', { name: 'Mostrar contraseña', exact: true });
    expect(show).toHaveClass('h-11', 'w-11');
    fireEvent.click(show);
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña', exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    await waitFor(() => expect(service.resetPassword).toHaveBeenCalledWith('only-unit-synthetic', 'OnlyUnit-2026!'));
    expect(await screen.findByRole('heading', { name: 'Contraseña restablecida' })).toBeVisible();
  });
});
