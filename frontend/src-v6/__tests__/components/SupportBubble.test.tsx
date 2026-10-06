import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: { id: 'owner' }, capture: vi.fn(), matches: vi.fn(), pending: null as unknown, impersonation: null as unknown }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.user }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: mocks.impersonation }) }));
vi.mock('../../services/supportCapture', () => ({ captureSupportScreen: mocks.capture }));
vi.mock('../../utils/supportSession', () => ({ supportSessionMatches: mocks.matches }));
vi.mock('../../utils/supportDraft', () => ({ readSupportDraft: () => mocks.pending }));
vi.mock('../../components/SupportReportDialog', () => ({ SupportReportDialog: ({ open, screenshot, captureError, returnToTask, onClose, onSubmitted }: { open: boolean; screenshot?: File; captureError?: string; returnToTask: boolean; onClose: () => void; onSubmitted: () => void }) =>
  open ? <div role="dialog"><span>{screenshot?.name}</span><span>{captureError}</span><span>{String(returnToTask)}</span><button onClick={onClose}>Cerrar reporte</button><button onClick={() => { onClose(); onSubmitted(); }}>ACK real simulado</button></div> : null }));
import { SupportBubble } from '../../components/SupportBubble';
describe('help bubble opens from the current task without automatic delivery', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.id = 'owner'; mocks.pending = null; mocks.impersonation = null; mocks.matches.mockReturnValue(true); mocks.capture.mockResolvedValue(new File(['jpeg'], 'pantalla.jpg')); });
  it('captures only after a deliberate click, prevents double clicks and opens the reviewed report', async () => {
    render(<SupportBubble />); expect(mocks.capture).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Ayuda y soporte técnico' });
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled(); await screen.findByRole('dialog');
    expect(mocks.capture).toHaveBeenCalledOnce(); expect(screen.getByText('pantalla.jpg')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ACK real simulado' }));
    expect(screen.getByRole('status')).toHaveTextContent('Reporte enviado a soporte');
  });
  it('opens a recoverable text report when capture fails', async () => {
    mocks.capture.mockRejectedValue(new Error('unsupported canvas'));
    render(<SupportBubble mobile />); fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' }));
    await screen.findByRole('dialog'); expect(screen.getByText(/No pudimos capturar/)).toBeInTheDocument();
  });
  it('does not capture impersonated accounts or replace an uncertain request attachment', async () => {
    mocks.impersonation = {};
    const view = render(<SupportBubble />); fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' }));
    expect(mocks.capture).not.toHaveBeenCalled(); view.unmount();
    mocks.impersonation = null; mocks.pending = { pendiente: {} };
    render(<SupportBubble />); fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' }));
    expect(mocks.capture).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('discards a late capture after the current account changes', async () => {
    let resolve!: (file: File) => void; mocks.capture.mockImplementation(() => new Promise<File>(done => { resolve = done; }));
    render(<SupportBubble />); fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' }));
    mocks.matches.mockReturnValue(false);
    await act(async () => { resolve(new File(['old'], 'another-account.jpg')); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByText('another-account.jpg')).not.toBeInTheDocument();
  });
  it('avoids the open drawer and reserves height for the mobile trip banner', () => {
    const view = render(<SupportBubble mobile aboveTrip />);
    expect(screen.getByRole('button', { name: 'Ayuda y soporte técnico' }).parentElement).toHaveStyle({ bottom: 'calc(148px + env(safe-area-inset-bottom, 0px))' });
    view.rerender(<SupportBubble mobile hidden />); expect(screen.queryByRole('button', { name: 'Ayuda y soporte técnico' })).not.toBeInTheDocument();
  });
});
