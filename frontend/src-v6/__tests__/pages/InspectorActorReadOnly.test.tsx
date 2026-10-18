import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GeneradorDetallePage from '../../pages/admin/GeneradorDetallePage';
import ProtectedRoute from '../../components/ProtectedRoute';

const mock = vi.hoisted(() => ({ role: 'GENERADOR', write: vi.fn(), download: vi.fn(), error: vi.fn() }));
vi.mock('../../services/generador-fiscal.service', () => ({ generadorFiscalService: { downloadDocumento: mock.download } }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: { documentos: [] } } }) } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: mock.error } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { rol: mock.role, esInspector: true }, isLoading: false, isRestricted: false }) }));
vi.mock('../../hooks/useActores', () => ({ useGenerador: () => ({ data: { id: 'g-1', razonSocial: 'Planta de prueba', cuit: '30-12345678-9', activo: true } }) }));
vi.mock('../../hooks/useEnrichment', () => ({ useGeneradoresEnrichment: () => ({ data: {} }) }));
vi.mock('../../components/TrazabilidadTimeline', () => ({ default: () => null }));
vi.mock('../../pages/inspecciones/ActorInspectionsPanel', () => ({ ActorInspectionsPanel: () => null }));
vi.mock('../../hooks/useGeneradorFiscal', () => {
  const mutation = () => ({ mutateAsync: mock.write, isPending: false });
  return {
    usePagosTEF: () => ({ data: [{ id: 'p-1', anio: 2026, montoTEF: 100, habilitado: true }] }),
    useDDJJ: () => ({ data: [{ id: 'd-1', anio: 2026, presentada: true }] }),
    useDocumentos: () => ({ data: [{ id: 'doc-1', nombre: 'Declaración.pdf', nombreOriginal: 'Declaración.pdf', tipo: 'OTRO', estado: 'PENDIENTE', tamanio: 1000 }] }),
    useCreatePago: mutation, useUpdatePago: mutation, useDeletePago: mutation, useCreateDDJJ: mutation,
    useUpdateDDJJ: mutation, useDeleteDDJJ: mutation, useUploadDocumento: mutation, useRevisarDocumento: mutation, useDeleteDocumento: mutation,
  };
});
function open(allowInspector: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/actores/generadores/g-1']}><Routes>
    <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_GENERADOR']} allowInspector={allowInspector} />}>
      <Route path="/admin/actores/generadores/:id" element={<GeneradorDetallePage />} />
    </Route>
  </Routes></MemoryRouter></QueryClientProvider>);
}
describe('inspector actor consultation', () => {
  beforeEach(() => {
    mock.role = 'GENERADOR'; mock.write.mockClear(); mock.error.mockClear();
    mock.download.mockReset().mockResolvedValue(undefined);
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => vi.restoreAllMocks());
  it('does not grant administrative routes unless explicitly designated read-only', () => {
    open(false);
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });
  it('can read the same ficha without payment, declaration, upload, review or delete controls', () => {
    open(true);
    expect(screen.getByRole('heading', { name: 'Planta de prueba' })).toBeInTheDocument();
    expect(screen.queryByText('Cargar certificado oficial')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Situacion Fiscal' }));
    expect(screen.queryByRole('button', { name: 'Registrar Pago' })).not.toBeInTheDocument();
    expect(screen.queryByText('Acciones')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'DDJJ y Documentos' }));
    expect(screen.queryByRole('button', { name: 'Registrar DDJJ' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Arrastra un archivo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Acciones')).not.toBeInTheDocument();
    expect(mock.write).not.toHaveBeenCalled();
  });
  it('preserves administrative editing for the authorized role', () => {
    mock.role = 'ADMIN_GENERADOR'; open(true);
    fireEvent.click(screen.getByRole('tab', { name: 'DDJJ y Documentos' }));
    const register = screen.getByRole('button', { name: 'Registrar DDJJ' });
    expect(register).toHaveClass('min-h-11');
    expect(register).not.toHaveClass('sm:min-h-9');
    expect(screen.getByText(/Arrastra un archivo/)).toBeInTheDocument();
    fireEvent.click(register);
    expect(screen.getByRole('heading', { name: 'Registrar DDJJ' })).toBeInTheDocument();
  });
  it('downloads in read-only consultation through the authenticated service, not an unauthenticated popup', async () => {
    open(true);
    fireEvent.click(screen.getByRole('tab', { name: 'DDJJ y Documentos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Declaración.pdf', exact: true }));
    await waitFor(() => expect(mock.download).toHaveBeenCalledWith('doc-1', 'Declaración.pdf'));
    expect(window.open).not.toHaveBeenCalled();
    expect(mock.write).not.toHaveBeenCalled();
  });
  it('reports a failed download and leaves the document available for retry', async () => {
    mock.download.mockRejectedValue(new Error('offline'));
    open(true);
    fireEvent.click(screen.getByRole('tab', { name: 'DDJJ y Documentos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Declaración.pdf', exact: true }));
    await waitFor(() => expect(mock.error).toHaveBeenCalledWith('No se pudo descargar el documento', 'Verificá la conexión e intentá nuevamente.'));
    expect(screen.getByRole('button', { name: 'Descargar Declaración.pdf', exact: true })).toBeEnabled();
    expect(window.open).not.toHaveBeenCalled();
    expect(mock.write).not.toHaveBeenCalled();
  });
});
