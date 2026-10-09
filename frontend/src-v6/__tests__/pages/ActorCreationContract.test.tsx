import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NuevoTransportistaPage from '../../pages/admin/NuevoTransportistaPage';
import NuevoGeneradorPage from '../../pages/admin/NuevoGeneradorPage';
import NuevoOperadorPage from '../../pages/admin/NuevoOperadorPage';

const mock = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), uploadDoc: vi.fn(), success: vi.fn(), error: vi.fn(), existing: undefined as unknown }));
vi.mock('../../hooks/useActorRegistrationDraft', () => ({ useActorRegistrationDraft: () => ({ available: null, saved: false, error: null, restoring: false, checkpoint: vi.fn(), clear: vi.fn(), assertSession: vi.fn() }) }));
vi.mock('../../services/generador-fiscal.service', () => ({ transportistaDocumentoService: { upload: mock.uploadDoc }, generadorFiscalService: { downloadDocumento: vi.fn() } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: mock.success, error: mock.error } }));
vi.mock('../../hooks/useActores', () => {
  const create = () => ({ mutateAsync: mock.create, isPending: false });
  const update = () => ({ mutateAsync: mock.update, isPending: false });
  const read = () => ({ data: mock.existing });
  return { useTransportista: read, useGenerador: read, useOperador: read,
    useCreateTransportista: create, useCreateGenerador: create, useCreateOperador: create,
    useUpdateTransportista: update, useUpdateGenerador: update, useUpdateOperador: update };
});
vi.mock('../../hooks/useEnrichment', () => ({ useGeneradoresEnrichment: () => ({ data: {} }), useOperadoresEnrichment: () => ({ data: {} }) }));
vi.mock('../../hooks/useGeneradorFiscal', () => ({ useUploadDocumento: () => ({ isPending: false }), useUploadOperadorDocumento: () => ({ isPending: false }) }));
vi.mock('../../components/CalculadoraTEF', () => ({ default: () => null }));

