import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NuevoManifiestoPage from '../../pages/manifiestos/NuevoManifiestoPage';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

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
  useCatalogoGeneradores: () => ({ data: [{ id: 'generador-1', razonSocial: 'Generador QA' }] }),
  useCatalogoTransportistas: () => ({ data: [
    { id: 'trans-y8', razonSocial: 'Transporte Y8', corrientesAutorizadas: 'Y8',
      vehiculos: [{ id: 'v1', patente: 'QA001', marca: 'QA', modelo: 'Uno', activo: true }, { id: 'v2', patente: 'QA002', marca: 'QA', modelo: 'Dos', activo: true }, { id: 'v-off', patente: 'INACTIVO', activo: false }],
      choferes: [{ id: 'c1', nombre: 'QA', apellido: 'Uno', dni: '00001', activo: true }, { id: 'c2', nombre: 'QA', apellido: 'Dos', dni: '00002', activo: true }] },
    { id: 'trans-y9', razonSocial: 'Transporte Y9', corrientesAutorizadas: 'Y9' },
    { id: 'trans-both', razonSocial: 'Transporte ambas', corrientesAutorizadas: 'Y8, Y9' },
    { id: 'trans-unknown', razonSocial: 'Transporte sin corrientes' },
  ] }),
  useCatalogoOperadores: () => ({ data: [{
    id: 'operador-1', razonSocial: 'Operador QA', modalidades: ['FIJO'],
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

describe('manifest transport compatibility after changing residues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'manifest-1', numero: 'QA-1' });
    HTMLElement.prototype.scrollIntoView = vi.fn();
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
    fireEvent.click(screen.getByRole('button', { name: 'Crear Manifiesto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][0]).toEqual(mocks.create.mock.calls[0][0]);
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
});
