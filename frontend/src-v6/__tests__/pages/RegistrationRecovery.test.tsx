import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InscripcionWizardPage from '../../pages/public/InscripcionWizardPage';
import { readRegistrationDraft, writeRegistrationDraft } from '../../services/registrationDraft';
import { queryClient } from '../../lib/queryClient';

const mock = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), requirements: vi.fn(), canWrite: vi.fn(), token: '' }));
vi.mock('../../services/api', () => ({ default: { get: mock.get, put: mock.put, post: mock.post }, getAccessToken: () => mock.token, setTokensDurably: vi.fn() }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { getRequirements: mock.requirements } }));
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: () => ({ status: 'owned', canWrite: mock.canWrite, retry: vi.fn() }) }));
const revision = '2026-10-09T10:00:00.000Z';
function session(owner: string) { return `qa.${btoa(JSON.stringify({ id: owner, restricted: true, registrationDraft: 'draft' }))}.qa`; }
function request(owner = 'owner') { return { data: { data: { solicitud: { id: 'draft', usuarioId: owner, tipoActor: 'GENERADOR', estado: 'BORRADOR', datosActor: '{}', updatedAt: revision,
  usuario: { nombre: 'QA responsable', cuit: '30-70987654-3', email: 'qa@night-qa.invalid' }, documentos: [] } } } }; }
async function open(type = 'generador') {
  await act(async () => { render(<MemoryRouter initialEntries={[`/inscripcion/${type}`]}><Routes><Route path="/inscripcion/:tipo" element={<InscripcionWizardPage />} /><Route path="/login" element={<p>Ingreso seguro</p>} /></Routes></MemoryRouter>); });
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); queryClient.clear(); mock.token = session('owner'); mock.canWrite.mockReturnValue(true);
  mock.get.mockResolvedValue(request()); mock.requirements.mockResolvedValue({ documentos: [], maxBytes: 10485760 });
  mock.put.mockResolvedValue({ data: { data: { solicitud: { updatedAt: '2026-10-09T10:01:00.000Z' } } } });
  mock.post.mockResolvedValue({ data: {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); queryClient.clear(); vi.restoreAllMocks(); });

