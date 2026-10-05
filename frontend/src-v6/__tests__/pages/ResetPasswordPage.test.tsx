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
  beforeEach(() => { service.resetPassword.mockReset().mockResolvedValue(undefined); });
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
  it('announces mismatched passwords and keeps both values without submitting', () => {
    open('/reset-password?token=only-unit-synthetic');
    fireEvent.change(screen.getByLabelText('Nueva contraseña', { exact: true }), { target: { value: 'OnlyUnit-2026!' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña', { exact: true }), { target: { value: 'Different-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(screen.getByLabelText('Nueva contraseña', { exact: true })).toHaveValue('OnlyUnit-2026!');
    expect(screen.getByLabelText('Confirmar contraseña', { exact: true })).toHaveValue('Different-2026!');
    expect(service.resetPassword).not.toHaveBeenCalled();
  });
  it('submits a token once even before the disabled state renders', () => {
    service.resetPassword.mockReturnValue(new Promise(() => {}));
    open('/reset-password?token=only-unit-synthetic');
    for (const label of ['Nueva contraseña', 'Confirmar contraseña']) {
      fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: 'OnlyUnit-2026!' } });
    }
    const button = screen.getByRole('button', { name: 'Restablecer contraseña' });
    fireEvent.submit(button.closest('form')!); fireEvent.submit(button.closest('form')!);
    expect(service.resetPassword).toHaveBeenCalledExactlyOnceWith('only-unit-synthetic', 'OnlyUnit-2026!');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('focus-visible:outline-2');
  });
  it('announces the API error and allows an unchanged retry without replacing credentials', async () => {
    service.resetPassword.mockRejectedValueOnce({ response: { data: { message: 'El enlace es inválido o expiró.' } } });
    open('/reset-password?token=only-unit-synthetic');
    for (const label of ['Nueva contraseña', 'Confirmar contraseña']) {
      fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: 'OnlyUnit-2026!' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace es inválido o expiró.');
    expect(screen.getByLabelText('Nueva contraseña', { exact: true })).toHaveValue('OnlyUnit-2026!');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    expect(await screen.findByRole('heading', { name: 'Contraseña restablecida' })).toBeVisible();
    expect(service.resetPassword).toHaveBeenCalledTimes(2);
    expect(service.resetPassword).toHaveBeenLastCalledWith('only-unit-synthetic', 'OnlyUnit-2026!');
  });
});