function open(type: 'transportista' | 'generador' | 'operador' = 'transportista', edit = false, base = '') {
  const Component = { transportista: NuevoTransportistaPage, generador: NuevoGeneradorPage, operador: NuevoOperadorPage }[type];
  render(<MemoryRouter basename={base || undefined} initialEntries={[base + (edit ? '/edit/qa' : '/new')]}><Routes>
    <Route path="/new" element={<Component />} /><Route path="/edit/:id" element={<Component />} />
    <Route path="*" element={<p>Listado</p>} />
  </Routes></MemoryRouter>);
}
function fill(label: RegExp, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
function basics() { fill(/Razon Social/, 'QA Transporte'); fill(/CUIT/, '30-12345678-9'); fill(/Email/, 'qa@night-qa.invalid'); }
function step(name: string) { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^(?:\\d+\\. )?${name}$`) })); }
function submit() { step('Confirmar'); const button = screen.queryByRole('button', { name: 'Crear Transportista' }); if (button) fireEvent.click(button); }
function vehicle() { step('Vehiculos'); step('Agregar'); fill(/Patente/, 'QA123ZZ'); fill(/Ano/, '2026'); fill(/Vencimiento/, '2030-01-01'); }

describe('actor creation contract', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.existing = undefined; mock.create.mockResolvedValue({ id: 'created' }); mock.update.mockResolvedValue({}); mock.uploadDoc.mockResolvedValue({ id: 'qa-doc', nombre: 'QA.pdf', tipo: 'OTRO', size: 100, estado: 'PENDIENTE' }); });
  it('keeps already saved data read-only after a partial upload failure while allowing attachment replacement and retry', async () => {
    mock.uploadDoc.mockRejectedValueOnce(new Error('QA upload rejected'));
    open(); basics(); fill(/Contraseña inicial/, 'OnlyLocal-QA-secret!'); step('Confirmar');
    const file = new File(['QA'], 'QA.pdf', { type: 'application/pdf' });
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Transportista' }));
    await waitFor(() => expect(screen.getByRole('alert', { name: 'Adjuntos pendientes' })).toHaveTextContent('Transportista guardado'));
    step('Datos Basicos'); expect(screen.getByLabelText(/Razon Social/)).toBeDisabled();
    step('Confirmar'); expect(screen.getByRole('button', { name: 'Quitar QA.pdf', exact: true })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar adjuntos', exact: true }));
    await waitFor(() => expect(screen.getByText('Listado')).toBeInTheDocument());
    expect(mock.create).toHaveBeenCalledOnce(); expect(mock.uploadDoc).toHaveBeenCalledTimes(2);
    expect(mock.uploadDoc.mock.calls.map(call => call[0])).toEqual(['created', 'created']);
  });
  it.each(['', 'short', '30123456789', '30-12345678-9', '        '])('does not send invalid initial password %j or substitute CUIT', async password => {
    open(); basics(); fill(/Password inicial|Contraseña inicial/, password); submit();
    await waitFor(() => expect(screen.getByLabelText(/Password inicial|Contraseña inicial/)).toHaveAttribute('aria-invalid', 'true'));
    expect(mock.create).not.toHaveBeenCalled(); expect(screen.getByLabelText(/Password inicial|Contraseña inicial/)).toBeVisible();
  });
  it('sends positive decimal vehicle capacity as a number and never shows the password in a success toast', async () => {
    open(); basics(); fill(/Password inicial|Contraseña inicial/, 'OnlyLocal-QA-secret!');
    vehicle(); fill(/Capacidad/, '12.5');
    submit(); await waitFor(() => expect(mock.create).toHaveBeenCalledOnce());
    expect(mock.create.mock.calls[0][0].vehiculos[0].capacidad).toBe(12.5);
    await waitFor(() => expect(mock.success).toHaveBeenCalled());
    expect(JSON.stringify(mock.success.mock.calls)).not.toContain('OnlyLocal-QA-secret!');
  });
  it.each(['', '0', '-1', '10 tn', 'Infinity'])('keeps an invalid vehicle capacity %j visible without dropping the vehicle', async capacity => {
    open(); basics(); fill(/Password inicial|Contraseña inicial/, 'OnlyLocal-QA-secret!');
    vehicle(); fill(/Capacidad/, capacity);
    submit(); await waitFor(() => expect(screen.getByLabelText(/Capacidad/)).toHaveAttribute('aria-invalid', 'true'));
    expect(mock.create).not.toHaveBeenCalled(); expect(screen.getByLabelText(/Patente/)).toHaveValue('QA123ZZ');
  });
  it.each([['Ano', ''], ['Ano', '2026.5'], ['Vencimiento', '']])('does not invent a missing or invalid vehicle %s (%j)', async (label, value) => {
    open(); basics(); fill(/Password inicial|Contraseña inicial/, 'OnlyLocal-QA-secret!');
    vehicle(); fill(/Capacidad/, '12500'); fill(new RegExp(label), value); submit();
    await waitFor(() => expect(screen.getByLabelText(new RegExp(label))).toHaveAttribute('aria-invalid', 'true')); expect(mock.create).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Patente/)).toHaveValue('QA123ZZ');
  });
  it('blocks double submission synchronously and allows retry after a server failure without losing the form', async () => {
    let reject!: (value: unknown) => void;
    mock.create.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    open(); basics(); fill(/Password inicial|Contraseña inicial/, 'OnlyLocal-QA-secret!'); step('Confirmar');
    const button = screen.getByRole('button', { name: 'Crear Transportista' });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(mock.create).toHaveBeenCalledOnce();
    await act(async () => reject(new Error('QA failure')));
    fireEvent.click(button); await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(2));
    expect(mock.create.mock.calls[1][0].razonSocial).toBe('QA Transporte');
  });
  it('preserves edit credentials and does not resend existing fleet as new vehicles', async () => {
    mock.existing = { id: 'qa', razonSocial: 'QA Transporte', cuit: '30-12345678-9', email: 'qa@night-qa.invalid', vehiculos: [{ patente: 'QA123ZZ', capacidad: 12.5 }], choferes: [] };
    open('transportista', true); step('Confirmar'); step('Guardar Cambios');
    await waitFor(() => expect(mock.update).toHaveBeenCalledOnce());
    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.update.mock.calls[0][0].data).not.toHaveProperty('password');
    expect(mock.update.mock.calls[0][0].data).not.toHaveProperty('vehiculos');
  });
  it('does not offer fleet editing that the general edit endpoint cannot save', () => {
    mock.existing = { id: 'qa', razonSocial: 'QA Transporte', cuit: '30-12345678-9', email: 'qa@night-qa.invalid',
      vehiculos: [{ patente: 'QA123ZZ', capacidad: 12.5, anio: 2026 }], choferes: [{ nombre: 'QA Chofer', dni: '000' }] };
    open('transportista', true);
    for (const name of ['Vehiculos', 'Choferes']) {
      step(name);
      expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Administrar flota/ })).toHaveAttribute('href', '/admin/actores/transportistas/qa');
      expect(screen.getByRole('link', { name: /Administrar flota/ })).toHaveAttribute('target', '_blank');
    }
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('names the remove controls and removes only the selected draft entry', () => {
    open(); basics(); fill(/Contraseña inicial/, 'OnlyLocal-QA-secret!');
    step('Vehiculos'); step('Agregar');
    const remove = screen.getByRole('button', { name: 'Quitar vehículo 1' });
    expect(remove.className).toContain('min-h-11'); fireEvent.click(remove);
    expect(screen.queryByLabelText(/Patente/)).not.toBeInTheDocument();
    step('Choferes'); step('Agregar');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar chofer 1' }));
    expect(screen.queryByLabelText(/DNI/)).not.toBeInTheDocument();
  });
  it('keeps the fleet destination inside the app basename', () => {
    mock.existing = { id: 'qa', razonSocial: 'QA Transporte', cuit: '30-12345678-9', email: 'qa@night-qa.invalid', vehiculos: [], choferes: [] };
    open('transportista', true, '/app'); step('Vehiculos');
    expect(screen.getByRole('link', { name: /Administrar flota/ })).toHaveAttribute('href', '/app/admin/actores/transportistas/qa');
  });
  it.each(['generador', 'operador', 'transportista'] as const)('%s never edits an unavailable or mismatched registry record', type => {
    mock.existing = { id: 'wrong-actor', razonSocial: 'Do not reuse', cuit: '30-12345678-9', email: 'qa@night-qa.invalid' };
    open(type, true); expect(screen.queryByLabelText('Razon Social *')).toBeNull(); expect(screen.getByRole('alert')).toHaveTextContent('No se pudo verificar');
    expect(mock.update).not.toHaveBeenCalled();
  });
  it.each(['generador', 'operador', 'transportista'] as const)('%s keeps current edits when the same registry is refetched', type => {
    mock.existing = { id: 'qa', razonSocial: 'QA original', cuit: '30-12345678-9', email: 'qa@night-qa.invalid' };
    open(type, true); mock.existing = { ...mock.existing as object, razonSocial: 'QA server refetch' };
    fill(/Razon Social/, 'QA current edit'); expect(screen.getByLabelText('Razon Social *')).toHaveValue('QA current edit');
    expect(mock.update).not.toHaveBeenCalled();
  });
  it.each(['generador', 'operador', 'transportista'] as const)('%s exposes and retains coordinates even when real and fiscal addresses coincide', type => {
    mock.existing = { id: 'qa', razonSocial: 'QA coordenada', cuit: '30-12345678-9', email: 'qa@night-qa.invalid', latitud: 0, longitud: -68 };
    open(type, true); if (type !== 'transportista') step('Domicilios');
    expect(screen.getByLabelText(/Coordenadas/)).toHaveValue('0, -68'); expect(mock.update).not.toHaveBeenCalled();
  });
  it.each(['generador', 'operador', 'transportista'] as const)('%s sends a valid zero coordinate when saving the verified record', async type => {
    mock.existing = { id: 'qa', razonSocial: 'QA coordenada', cuit: '30-12345678-9', email: 'qa@night-qa.invalid', latitud: 0, longitud: -68 };
    open(type, true); step(type === 'transportista' ? 'Confirmar' : 'Adjuntos'); step('Guardar Cambios');
    await waitFor(() => expect(mock.update).toHaveBeenCalledOnce()); expect(mock.update.mock.calls[0][0].data).toMatchObject({ latitud: 0, longitud: -68 });
  });
  for (const type of ['generador', 'operador', 'transportista'] as const) it.each(['not-a-number, -68', '91, -68', '-32, 181', ', -68'])(`${type} refuses invalid coordinates %j without losing the text`, async value => {
    mock.existing = { id: 'qa', razonSocial: 'QA coordenada', cuit: '30-12345678-9', email: 'qa@night-qa.invalid' };
    open(type, true); if (type !== 'transportista') step('Domicilios'); fill(/Coordenadas/, value);
    step(type === 'transportista' ? 'Confirmar' : 'Adjuntos'); const save = screen.queryByRole('button', { name: 'Guardar Cambios', exact: true }); if (save) fireEvent.click(save);
    await waitFor(() => expect(screen.getByLabelText(/Coordenadas/)).toHaveAttribute('aria-invalid', 'true'));
    expect(mock.update).not.toHaveBeenCalled(); expect(screen.getByLabelText(/Coordenadas/)).toHaveValue(value);
  });
  it('does not drop an incomplete driver or invent an expiry', async () => {
    open(); basics(); fill(/Contraseña inicial/, 'OnlyLocal-QA-secret!');
    step('Choferes'); step('Agregar'); fill(/Nombre \*/, 'QA Chofer'); fill(/DNI/, '00000000');
    submit();
    await waitFor(() => expect(screen.getByLabelText(/Vencimiento/)).toHaveAttribute('aria-invalid', 'true'));
    expect(mock.create).not.toHaveBeenCalled(); expect(screen.getByLabelText(/Nombre \*/)).toHaveValue('QA Chofer');
  });
  it.each(['transportista', 'generador', 'operador'] as const)('%s shows credential errors inline without stacking notices over the form', type => {
    open(type); basics();
    if (type !== 'transportista') step('Regulatorio');
    const input = screen.getByLabelText(/Password [Ii]nicial|Contraseña inicial/);
    for (const value of ['short', '30123456789']) {
      fireEvent.change(input, { target: { value } });
      step(type === 'transportista' ? 'Siguiente' : 'Continuar');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    }
    expect(mock.error).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
  it.each([
    ['generador', 'short'], ['generador', '30123456789'], ['generador', ''],
    ['operador', 'short'], ['operador', '30123456789'], ['operador', ''],
  ] as const)('%s also blocks invalid initial password %j before confirmation', (type, password) => {
    open(type); basics(); step('Regulatorio'); fill(/Password Inicial/, password);
    step('Continuar'); expect(screen.getByLabelText(/Password Inicial/)).toHaveAttribute('aria-invalid', 'true'); expect(mock.create).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Password Inicial/)).toBeVisible();
  });
});
