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
    { id: 'trans-y8', razonSocial: 'Transporte Y8', corrientesAutorizadas: 'Y8' },
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
