import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { act, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const render = (ui: React.ReactNode) => rtlRender(ui, {wrapper: MemoryRouter});
const mocks = vi.hoisted(() => ({ user: { id: 'owner' }, capture: vi.fn(), matches: vi.fn(), pending: null as unknown, impersonation: null as unknown }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.user }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: mocks.impersonation }) }));
vi.mock('../../services/supportCapture', () => ({ captureSupportScreen: mocks.capture }));
vi.mock('../../utils/supportSession', () => ({ supportSessionMatches: mocks.matches }));
vi.mock('../../utils/supportDraft', () => ({ readSupportDraft: () => mocks.pending }));
vi.mock('../../components/SupportReportDialog', () => ({ SupportReportDialog: ({ open, screenshot, captureError, returnToTask, onClose, onSubmitted }: { open: boolean; screenshot?: File; captureError?: string; returnToTask: boolean; onClose: () => void; onSubmitted: () => void }) =>
  open ? <div role="dialog"><span>{screenshot?.name}</span><span>{captureError}</span><span>{String(returnToTask)}</span><button onClick={onClose}>Cerrar reporte</button><button onClick={() => { onClose(); onSubmitted(); }}>ACK real simulado</button></div> : null }));
import { SupportBubble, mobileSupportClearance } from '../../components/SupportBubble';
import { ToastContainer } from '../../components/ui/Toast';
describe('help bubble opens from the current task without automatic delivery', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.id = 'owner'; mocks.pending = null; mocks.impersonation = null; mocks.matches.mockReturnValue(true); mocks.capture.mockResolvedValue(new File(['jpeg'], 'pantalla.jpg')); });
  it('offers help after validation, clears it when corrected, and never captures automatically', async () => {
    render(<main><input aria-label="Dato requerido" required /><SupportBubble /></main>);
    const input = screen.getByLabelText('Dato requerido');
    expect(screen.getByText('Ayuda')).toBeInTheDocument();
    fireEvent.invalid(input);
    expect(screen.getByText('Ayuda para completar')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.input(input, {target:{value:'Dato conservado'}});
    expect(screen.getByText('Ayuda')).toBeInTheDocument();
    expect(input).toHaveValue('Dato conservado');
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it('captures only after a deliberate click, prevents double clicks and opens the reviewed report', async () => {
    render(<SupportBubble />); expect(mocks.capture).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Ayuda y soporte técnico' });
    fireEvent.click(button);
    expect(mocks.capture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reportar un problema' })); fireEvent.click(button);
    expect(button).toBeDisabled(); await screen.findByRole('dialog');
    expect(mocks.capture).toHaveBeenCalledOnce(); expect(screen.getByText('pantalla.jpg')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ACK real simulado' }));
    expect(screen.getByRole('status')).toHaveTextContent('Reporte enviado a soporte');
  });
  it('opens a recoverable text report when capture fails', async () => {
    mocks.capture.mockRejectedValue(new Error('unsupported canvas'));
    render(<SupportBubble mobile />); fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' })); fireEvent.click(screen.getByRole('button', { name: 'Reportar un problema' }));
    await screen.findByRole('dialog'); expect(screen.getByText(/No pudimos capturar/)).toBeInTheDocument();
  });
  it('does not capture impersonated accounts or replace an uncertain request attachment', async () => {
    mocks.impersonation = {};
    const view = render(<SupportBubble />); fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' })); fireEvent.click(screen.getByRole('button', { name: 'Reportar un problema' }));
    expect(mocks.capture).not.toHaveBeenCalled(); view.unmount();
    mocks.impersonation = null; mocks.pending = { pendiente: {} };
    render(<SupportBubble />); fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' })); fireEvent.click(screen.getByRole('button', { name: 'Reportar un problema' }));
    expect(mocks.capture).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('discards a late capture after the current account changes', async () => {
    let resolve!: (file: File) => void; mocks.capture.mockImplementation(() => new Promise<File>(done => { resolve = done; }));
    render(<SupportBubble />); fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' })); fireEvent.click(screen.getByRole('button', { name: 'Reportar un problema' }));
    mocks.matches.mockReturnValue(false);
    await act(async () => { resolve(new File(['old'], 'another-account.jpg')); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByText('another-account.jpg')).not.toBeInTheDocument();
  });
  it('avoids the open drawer and reserves height for the mobile trip banner', () => {
    const view = render(<SupportBubble mobile aboveTrip />);
    expect(screen.getByRole('button', { name: 'Ayuda y soporte técnico' }).textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Ayuda y soporte técnico' })).toHaveClass('h-12', 'w-12', 'p-0');
    // FAB: 96px bottom + 56px height, then a real 12px gap.
    expect(screen.getByRole('button', { name: 'Ayuda y soporte técnico' }).parentElement).toHaveStyle({ bottom: 'calc(164px + env(safe-area-inset-bottom, 0px))' });
    view.rerender(<SupportBubble mobile hidden />); expect(screen.queryByRole('button', { name: 'Ayuda y soporte técnico' })).not.toBeInTheDocument();
  });
  it('can live in the inspection header without floating over save controls', async () => {
    render(<><SupportBubble mobile inline /><ToastContainer /></>);
    const button = screen.getByRole('button', { name: 'Ayuda y soporte técnico' });
    expect(button).toBeVisible();
    expect(button.parentElement).not.toHaveClass('fixed');
    expect(button.parentElement?.style.bottom).toBe('');
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Reportar un problema' }));
    await screen.findByRole('dialog');
    expect(mocks.capture).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'ACK real simulado' }));
    expect(button.parentElement?.querySelector('[role="status"]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Avisos del sistema' })).toHaveTextContent('Reporte enviado a soporte');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
describe('help bubble confirmation', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.id = 'owner'; mocks.pending = null; mocks.impersonation = null; mocks.matches.mockReturnValue(true); mocks.capture.mockResolvedValue(new File(['jpeg'], 'pantalla.jpg')); });
  it('does not stay over later screens after a delivered report', async () => {
    render(<SupportBubble mobile />);
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte técnico' })); fireEvent.click(screen.getByRole('button', { name: 'Reportar un problema' }));
    await screen.findByRole('dialog');
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'ACK real simulado' }));
      expect(screen.getByRole('status')).toHaveTextContent('Reporte enviado a soporte');
      act(() => { vi.advanceTimersByTime(8000); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});
describe('help bubble does not cover the end of the content', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.id = 'owner'; mocks.pending = null; mocks.impersonation = null; mocks.matches.mockReturnValue(true); });
  it.each([[false, 88], [true, 164]])('reserves space above the floating button (above trip: %s)', (aboveTrip, bottom) => {
    const reserved = Number(/calc\((\d+)px/.exec(mobileSupportClearance(aboveTrip))?.[1]);
    expect(reserved).toBeGreaterThanOrEqual(bottom + 48 + 16);
    expect(mobileSupportClearance(aboveTrip)).toContain('env(safe-area-inset-bottom, 0px)');
  });
  it('shows only the icon on phones in the web layout', () => {
    render(<SupportBubble />);
    expect(screen.getByText('Ayuda')).toHaveClass('hidden', 'sm:inline');
  });
});
