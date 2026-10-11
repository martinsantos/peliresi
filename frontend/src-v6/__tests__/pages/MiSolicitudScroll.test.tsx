import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ messages: [] as unknown[], status: 'OBSERVADA', sentAt: null as string | null }));
vi.mock('../../hooks/useSolicitudes', () => ({
  useMisSolicitudes: () => ({ data: [{ id: 'own', estado: state.status, fechaEnvio: state.sentAt, tipoActor: 'GENERADOR', observaciones: 'Completar domicilio' }], isLoading: false }),
  useMensajesSolicitud: () => ({ data: state.messages }),
  useEnviarMensaje: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEnviarSolicitud: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
import MiSolicitudPage from '../../pages/solicitud/MiSolicitudPage';
const originalScroll = HTMLElement.prototype.scrollIntoView;
const documentScroll = vi.fn();
describe('applicant conversation scroll', () => {
  beforeEach(() => { state.messages = []; state.status = 'OBSERVADA'; state.sentAt = null; documentScroll.mockClear(); HTMLElement.prototype.scrollIntoView = documentScroll; });
  afterEach(() => { HTMLElement.prototype.scrollIntoView = originalScroll; });
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
