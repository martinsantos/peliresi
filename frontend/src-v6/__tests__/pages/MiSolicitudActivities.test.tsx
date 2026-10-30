import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const requests = vi.hoisted(() => ({ message: vi.fn(), resend: vi.fn(), applications: null as null | Record<string, unknown>[] }));
beforeEach(() => { localStorage.clear(); requests.message.mockReset(); requests.resend.mockReset(); requests.applications = null; });
vi.mock('../../components/ActorActivities', () => ({ default: () => <h2>Mis actividades</h2> }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isRestricted: true, logout: vi.fn() }) }));
vi.mock('../../hooks/useSolicitudes', () => ({
  useMisSolicitudes: () => ({ data: requests.applications || [
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
it('locates the linked document and removes its target when changing activity', () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true');
  requests.applications = [
    { id: 'g', tipoActor: 'GENERADOR', estado: 'APROBADA', documentos: [{ id: 'g-doc', nombre: 'Generador.pdf', estado: 'PENDIENTE' }] },
    { id: 'o', tipoActor: 'OPERADOR', estado: 'APROBADA', documentos: [{ id: 'o-doc', nombre: 'Operador.pdf', estado: 'PENDIENTE' }] },
  ];
  render(<MemoryRouter initialEntries={['/mi-solicitud?solicitud=o&documento=o-doc']}><MiSolicitudPage /></MemoryRouter>);
  expect(screen.getByRole('listitem', { name: 'Documento del aviso: Operador.pdf' })).toHaveFocus();
  expect(screen.getByRole('listitem', { name: 'Documento del aviso: Operador.pdf' })).toHaveTextContent('Inscripción: Operador');
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), { target: { value: 'g' } });
  expect(screen.getByText('Inscripción de Generador')).toBeVisible();
  expect(screen.queryByText('Documento indicado en el aviso')).toBeNull();
  expect(screen.getByRole('button', { name: /Documentos presentados/ })).toHaveAttribute('aria-expanded', 'false');
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

it('an unavailable linked application never silently displays a different owned request',()=>{
  render(<MemoryRouter initialEntries={['/mi-solicitud?solicitud=missing']}><MiSolicitudPage/></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('No pudimos abrir la solicitud elegida con esta cuenta');
  expect(screen.queryByText('Inscripción de Generador')).toBeNull();
  expect(screen.queryByRole('button',{name:'Responder y Re-enviar'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Elegir otra solicitud'}));
  expect(screen.getByText('Inscripción de Generador')).toBeVisible();
  expect(requests.message).not.toHaveBeenCalled();expect(requests.resend).not.toHaveBeenCalled();
});

for (const prefix of ['', '/app']) it(`distinguishes a closed application and opens the current same-role request explicitly in ${prefix || 'web'}`, () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true');
  requests.applications = [
    { id: 'current', tipoActor: 'OPERADOR', estado: 'BORRADOR', createdAt: '2026-10-26T13:00:00Z' },
    { id: 'old', tipoActor: 'OPERADOR', estado: 'RECHAZADA', createdAt: '2026-10-20T01:00:00Z', motivoRechazo: 'Motivo del expediente anterior' },
    { id: 'other', tipoActor: 'GENERADOR', estado: 'BORRADOR', createdAt: '2026-10-26T14:00:00Z' },
  ];
  render(<MemoryRouter initialEntries={[prefix + '/mi-solicitud?solicitud=old']}><MiSolicitudPage /></MemoryRouter>);
  expect(screen.getByLabelText('Solicitud por actividad')).toHaveValue('old');
  expect(screen.getByRole('option', {name: /Operador · Rechazada · 19\/10\/2026/})).toBeVisible();
  expect(screen.getByText('Motivo: Motivo del expediente anterior')).toBeVisible();
  expect(screen.queryByText(/Nueva solicitud inicia otro expediente/)).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'Ver solicitud vigente'}));
  expect(screen.getByLabelText('Solicitud por actividad')).toHaveValue('current');
  expect(screen.getByRole('button', {name:'Continuar borrador'})).toBeVisible();
  expect(screen.queryByText('Motivo: Motivo del expediente anterior')).toBeNull();
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), {target:{value:'old'}});
  expect(screen.getByText('Motivo: Motivo del expediente anterior')).toBeVisible();
  expect(requests.message).not.toHaveBeenCalled(); expect(requests.resend).not.toHaveBeenCalled();
});
it('keeps existing history accessible with multirole creation disabled and dates missing', () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'false');
  requests.applications = ['a','b'].map(id=>({id, tipoActor:'GENERADOR', estado:'RECHAZADA', createdAt:'invalid'}));
  render(<MemoryRouter><MiSolicitudPage /></MemoryRouter>);
  const labels=screen.getAllByRole('option').map(option=>option.textContent);
  expect(new Set(labels).size).toBe(2);
  expect(labels.join(' ')).not.toMatch(/Invalid Date/);
  fireEvent.change(screen.getByLabelText('Solicitud por actividad'), {target:{value:'b'}});
  expect(screen.getByLabelText('Solicitud por actividad')).toHaveValue('b');
});
