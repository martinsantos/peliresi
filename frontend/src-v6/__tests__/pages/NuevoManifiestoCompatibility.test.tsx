import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NuevoManifiestoPage from '../../pages/manifiestos/NuevoManifiestoPage';
import { toast } from '../../components/ui/Toast';

const mocks = vi.hoisted(() => ({ create: vi.fn(), refreshError: false, availability: {} as Record<string, unknown> }));

vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: null }) }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'admin-1', rol: 'ADMIN' }, isAdmin: true, isGenerador: false }),
}));
vi.mock('../../hooks/useManifiestos', () => ({
  useCreateManifiesto: () => ({ mutateAsync: mocks.create, isPending: false }),
}));
vi.mock('../../hooks/useCatalogos', () => ({
  useTiposResiduo: () => ({ data: [
    { id: 'y8', codigo: 'Y8', nombre: 'Aceites' },
    { id: 'y9', codigo: 'Y9', nombre: 'Emulsiones' },
  ] }),
  useCatalogoGeneradores: () => ({ refetch: async () => ({ isError: mocks.refreshError, data: [{ id: 'generador-1', aprobacionManifiesto: { habilitada: true } }] }), data: [{ id: 'generador-1', razonSocial: 'Generador QA', aprobacionManifiesto: mocks.availability.generador }] }),
  useCatalogoTransportistas: () => ({ refetch: async () => ({ data: [] }), data: [
    { id: 'trans-y8', razonSocial: 'Transporte Y8', corrientesAutorizadas: 'Y8', aprobacionManifiesto: mocks.availability.transportista,
      vehiculos: [{ id: 'v1', patente: 'QA001', marca: 'QA', modelo: 'Uno', activo: true }, { id: 'v2', patente: 'QA002', marca: 'QA', modelo: 'Dos', activo: true }, { id: 'v-off', patente: 'INACTIVO', activo: false }],
      choferes: [{ id: 'c1', nombre: 'QA', apellido: 'Uno', dni: '00001', activo: true }, { id: 'c2', nombre: 'QA', apellido: 'Dos', dni: '00002', activo: true }] },
    { id: 'trans-y9', razonSocial: 'Transporte Y9', corrientesAutorizadas: 'Y9' },
    { id: 'trans-both', razonSocial: 'Transporte ambas', corrientesAutorizadas: 'Y8, Y9' },
    { id: 'trans-unknown', razonSocial: 'Transporte sin corrientes' },
  ] }),
  useCatalogoOperadores: () => ({ refetch: async () => ({ data: [] }), data: [{
    id: 'operador-1', razonSocial: 'Operador QA', aprobacionManifiesto: mocks.availability.operador, modalidades: ['FIJO', 'IN_SITU'],
    tratamientos: [{ tipoResiduoId: 'y8', activo: true }, { tipoResiduoId: 'y9', activo: true }],
  }] }),
}));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function choose(label: string, option: RegExp) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function prepareDestination(transport: RegExp) {
  render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
  choose('Generador *', /Generador QA/);
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  choose('Tipo de Residuo *', /Y8 - Aceites/);
  fireEvent.change(screen.getByLabelText('Cantidad *'), { target: { value: '12.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  choose('Transportista *', transport);
  choose('Operador / Destino *', /Operador QA/);
}

function changeResidue() {
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  choose('Tipo de Residuo *', /Y9 - Emulsiones/);
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
}

function SourceProbe() {
  const location = useLocation();
  return <output data-testid="source-location">{JSON.stringify({ path: location.pathname, state: location.state })}</output>;
}

describe('manifest transport compatibility after changing residues', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
    vi.clearAllMocks();
    mocks.availability = {};
    mocks.refreshError = false;
    mocks.create.mockResolvedValue({ id: 'manifest-1', numero: 'QA-1' });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('returns to the prior manifest without overwriting a recovered draft or creating a proposal', () => {
    const first = render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
    choose('Generador *', /Generador QA/);
    const key = Object.keys(localStorage).find(item => item.startsWith('sitrep:manifest-form:v1:'))!;
    const saved = localStorage.getItem(key);
    first.unmount();

    render(<MemoryRouter initialEntries={[{ pathname: '/manifiestos/nuevo', state: {
      manifestPreviousId: 'qa-legacy', manifestListReturn: '/manifiestos?estado=APROBADO',
    } }]}><Routes>
      <Route path="/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
      <Route path="/manifiestos/:id" element={<SourceProbe />} />
    </Routes></MemoryRouter>);
    expect(screen.getByText('Borrador recuperado')).toBeVisible();
    expect(screen.getByText(/puede pertenecer a otro manifiesto/)).toBeVisible();
    expect(screen.getByText(/no se copian ni se vinculan automáticamente/)).toBeVisible();
    expect(screen.getByLabelText('Generador *')).toHaveTextContent('Generador QA');
    fireEvent.click(screen.getByRole('button', { name: 'Volver al manifiesto anterior' }));
    expect(screen.getByTestId('source-location')).toHaveTextContent('"path":"/manifiestos/qa-legacy"');
    expect(screen.getByTestId('source-location')).toHaveTextContent('"manifestListReturn":"/manifiestos?estado=APROBADO"');
    expect(localStorage.getItem(key)).toBe(saved);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('ignores an invalid prior manifest reference rather than navigating outside the list', () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/manifiestos/nuevo', state: { manifestPreviousId: '../dashboard' } }]}><NuevoManifiestoPage /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Volver al manifiesto anterior' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a Manifiestos' })).toBeVisible();
  });

  it('returns inside the app basename and keeps the home origin', () => {
    render(<MemoryRouter basename="/app" initialEntries={[{ pathname: '/app/manifiestos/nuevo', state: {
      manifestPreviousId: 'qa-legacy', manifestHomeReturn: '/dashboard?filtro=espera',
    } }]}><Routes>
      <Route path="/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
      <Route path="/manifiestos/:id" element={<SourceProbe />} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al manifiesto anterior' }));
    expect(screen.getByTestId('source-location')).toHaveTextContent('"path":"/manifiestos/qa-legacy"');
    expect(screen.getByTestId('source-location')).toHaveTextContent('"manifestHomeReturn":"/dashboard?filtro=espera"');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('never selects the first vehicle/driver by default', async () => {
    prepareDestination(/^Transporte Y8$/);
    expect(screen.getByLabelText('Vehículo (opcional)')).toHaveTextContent('Elegir vehículo');
    expect(screen.getByLabelText('Chofer (opcional)')).toHaveTextContent('Elegir chofer');
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('vehiculoId');
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('choferId');
  });

  it('explains that an in-situ draft needs a new proposal before starting', async () => {
    prepareDestination(/^Transporte Y8$/);
    expect(screen.getByRole('button', { name: /^Con traslado/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^En origen/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ya asignaste un transporte');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sin transporte' }));
    expect(screen.getByText(/El borrador se conserva. Para iniciar necesitás una nueva propuesta con las tres partes/)).toBeVisible();
    expect(screen.queryByLabelText('Transportista *')).not.toBeInTheDocument();
    choose('Operador / Destino *', /Operador QA/);
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0].modalidad).toBe('IN_SITU');
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('transportistaId');
  });

  it('warns before entry that disabled proposals cannot start with a single signature', () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','false');
    render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
    expect(screen.getByText('Las propuestas de las tres partes no están habilitadas')).toBeVisible();
    expect(screen.getByText(/Podés conservar un borrador, pero no iniciar la operación con una sola firma/)).toBeVisible();
  });

  it('preserves the three assigned parties when cancelling a change to in-situ', async () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
    prepareDestination(/^Transporte Y8$/);
    choose('Vehículo (opcional)', /QA002/); choose('Chofer (opcional)', /QA Dos/);
    fireEvent.click(screen.getByRole('button', { name: /^En origen/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('se conserva el transporte como aprobador');
    fireEvent.click(screen.getByRole('button', { name: 'Mantener traslado' }));
    expect(screen.getByRole('button', { name: /^Con traslado/ })).toHaveAttribute('aria-pressed','true');
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ modalidad:'FIJO', transportistaId:'trans-y8', operadorId:'operador-1', vehiculoId:'v2', choferId:'c2' });
  });

  it('retains the approving carrier for in-situ without a vehicle or trip', async () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
    prepareDestination(/^Transporte Y8$/);
    fireEvent.click(screen.getByRole('button', { name: /^En origen/ }));
    expect(screen.getByText(/Las tres partes reciben un aviso y deben aprobar/)).toBeVisible();
    expect(screen.getByLabelText('Transportista aprobador *')).toHaveTextContent('Transporte Y8');
    expect(screen.queryByLabelText('Vehículo (opcional)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha prevista de inicio')).toBeVisible();
    expect(screen.queryByText(/Se guardará un borrador/)).not.toBeInTheDocument();
    choose('Operador / Destino *', /Operador QA/);
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ modalidad:'IN_SITU', transportistaId:'trans-y8', operadorId:'operador-1' });
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('vehiculoId');
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('choferId');
  });

  it('requires an approving carrier for a new in-situ proposal', () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
    render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
    choose('Generador *', /Generador QA/);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    choose('Tipo de Residuo *', /Y8 - Aceites/);
    fireEvent.change(screen.getByLabelText('Cantidad *'), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: /^En origen/ }));
    choose('Operador / Destino *', /Operador QA/);
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    expect(screen.getByText('Seleccioná el transportista que aprobará la propuesta.')).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('submits explicit second resources, not list order, and excludes inactive options', async () => {
    prepareDestination(/^Transporte Y8$/);
    fireEvent.click(screen.getByLabelText('Vehículo (opcional)'));
    expect(screen.queryByRole('option', { name: /INACTIVO/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /QA002/ }));
    choose('Chofer (opcional)', /QA Dos/);
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ vehiculoId: 'v2', choferId: 'c2' }));
  });

  it('clears resources when changing carrier, preserving the other form data', async () => {
    prepareDestination(/^Transporte Y8$/);
    choose('Vehículo (opcional)', /QA002/); choose('Chofer (opcional)', /QA Dos/);
    choose('Transportista *', /^Transporte ambas$/);
    expect(screen.getByLabelText('Vehículo (opcional)')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    const sent = mocks.create.mock.calls[0][0];
    expect(sent).not.toHaveProperty('vehiculoId'); expect(sent).not.toHaveProperty('choferId');
    expect(sent.residuos).toEqual([{ tipoResiduoId: 'y8', cantidad: 12.5, unidad: 'kg' }]);
  });

  it('retains selections on failure and allows an explicit retry', async () => {
    prepareDestination(/^Transporte Y8$/);
    choose('Vehículo (opcional)', /QA002/); choose('Chofer (opcional)', /QA Dos/);
    mocks.create.mockRejectedValueOnce(new Error('QA disconnected'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Vehículo (opcional)')).toHaveTextContent('QA002');
    expect(screen.getByLabelText('Chofer (opcional)')).toHaveTextContent('QA Dos');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Envío sin confirmar', expect.stringContaining('Comprobar envío')));
    expect(screen.getByText('Envío sin confirmar').closest('[role="status"]')).toHaveFocus();
    expect(screen.getByLabelText('Observaciones')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Descartar borrador' })).not.toBeInTheDocument();
    cleanup(); sessionStorage.clear();
    render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
    mocks.create.mockResolvedValueOnce({ id: 'manifest-1', numero: 'QA-1', creationRecovered: true });
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar envío' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][0]).toEqual(mocks.create.mock.calls[0][0]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Manifiesto recuperado', expect.stringContaining('no se creó otro')));
  });

  it('retries an earlier in-situ send without changing its original payload after proposals are enabled', async () => {
    prepareDestination(/^Transporte Y8$/);
    fireEvent.click(screen.getByRole('button', { name: /^En origen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sin transporte' }));
    choose('Operador / Destino *', /Operador QA/);
    fireEvent.change(screen.getByLabelText('Fecha prevista de inicio'), { target: { value: '2099-12-25' } });
    mocks.create.mockRejectedValueOnce(new Error('QA disconnected'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    const original = mocks.create.mock.calls[0][0];
    expect(original).not.toHaveProperty('transportistaId');
    cleanup(); sessionStorage.clear();
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
    mocks.create.mockResolvedValueOnce({ id: 'manifest-1', numero: 'QA-1', creationRecovered: true });
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar envío' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][0]).toEqual(original);
  });

  it('blocks an unrecorded send rather than losing its identity if the app closes', async () => {
    prepareDestination(/^Transporte Y8$/);
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Todavía no se envió', expect.any(String));
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar envío' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  });

  it('releases the form after a definitive validation rejection, preserving fields', async () => {
    prepareDestination(/^Transporte Y8$/);
    mocks.create.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Revisá los datos' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(screen.getByLabelText('Observaciones')).toBeEnabled());
    const original = mocks.create.mock.calls[0][0];
    fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'Corregido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][0]).toMatchObject({ observaciones: 'Corregido', residuos: original.residuos });
    expect(mocks.create.mock.calls[1][0].idempotencyKey).not.toBe(original.idempotencyKey);
  });

  it('requires a new compatible transport instead of submitting the hidden previous selection', async () => {
    prepareDestination(/^Transporte Y8$/);
    changeResidue();
    expect(screen.getByLabelText('Transportista *')).not.toHaveTextContent('Transporte Y8');
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Transportista *')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Transportista *')).toHaveFocus();

    choose('Transportista *', /^Transporte Y9$/);
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      transportistaId: 'trans-y9', operadorId: 'operador-1',
      residuos: [{ tipoResiduoId: 'y9', cantidad: 12.5, unidad: 'kg' }],
    }));
  });

  it.each([
    ['Transporte ambas', 'trans-both'],
    ['Transporte sin corrientes', 'trans-unknown'],
  ])('preserves %s when it remains available under the existing compatibility rules', async (label, id) => {
    prepareDestination(new RegExp(`^${label}$`));
    changeResidue();
    expect(screen.getByLabelText('Transportista *')).toHaveTextContent(label);
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ transportistaId: id }));
  });
  it('explains an inactive operator account immediately and prevents a doomed submission', async () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    mocks.availability.operador = { habilitada: false, motivo: 'CUENTA_INACTIVA', mensaje: 'Operador «Operador QA»: su cuenta de acceso está inactiva. Administración debe revisar y reactivar la cuenta para que pueda aprobar.' };
    prepareDestination(/^Transporte Y8$/);
    expect(screen.getByLabelText('Operador / Destino *')).toHaveTextContent('Cuenta inactiva');
    expect(screen.getByText(/Operador «Operador QA»: su cuenta de acceso está inactiva/)).toBeVisible();
    expect(screen.queryByText(/operadores habilitados/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'Conservar esta observación' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Operador / Destino *')).toHaveFocus();
    expect(screen.getByLabelText('Observaciones')).toHaveValue('Conservar esta observación');
  });

  it('blocks an inactive generator at its first step with a specific explanation', () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    mocks.availability.generador = { habilitada: false, motivo: 'ACTOR_INACTIVO', mensaje: 'Generador «Generador QA»: el actor está inactivo. Administración debe revisar su habilitación.' };
    render(<MemoryRouter><NuevoManifiestoPage /></MemoryRouter>);
    choose('Generador *', /Generador QA/);
    expect(screen.getByText(/Generador «Generador QA»: el actor está inactivo/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByLabelText('Generador *')).toHaveFocus();
    expect(screen.queryByLabelText('Cantidad *')).not.toBeInTheDocument();
  });

  it('returns to the precise field if its account changes after selection, preserving the other steps', async () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    prepareDestination(/^Transporte Y8$/);
    fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'Datos preservados' } });
    mocks.create.mockRejectedValueOnce({ response: { status: 400, data: { fieldErrors: { generador: 'Generador «Generador QA»: su cuenta de acceso está inactiva.' } } } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(screen.getByLabelText('Generador *')).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent('No se creó el manifiesto');
    expect(screen.getByText(/Generador «Generador QA»: su cuenta de acceso está inactiva/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByLabelText('Generador *')).toHaveFocus();
    mocks.refreshError = true;
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estados' }));
    expect(screen.getByLabelText('Generador *')).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar estados' })).toBeEnabled());
    expect(screen.getByText(/Generador «Generador QA»: su cuenta de acceso está inactiva/)).toBeVisible();
    mocks.refreshError = false;
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estados' }));
    await waitFor(() => expect(screen.queryByText(/Generador «Generador QA»: su cuenta de acceso está inactiva/)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByLabelText('Cantidad *')).toHaveValue(12.5);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByLabelText('Observaciones')).toHaveValue('Datos preservados');
    expect(screen.getByLabelText('Transportista *')).toHaveTextContent('Transporte Y8');
  });

});
