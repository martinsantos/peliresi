import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ messages: [] as unknown[], status: 'OBSERVADA', sentAt: null as string | null, loading: false, error: false, hasData: true, refetch: vi.fn() }));
vi.mock('../../hooks/useSolicitudes', () => ({
  useMisSolicitudes: () => ({ data: state.hasData ? [{ id: 'own', estado: state.status, fechaEnvio: state.sentAt, tipoActor: 'GENERADOR', observaciones: 'Completar domicilio' }] : undefined, isLoading: state.loading, isError: state.error, refetch: state.refetch }),
  useMensajesSolicitud: () => ({ data: state.messages }),
  useEnviarMensaje: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEnviarSolicitud: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
import MiSolicitudPage from '../../pages/solicitud/MiSolicitudPage';
const originalScroll = HTMLElement.prototype.scrollIntoView;
const documentScroll = vi.fn();
describe('applicant conversation scroll', () => {
  beforeEach(() => { state.messages = []; state.status = 'OBSERVADA'; state.sentAt = null; state.loading = false; state.error = false; state.hasData = true; state.refetch.mockClear(); documentScroll.mockClear(); HTMLElement.prototype.scrollIntoView = documentScroll; });
  afterEach(() => { HTMLElement.prototype.scrollIntoView = originalScroll; });
  it('replaces initial skeletons with the received application', () => {
    state.loading = true; state.hasData = false;
    const view = render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tu solicitud');
    state.loading = false; state.hasData = true;
    view.rerender(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    expect(view.container.querySelector('[data-form-skeleton]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Mi Solicitud de Inscripcion' })).toBeVisible();
  });
  it('offers retry on a failed fetch instead of an empty state or endless loading', () => {
    state.hasData = false; state.error = true;
    render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar tu solicitud');
    expect(screen.queryByText('No tienes solicitudes de inscripcion')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });
  it('does not replace received data or typed messages during refetch or a background failure', () => {
    const view = render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    const input = screen.getByPlaceholderText('Escribe un mensaje...');
    fireEvent.change(input, { target: { value: 'Mi respuesta todavía sin enviar' } });
    state.loading = true; state.error = true;
    view.rerender(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    expect(input).toHaveValue('Mi respuesta todavía sin enviar');
    expect(view.container.querySelector('[data-form-skeleton]')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('does not pull the document away from its heading on initial load', () => {
    render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Mi Solicitud de Inscripcion' })).toBeInTheDocument();
    expect(documentScroll).not.toHaveBeenCalled();
  });
  it('shows the latest message by scrolling only the conversation container', () => {
    const view = render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    const panel = screen.getByRole('region', { name: 'Mensajes de la solicitud' });
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 1200 });
    state.messages = [{ id: 'message', autorRol: 'ADMIN', contenido: 'Revisar domicilio', createdAt: '2026-10-11T12:00:00Z' }];
    view.rerender(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    expect(panel.scrollTop).toBe(1200);
    expect(screen.getByText('Revisar domicilio')).toBeInTheDocument();
    expect(documentScroll).not.toHaveBeenCalled();
  });
  it.each([['RECHAZADA', null], ['BORRADOR', null], ['RECHAZADA', 'invalid']])('does not invent a pending submission for %s with date %s', (status, sentAt) => {
    state.status = status!; state.sentAt = sentAt;
    render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    expect(screen.getByText(/^Tipo:/)).toHaveTextContent(/^Tipo: GENERADOR$/);
    expect(screen.queryByText(/Enviada pendiente|Invalid Date/)).not.toBeInTheDocument();
  });
  it('shows a persisted submission date in Mendoza, independent of the runner timezone', () => {
    state.sentAt = '2026-10-12T01:00:00Z';
    render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
    expect(screen.getByText(/^Tipo:/)).toHaveTextContent('Enviada 11/10/2026');
  });
});
