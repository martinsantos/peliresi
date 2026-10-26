import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const requests = vi.hoisted(() => ({ message: vi.fn(), resend: vi.fn() }));
beforeEach(() => { localStorage.clear(); requests.message.mockReset(); requests.resend.mockReset(); });
vi.mock('../../components/ActorActivities', () => ({ default: () => <h2>Mis actividades</h2> }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isRestricted: true, logout: vi.fn() }) }));
vi.mock('../../hooks/useSolicitudes', () => ({
  useMisSolicitudes: () => ({ data: [
    { id: 'g', tipoActor: 'GENERADOR', estado: 'OBSERVADA', observaciones: 'Generador observado' },
    { id: 'o', tipoActor: 'OPERADOR', estado: 'OBSERVADA', observaciones: 'Operador observado' },
  ] }),
  useMensajesSolicitud: () => ({ data: [] }),
  useEnviarMensaje: () => ({ mutateAsync: requests.message, isPending: false }),
  useEnviarSolicitud: () => ({ mutateAsync: requests.resend, isPending: false }),
}));
import MiSolicitudPage from '../../pages/solicitud/MiSolicitudPage';
afterEach(() => vi.unstubAllEnvs());
it('opens the requested own application from the activity button', () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true');
  render(<MemoryRouter initialEntries={['/mi-solicitud?solicitud=o']}><MiSolicitudPage /></MemoryRouter>);
  expect(screen.getByLabelText('Solicitud por actividad')).toHaveValue('o');
  expect(screen.getByText('Inscripción de Operador')).toBeVisible();
});
it('keeps unsent conversations separate when selecting another application', () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true');
  render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
  fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje...'), { target: { value: 'Consulta del generador sin enviar' } });
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'o' } });
  expect(screen.getByText('Inscripción de Operador')).toBeVisible();
  expect(screen.getByPlaceholderText('Escribe un mensaje...')).toHaveValue('');
  fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje...'), { target: { value: 'Consulta del operador sin enviar' } });
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'g' } });
  expect(screen.getByPlaceholderText('Escribe un mensaje...')).toHaveValue('Consulta del generador sin enviar');
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'o' } });
  expect(screen.getByPlaceholderText('Escribe un mensaje...')).toHaveValue('Consulta del operador sin enviar');
});

it('prioritizes correction and conversation before requesting other activities', () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true');
  render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
  const choices = screen.getByRole('heading', { name: 'Mis actividades', exact: true });
  for (const element of [screen.getByRole('button', { name: 'Corregir datos y documentos', exact: true }), screen.getByRole('textbox', { name: 'Mensaje a administración', exact: true })]) {
    expect(element.compareDocumentPosition(choices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  expect(screen.getByRole('button', { name: 'Enviar mensaje', exact: true })).toBeDisabled();
});

for (const kind of ['message', 'reply'] as const) it.each([false, true])(`${kind}: a delayed success preserves new text, including another activity (%s)`, async switchActivity => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true');
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  requests.message.mockImplementation(() => kind === 'message' ? pending : Promise.resolve());
  requests.resend.mockReturnValue(pending);
  render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
  const field = () => kind === 'message'
    ? screen.getByRole('textbox', { name: 'Mensaje a administración', exact: true })
    : screen.getByPlaceholderText('Escribe tu respuesta a las observaciones...');
  fireEvent.change(field(), { target: { value: 'Texto enviado del generador' } });
  fireEvent.click(screen.getByRole('button', { name: kind === 'message' ? 'Enviar mensaje' : 'Responder y Re-enviar', exact: true }));
  await act(async () => { await Promise.resolve(); });
  expect(requests.message).toHaveBeenCalledWith(expect.objectContaining({ solicitudId: 'g', contenido: 'Texto enviado del generador', clientMessageId: expect.any(String) }));
  if (switchActivity) fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'o' } });
  fireEvent.change(field(), { target: { value: 'Texto nuevo todavía sin enviar' } });
  await act(async () => { finish(); await pending; });
  expect(field()).toHaveValue('Texto nuevo todavía sin enviar');
  expect(requests.message).toHaveBeenCalledOnce();
  if (switchActivity) {
    fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'g' } });
    expect(field()).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'o' } });
    expect(field()).toHaveValue('Texto nuevo todavía sin enviar');
  }
});
