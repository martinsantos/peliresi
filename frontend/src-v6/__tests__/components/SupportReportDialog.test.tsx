import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ create: vi.fn(), sent: vi.fn(), digests: vi.fn(), navigate: vi.fn(), invalidate: vi.fn(), user: { id: 'owner', nombre: 'Usuario', rol: 'GENERADOR' }, impersonation: null as unknown }));
vi.mock('../../utils/supportDraft', async original => ({ ...await original<object>(), supportFileDigests: mocks.digests }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.user }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: mocks.impersonation, exitImpersonation: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../hooks/useMobilePrefix', () => ({ useMobilePrefix: () => (value: string) => value }));
vi.mock('../../services/support.service', () => ({ supportService: { create: mocks.create, sent: mocks.sent }, supportError: (error: Error) => error?.name === 'SupportSessionChangedError' ? error.message : 'No se confirmó el envío.' }));
import { SupportReportDialog } from '../../components/SupportReportDialog';
const fill = () => {
  fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'No abre el manifiesto' } });
  fireEvent.change(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?'), { target: { value: 'El detalle queda vacío después de entrar.' } });
};
// Unsigned unit marker only. No API/DB/browser authentication is injected.
const token = (id: string, iat = 1) => 'unit.' + btoa(JSON.stringify({ id, iat })) + '.not-a-credential';
describe('report problem preserves the human workflow', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.digests.mockResolvedValue([]); mocks.user.id = 'owner'; mocks.impersonation = null; mocks.create.mockResolvedValue({ id: 'ticket' }); mocks.sent.mockResolvedValue({ id: 'ticket' }); localStorage.setItem('sitrep_access_token', token('owner')); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
  it('explains the actual two-character report instead of silently disabling its primary action', () => {
    render(<SupportReportDialog open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'yy' } });
    fireEvent.change(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?'), { target: { value: 'hh' } });
    const submit = screen.getByRole('button', { name: 'Enviar ticket', exact: true });
    expect(submit).toBeEnabled();
    expect(screen.getByText('Para enviar: asunto (2/5 caracteres) y descripción (2/10 caracteres).')).toBeInTheDocument();
    fireEvent.click(submit);
    expect(screen.getByLabelText('Asunto')).toHaveFocus();
    expect(screen.getByLabelText('Asunto')).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.create).not.toHaveBeenCalled();
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).not.toContain('pendiente');
  });
  it('guides an empty report to its first required field without sending or freezing the draft', () => {
    render(<SupportReportDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    expect(screen.getByLabelText('Asunto')).toHaveFocus();
    expect(screen.getByText('Escribí al menos 5 caracteres para el asunto.')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Asunto')).toBeEnabled();
  });
  it('focuses a short description, then permits one acknowledged send at the exact thresholds', async () => {
    render(<SupportReportDialog open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Error' } });
    fireEvent.change(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?'), { target: { value: 'hh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    expect(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?')).toHaveFocus();
    expect(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?')).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?'), { target: { value: 'No aparece' } });
    expect(screen.queryByText(/Para enviar:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?')).not.toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/soporte/ticket'));
  });
  it('does not count spaces as report content or silently submit invalid text', () => {
    render(<SupportReportDialog open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: '     ' } });
    fireEvent.change(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?'), { target: { value: '          ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    expect(screen.getByText('Para enviar: asunto (0/5 caracteres) y descripción (0/10 caracteres).')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Asunto')).toHaveFocus();
  });
  it('keeps a timeout request frozen, retries the same key and clears only after acknowledgement', async () => {
    mocks.create.mockRejectedValueOnce(new Error('timeout'));
    render(<SupportReportDialog open onClose={vi.fn()} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket' }));
    await screen.findByText('Envío pendiente de confirmación. El texto se conserva sin cambios.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar ticket' })).not.toBeDisabled());
    expect(screen.getByLabelText('Asunto')).toBeDisabled();
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('No abre el manifiesto');
    expect(mocks.invalidate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/soporte/ticket'));
    expect(mocks.create.mock.calls[0]).toEqual(mocks.create.mock.calls[1]);
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toBeNull();
    expect(mocks.invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ['soporte', 'owner'] });
  });
  it('lets a user close without submitting or losing the locally saved text', async () => {
    const close = vi.fn(); render(<SupportReportDialog open onClose={close} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar luego' }));
    expect(close).toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('No abre el manifiesto');
  });
  it('does not claim delivery or call the network while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<SupportReportDialog open onClose={vi.fn()} />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket' }));
    await screen.findByRole('alert'); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('No abre el manifiesto');
  });
  it('does not send a human administrator report under an impersonated customer', () => {
    mocks.impersonation = { adminUser: { id: 'admin' } };
    render(<SupportReportDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Volver a mi sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar ticket' })).not.toBeInTheDocument();
  });
  it('does not leak the previous account draft after a role/session switch', () => {
    const { rerender } = render(<SupportReportDialog open onClose={vi.fn()} />); fill(); mocks.user.id = 'second-owner';
    rerender(<SupportReportDialog open onClose={vi.fn()} />); expect(screen.getByLabelText('Asunto')).toHaveValue('');
  });
  it('does not submit an unmounted owner report after asynchronous file preparation finishes', async () => {
    let finish!: (value: []) => void;
    mocks.digests.mockImplementation(() => new Promise<[]>(resolve => { finish = resolve; }));
    const { rerender } = render(<SupportReportDialog open onClose={vi.fn()} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    mocks.user.id = 'second-owner'; localStorage.setItem('sitrep_access_token', token('second-owner'));
    rerender(<SupportReportDialog open onClose={vi.fn()} />);
    await act(async () => { finish([]); });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Asunto')).toHaveValue('');
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('No abre el manifiesto');
  });
  it('rejects a new credential owner before React has reconciled the old report view', async () => {
    let finish!: (value: []) => void;
    mocks.digests.mockImplementation(() => new Promise<[]>(resolve => { finish = resolve; }));
    render(<SupportReportDialog open onClose={vi.fn()} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    localStorage.setItem('sitrep_access_token', token('second-owner'));
    await act(async () => { finish([]); });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('La sesión cambió');
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('No abre el manifiesto');
  });
  it('allows a genuine same-owner renewal during file preparation without rejecting the report', async () => {
    let finish!: (value: []) => void;
    mocks.digests.mockImplementation(() => new Promise<[]>(resolve => { finish = resolve; }));
    render(<SupportReportDialog open onClose={vi.fn()} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    localStorage.setItem('sitrep_access_token', token('owner', 2));
    await act(async () => { finish([]); });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/soporte/ticket'));
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it('does not navigate a new session when the old owner request receives its acknowledgement', async () => {
    let finish!: (value: { id: string }) => void;
    mocks.create.mockImplementation(() => new Promise<{ id: string }>(resolve => { finish = resolve; }));
    const close = vi.fn(); render(<SupportReportDialog open onClose={close} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    localStorage.setItem('sitrep_access_token', token('second-owner'));
    await act(async () => { finish({ id: 'old-owner-ticket' }); });
    expect(mocks.navigate).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
    // The acknowledged old-owner report exists: only its draft may be cleared.
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toBeNull();
  });
  it('does not query the old owner receipt using a different current credential', async () => {
    mocks.create.mockRejectedValueOnce(new Error('timeout'));
    render(<SupportReportDialog open onClose={vi.fn()} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Comprobar si llegó', exact: true })).toBeEnabled());
    localStorage.setItem('sitrep_access_token', token('second-owner'));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar si llegó', exact: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Comprobar si llegó', exact: true })).toBeEnabled());
    expect(mocks.sent).not.toHaveBeenCalled();
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('pendiente');
  });
  it('shows the captured screen for review and lets the user remove it without sending a completed form', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:screen');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    render(<SupportReportDialog open onClose={vi.fn()} screenshot={new File(['screen'], 'pantalla.jpg', { type: 'image/jpeg' })} />);
    expect(screen.getByRole('img', { name: 'Captura de la pantalla que estabas usando' })).toHaveAttribute('src', 'blob:screen');
    fill();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Quitar captura' })); });
    expect(screen.queryByRole('img', { name: 'Captura de la pantalla que estabas usando' })).not.toBeInTheDocument();
    expect(revokeUrl).toHaveBeenCalledWith('blob:screen');
    expect(mocks.create).not.toHaveBeenCalled();
    createUrl.mockRestore(); revokeUrl.mockRestore();
  });
  it('sends the reviewed screen only on confirmation and stays on the current task', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:screen');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const screenshot = new File(['screen'], 'pantalla.jpg', { type: 'image/jpeg' });
    const submitted = vi.fn();
    render(<SupportReportDialog open onClose={vi.fn()} onSubmitted={submitted} screenshot={screenshot} returnToTask />);
    expect(mocks.create).not.toHaveBeenCalled(); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
    await waitFor(() => expect(submitted).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][1]).toEqual([screenshot]);
    expect(mocks.navigate).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('explains a capture failure but still permits reporting without an image', () => {
    render(<SupportReportDialog open onClose={vi.fn()} captureError="No pudimos capturar esta pantalla. Podés adjuntar una imagen o enviar sólo el texto." />);
    expect(screen.getByText(/No pudimos capturar esta pantalla/)).toBeInTheDocument();
    fill(); expect(screen.getByRole('button', { name: 'Enviar ticket' })).toBeEnabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
