import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GeneradorDetallePage from '../../pages/admin/GeneradorDetallePage';
import ProtectedRoute from '../../components/ProtectedRoute';

const mock = vi.hoisted(() => ({ role: 'GENERADOR', write: vi.fn() }));
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
  render(<MemoryRouter initialEntries={['/admin/actores/generadores/g-1']}><Routes>
    <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_GENERADOR']} allowInspector={allowInspector} />}>
      <Route path="/admin/actores/generadores/:id" element={<GeneradorDetallePage />} />
    </Route>
  </Routes></MemoryRouter>);
}
describe('inspector actor consultation', () => {
  beforeEach(() => { mock.role = 'GENERADOR'; mock.write.mockClear(); });
  it('does not grant administrative routes unless explicitly designated read-only', () => {
    open(false);
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });
  it('can read the same ficha without payment, declaration, upload, review or delete controls', () => {
    open(true);
    expect(screen.getByRole('heading', { name: 'Planta de prueba' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Registrar DDJJ' })).toBeInTheDocument();
    expect(screen.getByText(/Arrastra un archivo/)).toBeInTheDocument();
  });
});
