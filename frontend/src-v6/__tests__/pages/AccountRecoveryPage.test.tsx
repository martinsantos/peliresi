import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const request = vi.hoisted(() => vi.fn());
vi.mock('../../services/auth.service', () => ({ authService: { claimAccount: request } }));
import ReclamarCuentaPage from '../../pages/auth/ReclamarCuentaPage';
import ForgotPasswordPage from '../../pages/auth/ForgotPasswordPage';
beforeEach(() => { request.mockReset(); request.mockResolvedValue({ message: 'Solicitud recibida' }); });
afterEach(cleanup);
const open = () => render(<MemoryRouter><ReclamarCuentaPage /></MemoryRouter>);
function fill() {
  fireEvent.change(screen.getByLabelText('CUIT *'), { target: { value: '30711235961' } });
  fireEvent.change(screen.getByLabelText('Razón social *'), { target: { value: 'Entidad QA' } });
}
describe('recovery starts by proving access to the registered mailbox', () => {
  it('collects only public identity data and explains the mailbox requirement', () => {
    open();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(document.querySelector('input[type="password"], input[type="email"]')).toBeNull();
    expect(screen.getByText(/correo ya registrado/)).toBeVisible();
    expect(screen.getByText(/no tenés acceso/i)).toBeVisible();
  });
  it('submits no replacement credentials and shows a non-enumerating completion', async () => {
    open(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace al correo registrado' }));
    await waitFor(() => expect(request).toHaveBeenCalledExactlyOnceWith({ cuit: '30711235961', razonSocial: 'Entidad QA' }));
    expect(await screen.findByRole('heading', { name: 'Revisá el correo registrado' })).toBeVisible();
    expect(screen.queryByText(/aprobara tu acceso/i)).toBeNull();
  });
  it('blocks duplicate submission while pending', async () => {
    request.mockReturnValue(new Promise(() => {})); open(); fill();
    const button = screen.getByRole('button', { name: 'Enviar enlace al correo registrado' });
    const form = button.closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(request).toHaveBeenCalledTimes(1); expect(button).toBeDisabled();
  });
  it('retains identity fields after failure and permits retry', async () => {
    request.mockRejectedValueOnce(new Error('offline')); open(); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace al correo registrado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Intentá de nuevo');
    expect(screen.getByLabelText('CUIT *')).toHaveValue('30711235961');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace al correo registrado' }));
    expect(await screen.findByRole('heading', { name: 'Revisá el correo registrado' })).toBeVisible();
  });
  it.each([['1', 'Entidad QA'], ['30711235961', ' ']])('validates public identity before requesting recovery %s / %s', (cuit, name) => {
    open();
    fireEvent.change(screen.getByLabelText('CUIT *'), { target: { value: cuit } });
    fireEvent.change(screen.getByLabelText('Razón social *'), { target: { value: name } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar enlace al correo registrado' }).closest('form')!);
    expect(screen.getByRole('alert')).toBeVisible(); expect(request).not.toHaveBeenCalled();
  });
  it('does not promise a CUIT bypass when the registered mailbox is inaccessible', () => {
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: /Reclama tu cuenta/ })).toBeNull();
    expect(screen.getByText(/contactá al administrador/i)).toBeVisible();
  });
});
