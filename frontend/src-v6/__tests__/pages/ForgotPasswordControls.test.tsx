import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from '../../pages/auth/ForgotPasswordPage';

const service = vi.hoisted(() => ({ forgotPassword: vi.fn() }));
vi.mock('../../services/auth.service', () => ({ authService: service }));
const open = () => render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
describe('Recovery controls work with touch, labels and a single submission', () => {
  beforeEach(() => { service.forgotPassword.mockReset().mockResolvedValue(undefined); });
  it('does not translate the interactive form during entrance, preserving stable touch targets', () => {
    const {container}=open();
    expect(container.firstElementChild).not.toHaveClass('animate-fade-in-up');
    expect(container.firstElementChild).toHaveClass('animate-fade-in','w-full','max-w-sm');
    expect(screen.getByRole('button',{name:'Email',exact:true})).toHaveClass('min-h-11');
    expect(screen.getByRole('button',{name:'CUIT',exact:true})).toHaveClass('min-h-11');
    expect(service.forgotPassword).not.toHaveBeenCalled();
  });
  it('labels the chosen identifier and announces touch-sized mode controls', () => {
    open();
    expect(screen.getByLabelText('Email', { exact: true })).toHaveAttribute('type', 'email');
    const email = screen.getByRole('button', { name: 'Email', exact: true });
    const cuit = screen.getByRole('button', { name: 'CUIT', exact: true });
    expect(email).toHaveAttribute('aria-pressed', 'true');
    expect(cuit).toHaveAttribute('aria-pressed', 'false');
    for (const button of [email, cuit]) expect(button).toHaveClass('min-h-11', 'focus-visible:outline-2');
    expect(screen.getByRole('link', { name: 'Volver al login' })).toHaveClass('min-h-11');
    fireEvent.click(cuit);
    expect(cuit).toHaveAttribute('aria-pressed', 'true');
    expect(email).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('CUIT', { exact: true })).toHaveAttribute('inputmode', 'numeric');
    expect(service.forgotPassword).not.toHaveBeenCalled();
  });
  it('blocks duplicate submission before the busy render, without changing the email payload', () => {
    service.forgotPassword.mockReturnValue(new Promise(() => {}));
    open();
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'qa@night-qa.invalid' } });
    const form = screen.getByRole('button', { name: 'Enviar enlace' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(service.forgotPassword).toHaveBeenCalledExactlyOnceWith({ email: 'qa@night-qa.invalid' });
    expect(form.querySelector('button[type="submit"]')).toBeDisabled();
  });
  it('announces a failure, retains CUIT and retries with no replacement credentials', async () => {
    service.forgotPassword.mockRejectedValueOnce(new Error('only-unit-offline'));
    open(); fireEvent.click(screen.getByRole('button', { name: 'CUIT', exact: true }));
    fireEvent.change(screen.getByPlaceholderText('20-12345678-9'), { target: { value: '30-71123596-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Intentá de nuevo');
    expect(screen.getByLabelText('CUIT', { exact: true })).toHaveValue('30-71123596-1');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    await waitFor(() => expect(service.forgotPassword).toHaveBeenCalledTimes(2));
    expect(service.forgotPassword).toHaveBeenLastCalledWith({ cuit: '30-71123596-1' });
    expect(await screen.findByRole('heading', { name: 'Revisá tu email' })).toBeVisible();
  });
});
