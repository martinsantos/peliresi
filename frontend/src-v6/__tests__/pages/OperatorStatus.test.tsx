import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import OperadoresPage from '../../pages/actores/OperadoresPage';
vi.mock('../../hooks/useActores', () => ({
  useOperadores: () => ({ data: { items: [
    { id: 'active', razonSocial: 'QA activo', cuit: '30000000001', activo: true, tratamientos: [] },
    { id: 'inactive', razonSocial: 'QA inactivo', cuit: '30000000002', activo: false, tratamientos: [] },
  ] }, isLoading: false }),
  useCreateOperador: () => ({ mutateAsync: vi.fn() }), useDeleteOperador: () => ({ mutateAsync: vi.fn() }),
}));
describe('operator status reflects the registration flag, not unmeasured presence', () => {
  it('labels a registered active operator as Activo rather than En línea', () => {
    render(<MemoryRouter><OperadoresPage /></MemoryRouter>);
    const row = within(screen.getByRole('table')).getByText('QA activo').closest('tr')!;
    expect(within(row).getByText('Activo', { exact: true })).toBeVisible();
    expect(screen.queryByText(/En l[ií]nea/)).toBeNull();
  });
  it('labels an inactive registration without inventing an operational plant condition', () => {
    render(<MemoryRouter><OperadoresPage /></MemoryRouter>);
    const row = within(screen.getByRole('table')).getByText('QA inactivo').closest('tr')!;
    expect(within(row).getByText('Inactivo', { exact: true })).toBeVisible();
    expect(screen.queryByText('Fuera de servicio')).toBeNull();
  });
});
