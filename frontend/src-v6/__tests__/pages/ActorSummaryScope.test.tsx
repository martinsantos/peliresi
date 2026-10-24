import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminOperadoresPage from '../../pages/admin/AdminOperadoresPage';
import TransportistasPage from '../../pages/actores/TransportistasPage';

const records = [
  { id: 'qa-active', razonSocial: 'QA Activo', cuit: '99000000001', activo: true, vehiculos: [], choferes: [], tratamientos: [] },
  { id: 'qa-inactive', razonSocial: 'QA Inactivo', cuit: '99000000002', activo: false, vehiculos: [], choferes: [], tratamientos: [] },
];
const queries = vi.hoisted(() => ({ operadores: vi.fn(), transportistas: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonateUser: vi.fn() }) }));
vi.mock('../../hooks/useEnrichment', () => ({ useOperadoresEnrichment: () => ({ data: { operadores: {} } }) }));
vi.mock('../../hooks/useActores', () => ({
  useOperadores: (filters: unknown) => { queries.operadores(filters); return { data: { items: records, total: 52, totalPages: 3 }, isLoading: false, isError: false }; },
  useTransportistas: (filters: unknown) => { queries.transportistas(filters); return { data: { items: records, total: 52, totalPages: 3 }, isLoading: false, isError: false }; },
  useDeleteOperador: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTransportista: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTransportista: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTransportista: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('Actor summaries disclose the actual denominator', () => {
  it.each([
    ['operadores', AdminOperadoresPage], ['transportistas', TransportistasPage],
  ] as const)('%s filters active state on the server across all pages', (kind, Page) => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name:'Filtros'}));
    fireEvent.click(screen.getByRole('button', {name:'Estado'}));
    fireEvent.click(screen.getByRole('option', {name:'Inactivo',exact:true}));
    expect(queries[kind]).toHaveBeenLastCalledWith(expect.objectContaining({activo:false,page:1}));
    expect(screen.getByRole('button',{name:'Abrir QA Inactivo'})).toBeInTheDocument();
  });
  it.each([
    ['operadores', AdminOperadoresPage, 'Total Operadores'],
    ['transportistas', TransportistasPage, 'Total Transportistas'],
  ] as const)('%s never describe two loaded records as 52 global active/inactive records', (_kind, Page, totalLabel) => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    expect(screen.getByText(totalLabel).parentElement).toHaveTextContent('52');
    for (const label of ['Activos · esta página', 'Inactivos · esta página']) {
      const caption = screen.getByText(label);
      expect(caption.parentElement).toHaveTextContent('1');
      expect(caption).toHaveClass('whitespace-normal', 'break-words');
    }
    expect(screen.queryByText('Activos', { exact: true })).toBeNull();
  });

  it('keeps the complete transporter label inside a single padded surface', () => {
    render(<MemoryRouter><TransportistasPage /></MemoryRouter>);
    const caption = screen.getByText('Total Transportistas');
    expect(caption).toHaveClass('whitespace-normal', 'break-words');
    expect(caption.parentElement).toHaveClass('min-w-0');
    expect(screen.getByText('Vencen en 30 días · esta página').parentElement).toHaveTextContent('0');
  });
});
