import { clearRegistrationDraft, writeRegistrationDraft } from '../../services/registrationDraft';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ applications: [] as Array<Record<string, string>>, message: vi.fn(), resend: vi.fn(), restricted: true, logout: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isRestricted: state.restricted, logout: state.logout }) }));
vi.mock('../../components/ActorActivities', () => ({ default: () => null }));
vi.mock('../../hooks/useSolicitudes', () => ({
  useMisSolicitudes: () => ({ data: state.applications }),
  useMensajesSolicitud: () => ({ data: [] }),
  useEnviarMensaje: () => ({ mutateAsync: state.message, isPending: false }),
  useEnviarSolicitud: () => ({ mutateAsync: state.resend, isPending: false }),
}));
import MiSolicitudPage from '../../pages/solicitud/MiSolicitudPage';
function Destination() { return <p>Destino: {useLocation().pathname}</p>; }
function open() { render(<MemoryRouter initialEntries={['/mi-solicitud']}><Routes><Route path="/mi-solicitud" element={<MiSolicitudPage />} /><Route path="/inscripcion/:tipo" element={<Destination />} /><Route path="/login" element={<Destination />} /><Route path="/dashboard" element={<Destination />} /></Routes></MemoryRouter>); }
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); state.restricted = true; state.logout.mockResolvedValue(undefined); vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'false'); });
afterEach(() => vi.unstubAllEnvs());
it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('%s explicitly renews the limited session after approval through a fresh login', async type => {
  state.applications = [{ id: 'owned', tipoActor: type, estado: 'APROBADA' }]; open();
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar con mi cuenta', exact: true }));
  await waitFor(() => expect(screen.getByText('Destino: /login')).toBeVisible());
  expect(state.logout).toHaveBeenCalledOnce();
});
it('an already operational session opens the dashboard without logging out again', () => {
  state.restricted = false; state.applications = [{ id: 'owned', tipoActor: 'GENERADOR', estado: 'APROBADA' }]; open();
  fireEvent.click(screen.getByRole('button', { name: 'Ir a Inicio', exact: true }));
  expect(screen.getByText('Destino: /dashboard')).toBeVisible(); expect(state.logout).not.toHaveBeenCalled();
});
it('keeps the approved result and a retry if closing the limited session fails', async () => {
  state.logout.mockRejectedValueOnce(new Error('local checkpoint unavailable'));
  state.applications = [{ id: 'owned', tipoActor: 'GENERADOR', estado: 'APROBADA' }]; open();
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar con mi cuenta', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo renovar el acceso');
  expect(screen.getByRole('button', { name: 'Ingresar con mi cuenta', exact: true })).toBeEnabled();
  expect(screen.getByRole('heading', { name: 'Tu inscripción fue aprobada', exact: true })).toBeVisible();
});
it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('%s resumes its owned draft with multirole disabled', type => {
  state.applications = [{ id: 'owned', tipoActor: type, estado: 'BORRADOR' }]; open();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar borrador', exact: true }));
  expect(screen.getByText('Destino: /inscripcion/' + type.toLowerCase())).toBeVisible();
  expect(state.message).not.toHaveBeenCalled(); expect(state.resend).not.toHaveBeenCalled();
});
it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('%s can correct the observed application before resending', type => {
  state.applications = [{ id: 'owned', tipoActor: type, estado: 'OBSERVADA', observaciones: 'Actualizar constancia y domicilio' }]; open();
  expect(screen.getByText('Actualizar constancia y domicilio')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Corregir datos y documentos', exact: true }));
  expect(screen.getByText('Destino: /inscripcion/' + type.toLowerCase())).toBeVisible();
  expect(state.message).not.toHaveBeenCalled(); expect(state.resend).not.toHaveBeenCalled();
});
it.each(['ENVIADA', 'EN_REVISION', 'APROBADA', 'RECHAZADA'])('%s does not offer editing a closed or submitted application', status => {
  state.applications = [{ id: 'owned', tipoActor: 'GENERADOR', estado: status }]; open();
  expect(screen.queryByRole('button', { name: 'Corregir datos y documentos' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Continuar borrador' })).not.toBeInTheDocument();
});
it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('%s rejected result does not promise a new registration or a forbidden reply', type => {
  state.applications = [{ id: 'owned', tipoActor: type, estado: 'RECHAZADA', motivoRechazo: 'Motivo definitivo QA' }]; open();
  expect(screen.getByText('Motivo: Motivo definitivo QA')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Crear nueva solicitud' })).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Escribe un mensaje...')).not.toBeInTheDocument();
  expect(screen.getByText(/podés consultar los mensajes, pero no enviar respuestas/)).toBeVisible();
});

it.each(['Generador','Transportista','Operador'])('an empty account may start %s without being forced into Generador',role=>{
  state.applications=[];open();
  fireEvent.click(screen.getByRole('button',{name:role,exact:true}));
  expect(screen.getByText('Destino: /inscripcion/'+role.toLowerCase())).toBeVisible();
  expect(state.message).not.toHaveBeenCalled();
});


it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('%s does not resend from Mi solicitud with an unresolved local attachment', type => {
  state.applications=[{id:'owned',usuarioId:'candidate',tipoActor:type,estado:'OBSERVADA'}];
  writeRegistrationDraft('candidate',`public:${type}:owned`,{files:['COMPROBANTE_PAGO']}); open();
  fireEvent.change(screen.getByLabelText('Tu respuesta'),{target:{value:'Corregí los documentos.'}});
  expect(screen.getByText(/Hay archivos pendientes de recuperar/)).toBeVisible();
  expect(screen.getByRole('button',{name:'Responder y Re-enviar'})).toBeDisabled();
  expect(state.message).not.toHaveBeenCalled(); expect(state.resend).not.toHaveBeenCalled();
});


it('does not block this application with a pending file belonging to another role or person', () => {
  state.applications=[{id:'owned',usuarioId:'candidate',tipoActor:'GENERADOR',estado:'OBSERVADA'}];
  writeRegistrationDraft('other','public:GENERADOR:owned',{files:['COMPROBANTE_PAGO']});
  writeRegistrationDraft('candidate','public:OPERADOR:owned',{files:['COMPROBANTE_PAGO']}); open();
  fireEvent.change(screen.getByLabelText('Tu respuesta'),{target:{value:'Corrección revisada.'}});
  expect(screen.queryByText(/Hay archivos pendientes de recuperar/)).toBeNull();
  expect(screen.getByRole('button',{name:'Responder y Re-enviar'})).toBeEnabled();
});
it('updates the resend guard when another tab creates or resolves a pending file', () => {
  state.applications=[{id:'owned',usuarioId:'candidate',tipoActor:'GENERADOR',estado:'OBSERVADA'}];open();
  fireEvent.change(screen.getByLabelText('Tu respuesta'),{target:{value:'Corrección revisada.'}});
  writeRegistrationDraft('candidate','public:GENERADOR:owned',{files:['COMPROBANTE_PAGO']});
  fireEvent(window,new StorageEvent('storage'));
  expect(screen.getByRole('button',{name:'Responder y Re-enviar'})).toBeDisabled();
  clearRegistrationDraft('candidate','public:GENERADOR:owned');fireEvent(window,new Event('focus'));
  expect(screen.getByRole('button',{name:'Responder y Re-enviar'})).toBeEnabled();
  expect(state.resend).not.toHaveBeenCalled();
});