describe('a real registration UI protects the current step and account boundary', () => {
  it.each(['generador', 'operador', 'transportista'])('%s points to the missing field, not session recovery, and keeps typing in place', async type => {
    const response = request(); response.data.data.solicitud.tipoActor = type.toUpperCase(); mock.get.mockResolvedValue(response);
    await open(type);
    fireEvent.change(screen.getByLabelText('Razon Social *'), { target: { value: 'QA datos conservados' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente', exact: true }));
    const address = screen.getByLabelText('Domicilio');
    await waitFor(() => expect(address).toHaveFocus());
    expect(address).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('button', { name: 'Recuperar sesión', exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conciliar borrador', exact: true })).toBeNull();
    const phone = screen.getByLabelText('Telefono'); phone.focus();
    fireEvent.change(phone, { target: { value: '0261' } }); expect(phone).toHaveFocus();
    expect(screen.getByLabelText('Razon Social *')).toHaveValue('QA datos conservados');
    expect(mock.put).not.toHaveBeenCalled(); expect(mock.post).not.toHaveBeenCalled();
  });
  it.each(['generador', 'operador'])('%s keeps invalid location text visible and stops advancement', async type => {
    const response = request(); response.data.data.solicitud.tipoActor = type.toUpperCase();
    response.data.data.solicitud.datosActor = JSON.stringify({ razonSocial: 'QA', domicilio: 'QA 123' }); mock.get.mockResolvedValue(response);
    await open(type);
    fireEvent.click(screen.getByRole('button', { name: /Paso 3 de .*Domicilios/ }));
    const coordinates = await screen.findByLabelText('Coordenadas Geograficas');
    fireEvent.change(coordinates, { target: { value: '91, -68' } }); mock.put.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente', exact: true }));
    await waitFor(() => expect(coordinates).toHaveFocus());
    expect(coordinates).toHaveAttribute('aria-invalid', 'true'); expect(coordinates).toHaveValue('91, -68');
    expect(mock.put).not.toHaveBeenCalled();
  });
  it('allows saving an incomplete draft without submitting or moving the current step', async () => {
    await open(); fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'QA recién escrito' } });
    await waitFor(() => expect(readRegistrationDraft('owner', 'public:GENERADOR:draft')?.data.form).toMatchObject({ razonSocial: 'QA recién escrito' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mock.put).toHaveBeenCalledOnce());
    expect(mock.put.mock.calls[0][1]).toMatchObject({ datosActor: { razonSocial: 'QA recién escrito' }, expectedUpdatedAt: revision });
    expect(mock.post).not.toHaveBeenCalled(); expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA recién escrito');
  });
  it.each(['ENVIADA', 'EN_REVISION', 'APROBADA', 'RECHAZADA'])('recovers the actual %s state instead of offering another registration', async state => {
    const response = request(); response.data.data.solicitud.estado = state; mock.get.mockResolvedValue(response);
    queryClient.setQueryData(['solicitudes', 'mis'], [{ id: 'draft', estado: 'BORRADOR' }]);
    const heading = state === 'APROBADA' ? 'Solicitud aprobada' : state === 'RECHAZADA' ? 'Solicitud rechazada' : 'Solicitud enviada';
    await open(); expect(screen.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Crear cuenta y continuar', exact: true })).toBeNull(); expect(mock.put).not.toHaveBeenCalled(); expect(mock.post).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(['solicitudes', 'mis'])?.isInvalidated).toBe(true);
  });
  it('does not display a submitted record from another owner', async () => {
    const response = request('other'); response.data.data.solicitud.estado = 'ENVIADA'; mock.get.mockResolvedValue(response);
    await open(); expect(screen.queryByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeNull(); expect(screen.getByRole('button', { name: 'Iniciar sesión y recuperar' })).toBeVisible();
  });
  it('refreshes the exact owned request without navigating a draft token to a protected account page', async () => {
    const response = request(); response.data.data.solicitud.estado = 'ENVIADA'; mock.get.mockResolvedValue(response);
    await open(); mock.get.mockClear();
    const approved = request(); approved.data.data.solicitud.estado = 'APROBADA'; mock.get.mockResolvedValue(approved);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado', exact: true }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Solicitud aprobada', exact: true })).toBeVisible());
    expect(mock.get).toHaveBeenCalledOnce(); expect(mock.get).toHaveBeenCalledWith('/solicitudes/draft');
    expect(screen.queryByRole('button', { name: 'Ver mi solicitud', exact: true })).toBeNull();
    expect(mock.post).not.toHaveBeenCalled(); expect(mock.put).not.toHaveBeenCalled();
  });
  it('keeps the last confirmed receipt and reports a failed refresh without inventing approval', async () => {
    const response = request(); response.data.data.solicitud.estado = 'ENVIADA'; mock.get.mockResolvedValue(response);
    await open(); mock.get.mockRejectedValue(new Error('QA sin conexión'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado', exact: true }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo actualizar el estado'));
    expect(screen.getByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Solicitud aprobada', exact: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Actualizar estado', exact: true })).toBeEnabled();
    expect(mock.post).not.toHaveBeenCalled();
  });
  it('rejects a refresh response that belongs to a different request', async () => {
    const response = request(); response.data.data.solicitud.estado = 'ENVIADA'; mock.get.mockResolvedValue(response);
    await open(); const foreign = request(); foreign.data.data.solicitud.id = 'another'; foreign.data.data.solicitud.estado = 'APROBADA'; mock.get.mockResolvedValue(foreign);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado', exact: true }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo actualizar el estado'));
    expect(screen.queryByRole('heading', { name: 'Solicitud aprobada', exact: true })).toBeNull();
    expect(mock.put).not.toHaveBeenCalled(); expect(mock.post).not.toHaveBeenCalled();
  });
  it('returns an observed request to its owned editable fields rather than claiming it was approved', async () => {
    const response = request(); response.data.data.solicitud.estado = 'ENVIADA'; mock.get.mockResolvedValue(response);
    await open(); const observed = request(); observed.data.data.solicitud.estado = 'OBSERVADA'; observed.data.data.solicitud.datosActor = JSON.stringify({ razonSocial: 'QA corregir datos' }); mock.get.mockResolvedValue(observed);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado', exact: true }));
    await waitFor(() => expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA corregir datos'));
    expect(screen.queryByRole('heading', { name: 'Solicitud aprobada', exact: true })).toBeNull();
    expect(mock.put).not.toHaveBeenCalled(); expect(mock.post).not.toHaveBeenCalled();
  });
  it('displays the rejection reason only from the verified owned request', async () => {
    const response = request(); Object.assign(response.data.data.solicitud, { estado: 'RECHAZADA', motivoRechazo: 'QA documentación a corregir' }); mock.get.mockResolvedValue(response);
    await open(); expect(screen.getByText('QA documentación a corregir', { exact: false })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Solicitud rechazada', exact: true })).toBeVisible();
  });
  it('blocks duplicate refreshes and discards a late receipt after the account changes', async () => {
    const response = request(); response.data.data.solicitud.estado = 'ENVIADA'; mock.get.mockResolvedValue(response);
    await open(); mock.get.mockClear(); let finish!: (value: unknown) => void;
    mock.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const button = screen.getByRole('button', { name: 'Actualizar estado', exact: true });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(mock.get).toHaveBeenCalledOnce(); expect(mock.get).toHaveBeenCalledWith('/solicitudes/draft');
    mock.token = session('other'); fireEvent(window, new StorageEvent('storage', { key: 'sitrep_access_token' }));
    const approved = request(); approved.data.data.solicitud.estado = 'APROBADA'; await act(async () => finish(approved));
    expect(screen.queryByRole('heading', { name: 'Solicitud aprobada', exact: true })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Iniciar sesión y recuperar' })).toBeVisible();
  });
  it('reconciles a lost submission acknowledgement against the owned server record without a second send', async () => {
    const response = request(); response.data.data.solicitud.datosActor = JSON.stringify({ razonSocial: 'QA alta', domicilio: 'QA Registro 100' });
    mock.get.mockImplementation(async () => response);
    mock.post.mockImplementation(async () => { response.data.data.solicitud.estado = 'ENVIADA'; throw new Error('QA acknowledgement lost after commit'); });
    await open(); fireEvent.click(screen.getByRole('button', { name: /^Paso 7 de 7: Resumen$/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar solicitud', exact: true })).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud', exact: true }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeVisible());
    expect(mock.post).toHaveBeenCalledOnce(); expect(mock.get.mock.calls.filter(call => call[0] === '/solicitudes/draft')).toHaveLength(2);
  });
  it('never infers acceptance when the post fails and the server still identifies a draft', async () => {
    const response = request(); response.data.data.solicitud.datosActor = JSON.stringify({ razonSocial: 'QA alta', domicilio: 'QA Registro 100' }); mock.get.mockResolvedValue(response);
    mock.post.mockRejectedValue(new Error('QA not submitted')); await open();
    fireEvent.click(screen.getByRole('button', { name: /^Paso 7 de 7: Resumen$/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar solicitud', exact: true })).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud', exact: true }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('QA not submitted'));
    expect(screen.queryByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeNull(); expect(mock.post).toHaveBeenCalledOnce();
  });
  it('clears the previous receipt state when the account changes', async () => {
    const response = request(); response.data.data.solicitud.estado = 'ENVIADA'; mock.get.mockResolvedValue(response);
    await open(); expect(screen.getByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeVisible();
    mock.token = session('other'); fireEvent(window, new StorageEvent('storage', { key: 'sitrep_access_token' }));
    expect(screen.queryByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeNull(); expect(screen.getByRole('button', { name: 'Iniciar sesión y recuperar' })).toBeVisible();
  });
  it('recovers text typed without ever changing steps after a close/reopen', async () => {
    await open(); fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'QA sin navegar' } });
    await waitFor(() => expect(readRegistrationDraft('owner', 'public:GENERADOR:draft')?.data.form).toMatchObject({ razonSocial: 'QA sin navegar' }));
    cleanup(); await open(); expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA sin navegar');
    expect(mock.put).not.toHaveBeenCalled(); expect(screen.getByRole('status')).toHaveTextContent('pendientes de guardar en SITREP');
  });
  it('retains local changes and never claims server saving after an offline error', async () => {
    mock.put.mockRejectedValue(new Error('QA sin conexión')); await open();
    fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'QA recuperable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se confirmó el guardado en SITREP'));
    expect(screen.getByRole('status')).toHaveTextContent('este dispositivo'); expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA recuperable');
  });
  it('does not mark edits made during a pending save as server-saved', async () => {
    let finish!: (value: unknown) => void; mock.put.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await open(); const field = screen.getByPlaceholderText('Empresa S.A.');
    fireEvent.change(field, { target: { value: 'QA versión enviada' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    fireEvent.change(field, { target: { value: 'QA edición posterior' } });
    await act(async () => finish({ data: { data: { solicitud: { updatedAt: '2026-10-09T10:01:00.000Z' } } } }));
    expect(field).toHaveValue('QA edición posterior'); expect(screen.getByRole('status')).toHaveTextContent('pendientes de guardar en SITREP');
    expect(mock.put.mock.calls[0][1].datosActor.razonSocial).toBe('QA versión enviada');
  });
  it('blocks a same-tick double save and a second editor', async () => {
    await open(); const button = screen.getByRole('button', { name: 'Guardar borrador' });
    act(() => { fireEvent.click(button); fireEvent.click(button); }); await waitFor(() => expect(mock.put).toHaveBeenCalledOnce());
    // The call count changes before its awaited confirmation/finally completes.
    // Exercise the second-editor boundary after saving, not another in-flight click.
    await waitFor(() => expect(button).toBeEnabled());
    mock.canWrite.mockReturnValue(false); fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('otra pestaña')); expect(mock.put).toHaveBeenCalledOnce();
  });
  it('requires explicit reconciliation instead of replacing a newer server draft', async () => {
    writeRegistrationDraft('owner', 'public:GENERADOR:draft', { form: { razonSocial: 'QA copia local' }, serverRevision: '2026-10-09T09:00:00.000Z', step: 1 });
    await open(); expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar mis cambios locales' }));
    expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA copia local'); expect(mock.put).not.toHaveBeenCalled();
  });
  it('never renders a local draft after the server identifies a different owner', async () => {
    writeRegistrationDraft('owner', 'public:GENERADOR:draft', { form: { razonSocial: 'PRIVATE-QA' }, serverRevision: revision });
    mock.get.mockResolvedValue(request('other')); await open();
    expect(screen.queryByDisplayValue('PRIVATE-QA')).toBeNull(); expect(screen.getByRole('button', { name: 'Iniciar sesión y recuperar' })).toBeVisible();
  });
  it('clears displayed private fields on account switching without destroying the original draft', async () => {
    await open(); fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'PRIVATE-QA' } });
    await waitFor(() => expect(readRegistrationDraft('owner', 'public:GENERADOR:draft')).not.toBeNull());
    mock.token = session('other'); fireEvent(window, new StorageEvent('storage', { key: 'sitrep_access_token' }));
    expect(screen.queryByDisplayValue('PRIVATE-QA')).toBeNull(); expect(mock.put).not.toHaveBeenCalled();
    expect(readRegistrationDraft('owner', 'public:GENERADOR:draft')?.data.form).toMatchObject({ razonSocial: 'PRIVATE-QA' });
  });
  it('preserves historical structured data when saving a new field', async () => {
    const response = request(); response.data.data.solicitud.datosActor = JSON.stringify({ tefInputs: { personal: 0, potenciaHP: 100 }, legacy: { version: 1 } });
    mock.get.mockResolvedValue(response); await open();
    fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'QA nueva declaración' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' })); await waitFor(() => expect(mock.put).toHaveBeenCalledOnce());
    expect(mock.put.mock.calls[0][1].datosActor).toMatchObject({ tefInputs: { personal: 0, potenciaHP: 100 }, legacy: { version: 1 }, razonSocial: 'QA nueva declaración' });
  });
});
