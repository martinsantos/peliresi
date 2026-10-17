import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditarManifiestoPage from '../../pages/manifiestos/EditarManifiestoPage';

const mocks = vi.hoisted(() => ({ update: vi.fn(), manifiesto: null as Record<string, unknown> | null }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'gen-user', rol: 'GENERADOR' }, isAdmin: false, isGenerador: true }),
}));
vi.mock('../../hooks/useManifiestos', () => ({
  useManifiesto: () => ({ data: mocks.manifiesto, isLoading: false }),
  useUpdateManifiesto: () => ({ mutateAsync: mocks.update, isPending: false }),
}));
vi.mock('../../hooks/useCatalogos', () => ({
  useTiposResiduo: () => ({ data: [{ id: 'y8', codigo: 'Y8', nombre: 'Aceites' }] }),
  useCatalogoGeneradores: () => ({ data: [{ id: 'generador-1', razonSocial: 'Generador QA' }] }),
  useCatalogoTransportistas: () => ({ data: [{ id: 'trans-1', razonSocial: 'Transporte QA' }] }),
  useCatalogoOperadores: () => ({ data: [{ id: 'operador-1', razonSocial: 'Operador QA' }] }),
}));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

function draft(overrides: Record<string, unknown>) {
  return {
    id: 'm1', numero: 'QA-1', estado: 'BORRADOR', generadorId: 'generador-1',
    generador: { razonSocial: 'Generador QA' }, transportistaId: 'trans-1', operadorId: 'operador-1',
    modalidad: 'FIJO', observaciones: null, fechaRetiro: null, fechaEstimadaRetiro: '2026-11-20T00:00:00.000Z',
    residuos: [{ tipoResiduoId: 'y8', cantidad: 10, unidad: 'kg' }],
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/manifiestos/m1/editar']}>
      <Routes><Route path="/manifiestos/:id/editar" element={<EditarManifiestoPage />} /></Routes>
    </MemoryRouter>,
  );
}

function goToStep3() {
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
}

describe('editing a draft manifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({ id: 'm1' });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('saves an IN_SITU draft without requiring or sending a carrier', async () => {
    mocks.manifiesto = draft({ modalidad: 'IN_SITU', transportistaId: null });
    renderPage();
    goToStep3();
    expect(screen.queryByLabelText('Transportista *')).not.toBeInTheDocument();
    expect(screen.getByText(/No se requiere transporte/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const sent = mocks.update.mock.calls[0][0];
    expect(sent).not.toHaveProperty('transportistaId');
    expect(sent).not.toHaveProperty('modalidad');
    expect(sent).toMatchObject({ id: 'm1', operadorId: 'operador-1' });
  });

  it('does not offer an editable estimated pickup date that the update would discard', () => {
    mocks.manifiesto = draft({});
    renderPage();
    goToStep3();
    expect(screen.queryByLabelText(/Fecha estimada de retiro/i)).not.toBeInTheDocument();
    expect(screen.getByText('20/11/2026')).toBeInTheDocument();
  });

  it('keeps requiring the carrier for a FIJO draft and focuses it', () => {
    mocks.manifiesto = draft({ transportistaId: null });
    renderPage();
    goToStep3();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Transportista *')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Transportista *')).toHaveFocus();
  });

  it('returns to the step of the invalid field instead of only showing a toast', () => {
    mocks.manifiesto = draft({ residuos: [{ tipoResiduoId: 'y8', cantidad: 0, unidad: 'kg' }] });
    renderPage();
    goToStep3();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad *')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Cantidad *')).toHaveFocus();
  });
});
